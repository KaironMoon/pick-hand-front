import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXED_NC2_ASSIST_PASI,
  buildFixedNc2AssistRules,
  visibleNc2AssistRows,
} from "../src/pages/nc2game/assist-settings.js";

test("NC2 assist pasi values are fixed from 2 through 25", () => {
  assert.deepEqual(FIXED_NC2_ASSIST_PASI, Array.from({ length: 24 }, (_, index) => index + 2));

  const rules = buildFixedNc2AssistRules([
    { pasi: 2, assist: "6회쉬기" },
    { pasi: 25, assist: "회차반대" },
  ]);
  assert.equal(rules.length, 24);
  assert.deepEqual(rules[0], { pasi: 2, assist: "6회쉬기" });
  assert.deepEqual(rules.at(-1), { pasi: 25, assist: "회차반대" });
});

test("NC2 assist rows are shown only through the highest step", () => {
  const rules = buildFixedNc2AssistRules([]);
  assert.deepEqual(
    visibleNc2AssistRows(rules, 5).map((row) => row.map((rule) => rule?.pasi ?? null)),
    [
      [2, null, null, null],
      [3, null, null, null],
      [4, null, null, null],
      [5, null, null, null],
    ],
  );
  assert.deepEqual(
    visibleNc2AssistRows(rules, 25).map((row) => row.map((rule) => rule?.pasi ?? null)),
    [
      [2, 8, 14, 20],
      [3, 9, 15, 21],
      [4, 10, 16, 22],
      [5, 11, 17, 23],
      [6, 12, 18, 24],
      [7, 13, 19, 25],
    ],
  );
});
