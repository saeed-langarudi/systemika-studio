'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const entities = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-entities.js'), 'utf8');
const pages = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-plot-pages.js'), 'utf8');

function block(startMarker, endMarker) {
  const start = editor.indexOf(startMarker);
  const end = editor.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return editor.slice(start, end);
}

test('Histogram properties no longer expose scaling type and rendering is always Histogram counts', () => {
  const dialog = block('class HistoPlotDialog', 'class XySelectorComponent');
  assert.doesNotMatch(dialog, /Select Scaling Type|Probability Density Function|ScaleType|PDF/);

  const visual = block('class HistoPlotVisual', 'class XyPlotVisual');
  assert.doesNotMatch(visual, /usePDF|ScaleType|Probability Density Function/);
  assert.match(visual, /let barValue = bar\.data\.length;/);
  assert.match(visual, /title: `Histogram of \$\{targetPrimName\}`/);

  const pageList = pages.slice(pages.indexOf('HistoPlot:'), pages.indexOf(']', pages.indexOf('HistoPlot:')) + 1);
  assert.doesNotMatch(pageList, /ScaleType/);
  assert.match(entities, /ScaleType:\s*"Histogram"/);
});

test('Table properties use per-entity Decimal fields instead of global Precision/Decimal controls', () => {
  const selector = block('class TableSelectorComponent', 'class TableData');
  assert.match(selector, /extends PlotVariableSelectorComponent/);
  assert.match(selector, /<span>Variable<\/span><span>Decimal<\/span>/);
  assert.match(selector, /class="table-decimal-field/);
  assert.match(selector, /Number\.isInteger\(number\)/);
  assert.match(selector, /TableDecimals/);

  const dialog = block('class TableDialog', 'class NewModelDialog');
  assert.match(dialog, /new TableSelectorComponent\(this\)/);
  assert.doesNotMatch(dialog, /new ArithmeticPrecisionComponent\(this\)/);
  assert.match(entities, /TableDecimals:\s*JSON\.stringify\(\{\}\)/);
});

test('Table decimal settings retain legacy decimal as fallback and allow a unique value per entity', () => {
  const helper = block('const SYSTEMIKA_TABLE_DEFAULT_DECIMALS', 'class TableSelectorComponent');
  const context = { JSON, Number, Object, String, console };
  vm.runInNewContext(`${helper}\nthis.getTableDecimals=getTableDecimals; this.getTableDecimalForId=getTableDecimalForId;`, context);

  function primitive(attrs) {
    return { getAttribute(name) { return attrs[name] ?? ''; } };
  }
  const legacy = primitive({ NumberLength: JSON.stringify({ usePrecision: true, precision: 4, decimal: 3 }), TableDecimals: '' });
  assert.equal(context.getTableDecimalForId(legacy, '10'), 3);

  const custom = primitive({
    NumberLength: JSON.stringify({ usePrecision: true, precision: 4, decimal: 2 }),
    TableDecimals: JSON.stringify({ 10: 1, 20: 5 })
  });
  const settings = context.getTableDecimals(custom);
  assert.equal(context.getTableDecimalForId(custom, '10', settings), 1);
  assert.equal(context.getTableDecimalForId(custom, '20', settings), 5);
  assert.equal(context.getTableDecimalForId(custom, '30', settings), 2);
});

test('Table renderer applies decimal settings by variable, including repeated run columns', () => {
  const visual = block('class TableVisual extends HtmlTwoPointer', 'class PlotVisual extends HtmlOverlayTwoPointer');
  assert.match(visual, /decimalsByVariable = IdsToDisplay\.map/);
  assert.match(visual, /Math\.floor\(columnIndex \/ runBlocks\.length\)/);
  assert.match(visual, /format_number\(value, \{ round_to_zero_limit, decimals: decimalsForValueColumn\(columnIndex\) \}\)/);
  assert.match(visual, /delete decimals\[String\(removeId\)\]/);
  assert.doesNotMatch(visual, /number_length\["usePrecision"\]/);
});
