import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_MISS_THRESHOLDS,
  maxMissLabel,
} from "../src/pages/ghgame/components/max-miss-dialog.js";

test("maximum miss thresholds cover 3M through 20M", () => {
  assert.deepEqual(MAX_MISS_THRESHOLDS, Array.from({ length: 18 }, (_, index) => index + 3));
});

test("maximum miss values below the selected threshold stay hidden", () => {
  assert.equal(maxMissLabel({ max_miss_streak: 8 }, 9), "");
  assert.equal(maxMissLabel({ max_miss_streak: 9 }, 9), "9M");
  assert.equal(maxMissLabel({ max_miss_streak: 11 }, 9), "11M");
});

test("J can always show its positive maximum miss value", () => {
  assert.equal(maxMissLabel({ max_miss_streak: 4 }, 9, true), "4M");
  assert.equal(maxMissLabel({ max_miss_streak: 0 }, 9, true), "");
});
