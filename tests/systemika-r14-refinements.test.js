'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');

test('Ctrl+mouse wheel zooms the canvas around the pointer without page zoom', () => {
  assert.match(editor, /this\.view\.addEventListener\("wheel"/);
  assert.match(editor, /if \(!event\.ctrlKey \|\| event\.deltaY === 0\) return/);
  assert.match(editor, /event\.preventDefault\(\)/);
  assert.match(editor, /this\.setLevelAt\(this\.level \* factor, event\.clientX, event\.clientY\)/);
  assert.match(editor, /static setLevelAt\(newLevel, clientX, clientY\)/);
  assert.match(editor, /view\.scrollLeft = canvasX \* level - pointerX/);
});
