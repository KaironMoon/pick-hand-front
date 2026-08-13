import assert from "node:assert/strict";
import test from "node:test";

import {
  extendMartinAmounts,
  GH_FIXED_PASI_LEVELS,
  GH_STRATEGY_MAX_STEP,
} from "../src/pages/ghgame/strategy-step-capacity.js";

test("GlobalHit strategy boxes support fixed assist settings through step 20", () => {
  assert.equal(GH_STRATEGY_MAX_STEP, 20);
  assert.deepEqual(GH_FIXED_PASI_LEVELS, Array.from({ length: 19 }, (_, index) => index + 2));
});

test("GlobalHit martin amounts are extended when the highest step increases", () => {
  const amounts = Array(20).fill(0);
  amounts[14] = 5;
  amounts[15] = 10;
  amounts[17] = 45;

  const extended = extendMartinAmounts(amounts, 16, 20);

  assert.deepEqual(extended.slice(15, 20), [10, 20, 45, 90, 180]);
  assert.deepEqual(extendMartinAmounts(amounts, 16, 16), amounts);
});
