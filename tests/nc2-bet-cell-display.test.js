import assert from "node:assert/strict";
import test from "node:test";

import { nc2BetCellAmountDisplay } from "../src/pages/nc2game/bet-cell-display.js";

test("shows only the amount when martin Z is not included", () => {
  assert.equal(nc2BetCellAmountDisplay({ amount: 1.1 }), "1.1");
});

test("shows the strategy amount and martin Z contribution in a betting cell", () => {
  assert.equal(nc2BetCellAmountDisplay({
    amount: 6.1,
    martinZIncluded: true,
    martinZAmount: 5.0,
  }), "6.1(5.0)");
});

test("shows the server-cut actual amounts in a betting cell", () => {
  assert.equal(nc2BetCellAmountDisplay({
    amount: 0.6,
    martinZIncluded: true,
    martinZAmount: 0.5,
  }), "0.6(0.5)");
});
