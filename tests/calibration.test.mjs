import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/core.js';

export const targets=[.1,.5,.9].flatMap(x=>[.08,.5,.92].map(y=>({x,y})));
const withPose=(x,y,poseY)=>[.4+.08*x,.03+.06*y,.4+.08*x,.03+.06*y,.5,.5,.3,0,poseY];
test('tiny head motion correlated with training target must not replace eye signal',()=>{
  const train=targets.flatMap(target=>Array.from({length:15},()=>({features:withPose(target.x,target.y,.2+.03*(target.y-.5)),target})));
  const model=core.fitCalibration(train);
  const check=[.09,.5,.91].map(y=>({features:withPose(.5,y,.2),target:{x:.5,y}}));
  const result=core.validateCalibration(model,check);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(core.commandZone(core.predict(model,check[0].features)),'up');
  assert.equal(core.commandZone(core.predict(model,check[2].features)),'down');
});

function face(width,height,angle=0){
  const p=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
  const set=(i,x,y)=>{const a=angle*Math.PI/180;const dx=x-320,dy=y-240;p[i]={x:(320+dx*Math.cos(a)-dy*Math.sin(a))/width,y:(240+dx*Math.sin(a)+dy*Math.cos(a))/height,z:0};};
  for(const [a,b,t,bot,iris,cx] of [[33,133,159,145,468,250],[362,263,386,374,473,390]]){
    set(a,cx-30,230);set(b,cx+30,230);set(t,cx,222);set(bot,cx,238);set(iris,cx+5,234);
  }
  set(1,320,270);return {faceLandmarks:[p]};
}
test('eye geometry is invariant to physical roll in non-square camera frames',()=>{
  for(const [w,h] of [[640,480],[640,360]]){
    const base=core.extractFeatures(face(w,h,0),w,h);
    const rolled=core.extractFeatures(face(w,h,20),w,h);
    assert.ok(base.valid&&rolled.valid);
    for(let i=0;i<4;i++)assert.ok(Math.abs(base.features[i]-rolled.features[i])<1e-8,`ratio ${w}/${h}, feature ${i}: ${base.features[i]} vs ${rolled.features[i]}`);
  }
});
test('same pixel eye geometry gives same eye features across camera aspect ratios',()=>{
  const a=core.extractFeatures(face(640,480),640,480),b=core.extractFeatures(face(640,360),640,360);
  for(let i=0;i<4;i++)assert.ok(Math.abs(a.features[i]-b.features[i])<1e-8);
});

test('point-balanced robust training withstands isolated spikes and unequal frame counts',()=>{
  const clean=targets.flatMap(target=>Array.from({length:24},()=>({features:withPose(target.x,target.y,.2),target})));
  const mixed=clean.map((s,i)=>i%24===0?{...s,features:s.features.map((v,j)=>j<4?v+.2:v)}:s);
  mixed.push(...clean.filter(s=>s.target.x===.1&&s.target.y===.08));
  const model=core.fitCalibration(mixed),normal=core.fitCalibration(clean);
  for(const y of [.09,.5,.91]){
    const f=withPose(.5,y,.2);assert.ok(Math.abs(core.predict(model,f).y-core.predict(normal,f).y)<1e-10);
    assert.ok(Math.abs(core.predict(model,f).y-y)<.01);
  }
  const quality=core.summarizePoint(mixed.slice(0,24));assert.equal(quality.kept,23);assert.equal(quality.ok,true);
});
test('held-out noisy frames are not discarded to manufacture validation success',()=>{
  const train=targets.flatMap(target=>Array.from({length:24},()=>({features:withPose(target.x,target.y,.2),target})));
  const model=core.fitCalibration(train);
  const check=[.09,.5,.91].flatMap(y=>Array.from({length:24},()=>({features:withPose(.5,y,.2),target:{x:.5,y}})));
  check[0].features=withPose(.5,.95,.2);
  const result=core.validateCalibration(model,check);assert.equal(result.ok,false);
  assert.ok(result.reasons.includes('일부 프레임의 최대 위치 오차 초과'));
  assert.equal(result.points[0].count,24);
});
test('diagnostics explain region failures even when mean error is within limit',()=>{
  const model={mean:[0],scale:[1],weights:[[.5,0],[.1,.8]]};
  const check=[.09,.5,.91].map(y=>({features:[y],target:{x:.5,y}}));
  const result=core.validateCalibration(model,check);
  assert.ok(result.meanError<.10);assert.equal(result.ok,false);
  assert.ok(result.reasons.includes('위 영역 구분 부족'));assert.ok(result.reasons.includes('아래 영역 구분 부족'));
  assert.equal(result.points.length,3);
});
