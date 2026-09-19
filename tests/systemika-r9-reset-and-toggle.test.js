'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');

test('Select/Deselect All keeps a stable label and width', () => {
  assert.match(editor, />Select \/ Deselect All<\/button>/);
  assert.match(editor, /min-width:132px/);
  assert.match(editor, /button\.text\("Select \/ Deselect All"\)/);
});

test('Reset is no longer exposed as a toolbar control or keyboard shortcut', () => {
  assert.doesNotMatch(html, /id="btn_reset"/);
  assert.doesNotMatch(editor, /"reset": ResetTool/);
  assert.doesNotMatch(editor, /ResetTool\.enterTool\(\)/);
});
