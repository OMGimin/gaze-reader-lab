export function isAllowedUrl(value) {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' && u.hostname === 'comic.naver.com' && u.pathname === '/webtoon/detail') ||
      (u.protocol === 'http:' && ['127.0.0.1','localhost'].includes(u.hostname) && u.port === '4173');
  } catch { return false; }
}

export function commandZone({x,y}) {
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return null;
  return x>=.2&&x<=.8?(y>=.86?'down':y<=.14?'up':y>=.3&&y<=.7?'neutral':null):null;
}

// No continuous scrolling: a neutral fixation arms exactly one dwell-triggered step.
export class IntentGate {
  constructor({ dwellMs = 900, neutralMs = 350, staleMs = 300 } = {}) {
    Object.assign(this, { dwellMs, neutralMs, staleMs }); this.pause('시작 전');
  }
  reset() { this.armed = false; this.zone = null; this.since = null; this.last = null; this.progress = 0; this.blinkSince = null; }
  pause(reason = '일시 정지') { this.paused = true; this.reason = reason; this.reset(); }
  resume() { this.paused = false; this.reason = '가운데를 바라보세요'; this.reset(); }
  update(point, now) {
    const out = () => ({ action: null, progress: this.progress, reason: this.reason });
    if (this.paused) return out();
    if (this.last !== null && (now - this.last > this.staleMs || now < this.last)) {
      this.pause('입력 지연 · 다시 시작하세요'); return out();
    }
    this.last = now;
    if (!point.valid || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      // A short blink cancels intention; prolonged closure requires manual resume.
      if (point.reason === 'blink') {
        this.blinkSince ??= now; this.armed = false; this.zone = null; this.since = null; this.progress = 0;
        if (now - this.blinkSince < 250) { this.reason = '눈 깜박임 · 가운데로'; return out(); }
      }
      this.pause('추적 실패 · 다시 시작하세요'); return out();
    }
    this.blinkSince = null;
    const zone = commandZone(point);
    if (zone !== this.zone) { this.zone = zone; this.since = now; this.progress = 0; }
    if (zone === 'neutral') {
      if (now - this.since >= this.neutralMs) this.armed = true;
      this.reason = this.armed ? '준비됨 · 위/아래 영역 응시' : '가운데 응시 중';
    } else if (this.armed && (zone === 'up' || zone === 'down')) {
      this.progress = Math.min(1,(now-this.since)/this.dwellMs);
      this.reason = `${zone === 'down' ? '다음' : '이전'} 이동 준비 ${Math.round(this.progress*100)}%`;
      if (this.progress >= 1) {
        this.armed = false; this.progress = 0; this.reason = '한 번 이동 · 가운데로 돌아오세요';
        return { action: zone, progress: 0, reason: this.reason };
      }
    } else { this.progress = 0; this.reason = '가운데를 바라보면 다시 준비됩니다'; }
    return out();
  }
}

