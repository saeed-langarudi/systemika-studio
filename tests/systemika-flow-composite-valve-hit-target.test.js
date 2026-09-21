const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const editor = fs.readFileSync(path.join(__dirname, "..", "OpenSystemDynamics", "src", "editor.js"), "utf8");

test("inactive flow activation includes valve bow-tie and circular variable, but not label/path", () => {
  assert.match(editor, /this\.flowPathGroup\.setAttribute\("pointer-events", "none"\)/);
  assert.match(editor, /this\.variable\.setAttribute\("pointer-events", "none"\)/);
  assert.match(editor, /getElementsByClassName\("element"\)\[0\]\.setAttribute\("pointer-events", "all"\)/);
  assert.match(editor, /getElementsByClassName\("highlight"\)\[0\]\.setAttribute\("pointer-events", "all"\)/);
  assert.match(editor, /this\.name_element\.setAttribute\("pointer-events", "none"\)/);
  assert.match(editor, /this\.valve\.setAttribute\("pointer-events", "all"\)/);
});
