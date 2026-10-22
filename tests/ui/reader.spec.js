import {test,expect} from '@playwright/test';
async function launch(page){
  await page.goto('/');await page.getByRole('button',{name:'모의 체험 시작'}).click();
  await page.getByRole('button',{name:'모의 입력 켜기',exact:true}).click();
  await page.getByRole('button',{name:'시작 / 재개',exact:true}).click();
}
async function neutral(page){await page.mouse.move(600,450);await page.waitForTimeout(450);}
async function down(page){await page.mouse.move(600,865);await page.waitForTimeout(1100);}

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    window.__cameraCalls=0;
    navigator.mediaDevices.getUserMedia=async()=>{window.__cameraCalls++;throw new DOMException('Test denial','NotAllowedError');};
  });
});

test('intention sequence scrolls once; continued fixation does not repeat; undo restores',async({page})=>{
  await launch(page);
  await down(page);expect(await page.evaluate(()=>scrollY)).toBe(0);
  await neutral(page);await down(page);const y=await page.evaluate(()=>scrollY);expect(y).toBeGreaterThan(300);
  await page.waitForTimeout(1300);expect(await page.evaluate(()=>scrollY)).toBe(y);
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();expect(await page.evaluate(()=>scrollY)).toBe(0);
  expect(await page.evaluate(()=>window.__cameraCalls)).toBe(0);
});

test('Esc, input loss, wheel, and blur cancel pending intent',async({page})=>{
  await launch(page);await neutral(page);await page.mouse.move(600,865);await page.waitForTimeout(300);await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);expect(await page.evaluate(()=>scrollY)).toBe(0);
  await expect(page.getByRole('status')).toContainText('Esc');
  await page.getByRole('button',{name:'시작 / 재개',exact:true}).click();await neutral(page);
  await page.getByRole('button',{name:'추적 실패',exact:true}).click();await down(page);expect(await page.evaluate(()=>scrollY)).toBe(0);
  await page.getByRole('button',{name:'시작 / 재개',exact:true}).click();await neutral(page);await page.mouse.wheel(0,100);
  await expect(page.getByRole('status')).toContainText('수동 스크롤');
  await page.getByRole('button',{name:'시작 / 재개',exact:true}).click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('status')).toContainText('창 전환');
});

test('calibration without a camera cannot arm; closed UI is removed',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'모의 체험 시작'}).click();
  await page.getByRole('button',{name:'시선 보정',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('유효한 카메라 입력이 없습니다');
  await expect(page.getByRole('button',{name:'시작 / 재개',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'시선 도우미 닫기'}).click();
  await expect(page.locator('#gaze-scroll-assistant')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__cameraCalls)).toBe(0);
});

test('real MediaPipe WASM/model initializes locally without camera or external requests',async({page})=>{
  const remote=[],errors=[];
  page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4173'))remote.push(request.url());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/camera.html');
  await page.getByRole('button',{name:'모델만 점검 (카메라 안 켬)',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('모델 로드 성공',{timeout:20000});
  expect(await page.evaluate(()=>window.__cameraCalls)).toBe(0);
  expect(remote).toEqual([]);expect(errors).toEqual([]);
  await page.screenshot({path:'docs/model-check.png'});
});

test('camera denial is handled with a stub; no actual permission request',async({page})=>{
  await page.goto('/camera.html');await page.getByRole('button',{name:'카메라 켜기',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('카메라 권한이 허용되지 않았습니다',{timeout:20000});
  expect(await page.evaluate(()=>window.__cameraCalls)).toBe(1);
  expect(await page.locator('video').evaluate(v=>v.srcObject)).toBe(null);
});

test('fixture and reader controls render at desktop and narrow widths',async({page})=>{
  await page.goto('/');await page.screenshot({path:'docs/desktop.png',fullPage:true});
  await launch(page);await neutral(page);await page.screenshot({path:'docs/reader-controls.png'});
  await page.setViewportSize({width:760,height:900});
  await expect(page.getByRole('button',{name:'정지 · Esc',exact:true})).toBeVisible();
  await page.screenshot({path:'docs/narrow.png'});
});

test('synthetic feature calibration reaches commands, stops on loss, invalidates on resize',async({page})=>{
  test.setTimeout(60000);
  const {build}=await import('esbuild');
  const harness=await build({stdin:{contents:`import {createReader} from './src/reader.js';
    window.testReader=createReader();window.synthetic={x:.5,y:.5,valid:true};
    setInterval(()=>{let point=window.synthetic;
      const root=document.querySelector('#gaze-scroll-assistant').shadowRoot;
      if(root.querySelector('.calibration').style.display==='block'){
        const dot=root.querySelector('.caldot');point={x:parseFloat(dot.style.left)/100||.5,y:parseFloat(dot.style.top)/100||.5,valid:true};
      }
      window.testReader.receive({valid:point.valid,features:[.4+.08*point.x,.03+.06*point.y,.4+.08*point.x,.03+.06*point.y,.5,.5,.3,0,.3],pose:[.5,.5,.3,0,.3]});
    },60);`,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'iife'});
  await page.route('**/test-harness.js',route=>route.fulfill({contentType:'text/javascript',body:harness.outputFiles[0].text}));
  await page.goto('/');await page.clock.install();
  await page.addScriptTag({url:'/test-harness.js'});await page.clock.runFor(100);
  await page.getByRole('button',{name:'시선 보정',exact:true}).click();
  await page.clock.runFor(40000);
  await expect(page.getByRole('status')).toContainText('보정 통과');
  await page.getByRole('button',{name:'시작 / 재개',exact:true}).click();await page.clock.runFor(600);
  await page.evaluate(()=>window.synthetic={x:.5,y:.93,valid:true});await page.clock.runFor(1400);
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(300);
  await page.evaluate(()=>window.synthetic.valid=false);await page.clock.runFor(100);
  await expect(page.getByRole('status')).toContainText('추적 실패');
  const y=await page.evaluate(()=>scrollY);await page.clock.runFor(2000);expect(await page.evaluate(()=>scrollY)).toBe(y);
  await page.setViewportSize({width:1200,height:850});await page.clock.runFor(100);
  await expect(page.getByRole('button',{name:'시작 / 재개',exact:true})).toBeDisabled();
  await page.evaluate(()=>window.synthetic={x:.5,y:.5,valid:true});await page.clock.runFor(100);
  await page.getByRole('button',{name:'시선 보정',exact:true}).click();await page.clock.runFor(25000);
  await expect(page.getByRole('heading',{name:/정확도 확인/})).toBeVisible();
  await page.getByRole('button',{name:'보정 취소 · Esc',exact:true}).click();
  await expect(page.getByRole('button',{name:'시작 / 재개',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>window.__cameraCalls)).toBe(0);
});
