import test from "node:test";
import assert from "node:assert/strict";

import { bigRoadCurrentStatus, isBigRoadWaitRow } from "../src/pages/ghgame/bigroad2-wait.js";

test("BigRoad2 displays P/B high-step wait history as W", () => {
  assert.equal(isBigRoadWaitRow({ pick: "P", status: "wait", result: null }), true);
  assert.equal(isBigRoadWaitRow({ pick: "B", status: "wait", result: null }), true);
  assert.equal(isBigRoadWaitRow({ pick: "W", status: "wait", result: null }), true);
});

test("BigRoad2 keeps settled P/B history as a normal result", () => {
  assert.equal(isBigRoadWaitRow({ pick: "P", status: "hit", result: "hit" }), false);
  assert.equal(isBigRoadWaitRow({ pick: "B", status: "miss", result: "miss" }), false);
});

test("BigRoad2 exposes the current high-step overlap stop as wait", () => {
  assert.equal(bigRoadCurrentStatus({
    status: undefined,
    bet_unavailable_reason: "high_step_overlap_wait",
  }), "wait");
  assert.equal(bigRoadCurrentStatus({ status: "rest" }), "rest");
});
