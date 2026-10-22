import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrationSummary, formatCalibrationSummary} from '../src/diagnostics.js';
test('summary allowlist excludes user and camera payloads recursively',()=>{
  const result={ok:false,meanError:.123456,maxError:Infinity,regions:[.5,1,0],
    points:[{target:{x:.5,y:.09,secret:'private'},count:24,meanError:.1,maxError:.2,coverage:.5,features:[123],video:'private'}],
    reasons:['private'],url:'private',weights:[123],deviceId:'private'};
  const summary=calibrationSummary(result,[{count:24,kept:20,features:[123]}]);
  assert.equal(summary.meanError,.1235);assert.equal(summary.maxError,null);
  assert.equal(summary.passed,false);assert.equal(summary.validationPoints[0].samples,24);
  const serialized=formatCalibrationSummary(result,[{count:24,kept:20,features:[123]}]);
  assert.doesNotMatch(serialized,/private|features|deviceId|weights|video|reasons|url/);
  assert.deepEqual(JSON.parse(serialized),summary);
});
test('missing and non-finite measurements remain unknown rather than false precision',()=>{
  const summary=calibrationSummary({ok:true,points:[{count:-1,target:{},coverage:NaN}]});
  assert.equal(summary.meanError,null);assert.equal(summary.validationPoints[0].samples,null);
  assert.equal(summary.validationPoints[0].agreement,null);
  assert.deepEqual(summary.trainingPoints,[]);assert.equal(summary.regionAgreement[0].ratio,null);
});
