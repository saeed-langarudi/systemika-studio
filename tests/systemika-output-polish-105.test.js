'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/style/editor.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');

test('1.0.5 removes legacy table inset so visible setting boxes share the selector width', () => {
  assert.match(css, /--systemika-setting-box-width:\s*360px/);
  assert.match(css, /\.systemika-output-setting-box > table\.modern-table,[\s\S]{0,260}border-collapse:\s*collapse;[\s\S]{0,80}border-spacing:\s*0;/);
  assert.match(css, /\.systemika-plot-variable-selector,[\s\S]{0,150}\.systemika-compare-run-combined[\s\S]{0,150}width:\s*100% !important/);
});

test('1.0.5 places export actions on a dedicated left-aligned second header row', () => {
  const titlePos = html.indexOf('id="systemika-output-title"');
  const actionsPos = html.indexOf('id="systemika-output-actions"');
  const detachPos = html.indexOf('id="systemika-output-detach"');
  assert.ok(titlePos >= 0 && actionsPos > titlePos && detachPos > actionsPos);
  assert.match(css, /\.systemika-output-header strong\s*\{[\s\S]{0,80}margin-right:\s*auto;/);
  assert.match(css, /\.systemika-output-actions\s*\{[\s\S]{0,180}order:\s*2;[\s\S]{0,100}flex:\s*0 0 100%;[\s\S]{0,160}margin-left:\s*0;[\s\S]{0,160}justify-content:\s*flex-start;/);
  assert.match(css, /\.systemika-output-actions:empty\s*\{[\s\S]{0,80}display:\s*none;/);
});
