import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoalStatusItems,
  formatGoalIndicator,
  formatGoalTarget,
  GOAL_STATUS_ITEMS,
} from "../src/pages/ghgame/goal-status.js";

test("goal status uses the approved multi POT order and labels", () => {
  assert.deepEqual(
    GOAL_STATUS_ITEMS.map(({ key, label }) => [key, label]),
    [
      ["AAR", "A"], ["SSR1", "S1"], ["SSR2", "S2"], ["SSR3", "S3"],
      ["FOR", "F"], ["FORX", "FX"], ["SQ", "SQ"], ["GOBH", "GH"],
      ["GOBP", "G%"], ["허니비", "H"], ["W111", "W"], ["M22", "M"],
      ["D112", "D"], ["PBJ", "PJ"],
    ],
  );
});

test("missing targets stay visible but dimmed and reached targets light up", () => {
  const items = buildGoalStatusItems(
    {
      AAR: { target: 30, pnl: 31, reached: true, reached_round: 23 },
      SSR1: { target: 0, pnl: 5, reached: false },
    },
    { target: 100, pnl: 40, reason: null },
    { running: false },
  );

  assert.deepEqual(
    items.find((item) => item.key === "AAR"),
    { key: "AAR", label: "A", target: 30, pnl: 31, reached: true, reachedRound: 23, dimmed: false },
  );
  assert.equal(items.find((item) => item.key === "SSR1").dimmed, true);
  assert.deepEqual(
    items.at(-1),
    { key: "overall-pnl", label: "Pnl", target: 100, pnl: 40, reached: false, reachedRound: 0, dimmed: false },
  );
});

test("combined Pnl uses the server round-state value while auto is running", () => {
  const items = buildGoalStatusItems(
    {},
    { target: 100, pnl: 10, reason: null },
    { running: true, goal_amount: 10, pnl_actual_p: 10.1, stop_reason: "goal_reached", round_count: 42 },
  );

  assert.deepEqual(
    items.at(-1),
    { key: "overall-pnl", label: "Pnl", target: 100, pnl: 10, reached: true, reachedRound: 42, dimmed: false },
  );
});

test("overall goal keeps the combined Pnl label", () => {
  const items = buildGoalStatusItems({}, { target: 10, pnl: 1 }, null);
  assert.equal(items.at(-1).label, "Pnl");
});

test("goal amount formatting keeps at most one decimal place", () => {
  assert.equal(formatGoalTarget(30), "30");
  assert.equal(formatGoalTarget(0.1), "0.1");
});

test("goal indicators show only the first reached round without a suffix", () => {
  assert.equal(formatGoalIndicator({ label: "A", reached: false, reachedRound: 0 }), "A");
  assert.equal(formatGoalIndicator({ label: "S1", reached: true, reachedRound: 31 }), "S1 31");
  assert.equal(formatGoalIndicator({ label: "GH Pnl", reached: true, reachedRound: 42 }), "GH Pnl 42");
});
