import {build} from 'esbuild';
import {mkdir,cp,copyFile,access} from 'node:fs/promises';
await access('vendor/face_landmarker.task');
for(const dir of ['dist/extension','dist/web']) {
  await mkdir(`${dir}/vendor`,{recursive:true});
  await cp('node_modules/@mediapipe/tasks-vision/wasm',`${dir}/vendor/wasm`,{recursive:true});
  await copyFile('vendor/face_landmarker.task',`${dir}/vendor/face_landmarker.task`);
  await copyFile('vendor/MEDIAPIPE-LICENSE.txt',`${dir}/vendor/MEDIAPIPE-LICENSE.txt`);
  await copyFile('THIRD_PARTY.md',`${dir}/THIRD_PARTY.md`);
  await copyFile('node_modules/@mediapipe/tasks-vision/README.md',`${dir}/vendor/MEDIAPIPE-README.md`);
  for(const name of ['camera.html','camera.css'])await copyFile(`web/${name}`,`${dir}/${name}`);
  await build({entryPoints:['src/camera.js'],outfile:`${dir}/camera.js`,bundle:true,format:'esm',target:'chrome120'});
}
await cp('extension','dist/extension',{recursive:true});
for(const name of ['background','content'])await build({entryPoints:[`src/${name}.js`],outfile:`dist/extension/${name}.js`,bundle:true,format:'iife',target:'chrome120'});
await build({entryPoints:['src/demo.js'],outfile:'dist/web/demo.js',bundle:true,format:'esm',target:'chrome120'});
for(const name of ['index.html','style.css'])await copyFile(`web/${name}`,`dist/web/${name}`);
console.log('Built dist/extension and dist/web. All runtime assets are local.');
