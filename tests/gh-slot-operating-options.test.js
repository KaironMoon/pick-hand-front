import assert from "node:assert/strict";
import test from "node:test";

import {
  ghBetStopReasonLabel,
  ghDrawdownStatusLabel,
  ghProfitStopStatusLabel,
  ghSlotLossStatusLabel,
} from "../src/pages/ghgame/slot-operating-options.js";

test("GH slot loss status shows current and projected loss conditions", () => {
  assert.equal(ghSlotLossStatusLabel({}), "사용안함");
  assert.equal(
    ghSlotLossStatusLabel({
      configured_limit: 500,
      configured_projected_limit: 1000,
      pnl: -490,
      bet_amount: 600,
      projected_pnl: -1090,
      stopped: true,
      trigger: "projected_loss",
    }),
    "현재손실 500 P · 패배예상손실 1,000 P · GH PNL -490 P · 다음 GH 600 P · 패배예상 PNL -1,090 P · 패배예상손실 중지",
  );
  assert.match(
    ghSlotLossStatusLabel({ configured_limit: 500, configured_projected_limit: 0 }),
    /^현재손실 500 P · 패배예상손실 미사용/,
  );
});

test("GH drawdown status distinguishes disabled, waiting, armed, and stopped", () => {
  assert.equal(ghDrawdownStatusLabel({}), "사용안함");
  assert.match(ghDrawdownStatusLabel({ drawdown_start: 10, drawdown_percent: 20 }), /대기$/);
  assert.match(ghDrawdownStatusLabel({ drawdown_start: 10, drawdown_percent: 20, drawdown_armed: true, drawdown_peak: 15 }), /감시중 \(최고 15 P\)$/);
  assert.match(ghDrawdownStatusLabel({ drawdown_start: 10, drawdown_percent: 20, reason: "drawdown_reached" }), /중지$/);
  assert.match(ghDrawdownStatusLabel({ configured_drawdown_start: 10, effective_drawdown_start: 1, drawdown_percent: 20 }), /판정 시작 1 P/);
  assert.match(ghDrawdownStatusLabel({ drawdown_start: 10, drawdown_percent: 20 }), /^10 P 이상 달성 시 최고 PNL에서/);
});

test("GH betting stop reason follows the persisted server round state", () => {
  assert.equal(ghBetStopReasonLabel({}), null);
  assert.equal(
    ghBetStopReasonLabel({ overall_stop: { reason: "goal_reached", pnl: 101, target: 100 } }),
    "현재 PNL 101 P가 목표 100 P에 도달 (전체 목표금액 달성)",
  );
  assert.equal(
    ghBetStopReasonLabel({
      overall_stop: {
        reason: "drawdown_reached",
        pnl: 80,
        drawdown_peak: 100,
        drawdown_threshold: 80,
      },
    }),
    "현재 PNL 80 P가 최고 PNL 100 P 대비 종료 기준 80 P 이하에 도달 (최고 PNL 손실률)",
  );
  assert.equal(
    ghBetStopReasonLabel({
      round_num: 60,
      overall_stop: { reason: "end_round_reached", end_round: 60 },
    }),
    "현재 60회차가 마감 60회차에 도달 (미달 마감)",
  );
  assert.equal(
    ghBetStopReasonLabel({
      overall_stop: {
        reason: "active_pot_limit_reached",
        active_pot_count: 2,
        pot_stop_count: 2,
      },
    }),
    "활성 POT 2개가 종료 기준 2개 이하에 도달 (잔여 POT 종료)",
  );
  assert.equal(
    ghBetStopReasonLabel({
      overall_stop: {
        reason: "round_bet_loss_streak_reached",
        round_bet_loss_streak_stop: 4,
        round_bet_loss_streak_trigger_round: 11,
        round_bet_loss_streak_trigger_bet_amount: 12.3,
        round_bet_loss_streak_compared_bet_limit: 10,
      },
    }),
    "4연패 이후 11회차 GH 배팅액 12.3 P가 종료 기준 10 P 이상에 도달 (배팅액판 연패중지)",
  );
  assert.equal(
    ghBetStopReasonLabel({
      overall_stop: {
        reason: "round_bet_loss_streak_reached",
        round_bet_loss_streak_trigger_condition: 2,
        round_bet_loss_streak_stop: 3,
        round_bet_loss_streak_trigger_round: 8,
        round_bet_loss_streak_trigger_bet_amount: 10,
        round_bet_loss_streak_compared_bet_limit: 10,
      },
    }),
    "3연패 이후 8회차 GH 배팅액 10 P가 종료 기준 10 P 이상에 도달 (배팅액판 연패중지 2번)",
  );
  assert.equal(
    ghBetStopReasonLabel({
      globalhit_loss_stop: {
        stopped: true,
        trigger: "projected_loss",
        pnl: -695,
        bet_amount: 86,
        projected_pnl: -781,
        configured_projected_limit: 700,
      },
    }),
    "GH PNL -695 P에서 다음 GH 배팅 86 P 패배 시 예상 PNL -781 P가 종료 기준 -700 P 이하에 도달 (패배예상손실)",
  );
  assert.equal(
    ghBetStopReasonLabel({
      globalhit_loss_stop: {
        stopped: true,
        trigger: "current_loss",
        pnl: -500,
        configured_limit: 500,
      },
    }),
    "GH PNL -500 P가 종료 기준 -500 P 이하에 도달 (현재손실)",
  );
  assert.equal(
    ghBetStopReasonLabel({
      profit_stop: {
        stopped: true,
        trigger_pnl: 20,
        stopped_at_round: 11,
        trigger_bet_amount: 12.3,
        bet_limit: 10,
      },
    }),
    "GH PNL 20 P 상태에서 11회차 GH 배팅액 12.3 P가 종료 기준 10 P 이상에 도달 (수익보호)",
  );
  assert.equal(
    ghBetStopReasonLabel({ overall_stop: {}, profit_stop: { stopped: false } }),
    null,
  );
});

test("GH profit protection status distinguishes disabled, active, and stopped", () => {
  assert.equal(ghProfitStopStatusLabel({}), "사용안함");
  assert.match(ghProfitStopStatusLabel({ after_round: 20, bet_limit: 5 }), /정상$/);
  assert.match(ghProfitStopStatusLabel({ after_round: 20, bet_limit: 5, stopped: true, mode: "actual", trigger_pnl: 3, trigger_bet_amount: 5 }), /GH PNL 3 P \/ GH 배팅 5 P · 중지$/);
});

test("fixed criteria keep combined goal and GH profit-protection wording", () => {
  assert.equal(
    ghBetStopReasonLabel({ overall_stop: { reason: "goal_reached", pnl: 101, target: 100 } }),
    "현재 PNL 101 P가 목표 100 P에 도달 (전체 목표금액 달성)",
  );
  assert.match(
    ghProfitStopStatusLabel({ after_round: 20, bet_limit: 5, stopped: true, trigger_pnl: 3, trigger_bet_amount: 5 }),
    /GH PNL 3 P \/ GH 배팅 5 P · 중지$/,
  );
});
