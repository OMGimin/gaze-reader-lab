import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {isAllowedUrl} from '../src/core.js';
async function worker(){
  const events={},injections=[],windows=[],badges=[];
  const source=(await readFile('src/background.js','utf8')).replace("import {isAllowedUrl} from './core.js';",'');
  vm.runInNewContext(source,{isAllowedUrl,URL,chrome:{action:{onClicked:{addListener:f=>events.click=f},setBadgeText:async v=>badges.push(v),setTitle:async()=>{}},scripting:{executeScript:async v=>injections.push(v)},windows:{create:async v=>windows.push(v)},runtime:{getURL:p=>'chrome-extension://test/'+p,onConnect:{addListener:f=>events.connect=f}}}});
  return {events,injections,windows,badges};
}
function port(name,sender){const p={name,sender,sent:[],postMessage(v){p.sent.push(v);},onDisconnect:{addListener:f=>p.disconnect=f},onMessage:{addListener:f=>p.message=f}};return p;}

test('worker rejects unrelated sites and injects only the explicitly selected allowed tab',async()=>{
  const w=await worker();await w.events.click({id:5,url:'https://example.com'});assert.equal(w.injections.length,0);
  await w.events.click({id:6,url:'https://comic.naver.com/webtoon/detail?titleId=1&no=1'});
  assert.equal(w.injections.length,1);assert.equal(w.injections[0].target.tabId,6);assert.equal(w.windows.length,1);
});

test('worker routes features to bound tab and stops camera when reader closes',async()=>{
  const w=await worker();const r=port('reader',{tab:{id:6},url:'https://comic.naver.com/webtoon/detail?titleId=1&no=1'});w.events.connect(r);
  const wrong=port('camera',{url:'chrome-extension://test/camera.html?tab=9'});w.events.connect(wrong);assert.equal(wrong.sent[0].type,'stop');
  const c=port('camera',{url:'chrome-extension://test/camera.html?tab=6'});w.events.connect(c);c.message({type:'sample',sample:{valid:true,features:[1,2]}});
  assert.equal(r.sent[0].type,'sample');r.disconnect();assert.equal(c.sent.at(-1).type,'stop');
});
