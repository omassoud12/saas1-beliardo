import test from "node:test";
import assert from "node:assert/strict";
import { handleTabListKeyDown } from "../src/utils/tabKeyboard.js";

test("tab lists wrap with arrow keys and activate the focused tab", () => {
  const events = [];
  const tabs = [0, 1, 2].map((index) => ({
    disabled: false,
    focus() { events.push(["focus", index]); },
    click() { events.push(["click", index]); },
  }));
  const event = {
    key: "ArrowLeft", target: tabs[0],
    currentTarget: { querySelectorAll: () => tabs },
    preventDefault() { events.push(["prevent"]); },
  };
  handleTabListKeyDown(event);
  assert.deepEqual(events, [["prevent"], ["focus", 2], ["click", 2]]);
});

test("tab lists support Home and ignore unrelated keys", () => {
  let activated = -1;
  const tabs = [0, 1].map((index) => ({ disabled: false, focus() {}, click() { activated = index; } }));
  handleTabListKeyDown({ key: "Home", target: tabs[1], currentTarget: { querySelectorAll: () => tabs }, preventDefault() {} });
  assert.equal(activated, 0);
  handleTabListKeyDown({ key: "Enter", target: tabs[0], currentTarget: { querySelectorAll: () => tabs }, preventDefault() { throw new Error("unexpected"); } });
  assert.equal(activated, 0);
});
