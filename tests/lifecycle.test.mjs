import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {CameraTracker} from '../src/tracker.js';

test('disconnected camera port stops once without recursive messaging',async()=>{
  const source=(await readFile('src/camera.js','utf8')).replace("import {CameraTracker} from './tracker.js';",'');
  const elements=new Map();const listeners={};let stops=0,posts=0;
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{addEventListener(){},textContent:'',disabled:false});return elements.get(selector);};
  class FakeTracker{constructor(v,onSample,onStatus){Object.assign(this,{onSample,onStatus});}stop(){stops++;this.onSample({valid:false});this.onStatus('stop');}destroy(){this.stop();}}
  vm.runInNewContext(source,{CameraTracker:FakeTracker,document:{querySelector:element},location:{protocol:'chrome-extension:'},chrome:{runtime:{connect:()=>({postMessage(){posts++;throw Error('disconnected');},onMessage:{addListener(fn){listeners.message=fn;}},onDisconnect:{addListener(fn){listeners.disconnect=fn;}}})}},window:{addEventListener(){}}});
  listeners.disconnect();assert.equal(stops,1);assert.equal(posts,0);assert.equal(element('#start-camera').disabled,true);
});

test('stop while getUserMedia is pending releases the eventual fake stream',async()=>{
  let resolveStream;let stops=0;const statuses=[];
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolveStream=r)}}});
  try{
    const video={srcObject:null,play:async()=>{}};
    const tracker=new CameraTracker(video,()=>{},s=>statuses.push(s));tracker.load=async()=>{};
    const pending=tracker.start();await new Promise(r=>setImmediate(r));
    tracker.stop();resolveStream({getTracks:()=>[{stop(){stops++;}}]});await pending;
    assert.equal(stops,1);assert.equal(video.srcObject,null);assert.equal(tracker.running,false);
  }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});

test('stop clears an active fake stream and sends invalid input',()=>{
  let stopped=0;const samples=[],video={srcObject:{}};
  const tracker=new CameraTracker(video,s=>samples.push(s),()=>{});
  tracker.stream={getTracks:()=>[{stop(){stopped++;}}]};tracker.running=true;
  tracker.stop();assert.equal(stopped,1);assert.equal(video.srcObject,null);assert.equal(samples.at(-1).valid,false);
});

test('pending camera start must stay disabled after the extension session closes',async()=>{
  const source=(await readFile('src/camera.js','utf8')).replace("import {CameraTracker} from './tracker.js';",'');
  for(const reason of ['disconnect','stop']){
    const elements=new Map(),listeners={};let settle,startCalls=0;
    const element=selector=>{if(!elements.has(selector))elements.set(selector,{addEventListener(event,fn){this[event]=fn;},textContent:'',disabled:false});return elements.get(selector);};
    class FakeTracker{constructor(v,onSample,onStatus){Object.assign(this,{onSample,onStatus});}start(){startCalls++;return new Promise(r=>settle=r);}stop(){this.onSample({valid:false});this.onStatus('stop');}destroy(){this.stop();}}
    vm.runInNewContext(source,{CameraTracker:FakeTracker,document:{querySelector:element},location:{protocol:'chrome-extension:'},chrome:{runtime:{connect:()=>({postMessage(){},onMessage:{addListener(fn){listeners.message=fn;}},onDisconnect:{addListener(fn){listeners.disconnect=fn;}}})}},window:{addEventListener(){}}});
    const button=element('#start-camera'),pending=button.click();
    if(reason==='disconnect')listeners.disconnect();else listeners.message({type:'stop'});
    assert.equal(button.disabled,true);settle();await pending;
    assert.equal(button.disabled,true);await button.click();assert.equal(startCalls,1);
  }
});

