import assert from "node:assert/strict";
import test from "node:test";

import { getRoundStateSubgameBasis } from "../src/pages/ghgame/subgame-basis.js";

test("BigRoad2 basis comes only from round_state", () => {
  const basis = {
    허니비: [{ round: 1, prev_picks: "PBP" }],
    W111: [],
    M22: [],
    D112: [],
  };

  assert.strictEqual(
    getRoundStateSubgameBasis({ subgame_basis: basis }),
    basis,
  );
  assert.deepEqual(getRoundStateSubgameBasis({}), {});
  assert.deepEqual(getRoundStateSubgameBasis(null), {});
});
