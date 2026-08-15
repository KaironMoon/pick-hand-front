import assert from "node:assert/strict";
import test from "node:test";

import { createGameResponseGuard } from "../src/pages/nc2game/game-response-guard.js";

test("NC2 slot switch rejects a response from the previously selected game", () => {
  const guard = createGameResponseGuard();
  guard.activate(369);
  const previousGameRequest = guard.begin(369);

  guard.activate(370);
  const selectedGameRequest = guard.begin(370);

  assert.equal(guard.isActive(369), false);
  assert.equal(guard.isActive(370), true);
  assert.equal(guard.canApply(previousGameRequest), false);
  assert.equal(guard.canApply(selectedGameRequest), true);
});

test("NC2 state refresh only applies the latest request for the selected game", () => {
  const guard = createGameResponseGuard();
  guard.activate(369);
  const slowerRequest = guard.begin(369);
  const latestRequest = guard.begin(369);

  assert.equal(guard.canApply(slowerRequest), false);
  assert.equal(guard.canApply(latestRequest), true);
});

test("NC2 A-B-A switch rejects an old response from the first A selection", () => {
  const guard = createGameResponseGuard();
  guard.activate(369);
  const firstSelectionRequest = guard.begin(369);
  guard.activate(370);
  guard.begin(370);
  guard.activate(369);
  const secondSelectionRequest = guard.begin(369);

  assert.equal(guard.canApply(firstSelectionRequest), false);
  assert.equal(guard.canApply(secondSelectionRequest), true);
});

test("NC2 replay or empty-slot transition rejects all pending live responses", () => {
  const guard = createGameResponseGuard();
  guard.activate(369);
  const pendingRequest = guard.begin(369);

  guard.clear();

  assert.equal(guard.canApply(pendingRequest), false);
});
