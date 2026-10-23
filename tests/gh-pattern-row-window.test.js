import test from 'node:test';
import assert from 'node:assert/strict';
import { PATTERN_ROW_HEIGHT, patternRowWindow } from '../src/pages/ghgame/pattern-row-window.js';

test('only mounts a small window even with 600 pattern rows', () => {
  assert.deepEqual(patternRowWindow(600, 0, 880), { start: 1, end: 28 });
  assert.deepEqual(patternRowWindow(600, -400 * PATTERN_ROW_HEIGHT, 880), { start: 392, end: 428 });
  assert.deepEqual(patternRowWindow(600, -590 * PATTERN_ROW_HEIGHT, 880), { start: 582, end: 600 });
});

test('offscreen tables keep their full height without mounting hidden rows', () => {
  assert.deepEqual(patternRowWindow(100, 2000, 880), { start: 1, end: 1 });
  assert.deepEqual(patternRowWindow(100, -10000, 880), { start: 100, end: 100 });
});
