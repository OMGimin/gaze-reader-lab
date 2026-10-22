import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { extractFeatures } from './core.js';

export class CameraTracker {
  constructor(video,onSample,onStatus,base='./vendor/') { Object.assign(this,{video,onSample,onStatus,base}); this.generation=0; this.destroyed=false; }
  async load() {
    if(this.destroyed)throw new Error('종료된 카메라 세션입니다');
    if(this.model) return;
    if(this.loading) return this.loading;
    this.loading=this.createModel();
    try{await this.loading;}finally{this.loading=null;}
  }
  async createModel() {
    const files=await FilesetResolver.forVisionTasks(`${this.base}wasm`);
    const model=await FaceLandmarker.createFromOptions(files,{
      baseOptions:{modelAssetPath:`${this.base}face_landmarker.task`,delegate:'CPU'},
      runningMode:'VIDEO',numFaces:2,minFaceDetectionConfidence:.65,minFacePresenceConfidence:.65,minTrackingConfidence:.65
    });
    if(this.destroyed){model.close();return;}
    this.model=model;
  }
  async check() {
    if(this.running)throw new Error('카메라를 끈 뒤 점검하세요');
    await this.load();
    if(this.destroyed)throw new Error('종료된 카메라 세션입니다');
    const blank=document.createElement('canvas');blank.width=64;blank.height=64;
    blank.getContext('2d').fillRect(0,0,64,64);
    const result=this.model.detectForVideo(blank,performance.now());
    return result.faceLandmarks.length;
  }
  async start() {
    if(this.destroyed || this.running || this.starting) return;
    this.starting=true; const generation=++this.generation;
    try {
      this.onStatus('모델을 기기에서 불러오는 중…'); await this.load();
      if(generation!==this.generation) return;
      this.onStatus('카메라 허용을 기다리는 중…');
      if(generation!==this.generation)return;
      // This method is only invoked by the user's explicit camera-start button.
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:20,max:30}},audio:false});
      if(generation!==this.generation) {stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;
      const track=stream.getVideoTracks()[0];
      if(!track||track.readyState==='ended')throw new Error('카메라 연결이 종료됐습니다');
      const ended=()=>{if(generation===this.generation&&this.stream===stream)this.stop('카메라 연결 종료');};
      track.addEventListener('ended',ended);
      this.removeEnded=()=>track.removeEventListener('ended',ended);
      this.video.srcObject=stream; await this.video.play();
      if(generation!==this.generation) return;
      if(track.readyState==='ended'){this.stop('카메라 연결 종료');return;}
      this.running=true; this.previousTime=-1;
      this.onStatus('카메라 작동 중 · 읽기 창에서 보정하세요');
      if(generation!==this.generation||!this.running)return;
      this.timer=setInterval(()=>this.tick(),66);
    } catch(error) {
      this.stop(error.name==='NotAllowedError'?'카메라 권한이 허용되지 않았습니다':`카메라 오류: ${error.message}`);
    } finally { this.starting=false; }
  }
  tick() {
    if(!this.running || this.video.readyState<2 || this.video.currentTime===this.previousTime) return;
    this.previousTime=this.video.currentTime;
    try {
      const result=this.model.detectForVideo(this.video,performance.now());
      const sample=extractFeatures(result,this.video.videoWidth,this.video.videoHeight);
      this.onSample(sample || {valid:false,reason:'face'});
    } catch(error) {this.stop(`추적 오류: ${error.message}`);}
  }
  stop(message='카메라 꺼짐') {
    this.generation++; clearInterval(this.timer); this.running=false;
    this.removeEnded?.(); this.removeEnded=null;
    this.stream?.getTracks().forEach(t=>t.stop()); this.stream=null;
    this.video.srcObject=null; this.onSample({valid:false,reason:'stopped'}); this.onStatus(message);
  }
  destroy() {if(this.destroyed)return;this.destroyed=true;this.stop(); this.model?.close(); this.model=null;}
}
