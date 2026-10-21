import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicatePatternRows } from '../src/pages/ghgame/pattern-duplicates.js';

test('marks every identical and inverse row, preserving row positions', () => {
  assert.deepEqual(
    duplicatePatternRows(['', 'BBPPPBBP', 'PPBBBPPB', 'BBBB', 'BBPPPBBP', '', 'BPBP']),
    [false, true, true, false, true, false, false],
  );
});

test('does not mark blanks, prefixes or differently ordered patterns', () => {
  assert.deepEqual(duplicatePatternRows(['', '', 'BBPP', 'BBPPP', 'BPBP']),
    [false, false, false, false, false]);
});

test('detects inverse rows independently of betting direction or activation', () => {
  assert.deepEqual(duplicatePatternRows(['PP', 'BB']), [true, true]);
  assert.deepEqual(duplicatePatternRows([]), []);
});
