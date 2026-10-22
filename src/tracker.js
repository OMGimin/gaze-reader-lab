import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { extractFeatures } from './core.js';

export class CameraTracker {
  constructor(video,onSample,onStatus,base='./vendor/') { Object.assign(this,{video,onSample,onStatus,base}); this.generation=0; }
  async load() {
    if(this.model) return;
    if(this.loading) return this.loading;
    this.loading=this.createModel();
    try{await this.loading;}finally{this.loading=null;}
  }
  async createModel() {
    const files=await FilesetResolver.forVisionTasks(`${this.base}wasm`);
    this.model=await FaceLandmarker.createFromOptions(files,{
      baseOptions:{modelAssetPath:`${this.base}face_landmarker.task`,delegate:'CPU'},
      runningMode:'VIDEO',numFaces:2,minFaceDetectionConfidence:.65,minFacePresenceConfidence:.65,minTrackingConfidence:.65
    });
  }
  async check() {
    if(this.running)throw new Error('카메라를 끈 뒤 점검하세요');
    await this.load();
    const blank=document.createElement('canvas');blank.width=64;blank.height=64;
    blank.getContext('2d').fillRect(0,0,64,64);
    const result=this.model.detectForVideo(blank,performance.now());
    return result.faceLandmarks.length;
  }
  async start() {
    if(this.running || this.starting) return;
    this.starting=true; const generation=++this.generation;
    try {
      this.onStatus('모델을 기기에서 불러오는 중…'); await this.load();
      if(generation!==this.generation) return;
      this.onStatus('카메라 허용을 기다리는 중…');
      // This method is only invoked by the user's explicit camera-start button.
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:20,max:30}},audio:false});
      if(generation!==this.generation) {stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream; this.video.srcObject=stream; await this.video.play();
      if(generation!==this.generation) return;
      this.running=true; this.previousTime=-1;
      stream.getVideoTracks()[0].addEventListener('ended',()=>this.stop('카메라 연결 종료'));
      this.onStatus('카메라 작동 중 · 읽기 창에서 보정하세요');
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
    this.stream?.getTracks().forEach(t=>t.stop()); this.stream=null;
    this.video.srcObject=null; this.onSample({valid:false,reason:'stopped'}); this.onStatus(message);
  }
  destroy() {this.stop(); this.model?.close(); this.model=null;}
}
