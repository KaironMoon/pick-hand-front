import assert from "node:assert/strict";
import test from "node:test";

import { isNc2ReferenceFixedOpen } from "../src/pages/nc2game/reference-sections.js";

test("NC2 reference grid stays fixed open in normal mode", () => {
  assert.equal(isNc2ReferenceFixedOpen([]), true);
  assert.equal(isNc2ReferenceFixedOpen(), true);
});

test("NC2 reference grids remain selectable while ZZZ mode is active", () => {
  assert.equal(isNc2ReferenceFixedOpen([{ index: 1, enabled: true }]), false);
});
