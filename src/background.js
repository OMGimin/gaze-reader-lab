import {isAllowedUrl} from './core.js';
let reader=null,camera=null;
chrome.action.onClicked.addListener(async tab=>{
  if(!isAllowedUrl(tab.url)) {
    await chrome.action.setBadgeText({tabId:tab.id,text:'범위 밖'});
    await chrome.action.setTitle({tabId:tab.id,title:'네이버 웹툰 회차 또는 http://127.0.0.1:4173 에서 실행하세요'});return;
  }
  if(reader?.tabId===tab.id){reader.port.postMessage({type:'notice',text:'이미 연결됨 · 카메라 창을 확인하세요'});return;}
  reader?.port.postMessage({type:'close'});camera?.port.postMessage({type:'stop'});
  try {
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
    await chrome.windows.create({url:chrome.runtime.getURL(`camera.html?tab=${tab.id}`),type:'popup',width:400,height:570});
    await chrome.action.setBadgeText({tabId:tab.id,text:''});
  } catch {await chrome.action.setBadgeText({tabId:tab.id,text:'오류'});}
});
chrome.runtime.onConnect.addListener(port=>{
  if(port.name==='reader' && port.sender?.tab && isAllowedUrl(port.sender.url)) {
    const session={port,tabId:port.sender.tab.id};reader=session;
    port.onDisconnect.addListener(()=>{if(reader===session){reader=null;camera?.port.postMessage({type:'stop'});}});
    return;
  }
  if(port.name==='camera' && port.sender?.url?.startsWith(chrome.runtime.getURL('camera.html'))) {
    const tabId=Number(new URL(port.sender.url).searchParams.get('tab'));
    if(reader?.tabId!==tabId){port.postMessage({type:'stop'});return;}
    camera?.port.postMessage({type:'stop'});
    const session={port,tabId};camera=session;
    port.onMessage.addListener(message=>{
      if(camera!==session||reader?.tabId!==tabId)return;
      if(message.type==='sample')reader.port.postMessage({type:'sample',sample:message.sample});
      if(message.type==='status')reader.port.postMessage({type:'notice',text:message.text});
    });
    port.onDisconnect.addListener(()=>{if(camera===session){camera=null;reader?.port.postMessage({type:'sample',sample:{valid:false,reason:'disconnected'}});}});
  }
});
