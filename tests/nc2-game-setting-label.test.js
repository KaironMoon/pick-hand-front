import assert from "node:assert/strict";
import test from "node:test";

import { nc2ItemWinLimitLabel } from "../src/pages/nc2game/game-setting-label.js";

test("NC2 admin tool shows the selected game's saved win limit", () => {
  assert.equal(nc2ItemWinLimitLabel({ item_win_limit: 10 }), "10승");
  assert.equal(nc2ItemWinLimitLabel({ item_win_limit: 60 }), "60승");
});

test("NC2 admin tool shows a dash when no game setting is available", () => {
  assert.equal(nc2ItemWinLimitLabel(null), "-");
  assert.equal(nc2ItemWinLimitLabel({ item_win_limit: 0 }), "-");
});