function solve(a, b) {
  const m = a.map((row,i)=>[...row,b[i]]), n=b.length;
  for(let k=0;k<n;k++) {
    let p=k; for(let i=k+1;i<n;i++) if(Math.abs(m[i][k])>Math.abs(m[p][k])) p=i;
    [m[k],m[p]]=[m[p],m[k]];
    if(Math.abs(m[k][k])<1e-10) throw new Error('보정 데이터가 충분하지 않습니다');
    const d=m[k][k]; for(let j=k;j<=n;j++) m[k][j]/=d;
    for(let i=0;i<n;i++) if(i!==k) { const f=m[i][k]; for(let j=k;j<=n;j++) m[i][j]-=f*m[k][j]; }
  }
  return m.map(row=>row[n]);
}
const median = values => {
  const sorted=[...values].sort((a,b)=>a-b), mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
};
const pointKey = target => `${target.x},${target.y}`;
function groupPoints(samples) {
  const groups=new Map();
  for(const sample of samples){const key=pointKey(sample.target);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(sample);}
  return [...groups.values()];
}
// Training only: reject isolated feature outliers without inspecting prediction error.
// Held-out validation below deliberately keeps ALL collected valid frames.
export function summarizePoint(samples) {
  if(!samples.length)return {ok:false,count:0,kept:0,reason:'표본 없음'};
  const dim=Math.min(4,samples[0].features.length);
  const finite=samples.filter(s=>s.features.length>=dim&&s.features.slice(0,dim).every(Number.isFinite));
  if(!finite.length)return {ok:false,count:samples.length,kept:0,reason:'유효한 눈 특징 없음'};
  const center=Array.from({length:dim},(_,i)=>median(finite.map(s=>s.features[i])));
  const mad=center.map((v,i)=>median(finite.map(s=>Math.abs(s.features[i]-v))));
  const inliers=finite.filter(s=>s.features.slice(0,dim).every((v,i)=>Math.abs(v-center[i])<=Math.max(.01,6*mad[i])));
  const kept=inliers.length;
  return {ok:kept>=8&&kept/samples.length>=.75,count:samples.length,kept,
    features:kept?center.map((_,i)=>median(inliers.map(s=>s.features[i]))):center,
    spread:Math.max(...mad),reason:kept<8?'표본 부족':kept/samples.length<.75?'눈 특징 흔들림이 큽니다':null};
}
export function fitCalibration(samples) {
  if(samples.length<30)throw new Error('보정 표본 부족');
  const inputDim=samples[0].features.length;
  if(!inputDim||samples.some(s=>s.features.length!==inputDim||![...s.features,s.target.x,s.target.y].every(Number.isFinite)))throw new Error('잘못된 보정 데이터');
  // Camera feature slots 0..3 are eye-local iris coordinates. Pose is a separate
  // safety guard, never a predictor: tiny target-correlated head motion confounds gaze.
  const dim=Math.min(4,inputDim), groups=groupPoints(samples);
  if(groups.length<5)throw new Error('서로 다른 보정점이 부족합니다');
  const points=groups.map(group=>({quality:summarizePoint(group),target:group[0].target}));
  if(points.some(p=>!p.quality.ok))throw new Error('일부 점의 눈 특징이 불안정합니다. 해당 점을 다시 측정하세요');
  const mean=Array.from({length:dim},(_,i)=>points.reduce((v,p)=>v+p.quality.features[i],0)/points.length);
  const scale=mean.map((v,i)=>Math.sqrt(points.reduce((sum,p)=>sum+(p.quality.features[i]-v)**2,0)/points.length));
  if(scale.every(v=>v<1e-5))throw new Error('점 사이 눈 특징 변화가 감지되지 않았습니다. 카메라 위치·조명을 확인하세요');
  const safeScale=scale.map(v=>Math.max(v,.001));
  const rows=points.map(p=>[1,...p.quality.features.map((v,i)=>(v-mean[i])/safeScale[i])]);
  const n=dim+1, count=rows.length, ridge=.01;
  // Equal weight per target; normalized Gram matrix keeps regularization independent
  // of frame count. Validation targets are never used to choose coefficients.
  const a=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>rows.reduce((v,r)=>v+r[i]*r[j],0)/count+(i===j&&i>0?ridge:0)));
  const weights=['x','y'].map(axis=>solve(a,Array.from({length:n},(_,i)=>rows.reduce((v,r,k)=>v+r[i]*points[k].target[axis],0)/count)));
  return {mean,scale:safeScale,weights,inputDim,eyeOnly:true};
}
export function predict(model,features) {
  if(!model||features.length!==(model.inputDim??model.mean.length)||!features.every(Number.isFinite))return {x:NaN,y:NaN};
  const used=features.slice(0,model.mean.length);
  const row=[1,...used.map((v,i)=>(v-model.mean[i])/model.scale[i])];
  const [x,y]=model.weights.map(w=>w.reduce((sum,v,i)=>sum+v*row[i],0));
  return {x,y}; // Never clamp an out-of-bounds estimate into a command region.
}
export function validateCalibration(model,samples) {
  if(samples.length<3)return {ok:false,meanError:Infinity,maxError:Infinity,regions:[0,0,0],points:[],reasons:['확인 표본 부족']};
  const measurements=samples.map(s=>{const p=predict(model,s.features);return {...s,prediction:p,error:Math.hypot(p.x-s.target.x,p.y-s.target.y)};});
  const errors=measurements.map(s=>s.error);
  const meanError=errors.reduce((a,b)=>a+b,0)/errors.length,maxError=Math.max(...errors);
  const regions=['up','neutral','down'].map(zone=>{
    const group=measurements.filter(s=>commandZone(s.target)===zone);
    return group.length?group.filter(s=>commandZone(s.prediction)===zone).length/group.length:0;
  });
  const points=groupPoints(measurements).map(group=>({target:group[0].target,count:group.length,
    meanError:group.reduce((sum,s)=>sum+s.error,0)/group.length,maxError:Math.max(...group.map(s=>s.error)),
    coverage:group.filter(s=>commandZone(s.prediction)===commandZone(s.target)).length/group.length}));
  const reasons=[];
  if(!Number.isFinite(meanError)||meanError>.10)reasons.push('평균 위치 오차 초과');
  if(!Number.isFinite(maxError)||maxError>.18)reasons.push('일부 프레임의 최대 위치 오차 초과');
  regions.forEach((v,i)=>{if(v<.8)reasons.push(`${['위','중앙','아래'][i]} 영역 구분 부족`);});
  return {ok:reasons.length===0,meanError,maxError,regions,points,reasons};
}

