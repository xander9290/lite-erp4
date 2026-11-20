import assert from "node:assert/strict";
import test from "node:test";
import { relationDropdownPlacement } from "./relationDropdownPlacement";

test("dropdown prefers below when it fits and flips above near the lower edge", () => {
  const bounds = { top: 0, bottom: 600 };
  assert.deepEqual(relationDropdownPlacement({ top: 100, bottom: 140 }, bounds, 250), { placement: "bottom", maxHeight: 250, visible: true, gap: 8 });
  assert.deepEqual(relationDropdownPlacement({ top: 500, bottom: 540 }, bounds, 250), { placement: "top", maxHeight: 250, visible: true, gap: 8 });
});

test("dropdown fits the larger side in a clipped scroller and caps tall content", () => {
  assert.deepEqual(relationDropdownPlacement({ top: 250, bottom: 290 }, { top: 100, bottom: 400 }, 500), { placement: "top", maxHeight: 138, visible: true, gap: 8 });
  assert.equal(relationDropdownPlacement({ top: 10, bottom: 50 }, { top: 0, bottom: 1000 }, 800).maxHeight, 320);
  assert.equal(relationDropdownPlacement({ top: 500, bottom: 540 }, { top: 0, bottom: 600 }, 30).placement, "bottom", "small content fits below without unnecessary flipping");
});

test("dropdown handles constrained viewports and offscreen anchors without overflowing", () => {
  assert.equal(relationDropdownPlacement({ top: 100, bottom: 140 }, { top: 99, bottom: 141 }, 300).maxHeight, 0);
  assert.equal(relationDropdownPlacement({ top: 500, bottom: 540 }, { top: 0, bottom: 400 }, 200).visible, false);
  assert.equal(relationDropdownPlacement({ top: 10, bottom: 50 }, { top: 100, bottom: 400 }, 200).visible, false);
});
