import assert from "node:assert/strict";
import test from "node:test";

import {
  NC2_KEEP_COUNT_DEFAULT,
  nc2KeepLabel,
  parseNc2KeepCount,
} from "../src/pages/nc2game/keep-count.js";

test("NC2 KEEP accepts only two through one hundred shoes", () => {
  assert.equal(parseNc2KeepCount(2), 2);
  assert.equal(parseNc2KeepCount("100"), 100);
  assert.equal(parseNc2KeepCount(1), null);
  assert.equal(parseNc2KeepCount(101), null);
  assert.equal(parseNc2KeepCount("2.5"), null);
  assert.equal(NC2_KEEP_COUNT_DEFAULT, 20);
});

test("NC2 KEEP label is plain while stopped and shows the server count while running", () => {
  assert.equal(nc2KeepLabel(20, { running: false }), "keep");
  assert.equal(nc2KeepLabel(20, {
    running: true,
    play_mode: "keep",
    keep_shoes_remaining: 1,
  }), "keep(1)");
  assert.equal(nc2KeepLabel(20, {
    running: true,
    play_mode: "one",
    keep_shoes_remaining: null,
  }), "keep");
});
