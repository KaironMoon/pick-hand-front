import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoalStatusItems,
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
      AAR: { target: 30, pnl: 31, reached: true },
      SSR1: { target: 0, pnl: 5, reached: false },
    },
    { target: 100, pnl: 40, reason: null },
    { running: false },
  );

  assert.deepEqual(
    items.find((item) => item.key === "AAR"),
    { key: "AAR", label: "A", target: 30, pnl: 31, reached: true, dimmed: false },
  );
  assert.equal(items.find((item) => item.key === "SSR1").dimmed, true);
  assert.deepEqual(
    items.at(-1),
    { key: "overall-pnl", label: "Pnl", target: 100, pnl: 40, reached: false, dimmed: false },
  );
});

test("overall Pnl uses actual auto PNL while auto is running", () => {
  const items = buildGoalStatusItems(
    {},
    { target: 100, pnl: 10, reason: null },
    { running: true, goal_amount: 10, pnl_actual_p: 10.1, stop_reason: "goal_reached" },
  );

  assert.deepEqual(
    items.at(-1),
    { key: "overall-pnl", label: "Pnl", target: 10, pnl: 10.1, reached: true, dimmed: false },
  );
});

test("goal amount formatting keeps at most one decimal place", () => {
  assert.equal(formatGoalTarget(30), "30");
  assert.equal(formatGoalTarget(0.1), "0.1");
});
