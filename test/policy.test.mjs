import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, routeFallback } from '../server/policy.mjs';
test('image requests and image-related questions route differently', () => {
  assert.equal(routeFallback('Create an image of a fox in a forest.'), 'image');
  assert.equal(routeFallback('Can you draw a little cabin?'), 'image');
  assert.equal(routeFallback('How do I generate an image in JavaScript?'), 'chat');
  assert.equal(routeFallback("Don't generate an image; explain lighting."), 'chat');
  assert.equal(routeFallback('Write code to create an image.'), 'chat');
  assert.equal(routeFallback('What is the capital of Romania?'), 'chat');
});
test('generation bounds reject invalid requests before launching a process', () => {
  assert.throws(() => validateRequest({prompt:'hello',mode:'image',settings:{width:1025}}), /multiples/);
  assert.throws(() => validateRequest({prompt:'hello',mode:'image',settings:{steps:999}}), /steps/);
  assert.throws(() => validateRequest({prompt:'hello',mode:'image',settings:{backend:'powershell'}}), /runtime/);
  assert.throws(() => validateRequest({prompt:'hello',mode:'auto',conversationId:'../../elsewhere'}), /ID/);
  assert.throws(() => validateRequest({prompt:' ',mode:'auto'}), /message/);
  assert.equal(validateRequest({prompt:' hello ',mode:'chat'}).prompt, 'hello');
});
