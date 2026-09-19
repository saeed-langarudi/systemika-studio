'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/style/editor.css'), 'utf8');

function between(source, startText, endText) {
  const start = source.indexOf(startText);
  assert.notEqual(start, -1, `missing ${startText}`);
  const end = source.indexOf(endText, start + startText.length);
  return source.slice(start, end === -1 ? source.length : end);
}

test('Manage Runs no longer exposes Duplicate and toolbar uses Run Name capitalization', () => {
  const manager = between(editor, 'class SystemikaRunsManagerDialog', 'class YesNoCancelDialog');
  assert.doesNotMatch(manager, /"Duplicate"\s*:/);
  assert.match(manager, /"Rename"\s*:/);
  assert.match(manager, /"Delete All"\s*:/);
  assert.match(index, /<label for="systemika-run-name">Run Name<\/label>/);
});

test('Runs to compare and display order share one compact run list', () => {
  const compare = between(editor, 'class CompareRunsSelectorComponent', 'class RunSelectorComponent');
  assert.match(compare, /systemika-compare-run-combined/);
  assert.match(compare, /<span>Display order<\/span>/);
  assert.match(compare, /systemika-compare-run-row-order/);
  assert.doesNotMatch(compare, /systemika-compare-run-order-wrap/);
  assert.doesNotMatch(compare, /class="systemika-compare-run-order"/);
  assert.match(compare, /systemika-run-order-up/);
  assert.match(compare, /systemika-run-order-down/);
  assert.match(compare, /moveRun\(index, delta\)/);
  assert.match(compare, /setCompareRunNames\(this\.primitive, names\)/);
  assert.match(compare, /return this\.syncOrderWithChecked\(\)/);
});

test('plot dialogs hide fixed-default numbered-line, entity-colour, and hover-data controls', () => {
  const time = between(editor, 'class TimePlotDialog', 'class GenerationsComponent');
  const compare = between(editor, 'class ComparePlotDialog', 'class HistogramOptionsComponent');
  const xy = between(editor, 'class XyPlotDialog', 'const SYSTEMIKA_TABLE_DEFAULT_DECIMALS');
  for (const dialog of [time, compare, xy]) {
    assert.doesNotMatch(dialog, /Show Data when hovering/);
  }
  for (const dialog of [time, compare]) {
    assert.doesNotMatch(dialog, /Numbered Lines/);
    assert.doesNotMatch(dialog, /Colour from Model Entity/);
  }
});

test('plot selectors use one compact Selected Variable(s) box with an Add Variable finder', () => {
  const plotSelector = between(editor, 'class PlotVariableSelectorComponent', '// Persistent run selected');
  const time = between(editor, 'class TimePlotSelectorComponent', 'class TimePlotDialog');
  const xy = between(editor, 'class XySelectorComponent', 'class XyPlotDialog');
  const table = between(editor, 'class TableSelectorComponent', 'class TableData');
  assert.match(plotSelector, /<strong>Selected Variable\(s\)<\/strong>/);
  assert.match(plotSelector, /systemika-variable-find-button/);
  assert.match(plotSelector, /\+ Add Variable/);
  assert.match(plotSelector, /systemika-variable-finder/);
  assert.match(time, /extends PlotVariableSelectorComponent/);
  assert.match(xy, /extends PlotVariableSelectorComponent/);
  assert.match(table, /extends PlotVariableSelectorComponent/);
});

test('plots use plus/minus page controls without a redundant settings button', () => {
  const plot = between(editor, 'class PlotVisual', 'class TimePlotVisual');
  assert.match(plot, /class="plot-page-add"[^>]*>\+<\/button>/);
  assert.match(plot, /class="plot-page-delete"[^>]*>−<\/button>/);
  assert.doesNotMatch(plot, /plot-settings-button/);
  assert.match(plot, /\.off\("dblclick contextmenu"\)/);
  assert.match(css, /\.plot-page-add,[\s\S]*\.plot-page-delete[\s\S]*font-size:\s*18px/);
});

test('Table uses a dedicated settings button instead of double-clicking', () => {
  const table = between(editor, 'class TableVisual', 'class HtmlOverlayTwoPointer');
  assert.match(table, /className = "table-settings-button"/);
  assert.match(table, /textContent = "⚙"/);
  assert.match(table, /this\.dialog\.show\(\)/);
  assert.doesNotMatch(table, /cutDiv\)\.dblclick/);
  assert.match(css, /\.table-settings-button\s*\{/);
});
