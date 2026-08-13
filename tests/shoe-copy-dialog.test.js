import assert from "node:assert/strict";
import test from "node:test";

import {
  loadShoeCopySourceType,
  saveShoeCopySourceType,
  shoeCopyEnterAction,
} from "../src/utils/shoe-copy-dialog.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("shoe copy source selection is restored independently by storage key", () => {
  const storage = createStorage();
  saveShoeCopySourceType("gh-key", "nc2", storage);
  saveShoeCopySourceType("nc2-key", "gh", storage);

  assert.equal(loadShoeCopySourceType("gh-key", "gh", storage), "nc2");
  assert.equal(loadShoeCopySourceType("nc2-key", "nc2", storage), "gh");
  assert.equal(loadShoeCopySourceType("missing", "nc2", storage), "nc2");
});

test("first Enter looks up and second Enter executes the matching preview", () => {
  const input = { sourceType: "gh", sourceGameInput: "161" };

  assert.equal(shoeCopyEnterAction({ ...input, preview: null }), "lookup");
  assert.equal(shoeCopyEnterAction({
    ...input,
    preview: { source_game_type: "gh", source_game_id: 161 },
  }), "execute");
});

test("changed source values require another lookup and busy input does nothing", () => {
  const preview = { source_game_type: "gh", source_game_id: 161 };

  assert.equal(shoeCopyEnterAction({ preview, sourceType: "nc2", sourceGameInput: "161" }), "lookup");
  assert.equal(shoeCopyEnterAction({ preview, sourceType: "gh", sourceGameInput: "162" }), "lookup");
  assert.equal(shoeCopyEnterAction({ preview, sourceType: "gh", sourceGameInput: "161", busy: true }), "none");
});
