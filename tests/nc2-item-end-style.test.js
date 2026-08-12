import assert from "node:assert/strict";
import test from "node:test";

import { nc2ItemNumberStyle } from "../src/pages/nc2game/item-end-style.js";

test("NC2 max-step stop marks the number red", () => {
  assert.equal(
    nc2ItemNumberStyle({ ended: true, end_reason: "max_step_miss" }).backgroundColor,
    "#c62828",
  );
});

test("NC2 win-limit stop keeps the existing blue number", () => {
  assert.equal(
    nc2ItemNumberStyle({ ended: true, end_reason: "item_win_limit" }).backgroundColor,
    "#1565c0",
  );
  assert.equal(nc2ItemNumberStyle({ ended: false }).backgroundColor, "#181d23");
});
