import assert from "node:assert/strict";
import test from "node:test";

import {
  NC2_KEEP_COUNT_DEFAULT,
  nc2KeepLabel,
  parseNc2KeepCount,
} from "../src/pages/nc2game/keep-count.js";

test("NC2 KEEP defaults to five and accepts only two through ten shoes", () => {
  assert.equal(parseNc2KeepCount(2), 2);
  assert.equal(parseNc2KeepCount("5"), 5);
  assert.equal(parseNc2KeepCount(1), null);
  assert.equal(parseNc2KeepCount(6), 6);
  assert.equal(parseNc2KeepCount("10"), 10);
  assert.equal(parseNc2KeepCount(11), null);
  assert.equal(parseNc2KeepCount(20), null);
  assert.equal(parseNc2KeepCount("2.5"), null);
  assert.equal(NC2_KEEP_COUNT_DEFAULT, 5);
});

test("NC2 KEEP label is plain while stopped and shows the server count while running", () => {
  assert.equal(nc2KeepLabel(5, { running: false }), "keep");
  assert.equal(nc2KeepLabel(5, {
    running: true,
    play_mode: "keep",
    keep_shoes_remaining: 1,
  }), "keep(1)");
  assert.equal(nc2KeepLabel(5, {
    running: true,
    play_mode: "one",
    keep_shoes_remaining: null,
  }), "keep");
  assert.equal(nc2KeepLabel(null, { running: true, play_mode: "keep" }), "keep(5)");
});
