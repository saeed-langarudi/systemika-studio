'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'style', 'editor.css'), 'utf8');

function between(source, a, b) {
  const start = source.indexOf(a);
  const end = source.indexOf(b, start + a.length);
  assert.notEqual(start, -1, `missing ${a}`);
  assert.notEqual(end, -1, `missing ${b}`);
  return source.slice(start, end);
}

test('single-run XY falls back to actual run rows when filtered rows are empty', () => {
  const helper = between(editor, 'function getXyRunSeries', 'class XyPlotVisual extends PlotVisual');
  const context = {
    RunResults: {
      getDataTimeStart: () => 0,
      getDataTimeLength: () => 100,
      getSelectiveIdResults: () => [
        [0, 10, 20],
        [1, 11, 22],
        [2, 12, 24],
      ],
      getFilteredSelectiveIdResults: () => [],
    },
  };
  vm.createContext(context);
  vm.runInContext(`${helper}; this.getXyRunSeries = getXyRunSeries;`, context);
  const points = Array.from(context.getXyRunSeries([1, 2], 'Base', 1), row => Array.from(row));
  assert.deepEqual(points, [[10, 20, 0], [11, 22, 1], [12, 24, 2]]);
});

test('XY makes an isolated single point visible even when markers are normally disabled', () => {
  const visual = between(editor, 'class XyPlotVisual extends PlotVisual', 'class LineVisual extends TwoPointer');
  assert.match(visual, /let showMarker = dataSerie\.length === 1/);
});

test('Ghost chooser contains a live search box and filters by name or type', () => {
  const chooser = between(editor, 'class GhostSourceDialog extends jqDialog', 'class XPromptDialog extends jqDialog');
  assert.match(chooser, /class="ghost-source-filter"/);
  assert.match(chooser, /placeholder="Search model entities…"/);
  assert.match(chooser, /item\.name\.toLowerCase\(\)\.includes\(query\)/);
  assert.match(chooser, /item\.typeLabel\.toLowerCase\(\)\.includes\(query\)/);
  assert.match(chooser, /filter\.on\("input", \(\) => this\.filterCandidates\(\)\)/);
});

test('multi-run table keeps the complete two-row header as one sticky painted block', () => {
  assert.match(editor, /sticky-table zebra-odd\$\{multiRun \? " systemika-multi-run-table" : ""\}/);
  assert.match(css, /systemika-multi-run-table thead \{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0/);
  assert.match(css, /systemika-multi-run-table thead th \{[\s\S]*position:\s*static/);
  assert.match(css, /th\.time-header-cell\[rowspan="2"\][\s\S]*height:\s*calc\(2 \* var\(--systemika-table-header-row-height\)\)/);
  assert.match(css, /systemika-multi-run-table thead th::after,[\s\S]*thead th::before[\s\S]*display:\s*none/);
});

test('single-run XY uses the original explicit single-series rendering configuration', () => {
  const visual = between(editor, 'class XyPlotVisual extends PlotVisual', 'class LineVisual extends TwoPointer');
  assert.match(visual, /this\.singleRunMode = runNames\.length === 1/);
  assert.match(visual, /if \(this\.singleRunMode\) settings\.color = "black"/);
  assert.match(visual, /settings\.label = `\$\{showNumber \? `\$\{seriesNumber\}\. ` : ""\}\$\{label\}`/);
});
