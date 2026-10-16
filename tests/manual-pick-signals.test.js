import test from "node:test";
import assert from "node:assert/strict";
import { manualPickSignalStyle } from "../src/pages/ghgame/manual-pick-signals.js";

test("server grades render red, blue and purple borders", () => {
  assert.match(manualPickSignalStyle(1).boxShadow, /#ef5350/);
  assert.match(manualPickSignalStyle(2).boxShadow, /#42a5f5/);
  assert.match(manualPickSignalStyle(3).boxShadow, /#ba68c8/);
  for (const grade of [0, null, undefined, 4]) assert.deepEqual(manualPickSignalStyle(grade), {});
});
