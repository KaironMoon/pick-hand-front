import assert from "node:assert/strict";
import test from "node:test";

import {
  ghSelectedSlotNo,
  ghEntrySlot,
  ghSetupsArray,
  replaceGhSlotSetup,
  updateGhGameSearchParams,
} from "../src/pages/ghgame/slot-navigation.js";

test("GH selected slot number falls back to 1 for invalid values", () => {
  assert.equal(ghSelectedSlotNo("3"), 3);
  assert.equal(ghSelectedSlotNo("invalid"), 1);
  assert.equal(ghSelectedSlotNo(null), 1);
  assert.equal(ghSelectedSlotNo(7), 1);
  assert.equal(ghSelectedSlotNo(0), 1);
});

test("GH setups array uses each slot's own entry when present", () => {
  const raw = {
    martin_a: { enabled: true },
    gh_setups: [
      { martin_a: { enabled: true } },
      { martin_a: { enabled: false } },
      null,
      null,
      null,
      null,
    ],
  };
  const setups = ghSetupsArray(raw);
  assert.equal(setups.length, 6);
  assert.equal(setups[0].martin_a.enabled, true);
  assert.equal(setups[1].martin_a.enabled, false);
  // slots without an explicit entry fall back to the raw root config rather than crashing.
  assert.equal(setups[2].martin_a.enabled, true);
});

test("GH setups array falls back to the raw config entirely when gh_setups is missing", () => {
  const raw = { martin_a: { enabled: true } };
  const setups = ghSetupsArray(raw);
  assert.equal(setups.length, 6);
  setups.forEach((setup) => assert.equal(setup.martin_a.enabled, true));
});

test("GH setups array returns nulls when there is no config yet", () => {
  const setups = ghSetupsArray(null);
  assert.equal(setups.length, 6);
  setups.forEach((setup) => assert.equal(setup, null));
});

test("replacing a GH slot setup only changes that slot", () => {
  const setups = [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }, { v: 6 }];
  const next = replaceGhSlotSetup(setups, 3, { v: 99 });
  assert.equal(next[2].v, 99);
  assert.equal(next[0].v, 1);
  assert.equal(next[1].v, 2);
  assert.equal(next[3].v, 4);
});

test("GH game URL keeps the selected slot while syncing the active game", () => {
  const fromSetup = updateGhGameSearchParams("slot=5", { gameId: 30 });
  assert.equal(fromSetup.toString(), "slot=5&gameId=30");

  const switched = updateGhGameSearchParams(fromSetup, { slotNo: 3, gameId: null });
  assert.equal(switched.toString(), "slot=3");
});

const slots = [
  { slot_no: 1, occupied: true, game_id: 100 },
  { slot_no: 2, occupied: false },
  { slot_no: 3, occupied: true, game_id: 300 },
];

test("GH entry defaults to slot 1 without a slot or game", () => {
  assert.equal(ghEntrySlot(slots).game_id, 100);
});

test("GH entry resolves a game-only URL to its actual slot", () => {
  assert.equal(ghEntrySlot(slots, { gameId: "300" }).slot_no, 3);
  assert.equal(ghEntrySlot(slots, { gameId: "300", slotNo: "1" }).slot_no, 3);
});

test("GH entry replaces an unmapped admin or deleted game with slot 1", () => {
  assert.equal(ghEntrySlot(slots, { gameId: "1098" }).game_id, 100);
  assert.equal(ghEntrySlot(slots, { gameId: "1098", slotNo: "3" }).game_id, 300);
});

test("GH entry keeps an empty selected slot instead of finding an occupied one", () => {
  const emptyFirst = [{ slot_no: 1, occupied: false }, slots[2]];
  assert.deepEqual(ghEntrySlot(emptyFirst, { gameId: "1098" }), emptyFirst[0]);
  assert.deepEqual(ghEntrySlot(slots, { slotNo: "2" }), slots[1]);
  assert.deepEqual(ghEntrySlot([]), { slot_no: 1, occupied: false });
});
