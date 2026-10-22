import {CameraTracker} from './tracker.js';
const status=document.querySelector('#camera-status'),start=document.querySelector('#start-camera');
const isExtension=location.protocol==='chrome-extension:';
const port=isExtension?chrome.runtime.connect({name:'camera'}):null;
let connected=!!port,sessionClosed=false;
function send(message){if(!connected)return;try{port.postMessage(message);}catch{connected=false;sessionClosed=true;tracker.stop('확장 연결 끊김');start.disabled=true;}}
const tracker=new CameraTracker(document.querySelector('video'),sample=>send({type:'sample',sample}),text=>{status.textContent=text;send({type:'status',text});});
start.addEventListener('click',async()=>{if(sessionClosed)return;start.disabled=true;await tracker.start();start.disabled=sessionClosed;});
document.querySelector('#stop-camera').addEventListener('click',()=>tracker.stop());
document.querySelector('#check-model').addEventListener('click',async()=>{try{const faces=await tracker.check();status.textContent=`모델 로드 성공 · 빈 영상 추론 ${faces}명 · 카메라 꺼짐`;}catch(e){status.textContent=`모델 로드 실패: ${e.message}`;}});
port?.onMessage.addListener(message=>{if(message.type==='stop'){connected=false;sessionClosed=true;tracker.stop('읽기 페이지 연결 종료');start.disabled=true;}});
port?.onDisconnect.addListener(()=>{connected=false;sessionClosed=true;tracker.stop('확장 연결 끊김');start.disabled=true;});
window.addEventListener('pagehide',()=>tracker.destroy());
// Reconnect a restored document with a new tracker, still requiring explicit Start.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
