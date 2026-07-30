import assert from "node:assert/strict";
import test from "node:test";

import { updatePbjStrategy } from "../src/pages/ghgame/pbj-goal.js";

test("editing one PBJ target synchronizes the other targets only", () => {
  const config = {
    P: { target_man: 1, enabled: true, bet_type: "manual" },
    B: { target_man: 1, enabled: false, bet_type: "martin" },
    J: { target_man: 1, enabled: true, bet_type: "cruise" },
  };

  const result = updatePbjStrategy(
    config,
    "B",
    { ...config.B, target_man: 7.5 },
  );

  assert.equal(result.P.target_man, 7.5);
  assert.equal(result.B.target_man, 7.5);
  assert.equal(result.J.target_man, 7.5);
  assert.equal(result.P.bet_type, "manual");
  assert.equal(result.B.bet_type, "martin");
  assert.equal(result.J.bet_type, "cruise");
  assert.equal(result.P.enabled, true);
  assert.equal(result.B.enabled, false);
});

test("editing a non-target PBJ setting keeps sibling strategies unchanged", () => {
  const config = {
    P: { target_man: 3, enabled: true },
    B: { target_man: 3, enabled: false },
    J: { target_man: 3, enabled: true },
  };

  const result = updatePbjStrategy(
    config,
    "J",
    { ...config.J, enabled: false },
  );

  assert.strictEqual(result.P, config.P);
  assert.strictEqual(result.B, config.B);
  assert.deepEqual(result.J, { target_man: 3, enabled: false });
});
