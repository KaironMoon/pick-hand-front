import assert from "node:assert/strict";
import test from "node:test";

import { resolveBetBoardDirection } from "../src/pages/ghgame/bet-board-direction.js";

// The chip and BET must show the same final direction even when GH and Z oppose it.
test("GH chip follows the final board instead of independent strategy directions", () => {
  const state = {
    globalhit_aggregate: { direction: "P", amount: 0.1 },
    pick_martin: { direction: "P", amount: 0.2 },
    round_amount_table: { total_side: "B", total_amount: 1.3 },
  };
  assert.equal(resolveBetBoardDirection(state), "B");
});

test("GH chip changes with the board immediately without an auto-status update", () => {
  const before = { round_amount_table: { total_side: "P" } };
  const after = { round_amount_table: { total_side: "B" } };
  assert.equal(resolveBetBoardDirection(before), "P");
  assert.equal(resolveBetBoardDirection(after), "B");
});

test("GH chip waits when the server has no final board direction", () => {
  assert.equal(resolveBetBoardDirection({
    round_amount_table: { total_side: null, total_amount: 0 },
    pick_martin: { direction: "P" },
    globalhit_aggregate: { direction: "B" },
  }), null);
  assert.equal(resolveBetBoardDirection(null), null);
});
