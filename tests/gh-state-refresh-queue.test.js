import assert from "node:assert/strict";
import test from "node:test";

import { createStateRefreshQueue } from "../src/pages/ghgame/state-refresh-queue.js";
import { createGameResponseGuard } from "../src/pages/nc2game/game-response-guard.js";

test("GH merges incoming refreshes into one request after the active request", async () => {
  const refresh = createStateRefreshQueue();
  const calls = [];
  let finish;
  const load = async (generation, options) => {
    calls.push({ generation, ...options });
    if (calls.length === 1) await new Promise((resolve) => { finish = resolve; });
  };

  const first = refresh(50762, 1, { partial: false }, load);
  const second = refresh(50762, 1, { partial: false, diagnostic: "round" }, load);
  const third = refresh(50762, 1, { partial: true }, load);
  assert.equal(calls.length, 1);
  assert.equal(second, third);
  finish();
  await Promise.all([first, second, third]);
  assert.deepEqual(calls, [
    { generation: 1, partial: false },
    { generation: 1, partial: false, diagnostic: "round" },
  ]);
});

test("GH does not retry a timeout without a queued refresh", async () => {
  const refresh = createStateRefreshQueue();
  let attempts = 0;
  const load = async () => {
    attempts += 1;
    throw new Error("timeout");
  };
  await assert.rejects(refresh(50762, 1, {}, load), /timeout/);
  assert.equal(attempts, 1);
  await refresh(50762, 1, {}, async () => { attempts += 1; });
  assert.equal(attempts, 2);
});

test("GH ignores queued refreshes from an earlier selection of the same game", async () => {
  const refresh = createStateRefreshQueue();
  const guard = createGameResponseGuard();
  guard.activate(50762);
  const generation = guard.getActiveGeneration(50762);
  let finish;
  const first = refresh(50762, generation, {}, async () => {
    await new Promise((resolve) => { finish = resolve; });
  });
  const pending = refresh(50762, generation, {}, async (queuedGeneration) => {
    assert.notEqual(guard.getActiveGeneration(50762), queuedGeneration);
  });
  guard.activate(50763);
  guard.activate(50762);
  finish();
  await Promise.all([first, pending]);
});
