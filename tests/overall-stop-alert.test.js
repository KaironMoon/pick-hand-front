import assert from "node:assert/strict";
import test from "node:test";

import { claimOverallStopAlert } from "../src/pages/ghgame/overall-stop-alert.js";

test("overall goal alert is shown only once for an auto game", () => {
  const alerted = new Set();

  assert.deepEqual(
    claimOverallStopAlert(alerted, 100, "goal_reached", "auto"),
    {
      title: "전체 목표금액 달성",
      detail: "전체 목표금액을 달성하여 배팅이 정지되었습니다.",
      modeLabel: "오토",
    },
  );
  assert.equal(
    claimOverallStopAlert(alerted, 100, "goal_reached", "auto"),
    null,
  );
});

test("end-round alert is shown for a manual game", () => {
  const alert = claimOverallStopAlert(
    new Set(),
    101,
    "end_round_reached",
    "manual",
  );

  assert.equal(alert.title, "미달마감 도달");
  assert.equal(alert.modeLabel, "수동");
});

test("goal reason wins when callers report only the server-selected reason", () => {
  const alert = claimOverallStopAlert(
    new Set(),
    102,
    "goal_reached",
    "auto",
  );

  assert.equal(alert.title, "전체 목표금액 달성");
});

test("active POT limit alert explains that only betting stopped", () => {
  const alert = claimOverallStopAlert(
    new Set(),
    103,
    "active_pot_limit_reached",
    "auto",
  );

  assert.deepEqual(alert, {
    title: "잔여 POT 종료",
    detail: "활성 배팅 POT 수가 설정값 이하가 되어 배팅이 정지되었습니다.",
    modeLabel: "오토",
  });
});

test("section goals and unknown reasons do not open the overall alert", () => {
  assert.equal(
    claimOverallStopAlert(new Set(), 104, "strategy_goal_reached", "manual"),
    null,
  );
});
