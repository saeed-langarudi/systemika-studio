'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');

test('Shift+Page Up/Down scrolls the canvas horizontally by a visible page', () => {
  assert.match(editor, /event\.shiftKey[^\n]*PageUp[^\n]*PageDown/);
  assert.match(editor, /Math\.floor\(view\.clientWidth \* 0\.9\)/);
  assert.match(editor, /view\.scrollLeft \+= event\.key === "PageDown" \? amount : -amount/);
});

test('Ctrl+Home resets both canvas scroll axes to the top-left origin', () => {
  assert.match(editor, /event\.key === "Home"/);
  assert.match(editor, /view\.scrollLeft = 0/);
  assert.match(editor, /view\.scrollTop = 0/);
});

test('zoom uses selected canvas entities as the focal anchor', () => {
  assert.match(editor, /static getSelectionAnchorClient\(\)/);
  assert.match(editor, /Object\.values\(get_selected_root_objects\(\) \|\| \{\}\)/);
  assert.match(editor, /positions\.reduce\(\(sum, pos\) => sum \+ pos\[0\], 0\) \/ positions\.length/);
  assert.match(editor, /if \(anchor\) this\.setLevelAt\(this\.level \* this\.STEP, anchor\.x, anchor\.y\)/);
  assert.match(editor, /if \(selectionAnchor\) this\.setLevelAt\(this\.level \* factor, selectionAnchor\.x, selectionAnchor\.y\)/);
});
