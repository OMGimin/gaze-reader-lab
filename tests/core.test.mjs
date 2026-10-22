import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentGate, fitCalibration, predict, validateCalibration, extractFeatures, isAllowedUrl } from '../src/core.js';

const feed = (gate, y, from, to, extra = {}) => {
  let actions = [];
  for (let t = from; t <= to; t += 50) {
    const result = gate.update({ x: .5, y, valid: true, ...extra }, t);
    if (result.action) actions.push(result.action);
  }
  return actions;
};
test('paused by default; reading never scrolls', () => {
  const gate = new IntentGate();
  assert.deepEqual(feed(gate, .94, 0, 3000), []);
  gate.resume();
  assert.deepEqual(feed(gate, .5, 4000, 8000), []);
});
test('neutral then deliberate dwell advances once, must return to neutral', () => {
  const gate = new IntentGate(); gate.resume();
  assert.deepEqual(feed(gate, .94, 0, 2000), []);
  feed(gate, .5, 2100, 2600);
  assert.deepEqual(feed(gate, .94, 2650, 6000), ['down']);
  feed(gate, .5, 6050, 6600);
  assert.deepEqual(feed(gate, .06, 6650, 8000), ['up']);
});
test('interrupted dwell and stale frames cannot trigger movement', () => {
  const gate = new IntentGate(); gate.resume();
  feed(gate, .5, 0, 500); feed(gate, .94, 550, 1000);
  gate.update({valid:false}, 1050);
  assert.deepEqual(feed(gate, .94, 1100, 2000), []);
  assert.equal(gate.paused, true);
  gate.resume(); feed(gate, .5, 2100, 2600); feed(gate,.94,2650,3000);
  assert.equal(gate.update({valid:true,x:.5,y:.94}, 4000).action, null);
  assert.equal(gate.paused, true);
});
test('out of bounds and non-finite estimates fail closed', () => {
  for (const point of [{x:NaN,y:.94},{x:.5,y:2},{x:Infinity,y:.4}]) {
    const gate = new IntentGate(); gate.resume(); feed(gate,.5,0,500);
    assert.equal(gate.update({valid:true,...point},550).action,null);
    assert.equal(gate.paused,true);
  }
});
const samples = [];
for (const x of [.1,.5,.9]) for (const y of [.08,.5,.92]) {
  for(let i=0;i<12;i++) samples.push({ features:[x,y,x-y], target:{x,y} });
}
test('calibration maps measured features, independent validation rejects poor accuracy', () => {
  const model = fitCalibration(samples);
  const point = predict(model,[.3,.7,-.4]);
  assert.ok(Math.abs(point.x-.3)<.02 && Math.abs(point.y-.7)<.02);
  const validation = [.1,.5,.9].map(y=>({features:[.5,y,.5-y],target:{x:.5,y}}));
  assert.equal(validateCalibration(model,validation).ok,true);
  assert.equal(validateCalibration(model,validation.map(s=>({...s,target:{x:.5,y:1-s.target.y}}))).ok,false);
});
test('insufficient or invariant calibration is rejected', () => {
  assert.throws(()=>fitCalibration([]));
  assert.throws(()=>fitCalibration(samples.map(s=>({...s,features:[1,1,1]}))));
});
test('no face / multiple faces / bad landmarks are invalid', () => {
  assert.equal(extractFeatures({faceLandmarks:[]}),null);
  assert.equal(extractFeatures({faceLandmarks:[[],[]]}),null);
  assert.equal(extractFeatures({faceLandmarks:[[]]}),null);
});
test('scope only permits Naver episode pages and local fixture', () => {
  assert.equal(isAllowedUrl('https://comic.naver.com/webtoon/detail?titleId=1&no=1'),true);
  assert.equal(isAllowedUrl('http://127.0.0.1:4173/'),true);
  for(const url of ['https://evil.com','https://comic.naver.com.evil.com/webtoon/detail','https://comic.naver.com/webtoon/list','http://comic.naver.com/webtoon/detail','http://127.0.0.1:9999/']) assert.equal(isAllowedUrl(url),false);
});
test('compressed calibration must not pass when command zones are unreachable',()=>{
  const model={mean:[0],scale:[1],weights:[[.5,0],[.1,.8]]};
  const samples=[.09,.5,.91,.5,.5].map(y=>({features:[y],target:{x:.5,y}}));
  assert.equal(validateCalibration(model,samples).ok,false);
});

test('short blink cancels dwell; prolonged blink pauses; restart clears old blink duration',()=>{
  const g=new IntentGate();g.resume();feed(g,.5,0,500);feed(g,.94,550,900);
  g.update({valid:false,reason:'blink'},950);g.update({valid:false,reason:'blink'},1050);
  assert.equal(g.paused,false);assert.equal(g.armed,false);
  feed(g,.94,1100,2500);assert.equal(g.armed,false);
  g.update({valid:false,reason:'blink'},2550);g.update({valid:false,reason:'blink'},2800);
  assert.equal(g.paused,true);g.resume();g.update({valid:false,reason:'blink'},5000);assert.equal(g.paused,false);
});
