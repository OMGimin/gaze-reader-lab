import {createReader} from './reader.js';
import {isAllowedUrl} from './core.js';
if(isAllowedUrl(location.href)&&!document.getElementById('gaze-scroll-assistant')){
  const port=chrome.runtime.connect({name:'reader'});
  const reader=createReader({onClose:()=>port.disconnect(),onCamera:()=>reader.status('별도 Gaze Camera 창에서 시작하세요. 창을 닫았다면 도우미를 닫고 확장 아이콘을 다시 누르세요.')});
  port.onMessage.addListener(message=>{
    if(message.type==='sample')reader.receive(message.sample);
    if(message.type==='notice')reader.status(message.text);
    if(message.type==='close')reader.close();
  });
  port.onDisconnect.addListener(()=>reader.close());
}
