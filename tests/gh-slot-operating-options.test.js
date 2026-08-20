import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("GH profit protection status distinguishes disabled, active, and stopped", () => {
  assert.equal(ghProfitStopStatusLabel({}), "사용안함");
  assert.match(ghProfitStopStatusLabel({ after_round: 20, bet_limit: 5 }), /정상$/);
  assert.match(ghProfitStopStatusLabel({ after_round: 20, bet_limit: 5, stopped: true, mode: "actual", trigger_pnl: 3, trigger_bet_amount: 5 }), /실PNL 3 P \/ 배팅 5 P · 중지$/);
});
