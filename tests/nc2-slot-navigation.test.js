import assert from "node:assert/strict";
import test from "node:test";

import {
  nc2GameReturnPath,
  nc2SelectedSlotNo,
  nc2SetupPath,
  updateNc2GameSearchParams,
} from "../src/pages/nc2game/slot-navigation.js";

test("NC2 setup and game return paths preserve the selected slot", () => {
  assert.equal(nc2SetupPath(4), "/nc2game/user-setup?slot=4");
  assert.equal(nc2GameReturnPath("4"), "/nc2game/user?slot=4");
});

test("NC2 setup slot changes determine the game return slot", () => {
  const changedSlotNo = nc2SelectedSlotNo("5");
  assert.equal(changedSlotNo, 5);
  assert.equal(nc2GameReturnPath(changedSlotNo), "/nc2game/user?slot=5");
  assert.equal(nc2SelectedSlotNo("invalid"), 1);
});

test("NC2 setup navigation keeps the existing default without a valid slot", () => {
  assert.equal(nc2SetupPath(null), "/nc2game/user-setup");
  assert.equal(nc2GameReturnPath("invalid"), "/nc2game/user");
  assert.equal(nc2GameReturnPath(7), "/nc2game/user");
});

test("NC2 game URL keeps the selected slot while syncing the active game", () => {
  const fromSetup = updateNc2GameSearchParams("slot=5", { gameId: 30 });
  assert.equal(fromSetup.toString(), "slot=5&gameId=30");

  const switched = updateNc2GameSearchParams(fromSetup, { slotNo: 3, gameId: null });
  assert.equal(switched.toString(), "slot=3");
});
