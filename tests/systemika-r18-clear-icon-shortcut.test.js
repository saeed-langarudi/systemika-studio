const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');
const editorJs = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');

test('Clear Outputs preserves the eraser asset and no longer reserves Ctrl+0', () => {
  assert.match(indexHtml, /id="btn_clear"[^>]*data-title="Clear Outputs"[^>]*aria-label="Clear Outputs"/);
  assert.match(indexHtml, /id="btn_clear"[\s\S]*?<img src="graphics\/eraser\.svg"/);
  assert.ok(fs.existsSync(path.join(root, 'OpenSystemDynamics/src/graphics/eraser.svg')));
});

test('Ctrl+0 resets zoom, and Ctrl+9 fits the diagram', () => {
  assert.match(editorJs, /if \(event\.key === "0"\) \{[\s\S]*?Zoom\.zoomReset\(\);[\s\S]*?return;/);
  assert.match(editorJs, /if \(event\.key === "9"\) \{[\s\S]*?Zoom\.zoomToFit\(\);[\s\S]*?return;/);
  assert.match(indexHtml, /id="btn_zoom_reset">Zoom 100% <span class="shortcut">Ctrl 0<\/span><\/button>/);
  assert.match(indexHtml, /id="btn_zoom_fit">Zoom to Fit <span class="shortcut">Ctrl 9<\/span><\/button>/);
});
