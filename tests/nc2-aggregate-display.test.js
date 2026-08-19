import assert from "node:assert/strict";
import test from "node:test";

import { nc2AggregateDisplay } from "../src/pages/nc2game/nc-aggregate-display.js";

test("NC aggregate display exposes P and B directions with amount", () => {
  assert.deepEqual(nc2AggregateDisplay({ direction: "P", amount: 128 }), {
    direction: "P",
    directionLabel: "P",
    amount: 128,
    amountLabel: "128.0P",
    color: "#1565d8",
  });
  assert.equal(nc2AggregateDisplay({ direction: "B", amount: 7.5 }).directionLabel, "B");
  assert.equal(nc2AggregateDisplay({ direction: "B", amount: 7.5 }).amountLabel, "7.5P");
});

test("NC aggregate display shows a zero-amount waiting state", () => {
  assert.deepEqual(nc2AggregateDisplay({ direction: null, amount: 99 }), {
    direction: null,
    directionLabel: "대기",
    amount: 0,
    amountLabel: "0.0P",
    color: "#555",
  });
  assert.equal(nc2AggregateDisplay().amountLabel, "0.0P");
});
