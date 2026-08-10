import assert from "node:assert/strict";
import test from "node:test";

import {
  autoStatusLookupError,
  createEmptyAutoStatus,
  mergePolledAutoStatus,
  shouldDisplayAutoError,
  shouldDisplayBetFailure,
  shouldDisplaySlotAutoError,
} from "../src/pages/ghgame/auto-status.js";

test("new game status starts without the previous auto error", () => {
  assert.deepEqual(createEmptyAutoStatus(), {
    running: false,
    autoSessionId: null,
    phase: null,
    stop_reason: null,
    active_pot_count: null,
    pot_stop_count: 0,
    goal_amount: 0,
    error_code: null,
    error_detail: null,
    pending_direction: null,
    pending_amount_p: 0,
    pending_amount_won: 0,
  });
});

test("polling exposes the exact pending casino order for pre-display", () => {
  const result = mergePolledAutoStatus(
    createEmptyAutoStatus(),
    {
      running: true,
      auto_session_id: "pending-session",
      pending_direction: "P",
      pending_amount_p: 1,
      pending_amount_won: 10000,
    },
  );

  assert.equal(result.pending_direction, "P");
  assert.equal(result.pending_amount_p, 1);
  assert.equal(result.pending_amount_won, 10000);
});

test("polling a game without an auto session clears inherited error state", () => {
  const result = mergePolledAutoStatus(
    {
      running: false,
      autoSessionId: "old-session",
      phase: "error",
      error_code: "worker_shutdown",
      error_detail: "stale error",
    },
    {
      running: false,
      auto_session_id: null,
      phase: null,
      error_code: null,
      error_detail: null,
      actual_bet_scale: 1,
    },
  );

  assert.equal(result.autoSessionId, null);
  assert.equal(result.phase, null);
  assert.equal(result.error_code, null);
  assert.equal(result.error_detail, null);
});

test("polling an errored auto session still exposes its real error", () => {
  const result = mergePolledAutoStatus(
    createEmptyAutoStatus(),
    {
      running: false,
      auto_session_id: "failed-session",
      phase: "error",
      error_code: "casino_bet_rejected",
      error_detail: "rejected",
    },
  );

  assert.equal(result.phase, "error");
  assert.equal(result.error_code, "casino_bet_rejected");
  assert.equal(result.error_detail, "rejected");
});

test("polling preserves POT stop details for the active game", () => {
  const result = mergePolledAutoStatus(
    createEmptyAutoStatus(),
    {
      running: true,
      auto_session_id: "pot-session",
      phase: "monitoring",
      stop_reason: "active_pot_limit_reached",
      active_pot_count: 3,
      pot_stop_count: 3,
    },
  );

  assert.equal(result.stop_reason, "active_pot_limit_reached");
  assert.equal(result.active_pot_count, 3);
  assert.equal(result.pot_stop_count, 3);
});

test("Error light is off whenever Auto is not running", () => {
  assert.equal(
    shouldDisplayAutoError(
      { running: false, phase: "error" },
      { code: "status_lookup_failed" },
    ),
    false,
  );
  assert.equal(autoStatusLookupError({ running: false }), null);
});

test("status lookup failure lights Error only while Auto is running", () => {
  const error = autoStatusLookupError({ running: true });

  assert.deepEqual(error, {
    code: "status_lookup_failed",
    detail: "자동게임 상태를 확인하지 못했습니다.",
  });
  assert.equal(
    shouldDisplayAutoError({ running: true, phase: "betting" }, error),
    true,
  );
});

test("slot Error blink remains visible after Auto stops with an error", () => {
  assert.equal(
    shouldDisplaySlotAutoError({
      auto_running: false,
      auto_status: "error",
      phase: "error",
    }),
    true,
  );
  assert.equal(
    shouldDisplaySlotAutoError({
      auto_running: true,
      auto_status: "running",
      phase: "error",
    }),
    true,
  );
});

test("monitoring bet skips are not displayed as betting failures", () => {
  assert.equal(shouldDisplayBetFailure("phase_not_betting"), false);
  assert.equal(shouldDisplayBetFailure("casino_bet_rejected"), true);
  assert.equal(shouldDisplayBetFailure("no_pick_at_betsopen"), true);
  assert.equal(shouldDisplayBetFailure(null), false);
});
