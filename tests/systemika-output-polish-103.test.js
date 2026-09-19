'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/style/editor.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `missing ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `missing ${end}`);
  return source.slice(a, b);
}

test('1.0.4 keeps all output exports in one consistent header action area without plot PNG', () => {
  const dock = between(editor, 'const SystemikaOutputDock = {', 'class PlotVisual extends HtmlOverlayTwoPointer');
  assert.match(index, /id="systemika-output-actions"/);
  assert.match(dock, /activeType === "equations"/);
  assert.match(dock, /visual instanceof TableVisual/);
  assert.match(dock, /visual instanceof PlotVisual/);
  assert.match(dock, /Export TXT/);
  assert.match(dock, /Export LaTeX/);
  assert.match(dock, /Export SVG/);
  assert.doesNotMatch(dock, /label: "Export PNG"/);
  assert.match(dock, /Export CSV/);
  assert.doesNotMatch(editor, /Export Table TSV|exportTSV/);
  assert.match(css, /\.systemika-output-export-button/);
});

test('1.0.3 gives Table the same compact variable finder used by plots', () => {
  const table = between(editor, 'class TableSelectorComponent', 'class TableData');
  const base = between(editor, 'class PlotVariableSelectorComponent', '// Persistent run selected');
  assert.match(table, /extends PlotVariableSelectorComponent/);
  assert.match(base, /<strong>Selected Variable\(s\)<\/strong>/);
  assert.match(base, /\+ Add Variable/);
  assert.match(table, /table-decimal-field/);
});

test('1.0.3 XY selector integrates dash and width into selected-variable rows', () => {
  const selector = between(editor, 'class XySelectorComponent', 'class XyPlotDialog');
  const visual = between(editor, 'class XyPlotVisual extends PlotVisual', 'class LineVisual extends TwoPointer');
  assert.match(selector, /lineStyle: true/);
  assert.match(selector, /<span>Dash<\/span><span>Width<\/span>/);
  assert.match(selector, /styleControlsHtml\(id\)/);
  assert.match(visual, /getPlotLineStyle\(this\.primitive, idsToDisplay\[1\]\)/);
  assert.match(visual, /linePattern: curveStyle\.pattern/);
  assert.match(visual, /lineWidth: curveStyle\.width/);
});

test('1.0.4 gives every plot/table settings box one exact 360px width', () => {
  const dialog = between(editor, 'class DisplayDialog', 'class AxisLimitsComponent');
  assert.match(dialog, /systemika-output-setting-box/);
  assert.match(css, /--systemika-setting-box-width:\s*360px/);
  assert.match(css, /\.systemika-output-setting-box[\s\S]{0,260}width:\s*var\(--systemika-setting-box-width, 360px\) !important[\s\S]{0,180}min-width:\s*var\(--systemika-setting-box-width, 360px\)[\s\S]{0,180}max-width:\s*var\(--systemika-setting-box-width, 360px\)/);
  assert.match(css, /\.systemika-compare-run-combined[\s\S]{0,180}width:\s*100% !important/);
  assert.match(css, /\.systemika-plot-variable-selector,[\s\S]{0,180}width:\s*100% !important/);
});

test('1.0.3 uses bottom legends and simplified run labels', () => {
  const gens = between(editor, 'class DataGenerations {', 'class ComparePlotVisual extends PlotVisual');
  assert.match(editor, /function plotBottomLegendOptions/);
  assert.match(editor, /location: "s"/);
  assert.match(editor, /placement: "outsideGrid"/);
  assert.doesNotMatch(gens, /`[^`]*Run = |labelGen\.push\([^\n]*Run = /);
  assert.match(gens, /wantedIds\.length === 1 \? runLabel : `\$\{this\.labelGen\[i\]\[j\]\} \[\$\{runLabel\}\]`/);
  assert.match(gens, /for \(let wantedId of wantedIds\)[\s\S]*for \(let i = 0; i < this\.idGen\.length; i\+\+\)/);
});

test('1.0.3 exports plotted data to CSV for all plot types', () => {
  assert.match(editor, /function exportPlotDataCsv\(visual\)/);
  assert.match(editor, /visual instanceof ComparePlotVisual/);
  assert.match(editor, /visual instanceof TimePlotVisual/);
  assert.match(editor, /visual instanceof XyPlotVisual/);
  assert.match(editor, /visual instanceof HistoPlotVisual/);
  assert.match(editor, /fileManager\.exportFile\(csv, "\.csv"\)/);
  assert.match(editor, /function plottedCompareSeriesCsv/);
  assert.match(editor, /function plottedXyCsv/);
  assert.match(editor, /function plottedHistogramCsv/);
});


test('comparative plot CSV follows variable-first then run ordering', () => {
  const start = editor.indexOf('function plotCsvCell(value)');
  const end = editor.indexOf('function plottedXyCsv(visual)', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const helperSource = editor.slice(start, end);
  const primitives = {
    '1': { name: 'Population' },
    '2': { name: 'Infected' }
  };
  const context = {
    String, Number, Array, Map, Object, JSON,
    getDisplayIds: () => ['1', '2'],
    findID: id => primitives[String(id)],
    getName: p => p.name,
  };
  vm.runInNewContext(`${helperSource}\nthis.plottedCompareSeriesCsv = plottedCompareSeriesCsv;`, context);
  const csv = context.plottedCompareSeriesCsv({
    primitive: {},
    gens: {
      idGen: [['1', '2'], ['1', '2']],
      runLabelGen: ['Base', 'Policy'],
      resultGen: [
        [[0, 100, 5], [1, 110, 7]],
        [[0, 100, 5], [1, 120, 9]]
      ]
    }
  });
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'Time,Population [Base],Population [Policy],Infected [Base],Infected [Policy]');
  assert.equal(lines[1], '0,100,100,5,5');
  assert.equal(lines[2], '1,110,120,7,9');
});
