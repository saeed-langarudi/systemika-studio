'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/style/editor.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `missing ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `missing ${end}`);
  return source.slice(a, b);
}

test('1.0.4 fixes every plot/table setting wrapper to exactly 360px', () => {
  assert.match(css, /--systemika-setting-box-width:\s*360px/);
  assert.match(css, /\.systemika-output-settings \.table-cell,[\s\S]{0,220}width:\s*var\(--systemika-setting-box-width, 360px\) !important[\s\S]{0,160}min-width:\s*var\(--systemika-setting-box-width, 360px\)[\s\S]{0,160}max-width:\s*var\(--systemika-setting-box-width, 360px\)/);
  assert.match(css, /\.systemika-plot-variable-selector,[\s\S]{0,150}\.systemika-compare-run-combined[\s\S]{0,150}width:\s*100% !important/);
});

test('1.0.4 derives the default panel width as 105 percent of a settings box', () => {
  assert.match(css, /--systemika-default-panel-width:\s*378px/);
  assert.match(css, /flex:\s*0 0 var\(--systemika-default-panel-width\)/);
  assert.match(css, /min-width:\s*var\(--systemika-default-panel-width\)/);
  assert.match(editor, /syncDefaultPanelWidthToSettings\(\)[\s\S]{0,420}Math\.ceil\(boxWidth \* 1\.05\)/);
  assert.match(editor, /mountInDock\(settings\)[\s\S]{0,160}syncDefaultPanelWidthToSettings\(\)/);
});

test('1.0.4 uses icon-only detach/attach with the same button footprint as Close', () => {
  assert.match(html, /id="systemika-output-detach"[\s\S]{0,180}<img src="graphics\/unlink\.svg"/);
  assert.doesNotMatch(html, /<span>Detach<\/span>|<span>Attach<\/span>/);
  assert.match(css, /\.systemika-output-detach-button,\s*\.systemika-output-close-button\s*\{[\s\S]{0,180}width:\s*28px[\s\S]{0,100}height:\s*26px/);
  assert.match(css, /\.systemika-output-detach-button img\s*\{[\s\S]{0,100}width:\s*20px[\s\S]{0,80}height:\s*20px/);
  assert.match(editor, /button\.title = this\._detached \? "Attach output panel" : "Detach output panel"/);
});

test('1.0.4 defaults plot/table output and settings to equal shares and omits PNG export', () => {
  const dock = between(editor, 'const SystemikaOutputDock = {', 'class PlotVisual extends HtmlOverlayTwoPointer');
  assert.match(dock, /_visualViewFlex:\s*"1 1 0px"/);
  assert.match(dock, /settings\.style\.flex = "1 1 0px"/);
  assert.match(css, /\.systemika-output-view\s*\{[\s\S]{0,140}flex:\s*1 1 0px/);
  assert.match(css, /\.systemika-output-settings\s*\{[\s\S]{0,140}flex:\s*1 1 0px/);
  assert.match(dock, /label: "Export SVG"/);
  assert.match(dock, /label: "Export CSV"/);
  assert.doesNotMatch(dock, /label: "Export PNG"/);
});
