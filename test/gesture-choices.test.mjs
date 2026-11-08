import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gestureArtwork, selectedChoiceIndex } from '../public/gesture-choices.js';

test('recognizes the gesture options and keeps unknown choices distinct', () => {
  assert.equal(gestureArtwork('Open palm'),'/assets/gestures/palm.svg');
  assert.equal(gestureArtwork('Closed fist'),'/assets/gestures/fist.svg');
  assert.equal(gestureArtwork('Pointing'),'/assets/gestures/point.svg');
  assert.equal(gestureArtwork('Other or no hand'),'/assets/gestures/fallback.svg');
  assert.equal(gestureArtwork('Search the web'),null);
});
test('highlights the returned bounded choice, with a probability fallback', () => {
  assert.equal(selectedChoiceIndex('option_2',[0.8,0.1,0.05,0.05],4),2);
  assert.equal(selectedChoiceIndex('option_9',[0.1,0.7,0.1,0.1],4),1);
  assert.equal(selectedChoiceIndex(undefined,[0,0,0,0],4),-1);
  assert.equal(selectedChoiceIndex(undefined,[],4),-1);
});
