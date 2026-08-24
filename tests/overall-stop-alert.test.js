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

test("drawdown alert explains that only betting stopped", () => {
  const alert = claimOverallStopAlert(
    new Set(),
    105,
    "drawdown_reached",
    "manual",
  );

  assert.deepEqual(alert, {
    title: "최고 PNL 손실률 도달",
    detail: "최고 PNL 대비 설정 손실률에 도달하여 배팅이 정지되었습니다.",
    modeLabel: "수동",
  });
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

test("round betting board loss streak alert explains the stop", () => {
  const alert = claimOverallStopAlert(
    new Set(),
    106,
    "round_bet_loss_streak_reached",
    "auto",
    {
      round_bet_loss_streak_trigger_round: 11,
      round_bet_loss_streak_trigger_bet_amount: 12.3,
    },
  );

  assert.deepEqual(alert, {
    title: "배팅액판 연패중지",
    detail: "11회차 실제 주문액 12.3 P가 기준금액에 도달하여 배팅이 정지되었습니다.",
    modeLabel: "오토",
  });
});

test("round betting board loss streak alert identifies the triggered condition", () => {
  const alert = claimOverallStopAlert(
    new Set(),
    107,
    "round_bet_loss_streak_reached",
    "manual",
    {
      round_bet_loss_streak_trigger_condition: 3,
      round_bet_loss_streak_trigger_round: 15,
      round_bet_loss_streak_trigger_bet_amount: 30,
    },
  );

  assert.equal(
    alert.detail,
    "3번 조건이 발동하여 15회차 배팅액 30 P가 기준금액에 도달하여 배팅이 정지되었습니다.",
  );
});

test("section goals and unknown reasons do not open the overall alert", () => {
  assert.equal(
    claimOverallStopAlert(new Set(), 104, "strategy_goal_reached", "manual"),
    null,
  );
});
