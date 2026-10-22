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
