import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleHandBox, projectHandBox } from '../public/hand-box.js';

const box = {left:0.1,top:0.2,right:0.4,bottom:0.7};
test('draws only when hand presence is strictly above 50 percent', () => {
  for (const probability of [0,0.49,0.5,NaN,undefined]) assert.equal(visibleHandBox(probability,box),null);
  assert.deepEqual(visibleHandBox(0.50001,box),box);
});
test('clears missing and malformed boxes instead of retaining an old detection', () => {
  for (const invalid of [null,undefined,{}, {...box,right:0.1},{...box,top:-0.2},{...box,bottom:Infinity}]) assert.equal(visibleHandBox(0.99,invalid),null);
});
test('mirrors the model box to match the camera preview', () => {
  const rect = projectHandBox(box,{sourceWidth:640,sourceHeight:480,viewWidth:640,viewHeight:480});
  assert.equal(rect.left,384); assert.equal(rect.top,96);
  assert.equal(rect.width,192); assert.equal(rect.height,240);
});
test('removes capture letterboxing before positioning over widescreen video', () => {
  assert.deepEqual(projectHandBox({left:0.25,top:0.25,right:0.5,bottom:0.75},{sourceWidth:1280,sourceHeight:720,viewWidth:1280,viewHeight:720}), {left:640,top:120,width:320,height:480});
});
test('accounts for object-fit cropping and clips boxes to the visible camera area', () => {
  assert.deepEqual(projectHandBox({left:0.25,top:0.25,right:0.5,bottom:0.75},{sourceWidth:640,sourceHeight:480,viewWidth:640,viewHeight:360}),{left:320,top:60,width:160,height:240});
  assert.equal(projectHandBox({left:0.1,top:0,right:0.2,bottom:0.1},{sourceWidth:640,sourceHeight:480,viewWidth:640,viewHeight:200}),null);
});
