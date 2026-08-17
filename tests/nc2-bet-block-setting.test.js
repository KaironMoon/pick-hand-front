import assert from "node:assert/strict";
import test from "node:test";

import {
  betStepRangeLabel,
  normalizeBetAllowedStepRange,
  normalizeBetBlockAfterRound,
} from "../src/pages/nc2game/bet-block-setting.js";

test("NC2 bet block round is normalized to zero through sixty", () => {
  assert.equal(normalizeBetBlockAfterRound(-1), 0);
  assert.equal(normalizeBetBlockAfterRound(45), 45);
  assert.equal(normalizeBetBlockAfterRound(99), 60);
});

test("allowed step range stays ordered inside one through twenty-five", () => {
  assert.deepEqual(normalizeBetAllowedStepRange(-1, 99), [1, 25]);
  assert.deepEqual(normalizeBetAllowedStepRange(5, 3), [5, 5]);
});

test("bet range description follows the configured round and allowed steps", () => {
  assert.equal(betStepRangeLabel(0, 1, 25), "사용안함");
  assert.equal(betStepRangeLabel(45, 2, 5), "45회차 이후 2~5단계만 배팅 허용");
});
