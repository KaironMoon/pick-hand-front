import assert from "node:assert/strict";
import test from "node:test";

import { findGhSlotByNumber, findGhSlotReplacement } from "../src/pages/ghgame/slot-sync.js";

test("GH slot sync follows a replacement linked to the stale game", () => {
  const replacement = findGhSlotReplacement([
    { slot_no: 1, occupied: true, game_id: 20, previous_game_id: 10 },
    { slot_no: 2, occupied: true, game_id: 30, previous_game_id: null },
  ], 10, null);
  assert.equal(replacement.game_id, 20);
});

test("GH slot sync falls back to the selected slot after a lost response", () => {
  const replacement = findGhSlotReplacement([
    { slot_no: 4, occupied: true, game_id: 41, previous_game_id: null },
  ], 40, 4);
  assert.equal(replacement.game_id, 41);
});

test("GH slot sync does nothing while the current game is still mapped", () => {
  assert.equal(findGhSlotReplacement([
    { slot_no: 1, occupied: true, game_id: 10, previous_game_id: 9 },
  ], 10, 1), null);
});

test("GH slot lookup resolves the latest occupied slot by number", () => {
  const slot = findGhSlotByNumber([
    { slot_no: 1, occupied: false },
    { slot_no: 2, occupied: true, game_id: 20 },
  ], 2);

  assert.equal(slot.game_id, 20);
  assert.equal(findGhSlotByNumber([], 2), null);
  assert.equal(findGhSlotByNumber([{ slot_no: 2 }], 7), null);
});
