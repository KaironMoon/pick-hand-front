import assert from "node:assert/strict";
import test from "node:test";
import { resolveSlotPnl } from "../src/pages/ghgame/slot-summary.js";

const slot = { occupied: true, game_id: 77, total_pnl: 99 };
const state = {
  round_amount_table: { total_pnl: 123 },
  actual_bet_table: { server_total_pnl_p: -4.5 },
};

test("selected slot switches from calculated to actual PNL while Auto runs", () => {
  assert.equal(resolveSlotPnl(slot, "77", state, { running: false }), 123);
  assert.equal(resolveSlotPnl(slot, "77", state, { running: true }), -4.5);
  assert.equal(resolveSlotPnl(slot, "77", state, { running: false }), 123);
});

test("other slots use their own server-selected PNL regardless of selected Auto", () => {
  assert.equal(resolveSlotPnl(slot, 78, state, { running: true }), 99);
  assert.equal(resolveSlotPnl(slot, 78, state, { running: false }), 99);
});

test("zero actual PNL does not fall back to calculated or stale slot PNL", () => {
  assert.equal(resolveSlotPnl(slot, 77, {
    ...state, actual_bet_table: { server_total_pnl_p: 0 },
  }, { running: true }), 0);
});

test("slot API value is used before selected state loads and empty slots stay zero", () => {
  assert.equal(resolveSlotPnl(slot, 77, null, { running: true }), 99);
  assert.equal(resolveSlotPnl(undefined, 77, state, { running: true }), 0);
});
