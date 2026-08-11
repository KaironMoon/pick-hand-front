import assert from "node:assert/strict";
import test from "node:test";

import { resolvePickMartinSummary } from "../src/pages/ghgame/pick-martin-summary.js";

const roundState = {
  pick_martin: {
    step: 2,
    amount: 0.4,
    direction: "P",
  },
};

test("manual mode displays the independent pick martin summary", () => {
  assert.deepEqual(resolvePickMartinSummary(roundState, { running: false }), {
    step: 2,
    amount: 0.4,
    direction: "P",
  });
});

test("auto mode keeps the pick martin amount while showing the pending direction", () => {
  assert.deepEqual(
    resolvePickMartinSummary(roundState, {
      running: true,
      pending_amount_p: 8.2,
      pending_direction: "B",
    }),
    {
      step: 2,
      amount: 0.4,
      direction: "B",
    },
  );
});
