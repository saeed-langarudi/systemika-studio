'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const runManager = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'systemika-run-manager.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = editor.indexOf(startMarker);
  const end = editor.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return editor.slice(start, end);
}

test('new completed runs are auto-selected before display subscribers refresh', () => {
  assert.match(runManager, /SystemikaDisplayRuns\.selectNewRun\(decision\.runName\)/);
  const commitIndex = runManager.indexOf('captureCompletedRun(decision)');
  const saveIndex = runManager.indexOf('saveCurrentRun', commitIndex);
  assert.ok(commitIndex >= 0 && saveIndex > commitIndex);

  const helper = sourceBetween('function selectNewRunForDisplays(runName)', 'function getCompareRunBounds(primitive)');
  assert.match(helper, /\["TimePlot"\]/);
  assert.match(helper, /primitive\.setAttribute\("RunName", name\)/);
  assert.match(helper, /\["ComparePlot", "Table", "XyPlot", "HistoPlot"\]/);
  assert.match(helper, /selected\.push\(name\)/);
});

test('side-by-side table helper aligns runs by time and leaves gaps instead of stacking rows', () => {
  const helper = sourceBetween('function buildSideBySideRunTable(runBlocks, variableCount)', 'class TableVisual extends HtmlTwoPointer');
  const context = { Array, Map, Number, String };
  vm.runInNewContext(`${helper}\nthis.buildSideBySideRunTable = buildSideBySideRunTable;`, context);

  const rows = context.buildSideBySideRunTable([
    { label: 'Base', results: [[0, 10, 20], [1, 11, 21], [2, 12, 22]] },
    { label: 'Run 1', results: [[0, 100, 200], [2, 120, 220], [3, 130, 230]] },
  ], 2);

  assert.deepEqual(Array.from(rows, row => Array.from(row)), [
    [0, 10, 100, 20, 200],
    [1, 11, null, 21, null],
    [2, 12, 120, 22, 220],
    [3, null, 130, null, 230],
  ]);
});

test('multi-run table renders run groups as columns and exports flattened run-specific columns', () => {
  const visual = sourceBetween('class TableVisual extends HtmlTwoPointer', 'class PlotVisual extends HtmlOverlayTwoPointer');
  assert.match(visual, /rowspan='2'/);
  assert.match(visual, /colspan='\$\{runBlocks\.length\}'/);
  assert.match(visual, /variableGroupHeaders/);
  assert.match(visual, /runHeaders/);
  assert.match(visual, /buildSideBySideRunTable\(runBlocks, IdsToDisplay\.length\)/);
  assert.doesNotMatch(visual, /includeRunColumn/);
  assert.doesNotMatch(visual, /\[block\.label\]\.concat\(row\)/);

  const data = sourceBetween('class TableData {', 'class TableLimitsComponent');
  assert.match(data, /\$\{name\} \[\$\{runName\}\]/);
  assert.doesNotMatch(data, /"Run" \+ seperator/);
});


test('auto-selection switches Time Plot and appends the new run to Time/XY/Histogram comparison displays and Table', () => {
  const helper = sourceBetween('function getDisplayRunName(primitive)', 'function getCompareRunBounds(primitive)');
  function primitive(initial = {}) {
    const attrs = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));
    return {
      getAttribute(name) { return attrs.get(name) || ''; },
      setAttribute(name, value) { attrs.set(name, String(value)); },
      attrs,
    };
  }
  const timePlot = primitive({ RunName: 'Base' });
  const xyPlot = primitive({ RunNames: '["Base"]' });
  const histoPlot = primitive({ RunNames: '["Base"]' });
  const comparePlot = primitive({ RunNames: '["Base"]' });
  const table = primitive({ RunNames: '["Base"]' });
  const bank = { TimePlot: [timePlot], XyPlot: [xyPlot], HistoPlot: [histoPlot], ComparePlot: [comparePlot], Table: [table] };
  const context = {
    console, JSON, String, Number, Array,
    window: {},
    RunResults: { results: [] },
    primitives: type => bank[type] || [],
  };
  context.window = context;
  vm.runInNewContext(`${helper}\nthis.selectNewRunForDisplays = selectNewRunForDisplays; this.getCompareRunNames = getCompareRunNames;`, context);
  context.selectNewRunForDisplays('Run 1');

  assert.equal(timePlot.attrs.get('RunName'), 'Run 1');
  assert.deepEqual(Array.from(context.getCompareRunNames(xyPlot)), ['Base', 'Run 1']);
  assert.deepEqual(Array.from(context.getCompareRunNames(histoPlot)), ['Base', 'Run 1']);
  assert.deepEqual(Array.from(context.getCompareRunNames(comparePlot)), ['Base', 'Run 1']);
  assert.deepEqual(Array.from(context.getCompareRunNames(table)), ['Base', 'Run 1']);
});


test('multi-run table export uses one column per run-variable pair', () => {
  const classSource = sourceBetween('class TableData {', 'class TableLimitsComponent');
  const context = { fileManager: { exportFile() {} } };
  vm.runInNewContext(`${classSource}\nthis.TableData = TableData;`, context);
  const data = new context.TableData();
  data.namesToDisplay = ['Population', 'Infected'];
  data.runNames = ['Base', 'Run 1'];
  data.results = [[0, 10, 20, 100, 200], [1, 11, 21, 110, 210]];
  data.results = [[0, 10, 100, 20, 200], [1, 11, 110, 21, 210]];
  assert.equal(
    data.getAsString(','),
    'Time,Population [Base],Population [Run 1],Infected [Base],Infected [Run 1]\n' +
      '0,10,100,20,200\n' +
      '1,11,110,21,210\n'
  );
});
