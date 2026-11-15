import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicatePatternRowGroups, duplicatePatternRows } from '../src/pages/ghgame/pattern-duplicates.js';

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

test('returns every matching row index across a 300-row block list', () => {
  const patterns = Array(300).fill('');
  patterns[2] = 'BBP';
  patterns[11] = 'PPB';
  patterns[17] = 'BB';
  patterns[299] = 'BBP';

  const groups = duplicatePatternRowGroups(patterns);
  for (const index of [2, 11, 299]) assert.deepEqual(groups[index], [2, 11, 299]);
  assert.equal(groups.filter(Boolean).length, 3);
});
