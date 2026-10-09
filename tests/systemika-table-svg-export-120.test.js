'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const editor = fs.readFileSync(path.join(__dirname, '../OpenSystemDynamics/src/editor.js'), 'utf8');
const dock = editor.slice(editor.indexOf('const SystemikaOutputDock = {'), editor.indexOf('class TableVisual extends HtmlTwoPointer'));
const svgCode = editor.slice(editor.indexOf('// Export a complete vector table'), editor.indexOf('async function exportGraphVisual(visual, format)'));
const escapeCode = editor.slice(editor.indexOf('function graphXmlEscape(value) {'), editor.indexOf('function graphPlainText(value) {'));

function cell(text, colSpan = 1, rowSpan = 1, unit = '') {
  const item = { textContent: String(text), colSpan, rowSpan };
  item.querySelector = selector => {
    if (selector === '.time-unit' && unit) return { textContent: unit };
    if (selector === 'div:not(.time-unit)' && unit) return { textContent: 'Time' };
    return null;
  };
  return item;
}
function row(...cells) { return { cells }; }
function visualFromRows(headers, body) {
  const table = { tHead: { rows: headers }, tBodies: [{ rows: body }] };
  return {
    primitive: { name: 'Population & Employment' },
    dockElement: { querySelector: selector => selector === 'table.sticky-table' ? table : null },
  };
}
function exporter() {
  const saves = [];
  const alerts = [];
  const context = vm.createContext({
    fileManager: { exportFile: async (...args) => { saves.push(args); } },
    getName: p => p.name,
    htmlEscape: t => String(t),
    xAlert: t => alerts.push(t),
  });
  vm.runInContext(escapeCode + svgCode, context);
  return { context, saves, alerts };
}

test('Table header provides SVG and existing CSV using same export button style as plots', () => {
  const tableBlock = dock.slice(dock.indexOf('if (visual instanceof TableVisual) {'), dock.indexOf('if (visual instanceof PlotVisual) {'));
  assert.match(tableBlock, /label: "Export SVG".*exportTableVisualSvg\(visual\)/);
  assert.match(tableBlock, /label: "Export CSV".*visual\.data\.exportCSV\(\)/);
  assert.match(dock, /systemika-output-export-button/);
});

test('Table SVG exports all rows, exact displayed values, XML-safe names and Time units', () => {
  const { context } = exporter();
  const data = Array.from({ length: 100 }, (_, i) => row(cell(i), cell((i + .1234567).toFixed(3)), cell(i ? '12.0' : '')));
  const v = visualFromRows([row(cell('Time', 1, 1, 'Years'), cell('Population <2026>'), cell('Wages & Salaries'))], data);
  const payload = vm.runInContext('buildTableSvgPayload', context)(v);
  assert.match(payload.svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(payload.svg, /Population &amp; Employment/);
  assert.match(payload.svg, /Population &lt;2026&gt;/);
  assert.match(payload.svg, /Wages &amp; Salaries/);
  assert.match(payload.svg, />Years<\/text>/);
  assert.match(payload.svg, />99\.123<\/text>/);
  assert.match(payload.svg, /fill="#f4f4f4"/);
  assert.match(payload.svg, /text-anchor="end"/);
  assert.equal((payload.svg.match(/<rect /g) || []).length, 303);
  assert.ok(payload.height > 2600, 'full 100 rows must be exported even if only a few are visible in the panel');
  assert.doesNotMatch(payload.svg, /foreignObject|<canvas|<image /);
});

test('Comparison tables preserve grouped variable headers and distinct run labels', () => {
  const { context } = exporter();
  const v = visualFromRows([
    row(cell('Time', 1, 2, 'Months'), cell('Employment', 2), cell('Criminals', 2)),
    row(cell('Baseline'), cell('Policy'), cell('Baseline'), cell('Policy')),
  ], [row(cell('0'), cell('1.00'), cell('2.00'), cell('3.00'), cell('4.00'))]);
  const payload = vm.runInContext('buildTableSvgPayload', context)(v);
  assert.match(payload.svg, /Employment/);
  assert.match(payload.svg, /Criminals/);
  assert.match(payload.svg, /Baseline/);
  assert.match(payload.svg, /Policy/);
  assert.equal((payload.svg.match(/<rect /g) || []).length, 12);
  assert.equal(payload.height, 37 + 2 * 38 + 26 + 1);
});

test('SVG export uses file manager, reports missing results without writing empty SVG', async () => {
  const { context, saves, alerts } = exporter();
  const v = visualFromRows([row(cell('Time'), cell('P'))], [row(cell('0'), cell('1.200'))]);
  const exportFn = vm.runInContext('exportTableVisualSvg', context);
  await exportFn(v);
  assert.equal(saves.length, 1);
  assert.equal(saves[0][1], '.svg');
  assert.match(saves[0][0], />1\.200<\/text>/);
  assert.equal(alerts.length, 0);
  await exportFn(visualFromRows([row(cell('Time'))], []));
  assert.equal(saves.length, 1);
  assert.match(alerts[0], /no table results/i);
});


test('SVG retains variable heading colors from the rendered table', () => {
  const { context } = exporter();
  context.getComputedStyle = () => ({ color: 'rgb(0, 128, 0)' });
  const variable = cell('Population');
  variable.querySelector = selector => selector === '.cm-primitive' ? {} : null;
  const v = visualFromRows([row(cell('Time'), variable)], [row(cell('0'), cell('42'))]);
  const payload = vm.runInContext('buildTableSvgPayload', context)(v);
  assert.match(payload.svg, /fill="rgb\(0, 128, 0\)"[^>]*>Population<\/text>/);
});
