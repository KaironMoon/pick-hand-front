import assert from "node:assert/strict";
import test from "node:test";

import {
  nc2GameReturnPath,
  nc2SetupPath,
} from "../src/pages/nc2game/slot-navigation.js";

test("NC2 setup and game return paths preserve the selected slot", () => {
  assert.equal(nc2SetupPath(4), "/nc2game/user-setup?slot=4");
  assert.equal(nc2GameReturnPath("4"), "/nc2game/user?slot=4");
});

test("NC2 setup navigation keeps the existing default without a valid slot", () => {
  assert.equal(nc2SetupPath(null), "/nc2game/user-setup");
  assert.equal(nc2GameReturnPath("invalid"), "/nc2game/user");
  assert.equal(nc2GameReturnPath(7), "/nc2game/user");
});
