import assert from "node:assert/strict";
import test from "node:test";

import {
  isHighStepOverlapWait,
  isMaxMissAtLeast,
  isMissStreakAtLeast,
} from "../src/pages/ghgame/components/strategy-board-alerts.js";

test("round and quarter current miss streaks blink from 7M", () => {
  assert.equal(isMissStreakAtLeast("6M", 7), false);
  assert.equal(isMissStreakAtLeast("7M", 7), true);
  assert.equal(isMissStreakAtLeast("12M", 7), true);
  assert.equal(isMissStreakAtLeast("9H", 7), false);
});

test("maximum miss streaks blink from 9 after the shared label trigger", () => {
  assert.equal(isMaxMissAtLeast("12-8", 9), false);
  assert.equal(isMaxMissAtLeast("4-9", 9), true);
  assert.equal(isMaxMissAtLeast("3-11", 9), true);
  assert.equal(isMaxMissAtLeast("9M", 9), false);
});

test("only high-step overlap wait picks blink on the calculator board", () => {
  assert.equal(isHighStepOverlapWait("P(W)", "(고단계 중첩정지)"), true);
  assert.equal(isHighStepOverlapWait("B(W)", "(고단계 중첩정지)"), true);
  assert.equal(isHighStepOverlapWait("P(W)", "쿼터휴식:육전"), false);
  assert.equal(isHighStepOverlapWait("W", "(고단계 중첩정지)"), false);
  assert.equal(isHighStepOverlapWait("B", "(고단계 중첩정지)"), false);
});
