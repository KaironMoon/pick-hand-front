import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyAutoStatus,
  mergePolledAutoStatus,
} from "../src/pages/ghgame/auto-status.js";

test("new game status starts without the previous auto error", () => {
  assert.deepEqual(createEmptyAutoStatus(), {
    running: false,
    autoSessionId: null,
    phase: null,
    error_code: null,
    error_detail: null,
  });
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