export function extractFeatures(result, imageWidth=1, imageHeight=1) {
  if(!Number.isFinite(imageWidth)||!Number.isFinite(imageHeight)||imageWidth<=0||imageHeight<=0)return null;
  if(result.faceLandmarks?.length!==1) return null;
  const p=result.faceLandmarks[0];
  if(p.length<478 || p.some(v=>![v.x,v.y,v.z].every(Number.isFinite))) return null;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  // x/W and y/H are not Euclidean units. Use image-width units for BOTH axes.
  // CSS scaleX(-1) mirrors the preview only; video inference stays unmirrored.
  const eyePoints=p.map(v=>({x:v.x,y:v.y*imageHeight/imageWidth}));
  const eye=(a,b,top,bottom,iris)=>{
    const q=eyePoints,width=dist(q[a],q[b]);if(width<.015)return null;
    const dx=(q[b].x-q[a].x)/width,dy=(q[b].y-q[a].y)/width;
    const ix=q[iris].x-q[a].x,iy=q[iris].y-q[a].y;
    return {x:(ix*dx+iy*dy)/width,y:(-ix*dy+iy*dx)/width,open:dist(q[top],q[bottom])/width};
  };
  const l=eye(33,133,159,145,468),r=eye(362,263,386,374,473);
  if(!l||!r) return null;
  if(l.open<.12 || r.open<.12) return {valid:false,reason:'blink'};
  const width=dist(p[33],p[263]),cx=(p[33].x+p[263].x)/2,cy=(p[33].y+p[263].y)/2;
  if(width<.1 || width>.65) return null;
  const pose=[cx,cy,width,(p[1].x-cx)/width,(p[1].y-cy)/width];
  return {valid:true,features:[l.x,l.y,r.x,r.y,...pose],pose};
}
export function poseMatches(base,pose) {
  return !!base && !!pose && Math.abs(base[0]-pose[0])<.07 && Math.abs(base[1]-pose[1])<.07 &&
    Math.abs(base[2]-pose[2])<base[2]*.22 && Math.abs(base[3]-pose[3])<.12 && Math.abs(base[4]-pose[4])<.12;
}
