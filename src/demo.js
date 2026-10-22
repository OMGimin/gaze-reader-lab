import {createReader} from './reader.js';
import {CameraTracker} from './tracker.js';
let reader=null;
const camera=document.querySelector('#camera-card'),video=document.querySelector('video');
const tracker=new CameraTracker(video,sample=>reader?.receive(sample),text=>{document.querySelector('#camera-status').textContent=text;});
document.querySelector('#launch').addEventListener('click',()=>{
  if(reader)return;
  reader=createReader({demo:true,onClose:()=>{reader=null;tracker.stop();camera.hidden=true;document.body.classList.remove('lab-open');},onCamera:()=>{camera.hidden=false;},onMode:()=>tracker.stop()});
  document.body.classList.add('lab-open');
});
document.querySelector('#start-camera').addEventListener('click',()=>tracker.start());
document.querySelector('#stop-camera').addEventListener('click',()=>tracker.stop());
document.querySelector('#hide-camera').addEventListener('click',()=>{tracker.stop();camera.hidden=true;});
window.addEventListener('pagehide',()=>tracker.destroy());
