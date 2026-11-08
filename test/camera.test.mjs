import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestCamera, cameraErrorMessage } from '../public/camera.js';

const fail = name => Object.assign(new Error(name), {name});

test('uses the default camera without imposing a capture resolution', async () => {
  const stream = {};
  const result = await requestCamera({ getUserMedia: async constraints => {
    assert.deepEqual(constraints, {video:true,audio:false});
    return stream;
  }});
  assert.equal(result, stream);
});

test('recovers when the browser default is stale but another camera is available', async () => {
  let calls = 0;
  const stream = {};
  const result = await requestCamera({
    enumerateDevices: async () => [{kind:'audioinput',deviceId:'mic'}, {kind:'videoinput',deviceId:'connected-webcam'}],
    getUserMedia: async constraints => {
      if (++calls === 1) throw fail('NotFoundError');
      assert.deepEqual(constraints, {video:{deviceId:{exact:'connected-webcam'}},audio:false});
      return stream;
    }
  });
  assert.equal(result, stream);
  assert.equal(calls, 2);
});

test('reports missing hardware without substituting a sample stream', async () => {
  const error = fail('NotFoundError');
  await assert.rejects(requestCamera({getUserMedia:async()=>{throw error;},enumerateDevices:async()=>[]}), e=>e===error);
  assert.match(cameraErrorMessage(error), /Reconnect it/);
});

test('does not repeatedly request permission when access is blocked', async () => {
  let calls = 0;
  await assert.rejects(requestCamera({getUserMedia:async()=>{calls++;throw fail('NotAllowedError');}}), {name:'NotAllowedError'});
  assert.equal(calls, 1);
  assert.match(cameraErrorMessage(fail('NotAllowedError')), /access is blocked/);
});

test('distinguishes a busy device from an absent one', () => {
  assert.match(cameraErrorMessage(fail('NotReadableError')), /busy/);
});