test('destroy during pending model creation closes the eventual model and prevents reuse',async()=>{
  const source=(await readFile('src/tracker.js','utf8')).replace(/^import .*;\n/gm,'').replace('export class CameraTracker','class CameraTracker')+'\nglobalThis.Tracker=CameraTracker;';
  let resolveModel,closes=0;
  const ctx={FilesetResolver:{forVisionTasks:async()=>({})},FaceLandmarker:{createFromOptions:()=>new Promise(r=>resolveModel=r)},clearInterval,extractFeatures(){}};
  vm.runInNewContext(source,ctx);
  const tracker=new ctx.Tracker({srcObject:null},()=>{},()=>{});
  const pending=tracker.load();await new Promise(r=>setImmediate(r));
  tracker.destroy();resolveModel({close(){closes++;}});await pending;
  assert.equal(closes,1);assert.equal(tracker.model,null);
  await assert.rejects(()=>tracker.load(),/종료된/);
  await tracker.start();assert.equal(tracker.running,false);
  tracker.destroy();assert.equal(closes,1);
});

async function withFakeCamera(run){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const streams=[];
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>streams.shift()}}});
  try{await run(streams);}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
}
function fakeStream(){
  const track={readyState:'live',stops:0,listeners:new Set(),stop(){this.stops++;this.readyState='ended';},addEventListener(_,fn){this.listeners.add(fn);this.lastListener=fn;},removeEventListener(_,fn){this.listeners.delete(fn);}};
  return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};
}
test('old stream ended callback cannot stop a restarted camera',async()=>{
  await withFakeCamera(async streams=>{
    const first=fakeStream(),second=fakeStream();streams.push(first,second);
    const tracker=new CameraTracker({srcObject:null,play:async()=>{}},()=>{},()=>{});tracker.load=async()=>{};
    try{await tracker.start();const oldEnded=first.track.lastListener;tracker.stop();
      assert.equal(first.track.listeners.size,0);await tracker.start();oldEnded();
      assert.equal(tracker.running,true);assert.equal(second.track.stops,0);
    }finally{tracker.destroy();}
  });
});
test('stream ending during pending play never becomes running',async()=>{
  await withFakeCamera(async streams=>{
    const stream=fakeStream();streams.push(stream);let playResolve;
    const tracker=new CameraTracker({srcObject:null,play:()=>new Promise(r=>playResolve=r)},()=>{},()=>{});tracker.load=async()=>{};
    const pending=tracker.start();await new Promise(r=>setImmediate(r));
    stream.track.readyState='ended';stream.track.lastListener();playResolve();await pending;
    assert.equal(tracker.running,false);assert.equal(tracker.video.srcObject,null);assert.equal(stream.track.listeners.size,0);
    tracker.destroy();
  });
});

test('persisted camera page restores a fresh camera-off document, not automatic capture',async()=>{
  const source=(await readFile('src/camera.js','utf8')).replace("import {CameraTracker} from './tracker.js';",'');
  const listeners={};let reloads=0,starts=0,destroys=0;
  class FakeTracker{start(){starts++;}destroy(){destroys++;}}
  vm.runInNewContext(source,{CameraTracker:FakeTracker,document:{querySelector:()=>({addEventListener(){}})},location:{protocol:'http:',reload(){reloads++;}},window:{addEventListener(name,fn){listeners[name]=fn;}}});
  listeners.pagehide();listeners.pageshow({persisted:false});assert.equal(reloads,0);
  listeners.pageshow({persisted:true});assert.equal(reloads,1);assert.equal(starts,0);assert.equal(destroys,1);
});

test('synchronous status callback stopping capture cannot leave a new interval',async()=>{
  await withFakeCamera(async streams=>{
    streams.push(fakeStream());
    const tracker=new CameraTracker({srcObject:null,play:async()=>{}},()=>{},text=>{if(text.startsWith('카메라 작동 중'))tracker.stop('disconnected');});tracker.load=async()=>{};
    try{await tracker.start();assert.equal(tracker.running,false);assert.equal(tracker.stream,null);assert.equal(tracker.timer,undefined);}finally{tracker.destroy();}
  });
});

test('disconnect while announcing permission wait never requests a camera',async()=>{
  await withFakeCamera(async streams=>{
    const stream=fakeStream();streams.push(stream);
    const tracker=new CameraTracker({srcObject:null,play:async()=>{}},()=>{},text=>{if(text.startsWith('카메라 허용'))tracker.stop('disconnected');});tracker.load=async()=>{};
    try{await tracker.start();assert.equal(streams.length,1);assert.equal(tracker.stream,null);assert.equal(tracker.running,false);}finally{tracker.destroy();}
  });
});
