import assert from "node:assert/strict";
import test from "node:test";

import {
  GH_KEEP_COUNT_DEFAULT,
  ghKeepLabel,
  parseGhKeepCount,
} from "../src/pages/ghgame/keep-count.js";

test("GH KEEP defaults to five and accepts only two through five shoes", () => {
  assert.equal(parseGhKeepCount(2), 2);
  assert.equal(parseGhKeepCount("5"), 5);
  assert.equal(parseGhKeepCount(1), null);
  assert.equal(parseGhKeepCount(6), null);
  assert.equal(parseGhKeepCount(20), null);
  assert.equal(parseGhKeepCount("2.5"), null);
  assert.equal(GH_KEEP_COUNT_DEFAULT, 5);
});

test("GH KEEP label is plain while stopped and shows the server count while running", () => {
  assert.equal(ghKeepLabel(5, { running: false }), "keep");
  assert.equal(ghKeepLabel(5, {
    running: true,
    play_mode: "keep",
    keep_shoes_remaining: 1,
  }), "keep(1)");
  assert.equal(ghKeepLabel(5, {
    running: true,
    play_mode: "one",
    keep_shoes_remaining: null,
  }), "keep");
  assert.equal(ghKeepLabel(null, { running: true, play_mode: "keep" }), "keep(5)");
});
