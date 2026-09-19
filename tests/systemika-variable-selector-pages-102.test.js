'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/style/editor.css'), 'utf8');

function between(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `${startToken} exists`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `${endToken} exists after ${startToken}`);
  return source.slice(start, end);
}

test('plot variable selector is one box matching the compact run-selector width', () => {
  const selector = between(editor, 'class PlotVariableSelectorComponent', '// Persistent run selected');
  assert.match(selector, /systemika-plot-variable-selector/);
  assert.match(selector, /<strong>Selected Variable\(s\)<\/strong>/);
  assert.match(selector, /systemika-variable-find-button/);
  assert.match(selector, /primitive-filter-input/);
  assert.doesNotMatch(selector, /included-list-div/);
  assert.doesNotMatch(selector, /excluded-list-div/);
  assert.match(css, /\.systemika-plot-variable-selector\s*\{[^}]*width:\s*min\(100%, 360px\)/s);
  assert.match(css, /\.systemika-compare-run-options\s*\{[^}]*height:\s*78px/s);
  assert.match(css, /\.systemika-variable-selected-list\s*\{[^}]*height:\s*78px/s);
});

test('Time Plot variable rows contain dash, width, and axis controls; Compare Plot uses the integrated style selector', () => {
  const selector = between(editor, 'class PlotVariableSelectorComponent', '// Persistent run selected');
  const timeSelector = between(editor, 'class TimePlotSelectorComponent', 'class TimePlotDialog');
  const timeDialog = between(editor, 'class TimePlotDialog', 'class GenerationsComponent');
  const compareDialog = between(editor, 'class ComparePlotDialog', 'class HistogramOptionsComponent');
  assert.match(selector, /line-pattern-select plot-variable-style-select/);
  assert.match(selector, /line-width-select plot-variable-style-select/);
  assert.match(timeSelector, /plot-variable-axis-select/);
  assert.match(timeDialog, /new TimePlotSelectorComponent\(this\)/);
  assert.match(compareDialog, /new PlotVariableSelectorComponent\(this, undefined, \{ lineStyle: true \}\)/);
  assert.doesNotMatch(timeDialog, /LineOptionsComponent/);
  assert.doesNotMatch(compareDialog, /LineOptionsComponent/);
});

test('switching plot pages flushes pending live settings and rebuilds docked controls for the selected page', () => {
  const plot = between(editor, 'class PlotVisual', 'class TimePlotVisual');
  const dialog = between(editor, 'class DisplayDialog', 'class AxisLimitsComponent');
  assert.match(dialog, /flushLiveApply\(\)/);
  assert.match(dialog, /refreshDockedSettings\(\)/);
  assert.match(dialog, /this\.beforeShow\(\)/);
  assert.match(plot, /flushPageSettings\(\)/);
  assert.match(plot, /this\.flushPageSettings\(\) === false/);
  assert.match(plot, /this\.dialog\.refreshDockedSettings\(\)/);
  assert.match(plot, /SystemikaPlotPages\.selectPage\(this\.primitive, index\)/);
});
