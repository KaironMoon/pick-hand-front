import assert from "node:assert/strict";
import test from "node:test";

import {
  betStopRoundLabel,
  normalizeBetBlockAfterRound,
} from "../src/pages/nc2game/bet-block-setting.js";

test("NC2 bet block round is normalized to zero through sixty", () => {
  assert.equal(normalizeBetBlockAfterRound(-1), 0);
  assert.equal(normalizeBetBlockAfterRound(45), 45);
  assert.equal(normalizeBetBlockAfterRound(99), 60);
});

test("bet stop description follows the configured first stopped round", () => {
  assert.equal(betStopRoundLabel(0), "사용안함");
  assert.equal(betStopRoundLabel(45), "45회차부터 배팅 중지");
});
