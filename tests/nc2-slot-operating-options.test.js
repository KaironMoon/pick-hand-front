import assert from "node:assert/strict";
import test from "node:test";

import {
  NC2_SLOT_OPERATING_OPTIONS,
  nc2DrawdownConditionLabel,
  nc2SlotLossStopLabel,
  replaceNc2SlotSetup,
} from "../src/pages/nc2game/slot-operating-options.js";

test("NC2 operating options contain the four numeric stop settings", () => {
  assert.deepEqual(
    NC2_SLOT_OPERATING_OPTIONS.map((item) => item.key),
    [
      "auto_goal_amount",
      "auto_drawdown_start_amount",
      "auto_drawdown_percent",
      "auto_end_round",
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
    "슬롯 NC 합산 누적 100.5 P 손실 시 NC 배팅 전체 정지",
  );
});
