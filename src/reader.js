import { IntentGate, fitCalibration, predict, validateCalibration, poseMatches, summarizePoint } from './core.js';
const TRAIN=[{x:.5,y:.5},{x:.1,y:.08},{x:.9,y:.92},{x:.9,y:.08},{x:.1,y:.92},{x:.5,y:.08},{x:.1,y:.5},{x:.5,y:.92},{x:.9,y:.5}];
const CHECK=[{x:.5,y:.09},{x:.5,y:.5},{x:.5,y:.91},{x:.25,y:.5},{x:.75,y:.5}];
export function createReader({demo=false,onClose=()=>{},onCamera=()=>{},onMode=()=>{}}={}) {
  const host=document.createElement('div'); host.id='gaze-scroll-assistant';
  const root=host.attachShadow({mode:'open'}); document.documentElement.append(host);
  root.innerHTML=`<style>
    :host{all:initial;color:#e9f3ef;font:14px/1.5 system-ui,sans-serif;position:fixed;inset:0;z-index:2147483647;pointer-events:none}
    *{box-sizing:border-box} button,select{font:inherit}button{cursor:pointer;border:1px solid #48685c;background:#1c332b;color:#effaf4;padding:9px 13px;border-radius:10px}button:hover{background:#315848}button:focus-visible{outline:3px solid #efcb7a}button:disabled{opacity:.4;cursor:default}button.primary{background:#c5f1ce;color:#143623;border:0;font-weight:700}
    .panel{position:fixed;top:18px;right:18px;width:300px;padding:20px;background:#102a24f5;border:1px solid #557366;border-radius:18px;box-shadow:0 12px 50px #0003;pointer-events:auto;max-height:calc(100vh - 36px);overflow:auto}
    .brand{font-size:11px;letter-spacing:2px;color:#b1cfbf}h2{font-size:22px;line-height:1.2;margin:7px 0 14px}p{margin:10px 0;color:#c2d5cc;font-size:12px}.row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.status{min-height:44px;color:#e7f6e9}.badge{color:#efcb7a;font-size:12px}progress{width:100%;height:6px;accent-color:#b8efc3} .target{position:fixed;left:50%;transform:translateX(-50%);width:60vw;max-width:750px;height:14vh;border:1px dashed #b9d2c66e;display:flex;align-items:center;justify-content:center;gap:12px;border-radius:18px;color:#f1fff5;background:#183c3266;font-weight:600;text-shadow:0 1px 3px #000;pointer-events:none}.up{top:0}.down{bottom:0}.target.active{background:#2c705bd9;border-color:#c3f6cd}
    .dot{position:fixed;width:15px;height:15px;border:2px solid #fff;border-radius:50%;background:#ffc56b;transform:translate(-50%,-50%);display:none;box-shadow:0 0 0 5px #ffc56b22}
    .calibration{position:fixed;inset:0;background:#0c211bf2;pointer-events:auto;display:none}.instruction{position:absolute;left:50%;top:22%;transform:translateX(-50%);width:min(500px,75vw);text-align:center;color:#eaf6ee}.caldot{position:absolute;width:34px;height:34px;border-radius:50%;background:#efffdf;box-shadow:0 0 0 12px #d4efc333;transform:translate(-50%,-50%)}
    .diagnostics{font-size:11px;margin-top:12px;border-top:1px solid #476255;padding-top:8px}.diagnostics p{font-size:11px;white-space:pre-line}.diagnostics table{width:100%;font-size:10px;text-align:left;border-collapse:collapse}.diagnostics td,.diagnostics th{padding:4px;border-bottom:1px solid #345348}.mock{border-top:1px solid #476255;margin-top:15px;padding-top:12px} .small{font-size:11px}.close{position:absolute;right:12px;top:10px;padding:3px 8px;background:transparent} [hidden]{display:none!important}
    @media(max-width:850px){.panel{width:240px;padding:14px;top:14vh;right:8px}.target{width:95vw}}
  </style>
  <div class="target up" id="up">↑ 이전 구간 <span>900ms 응시</span></div>
  <div class="target down" id="down">↓ 다음 구간 <span>900ms 응시</span></div>
  <div class="dot"></div>
  <section class="panel" aria-label="시선 스크롤 제어">
    <button class="close" aria-label="시선 도우미 닫기">×</button>
    <div class="brand">GAZE / READER LAB</div><h2>눈으로, 한 장면씩.</h2>
    <div class="badge">${demo?'모의 입력 · 카메라 사용 안 함':'카메라 꺼짐 · 시작은 직접'}</div>
    <p>가운데를 본 뒤 위·아래 영역에 시선을 머무르세요. 한 번 이동한 뒤 다시 가운데로.</p>
    <div class="status" role="status" aria-live="polite">${demo?'모의 입력을 켜면 마우스 위치를 시선으로 사용합니다.':'카메라 창에서 시작한 뒤 보정하세요.'}</div>
    <progress max="1" value="0" aria-label="응시 진행도"></progress>
    <div class="row"><button class="primary" id="resume" disabled>시작 / 재개</button><button id="pause">정지 · Esc</button></div>
    <div class="row"><button id="calibrate">시선 보정</button><button id="undo">되돌리기</button></div>
    <div class="row"><button id="camera">${demo?'카메라 직접 시작':'카메라 창 안내'}</button><label class="small"><input id="show-dot" type="checkbox"> 추정점 표시</label></div>
    <p class="small">추적 실패·창 전환·수동 스크롤 시 정지.<br>머리 위치나 창 크기가 바뀌면 다시 보정하세요.</p>
    <details class="diagnostics" id="diagnostics" hidden><summary>보정 진단 · 이 창에서만</summary><p id="diagnostic-text"></p><table><thead><tr><th>확인점</th><th>표본</th><th>평균/최대</th><th>영역 일치</th></tr></thead><tbody id="diagnostic-points"></tbody></table><p>영상·눈 특징 저장 없음. 창을 닫으면 진단도 사라집니다.</p></details>
    ${demo?'<div class="mock"><button id="mock-toggle">모의 입력 켜기</button><button id="mock-lost">추적 실패</button><p>카메라 정확도를 재현하지 않는 UX 테스트입니다.</p></div>':''}
  </section>
  <section class="calibration" aria-label="시선 보정 화면"><div class="instruction"><h2 id="cal-title">보정</h2><p id="cal-text">점을 눈으로 따라가세요. 머리는 움직이지 마세요.</p><p id="cal-quality"></p><button id="retry-point" hidden>이 점 다시 측정</button> <button id="cancel-cal">보정 취소 · Esc</button></div><div class="caldot"></div></section>`;
  const $=s=>root.querySelector(s), gate=new IntentGate();
  let model=null,baseline=null,cal=null,lastSample=null,lastReceived=0,smooth=null,previousScroll=null,mock=false,closed=false;
  let pointer={x:.5,y:.5},source='camera',lastHref=location.href,lastWindow=[window.screenX,window.screenY,window.devicePixelRatio];
  const listeners=[];
  function listen(target,name,fn,options) {target.addEventListener(name,fn,options);listeners.push(()=>target.removeEventListener(name,fn,options));}
  function status(text){$('.status').textContent=text;}
  function render(result={}) {
    $('progress').value=result.progress||0; status(result.reason||gate.reason);
    $('#up').classList.toggle('active',!gate.paused&&gate.zone==='up'&&gate.armed);
    $('#down').classList.toggle('active',!gate.paused&&gate.zone==='down'&&gate.armed);
    $('#resume').disabled=!(mock||model)||!!cal;
  }
  function pause(reason){gate.pause(reason);smooth=null;render();}
  function cancelCal(reason='보정 취소'){cal=null;$('.calibration').style.display='none';pause(reason);}
  function invalidate(reason){model=null;baseline=null;cancelCal(reason);}
  function scroll(action){previousScroll=window.scrollY;window.scrollBy({top:(action==='down'?1:-1)*Math.min(innerHeight*.55,520),behavior:'instant'});}
  function apply(point,now){
    const result=gate.update(point,now); if(result.action)scroll(result.action); render(result);
    const dot=$('.dot'); dot.style.display=$('#show-dot').checked&&point.valid?'block':'none';
    if(point.valid){dot.style.left=`${point.x*100}%`;dot.style.top=`${point.y*100}%`;}
  }
  function receive(sample){
    if(closed||mock)return;
    lastReceived=performance.now();lastSample=sample;
    if(cal)return;
    if(!model || gate.paused)return;
    if(!sample.valid){smooth=null;apply(sample,lastReceived);return;}
    if(!poseMatches(baseline,sample.pose)){invalidate('머리 위치 변경 · 다시 보정하세요');return;}
    const point=predict(model,sample.features);
    if(![point.x,point.y].every(Number.isFinite)||point.x<0||point.x>1||point.y<0||point.y>1){apply({valid:false},lastReceived);return;}
    smooth=smooth?{x:smooth.x*.65+point.x*.35,y:smooth.y*.65+point.y*.35}:point;
    apply({...smooth,valid:true},lastReceived);
  }
  function startCal(){
    if(mock){status('모의 입력을 끈 뒤 카메라를 직접 시작하세요.');return;}
    if(!lastSample?.valid||performance.now()-lastReceived>300){status('유효한 카메라 입력이 없습니다. 카메라 창에서 먼저 시작하세요.');return;}
    pause('보정 중');model=null;baseline=null;
    cal={phase:'train',index:0,start:performance.now(),samples:[],validation:[],bucket:[],reports:[],poseReference:null,waiting:false};
    $('#diagnostics').hidden=true;$('#retry-point').hidden=true;
    $('.calibration').style.display='block';render();
  }
  function pausePoint(reason){
    if(!cal)return;
    cal.waiting=true;$('#retry-point').hidden=false;
    $('#cal-text').textContent=reason;
    $('#cal-quality').textContent='이 점의 표본은 아직 학습에 넣지 않았습니다. 준비되면 다시 측정하세요.';
  }
  function showDiagnostics(result,reports){
    $('#diagnostics').hidden=false;$('#diagnostics').open=!result.ok;
    const percent=v=>Number.isFinite(v)?`${(v*100).toFixed(1)}%`:'측정 불가';
    const regions=result.regions.map((v,i)=>`${['위','중앙','아래'][i]} ${Math.round(v*100)}%`).join(' / ');
    const samples=reports.map((r,i)=>`${i+1}점 ${r.kept}/${r.count}`).join(', ');
    $('#diagnostic-text').textContent=`${result.ok?'확인 통과':result.reasons.join(' · ')}
평균 ${percent(result.meanError)} / 최대 ${percent(result.maxError)}
영역 일치: ${regions} (각 80% 이상 필요)
학습점 채택/수집: ${samples}
눈만 점을 따라가세요. 카메라 창은 읽기 창 옆에 두고 보정 도중 창이나 머리를 움직이지 마세요. 실패하면 조명·안경 반사·카메라 위치를 확인하고 시선 보정을 다시 누르세요.`;
    const tbody=$('#diagnostic-points');tbody.replaceChildren();
    for(const p of result.points){
      const tr=document.createElement('tr');
      const label=p.target.y<.2?'위':p.target.y>.8?'아래':p.target.x<.4?'왼쪽':p.target.x>.6?'오른쪽':'중앙';
      for(const value of [label,String(p.count),`${percent(p.meanError)} / ${percent(p.maxError)}`,`${Math.round(p.coverage*100)}%`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
      tbody.append(tr);
    }
  }
  function tickCal(now){
    if(!cal||cal.waiting)return;
    const points=cal.phase==='train'?TRAIN:CHECK,target=points[cal.index],elapsed=now-cal.start;
    $('.caldot').style.left=`${target.x*100}%`;$('.caldot').style.top=`${target.y*100}%`;
    $('#cal-title').textContent=`${cal.phase==='train'?'보정':'정확도 확인'} ${cal.index+1} / ${points.length}`;
    $('#cal-text').textContent=elapsed<1200?'밝은 점으로 시선을 옮기세요. 머리는 그대로 유지하세요.':'점을 계속 응시하세요. 측정 중…';
    $('#cal-quality').textContent=`새 표본 ${cal.bucket.length} / 24 · 보정·확인 약 40초 · 중앙의 안내보다 밝은 점을 보세요`;
    if(now-lastReceived>300){pausePoint('새 영상 입력이 늦습니다. 카메라 창을 가리지 말고 다시 시도하세요.');return;}
    if(!lastSample?.valid){
      if(lastSample?.reason==='blink'){cal.blinkSince??=now;if(now-cal.blinkSince<300)return;}
      pausePoint('눈/얼굴 추적이 끊겼습니다. 한 사람만 정면을 보고 다시 시도하세요.');return;
    }
    cal.blinkSince=null;
    if(elapsed>=1200&&cal.lastAt!==lastReceived&&lastReceived>=cal.start+1200){
      cal.poseReference??=[...lastSample.pose];
      if(!poseMatches(cal.poseReference,lastSample.pose)){pausePoint('보정 시작 때와 머리 위치가 다릅니다. 원래 자세로 돌아오거나 보정을 취소하고 다시 시작하세요.');return;}
      cal.bucket.push({features:[...lastSample.features],target});cal.lastAt=lastReceived;
    }
    if(cal.bucket.length<24){if(elapsed>=4500)pausePoint('새 표본이 부족합니다. 카메라 창을 보이게 두고 이 점을 다시 측정하세요.');return;}
    if(cal.phase==='train'){
      const quality=summarizePoint(cal.bucket);
      if(!quality.ok){pausePoint(`${quality.reason} (${quality.kept}/${quality.count}개 채택). 눈을 점에 고정하고 이 점을 다시 측정하세요.`);return;}
      cal.reports.push({count:quality.count,kept:quality.kept,spread:quality.spread});
    }
    (cal.phase==='train'?cal.samples:cal.validation).push(...cal.bucket);cal.bucket=[];cal.index++;cal.start=now;
    if(cal.index<points.length)return;
    if(cal.phase==='train'){
      try{cal.candidate=fitCalibration(cal.samples);}catch(e){cancelCal(e.message);return;}
      cal.phase='check';cal.index=0;
    }else{
      const result=validateCalibration(cal.candidate,cal.validation);
      model=result.ok?cal.candidate:null;
      baseline=result.ok?cal.poseReference:null;
      const reports=cal.reports;
      cancelCal(result.ok?`보정 통과 · 평균 오차 ${(result.meanError*100).toFixed(1)}% · 시작을 누르세요`:`보정 실패 · ${result.reasons.join(' · ')} · 아래 진단을 확인하세요`);
      showDiagnostics(result,reports);
    }
  }
  listen($('#retry-point'),'click',()=>{
    if(!cal)return;
    if(!lastSample?.valid||performance.now()-lastReceived>300){$('#cal-text').textContent='유효한 카메라 입력이 없습니다. 먼저 카메라 창과 얼굴 위치를 확인하세요.';return;}
    cal.bucket=[];cal.start=performance.now();cal.lastAt=null;cal.blinkSince=null;cal.waiting=false;$('#retry-point').hidden=true;
  });
  listen($('#resume'),'click',()=>{if(mock||model){gate.resume();render();}});
  listen($('#pause'),'click',()=>pause('사용자 정지'));
  listen($('#undo'),'click',()=>{pause('되돌림 · 다시 시작하세요');if(previousScroll!==null){window.scrollTo({top:previousScroll,behavior:'instant'});previousScroll=null;}});
  listen($('#calibrate'),'click',startCal);listen($('#cancel-cal'),'click',()=>cancelCal());
  listen($('#camera'),'click',()=>{if(mock){status('먼저 모의 입력을 끄세요.');return;}onCamera();});
  listen($('.close'),'click',close);
  if(demo){
    listen($('#mock-toggle'),'click',()=>{mock=!mock;onMode();source=mock?'mock':'camera';invalidate(mock?'모의 입력 준비 · 시작을 누르세요':'모의 입력 꺼짐');$('#mock-toggle').textContent=mock?'모의 입력 끄기':'모의 입력 켜기';$('.badge').textContent=mock?'모의 입력 활성 · 마우스 = 시선':'카메라는 직접 시작해야 합니다';});
    listen($('#mock-lost'),'click',()=>pause('추적 실패 · 다시 시작하세요'));
    listen(window,'pointermove',e=>{pointer={x:e.clientX/innerWidth,y:e.clientY/innerHeight};});
  }
  listen(window,'keydown',e=>{if(e.key==='Escape'){cancelCal('Esc · 정지');}else if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)){pause('키보드 조작 · 정지');}},true);
  listen(window,'wheel',()=>pause('수동 스크롤 · 정지'),{passive:true,capture:true});
  listen(window,'touchstart',()=>pause('터치 조작 · 정지'),{passive:true});
  listen(window,'pointerdown',e=>{if(!e.composedPath().includes(host))pause('수동 조작 · 정지');},true);
  listen(window,'blur',()=>{if(cal)cancelCal('창 전환 · 보정 취소');else pause('창 전환 · 정지');});
  listen(document,'visibilitychange',()=>{if(document.hidden)cancelCal('숨겨진 탭 · 정지');});
  listen(window,'resize',()=>invalidate('창 크기 변경 · 다시 보정하세요'));
  const timer=setInterval(()=>{
    const now=performance.now();
    const geometry=[window.screenX,window.screenY,window.devicePixelRatio];
    if(geometry.some((v,i)=>v!==lastWindow[i])){lastWindow=geometry;invalidate('창 위치/배율 변경 · 다시 보정하세요');}
    if(location.href!==lastHref){lastHref=location.href;invalidate('페이지 이동 · 다시 연결하세요');}
    if(cal){tickCal(now);return;}
    if(!gate.paused&&!document.hidden){
      if(mock)apply({...pointer,valid:true},now);
      else if(now-lastReceived>300)pause('카메라 입력 지연 · 정지');
    }
  },50);
  function close(){if(closed)return;closed=true;clearInterval(timer);listeners.forEach(fn=>fn());model=null;lastSample=null;host.remove();onClose();}
  return {receive,pause,close,status,get source(){return source;}};
}
