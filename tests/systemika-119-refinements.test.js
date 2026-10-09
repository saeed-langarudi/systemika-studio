'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const pagesSource = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-plot-pages.js'), 'utf8');
const entities = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-entities.js'), 'utf8');
const newApi = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'newAPI.js'), 'utf8');
const calibration = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-calibration-sandbox.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'style', 'editor.css'), 'utf8');

function primitive(type, attrs = {}) {
  const data = new Map(Object.entries(attrs).map(([key, value]) => [key, String(value)]));
  return {
    value: { nodeName: type },
    getAttribute(name) { return data.get(name) || ''; },
    setAttribute(name, value) { data.set(name, String(value)); },
    data,
  };
}

test('new, removed, and renamed runs are reconciled across every persisted plot page', () => {
  const context = { module: { exports: {} }, exports: {}, globalThis: {} };
  vm.runInNewContext(pagesSource, context);
  const api = context.module.exports;
  const plot = primitive('ComparePlot', {
    RunNames: '["Base"]', RunName: '', Primitives: '1', AxisLimits: '{}', LineOptions: '{}', LineStyles: '{}', VariableRanges: '{}', MultiScale: 'true',
    PlotPages: JSON.stringify([
      { name: 'Page 1', attrs: { RunNames: '["Base"]', RunName: '', Primitives: '1', AxisLimits: '{}', LineOptions: '{}', LineStyles: '{}', VariableRanges: '{}', MultiScale: 'true' } },
      { name: 'Page 2', attrs: { RunNames: '["Base","Old"]', RunName: '', Primitives: '2', AxisLimits: '{}', LineOptions: '{}', LineStyles: '{}', VariableRanges: '{}', MultiScale: 'true' } },
    ]),
    PlotPageIndex: '0',
  });

  api.selectNewRun(plot, 'Run 1');
  let pages = JSON.parse(plot.getAttribute('PlotPages'));
  assert.deepEqual(JSON.parse(pages[0].attrs.RunNames), ['Base', 'Run 1']);
  assert.deepEqual(JSON.parse(pages[1].attrs.RunNames), ['Base', 'Old', 'Run 1']);

  api.removeRun(plot, 'Old');
  pages = JSON.parse(plot.getAttribute('PlotPages'));
  assert.deepEqual(JSON.parse(pages[1].attrs.RunNames), ['Base', 'Run 1']);

  api.renameRun(plot, 'Run 1', 'Policy');
  pages = JSON.parse(plot.getAttribute('PlotPages'));
  assert.deepEqual(JSON.parse(pages[0].attrs.RunNames), ['Base', 'Policy']);
  assert.deepEqual(JSON.parse(pages[1].attrs.RunNames), ['Base', 'Policy']);
});

test('time plots default to per-variable multiscale and persist per-variable custom ranges', () => {
  assert.match(entities, /primitiveBank\.compareplot[\s\S]{0,900}VariableRanges: "\{\}"[\s\S]{0,120}MultiScale: true/);
  assert.match(newApi, /function getPlotVariableRanges/);
  assert.match(newApi, /function setPlotVariableRanges/);
  assert.match(editor, /buildMultiScaleAxes\(this\.primitive, idsToDisplay, yRenderer\)/);
  assert.match(editor, /settings\.yaxis = axisNames\[Math\.min\(wantedIndex, axisNames\.length - 1\)\]/);
  assert.match(editor, /class ComparePlotVisual[\s\S]*?updateChart\(\)[\s\S]*?if \(multiScale\) \{[\s\S]*?renderMultiScaleKey\(this, idsToDisplay\)/);
  assert.match(editor, /systemika-multiscale-axis-gutter/);
  assert.match(editor, /gridPadding: multiScale \? \{ left: 112, right: 12 \}/);
  assert.match(editor, /numberTicks: 3/);
  assert.match(editor, /showTicks: false/);
  assert.match(editor, /plot-variable-range-button/);
  assert.match(editor, /Automatic range/);
  assert.doesNotMatch(css, /\.systemika-multiscale-key/);
});

test('Clear Outputs remains disabled whenever there are no displayed results', () => {
  assert.match(editor, /hasDisplayedResults\(\)/);
  assert.match(editor, /updateClearButtonState\(\)/);
  assert.match(editor, /button\.disabled = !this\.hasDisplayedResults\(\)/);
  assert.match(editor, /class ClearTool[\s\S]{0,500}!SystemikaOutputDevices\.hasDisplayedResults\(\)/);
  assert.doesNotMatch(editor, /tool-action-feedback/);
});

test('Calibration Sandbox plot variables can be removed independently', () => {
  assert.match(calibration, /class="remove-plot"/);
  assert.match(calibration, /data-remove-role="reference"/);
  assert.match(calibration, /data-remove-role="simulated"/);
  assert.match(calibration, /state\.plots\[i\]\[role\]=null/);
  assert.match(calibration, /schedulePersist\(\)/);
});
