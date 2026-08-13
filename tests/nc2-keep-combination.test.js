import assert from "node:assert/strict";
import test from "node:test";

import {
  NC2_KEEP_COMBINATION_KEY,
  clearNc2KeepCombination,
  loadNc2KeepCombination,
  saveNc2KeepCombination,
} from "../src/pages/nc2game/keep-combination.js";

function createStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set(NC2_KEEP_COMBINATION_KEY, initialValue);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("NC2 combination game sequence values are restored from local storage", () => {
  const gameSeqs = Array.from({ length: 32 }, (_, index) => index + 1);
  assert.deepEqual(
    loadNc2KeepCombination(createStorage(JSON.stringify(gameSeqs))),
    gameSeqs,
  );
  assert.equal(loadNc2KeepCombination(createStorage()), null);
  assert.equal(loadNc2KeepCombination(createStorage("true")), null);
});

test("NC2 combination values are saved and removed like the GH lock value", () => {
  const storage = createStorage();
  const gameSeqs = Array.from({ length: 32 }, (_, index) => index + 101);

  saveNc2KeepCombination(gameSeqs, storage);
  assert.deepEqual(loadNc2KeepCombination(storage), gameSeqs);

  clearNc2KeepCombination(storage);
  assert.equal(loadNc2KeepCombination(storage), null);
});

test("invalid or duplicated NC2 combination values are not restored", () => {
  assert.equal(loadNc2KeepCombination(createStorage("[1,2,3]")), null);
  assert.equal(loadNc2KeepCombination(createStorage(JSON.stringify(Array(32).fill(1)))), null);
  assert.equal(loadNc2KeepCombination(createStorage("[1,0]")), null);
  assert.equal(loadNc2KeepCombination(createStorage("not-json")), null);
});
