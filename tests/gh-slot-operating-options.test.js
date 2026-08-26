import assert from "node:assert/strict";
import test from "node:test";

import {
  ghBetStopReasonLabel,
  ghDrawdownStatusLabel,
  ghProfitStopStatusLabel,
} from "../src/pages/ghgame/slot-operating-options.js";

test("GH drawdown status distinguishes disabled, waiting, armed, and stopped", () => {
  assert.equal(ghDrawdownStatusLabel({}), "사용안함");
  assert.match(ghDrawdownStatusLabel({ drawdown_start: 10, drawdown_percent: 20 }), /대기$/);
  assert.match(ghDrawdownStatusLabel({ drawdown_start: 10, drawdown_percent: 20, drawdown_armed: true, drawdown_peak: 15 }), /감시중 \(최고 15 P\)$/);
  assert.match(ghDrawdownStatusLabel({ drawdown_start: 10, drawdown_percent: 20, reason: "drawdown_reached" }), /중지$/);
  assert.match(ghDrawdownStatusLabel({ configured_drawdown_start: 10, effective_drawdown_start: 1, drawdown_percent: 20 }), /판정 시작 1 P/);
});

test("GH betting stop reason follows the persisted server round state", () => {
  assert.equal(ghBetStopReasonLabel({}), null);
  assert.equal(
    ghBetStopReasonLabel({ overall_stop: { reason: "goal_reached", pnl: 101, target: 100 } }),
    "현재 GH PNL 101 P가 목표 100 P에 도달 (GH 목표금액 달성)",
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
    "현재 GH PNL 80 P가 최고 PNL 100 P 대비 종료 기준 80 P 이하에 도달 (GH 최고 PNL 손실률)",
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
