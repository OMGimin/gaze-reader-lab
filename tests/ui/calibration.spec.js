import {test,expect} from '@playwright/test';
import {build} from 'esbuild';
async function prepare(page){
  await page.addInitScript(()=>{window.cameraCalls=0;navigator.mediaDevices.getUserMedia=async()=>{window.cameraCalls++;throw Error('camera must not run');};});
  const harness=await build({stdin:{contents:`import {createReader} from './src/reader.js';
    const reader=createReader();window.input={valid:true,badCheck:false,poseX:.5};
    setInterval(()=>{
      const root=document.querySelector('#gaze-scroll-assistant').shadowRoot;
      const dot=root.querySelector('.caldot');
      let x=parseFloat(dot.style.left)/100||.5,y=parseFloat(dot.style.top)/100||.5;
      if(window.input.badCheck&&root.querySelector('#cal-title').textContent.startsWith('정확도 확인'))y=.5;
      reader.receive({valid:window.input.valid,features:[.4+.08*x,.03+.06*y,.4+.08*x,.03+.06*y,.5,.5,.3,0,.3],pose:[window.input.poseX,.5,.3,0,.3]});
    },60);`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'});
  await page.route('**/calibration-harness.js',r=>r.fulfill({contentType:'text/javascript',body:harness.outputFiles[0].text}));
  await page.goto('/');await page.clock.install();await page.addScriptTag({url:'/calibration-harness.js'});await page.clock.runFor(100);
}
test('tracking interruption retries the same point; pose change is explained and cannot arm',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:'시선 보정',exact:true}).click();
  await page.clock.runFor(1600);await page.evaluate(()=>window.input.valid=false);await page.clock.runFor(100);
  await expect(page.getByRole('button',{name:'이 점 다시 측정',exact:true})).toBeVisible();
  await expect(page.locator('#cal-text')).toContainText('추적이 끊겼습니다');
  await page.evaluate(()=>window.input.valid=true);await page.clock.runFor(100);
  await page.getByRole('button',{name:'이 점 다시 측정',exact:true}).click();await page.clock.runFor(1500);
  await expect(page.locator('#cal-title')).toHaveText('보정 1 / 9');
  await page.evaluate(()=>window.input.poseX=.7);await page.clock.runFor(100);
  await expect(page.locator('#cal-text')).toContainText('머리 위치가 다릅니다');
  await page.getByRole('button',{name:'보정 취소 · Esc',exact:true}).click();
  await expect(page.getByRole('button',{name:'시작 / 재개',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>window.cameraCalls)).toBe(0);
});
test('failed validation shows point quality and region failures without unlocking start',async({page})=>{
  test.setTimeout(60000);await prepare(page);
  await page.evaluate(()=>window.input.badCheck=true);
  await page.getByRole('button',{name:'시선 보정',exact:true}).click();await page.clock.runFor(40000);
  await expect(page.getByRole('status')).toContainText('보정 실패');
  await expect(page.locator('#diagnostic-text')).toContainText('위 영역 구분 부족');
  await expect(page.locator('#diagnostic-text')).toContainText('아래 영역 구분 부족');
  await expect(page.locator('#diagnostic-text')).toContainText('학습점 채택/수집');
  await expect(page.locator('#diagnostic-points tr')).toHaveCount(5);
  await expect(page.getByRole('button',{name:'시작 / 재개',exact:true})).toBeDisabled();
  await page.screenshot({path:'docs/calibration-fix/diagnostics.png'});
  expect(await page.evaluate(()=>window.cameraCalls)).toBe(0);
});
