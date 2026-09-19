const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');
const editorJs = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');

test('Clear Outputs uses the supplied eraser asset and exact tooltip', () => {
  assert.match(indexHtml, /id="btn_clear"[^>]*data-title="Clear Outputs \(Ctrl\+0\)"[^>]*aria-label="Clear Outputs"/);
  assert.match(indexHtml, /id="btn_clear"[\s\S]*?<img src="graphics\/eraser\.svg"/);
  assert.ok(fs.existsSync(path.join(root, 'OpenSystemDynamics/src/graphics/eraser.svg')));
});

test('Ctrl+0 triggers Clear Outputs and Reset Zoom no longer advertises that shortcut', () => {
  assert.match(editorJs, /if \(event\.key === "0"\) \{[\s\S]*?ClearTool\.enterTool\(\);[\s\S]*?return;/);
  assert.doesNotMatch(indexHtml, /id="btn_zoom_reset"[^>]*>[\s\S]*?Ctrl 0[\s\S]*?<\/button>/);
  assert.match(indexHtml, /id="btn_zoom_reset">Reset Zoom<\/button>/);
});
