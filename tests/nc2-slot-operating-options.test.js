import assert from "node:assert/strict";
import test from "node:test";

import {
  NC2_SLOT_OPERATING_OPTIONS,
  nc2DrawdownConditionLabel,
  nc2JModeLabel,
  nc2ProfitStopConditionLabel,
  nc2SlotLossStopLabel,
  replaceNc2SlotSetup,
} from "../src/pages/nc2game/slot-operating-options.js";

test("NC2 operating options contain the six numeric stop settings", () => {
  assert.deepEqual(
    NC2_SLOT_OPERATING_OPTIONS.map((item) => item.key),
    [
      "auto_goal_amount",
      "auto_drawdown_start_amount",
      "auto_drawdown_percent",
      "auto_end_round",
      "profit_stop_after_round",
      "profit_stop_bet_amount",
    ],
  );
});

test("updating an NC2 slot setup leaves the other slots unchanged", () => {
  const setups = Array.from({ length: 6 }, (_, index) => ({
    slot: index + 1,
    reference_count: 32,
    item_win_limit: 60,
    auto_goal_amount: 10,
  }));
  const updated = replaceNc2SlotSetup(setups, 4, {
    ...setups[3],
    reference_count: 128,
    item_win_limit: 25,
    auto_goal_amount: 40,
  });

  assert.equal(updated[3].reference_count, 128);
  assert.equal(updated[3].item_win_limit, 25);
  assert.equal(updated[3].auto_goal_amount, 40);
  assert.equal(updated[0], setups[0]);
  assert.equal(updated[4], setups[4]);
});

test("NC2 current game drawdown condition explains enabled and disabled settings", () => {
  assert.equal(nc2DrawdownConditionLabel({}), "사용안함");
  assert.equal(
    nc2DrawdownConditionLabel({
      auto_drawdown_start_amount: 100.5,
      auto_drawdown_percent: 20,
    }),
    "100.5 P 이상 달성 시 최고 PNL에서 20% 이상 손실 나면 배팅 정지",
  );
});

test("NC2 slot loss stop label explains enabled and disabled settings", () => {
  assert.equal(nc2SlotLossStopLabel({}), "사용안함");
  assert.equal(
    nc2SlotLossStopLabel({ slot_loss_stop_amount: 100.5 }),
    "마틴 제외 순수 NC PNL 100.5 P 손실 시 NC 배팅 정지 · 오토는 PNL/손실금액 모두 실배팅 배율 적용",
  );
});

test("NC2 J mode label distinguishes disabled, waiting, active, and zero-bet states", () => {
  assert.equal(nc2JModeLabel({}, {}), "사용안함");
  assert.equal(
    nc2JModeLabel({ j_mode_enabled: true }, { j_mode: { active: false } }),
    "사용함 · 21회차부터 NC 금액 + J 방향",
  );
  assert.equal(
    nc2JModeLabel(
      { j_mode_enabled: true },
      { j_mode: { active: true, direction: "B", amount: 12.8 } },
    ),
    "적용중 · B 12.8 P",
  );
  assert.equal(
    nc2JModeLabel(
      { j_mode_enabled: true },
      { j_mode: { active: true, direction: null, amount: 0 } },
    ),
    "적용중 · 대기 0 P",
  );
});

test("NC2 profit stop label explains the following-round boundary", () => {
  assert.equal(nc2ProfitStopConditionLabel({}), "사용안함");
  assert.equal(
    nc2ProfitStopConditionLabel({
      profit_stop_after_round: 40,
      profit_stop_bet_amount: 10.5,
    }),
    "40회차 이후 10.5 P 이상 배팅 할 경우 이후 배팅 중지",
  );
});
