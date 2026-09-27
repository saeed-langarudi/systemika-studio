const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('OpenSystemDynamics/src/index.html', 'utf8');
const editor = fs.readFileSync('OpenSystemDynamics/src/editor.js', 'utf8');
const css = fs.readFileSync('OpenSystemDynamics/src/style/editor.css', 'utf8');

test('Find variable is exposed as a top-toolbar action with Ctrl+F and an icon', () => {
  assert.match(html, /id="btn_find_variable"[^>]*data-title="Find \(Ctrl\+F\)"/);
  assert.match(html, /id="btn_find_variable"[\s\S]*?graphics\/find\.svg/);
  assert.ok(fs.existsSync('OpenSystemDynamics/src/graphics/find.svg'));
});

test('Ctrl/Cmd+F opens the Find dialog and the shortcut is documented', () => {
  assert.match(editor, /commandModifier[\s\S]*?toLowerCase\(\) === "f"[\s\S]*?findVariableDialog\.show\(\)/);
  assert.match(editor, /<tr><td>Find variable<\/td><td>\$\{modifierKey\}\+F<\/td><\/tr>/);
});

test('Find dialog provides searchable sortable Name and Type columns', () => {
  assert.match(editor, /class FindVariableDialog extends jqDialog/);
  assert.match(editor, /data-sort="name">Name/);
  assert.match(editor, /data-sort="type">Type/);
  assert.match(editor, /getSystemikaType\(primitive\)/);
  assert.match(editor, /row\.name\.toLowerCase\(\)\.includes\(query\)/);
  assert.match(editor, /row\.type\.toLowerCase\(\)\.includes\(query\)/);
  assert.match(css, /\.systemika-find-table-wrap/);
});

test('Finding a variable selects it and centers it in the canvas', () => {
  assert.match(editor, /function focusModelEntityById\(id\)/);
  assert.match(editor, /unselect_all\(\);\s*visual\.select\(\)/);
  assert.match(editor, /view\.scrollLeft = Math\.max\(0, pos\[0\] \* Zoom\.level - view\.clientWidth \/ 2\)/);
  assert.match(editor, /view\.scrollTop = Math\.max\(0, pos\[1\] \* Zoom\.level - view\.clientHeight \/ 2\)/);
});
