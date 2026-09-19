'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const pages = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-plot-pages.js'), 'utf8');

function classBlock(name, nextName) {
  const start = editor.indexOf(`class ${name}`);
  assert.notEqual(start, -1, `${name} exists`);
  const end = nextName ? editor.indexOf(`class ${nextName}`, start + 1) : editor.length;
  return editor.slice(start, end === -1 ? editor.length : end);
}

test('plot property dialogs no longer expose Plot Period or Figure Pages panels', () => {
  assert.doesNotMatch(editor, /class PlotPeriodComponent extends HtmlComponent/);
  assert.doesNotMatch(editor, /class PlotPagesComponent extends HtmlComponent/);
  for (const [name, next] of [
    ['TimePlotDialog', 'GenerationsComponent'],
    ['ComparePlotDialog', 'HistogramOptionsComponent'],
    ['HistoPlotDialog', 'XySelectorComponent'],
    ['XyPlotDialog', 'TableData'],
  ]) {
    const block = classBlock(name, next);
    assert.doesNotMatch(block, /Plot Period/);
    assert.doesNotMatch(block, /PlotPagesComponent/);
  }
});

test('XY plot uses the integrated per-variable dash and line-width controls', () => {
  const selector = classBlock('XySelectorComponent', 'XyPlotDialog');
  assert.match(selector, /lineStyle:\s*true/);
  assert.match(selector, /<span>Dash<\/span><span>Width<\/span>/);
  assert.match(selector, /this\.styleControlsHtml\(id\)/);
  const visual = classBlock('XyPlotVisual', 'LineVisual');
  assert.match(visual, /getPlotLineStyle\(this\.primitive, idsToDisplay\[1\]\)/);
  assert.match(visual, /lineWidth:\s*curveStyle\.width/);
  assert.match(visual, /linePattern:\s*curveStyle\.pattern/);
});

test('plot interface exposes matching plus/minus page controls and protects the last page', () => {
  const plot = classBlock('PlotVisual', 'TimePlotVisual');
  assert.match(plot, /class="plot-page-delete"/);
  assert.match(plot, /class="plot-page-delete"[^>]*>−<\/button>/);
  assert.doesNotMatch(plot, /plot-settings-button/);
  assert.match(plot, /info\.count <= 1/);
  assert.match(plot, /SystemikaPlotPages\.deletePage/);
});


test('plot page minus is visibly dim when disabled and matches the add control', () => {
  const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/style/editor.css'), 'utf8');
  assert.doesNotMatch(editor, /graphics\/plot-page-delete\.svg/);
  assert.match(css, /\.systemika-plot-page-nav \.plot-page-add,[\s\S]*\.systemika-plot-page-nav \.plot-page-delete[\s\S]*font-size:\s*18px/);
  assert.match(css, /\.plot-page-delete:disabled\s*\{[^}]*color:\s*#aaa;[^}]*opacity:\s*0\.42/s);
});
test('auxiliaries using Smooth Delay or Lag switch to the processing symbol dynamically', () => {
  const icon = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/graphics/processing.svg'), 'utf8');
  assert.match(editor, /function auxiliaryUsesDelayFunction/);
  assert.match(editor, /\\b\(\?:Smooth\|Delay\|Lag\)\\s\*\\\(/);
  const variable = classBlock('VariableVisual', 'ConstantVisual');
  assert.match(variable, /graphics\/processing\.svg/);
  assert.match(variable, /auxiliaryUsesDelayFunction\(this\.primitive\)/);
  assert.match(variable, /showProcessing \? "hidden" : "visible"/);
  assert.match(variable, /showProcessing \? "visible" : "hidden"/);
  assert.match(icon, /id="processing"/);
});

test('Manage Runs provides confirmed Delete All behavior', () => {
  const manager = classBlock('SystemikaRunsManagerDialog', 'UnsavedSaveChoiceDialog');
  assert.match(manager, /"Delete All":\s*\(\) => this\.deleteAllRuns\(\)/);
  assert.match(manager, /Delete <b>all \$\{runs\.length\} saved run/);
  assert.match(manager, /for \(let run of runs\)/);
  assert.match(manager, /systemikaSimulationData\.deleteRun\(name\)/);
  assert.match(manager, /removeRunFromDisplaySelections\(name\)/);
});
