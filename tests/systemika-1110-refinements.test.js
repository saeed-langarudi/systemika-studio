'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const environment = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'environment.js'), 'utf8');
const calibration = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-calibration-sandbox.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'style', 'editor.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function fileMenuMarkup() {
  const start = index.indexOf('<button class="menuButton" id="btn_file">File</button>');
  const end = index.indexOf('<button class="menuButton">View</button>');
  assert.ok(start >= 0 && end > start);
  return index.slice(start, end);
}

test('1.3.1 shows the current model name in the model window', () => {
  assert.equal(pkg.version, '1.3.1');
  assert.match(index, /id="current-model-name" class="current-model-name"/);
  assert.match(css, /\.current-model-name\s*\{/);
  assert.match(environment, /updateModelNameDisplay\(\)/);
  assert.match(environment, /String\(name\)\.split/);
  assert.match(environment, /display\.textContent = name \|\| "Untitled model"/);
  assert.match(environment, /this\._fileName = newFileName;\s*this\.updateModelNameDisplay\(\)/);
});

test('File menu has no custom tooltips and no Models in Browser item', () => {
  const menu = fileMenuMarkup();
  assert.doesNotMatch(menu, /data-title=/);
  assert.doesNotMatch(menu, /Models in Browser/);
  assert.doesNotMatch(index, /id="btn_browser_models"/);
  assert.doesNotMatch(editor, /#btn_browser_models/);
  // BrowserModelsDialog remains because startup/browser-storage workflows still use it.
  assert.match(editor, /class BrowserModelsDialog/);
});

test('multiscale labels use black numbered prefixes with a colon and colored values', () => {
  assert.match(editor, /number\.style\.color = "#000"/);
  assert.match(editor, /number\.textContent = `\$\{index \+ 1\}:`/);
  assert.match(editor, /scaleValue\.style\.color = color \|\| "#444"/);
  assert.match(editor, /scaleValue\.textContent = formattedTicks\[tickIndex\]\[index\]/);
});

test('Calibration Sandbox constants can be removed from the selected parameter list', () => {
  assert.match(calibration, /class="remove" type="button" title="Remove parameter"/);
  assert.match(calibration, /state\.ranges\.delete\(id\)/);
  assert.match(calibration, /renderParameters\(\);schedulePersist\(0\)/);
});

test('multiscale labels reserve aligned number and value columns', () => {
  assert.match(editor, /formattedTicks = positions\.map/);
  assert.match(editor, /maxValueChars = Math\.max/);
  assert.match(editor, /valueColumnWidth = `minmax\(0, \$\{Math\.max\(4, maxValueChars \+ 1\)\}ch\)`/);
  assert.match(editor, /gridTemplateColumns = `20px \$\{valueColumnWidth\}`/);
  assert.match(editor, /number\.textContent = `\$\{index \+ 1\}:`/);
  assert.match(editor, /scaleValue\.textContent = formattedTicks\[tickIndex\]\[index\]/);
  assert.match(editor, /fontVariantNumeric = "tabular-nums"/);
});

test('comparison Time Plot uses per-variable Range controls instead of a redundant Y-axis range row', () => {
  const start = editor.indexOf('class ComparePlotDialog extends DisplayDialog');
  const end = editor.indexOf('class HistogramOptionsComponent', start);
  const compare = editor.slice(start, end);
  assert.match(compare, /new PlotVariableSelectorComponent\(this, undefined, \{ lineStyle: true, range: true \}\)/);
  assert.match(compare, /\{ text: "Time", key: "timeaxis", isTimeAxis: true \}/);
  assert.doesNotMatch(compare, /\{ text: "Y-Axis", key: "yaxis" \}/);
});

test('default plot page labels show one unambiguous page count', () => {
  assert.match(editor, /isDefaultPageName = \/\^Page\\s\+\\d\+\$\/i/);
  assert.match(editor, /`Page \$\{info\.index \+ 1\}\/\$\{info\.count\}`/);
  assert.match(editor, />Page 1\/1<\/span>/);
  assert.doesNotMatch(editor, />Page 1  1\/1<\/span>/);
});

test('multiscale Time Plot renders and exports its Y-axis label', () => {
  assert.match(editor, /function renderMultiScaleYAxisLabel\(visual\)/);
  assert.match(editor, /getAttribute\("LeftAxisLabel"\)/);
  assert.match(editor, /className = "systemika-multiscale-y-label"/);
  assert.match(editor, /renderMultiScaleYAxisLabel\(this\)/);
  assert.match(editor, /function graphMultiScaleTicksSvg\(visual, grid\)/);
  assert.match(editor, /visual\.primitive\.getAttribute\("LeftAxisLabel"\)/);
});

test('SVG export includes multiscale Y ticks and Time Plot curve numbers', () => {
  assert.match(editor, /function graphMultiScaleTicksSvg\(visual, grid\)/);
  assert.match(editor, /formatMultiScaleValue\(value\)/);
  assert.match(editor, /function graphComparePointLabelsSvg\(visual\)/);
  assert.match(editor, /row\[2\] === null/);
  const start = editor.indexOf('function buildGraphSvgPayload(visual)');
  const end = editor.indexOf('function chartDivToSvg(visual)', start);
  const exporter = editor.slice(start, end);
  assert.match(exporter, /graphMultiScaleTicksSvg\(visual, grid\)/);
  assert.match(exporter, /graphComparePointLabelsSvg\(visual\)/);
});


test('multiscale gutter stays outside the plot and SVG restores horizontal grid lines', () => {
  assert.match(editor, /gridLeft = Number\(\(visual\.plot\._gridPadding \|\| \{\}\)\.left\) \|\| 112/);
  assert.match(editor, /host\.style\.width = `\$\{Math\.max\(46, gridLeft - gutterLeft - gutterRightGap\)\}px`/);
  assert.match(editor, /function graphMultiScaleGridSvg\(visual, grid\)/);
  assert.match(editor, /graphMultiScaleGridSvg\(visual, grid\)/);
  assert.match(editor, /grid\.bottom \+ GRAPH_EXPORT_X_LABEL_OFFSET/);
});

test('Manage Runs opens independently of project-directory authorization and offers explicit recovery', () => {
  const runs = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-run-manager.js'), 'utf8');
  const manager = runs.slice(runs.indexOf('async function openRunsFolder()'), runs.indexOf('async function locateRunsFolder()'));
  assert.doesNotMatch(manager, /await ensurePersistenceReady\(\)/);
  assert.match(runs, /async function locateRunsFolder\(\)/);
  assert.match(editor, /systemika-runs-recover/);
  assert.match(editor, /systemika-runs-export/);
});

test('failed simulations retain partial results and report the failing simulation time', () => {
  const engineSource = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-engine.js'), 'utf8');
  assert.match(engineSource, /partialResults = this\.currentResults\(\)/);
  assert.match(engineSource, /Error occurred at simulation time/);
  assert.match(editor, /res\.partialResults/);
  assert.match(editor, /SystemikaRunManager\.captureLiveRun/);
});
