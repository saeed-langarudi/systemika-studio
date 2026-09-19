'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Docs = require('../OpenSystemDynamics/src/systemika-documentation.js');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');
const entities = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-entities.js'), 'utf8');
const pages = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-plot-pages.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `missing start marker: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `missing end marker: ${end}`);
  return source.slice(a, b);
}

test('stock documentation uses a consistent equation plus explicit initial condition', () => {
  const stock = { type: 'stock', name: 'Stock1', expression: '100', inflows: ['Flow1'], outflows: [], units: 'Item', comment: 'A documented stock' };
  const integral = Docs.buildRows([stock], { form: 'integral', sort: 'type' })[0];
  const differential = Docs.buildRows([stock], { form: 'differential', sort: 'type' })[0];
  const difference = Docs.buildRows([stock], { form: 'difference', sort: 'type' })[0];

  assert.equal(integral.equation, 'Stock1(t) = Stock1(t0) + ∫(t0→t) (Flow1) dτ');
  assert.equal(differential.equation, 'dStock1/dt = Flow1');
  assert.equal(difference.equation, 'Stock1(t + DT) = Stock1(t) + DT * (Flow1)');
  for (const row of [integral, differential, difference]) {
    assert.equal(row.initialCondition, 'Stock1(t0) = 100');
    assert.equal(row.comment, 'A documented stock');
  }
});

test('CSV keeps Initial Condition and Comment as dedicated columns, with Comment last', () => {
  const rows = Docs.buildRows([
    { type: 'stock', name: 'Stock1', expression: '100', inflows: ['Flow1'], outflows: [], units: 'Item', comment: 'Stock comment' },
    { type: 'flow', name: 'Flow1', expression: '2', units: 'Item/Year', comment: 'Flow comment' }
  ], { form: 'differential', sort: 'type' });
  const csv = Docs.toCSV(rows);
  assert.match(csv, /^Order,Type,Name,Equation,Initial Condition,Units,Comment\n/);
  assert.match(csv, /Stock1\(t0\) = 100,Item,Stock comment/);
  assert.match(csv, /Flow1 = 2,,Item\/Year,Flow comment/);
});

test('Equations live in the output workspace without Print-menu or Print-panel controls', () => {
  assert.doesNotMatch(index, /<button class="menuButton">Print<\/button>/);
  assert.doesNotMatch(index, /Print Equations/);
  assert.match(index, /id="btn_equations"[^>]*data-title="Equations \(E\)"/);
  assert.match(editor, /this\.setTitle\("Equations"\)/);
  assert.doesNotMatch(editor, /documentation-print/);
  assert.match(editor, /<th>Comment<\/th>/);
  assert.match(editor, /equation-entity-count/);
  assert.match(editor, /equation-document-summary/);
});

test('entity definition dialogs persist documentation comments in the Note attribute', () => {
  assert.match(editor, /class="comment-field"/);
  assert.match(editor, /this\.primitive\.setAttribute\("Note", comment\)/);
  assert.match(editor, /this\.primitive\.setAttribute\("Note", this\.commentField \? this\.commentField\.value : ""\)/);
  assert.match(editor, /comment: stock\.getAttribute\("Note"\) \|\| ""/);
  assert.match(editor, /comment: flow\.getAttribute\("Note"\) \|\| ""/);
});

test('graph exports live in the output header and expose SVG plus CSV only', () => {
  const dock = between(editor, 'const SystemikaOutputDock = {', 'class PlotVisual extends HtmlOverlayTwoPointer');
  assert.match(index, /id="systemika-output-actions"/);
  assert.match(dock, /label: "Export SVG"/);
  assert.doesNotMatch(dock, /label: "Export PNG"/);
  assert.match(dock, /label: "Export CSV"/);
  assert.match(dock, /exportPlotDataCsv\(visual\)/);
  assert.doesNotMatch(editor, /class GraphExportComponent extends HtmlComponent/);
  assert.match(editor, /function chartDivToSvg\(visual\)/);
  assert.match(editor, /Intentionally no background rectangle: exported SVG, PNG, and clipboard images remain transparent/);
  assert.doesNotMatch(editor, /sourceCanvases/);
  assert.doesNotMatch(editor, /<foreignObject/);
  assert.match(editor, /function cleanSvgToPngDataUrl/);
  assert.match(editor, /ctx\.clearRect\(0, 0, canvas\.width, canvas\.height\)/);
  assert.match(preload, /writeBase64File/);
  assert.match(main, /file:write-base64/);
});


test('PNG graph export is high resolution, padded, and can be copied to the OS clipboard', () => {
  assert.match(editor, /const GRAPH_EXPORT_RASTER_SCALE = 3/);
  assert.match(editor, /const GRAPH_EXPORT_EDGE_PADDING = 10/);
  assert.match(editor, /canvas\.width = Math\.max\(1, Math\.ceil\(width \* rasterScale\)\)/);
  assert.match(editor, /ctx\.imageSmoothingQuality = "high"/);
  assert.match(editor, /let exportHeight = Math\.max\([\s\S]*legend \? legendTop \+ legend\.height \+ GRAPH_EXPORT_EDGE_PADDING : 0/);
  assert.match(editor, /async function copyGraphVisualToClipboard/);
  assert.match(preload, /copyPngToClipboard/);
  assert.match(main, /clipboard:write-png/);
  assert.match(main, /ClipboardItem/);
  assert.match(main, /await clipboard\.write\(\[/);
  assert.match(main, /"image\/png": new Blob\(\[pngBuffer\]/);
  assert.doesNotMatch(main, /clipboard\.writeImage\(/);
  assert.match(editor, /async function copySelectionWithFigureImage/);
  assert.match(editor, /async function cutSelectionWithFigureImage/);
});

test('time-plot legends render line samples with the plotted dash style', () => {
  assert.match(editor, /function stylePlotLegendLineSamples/);
  assert.match(editor, /stroke-dasharray/);
  assert.ok((editor.match(/stylePlotLegendLineSamples\(this\.chartDiv, this\.plot/g) || []).length >= 3);
});

test('XY uses Show Number rather than Show Markers and carries it through pages', () => {
  assert.match(entities, /ShowNumber:\s*false/);
  assert.match(pages, /"ShowNumber"/);
  const xyDialog = between(editor, 'class XyPlotDialog extends DisplayDialog', 'class TableData');
  assert.match(xyDialog, /Show Number/);
  assert.doesNotMatch(xyDialog, /Show Markers/);
  const xyVisual = between(editor, 'class XyPlotVisual extends PlotVisual', 'class LineVisual extends TwoPointer');
  assert.match(xyVisual, /getAttribute\("ShowNumber"\)/);
  assert.match(xyVisual, /seriesNumber/);
  assert.match(xyVisual, /renderXyCurveNumbers\(this\)/);
  assert.match(editor, /className = "systemika-xy-curve-number"/);
  assert.match(editor, /function graphCurveNumberPlacements/);
  assert.match(editor, /Math\.round\(totalLength \/ 90\)/);
  assert.match(editor, /for \(let point of graphCurveNumberPlacements\(series\)\)/);
  assert.match(xyVisual, /settings\.label = `\$\{showNumber \? `\$\{seriesNumber\}\. ` : ""\}\$\{label\}`/);
});


test('legend is placed below the plot and exports preserve dash samples', () => {
  assert.match(editor, /function plotBottomLegendOptions/);
  assert.match(editor, /location: "s"/);
  assert.match(editor, /placement: "outsideGrid"/);
  assert.match(editor, /function spacePlotLegendFromGrid\(chartDiv, gapPixels = 8\)/);
  assert.match(editor, /legend\.style\.marginTop/);
  assert.ok((editor.match(/spacePlotLegendFromGrid\(this\.chartDiv\)/g) || []).length >= 4);
  assert.match(editor, /let y = Math\.max\(GRAPH_EXPORT_EDGE_PADDING, Number\(legendTop\)/);
  assert.match(editor, /stroke-dasharray/);
});

test('graph export targets only the rendered chart and never includes plot page navigation', () => {
  const exporter = between(editor, 'function buildGraphSvgPayload(visual)', 'function downloadDataUrl');
  assert.doesNotMatch(exporter, /pageNavDiv|plot-page-label|systemika-plot-page-nav/);
  assert.match(exporter, /visual\.plot/);
});

test('plot page navigation is aligned to the bottom-right edge', () => {
  const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'style', 'editor.css'), 'utf8');
  const nav = between(css, '.systemika-plot-page-nav {', '.systemika-plot-page-nav button');
  assert.match(nav, /justify-content:\s*flex-end/);
  assert.match(nav, /padding-right:\s*4px/);
});

test('Smooth Delay and Lag initial values are documented as Initial Conditions', () => {
  const rows = Docs.buildRows([
    { type: 'auxiliary', name: 'Smoothed', expression: 'Smooth(Demand, 4, 2, 100)' },
    { type: 'auxiliary', name: 'Delayed', expression: 'Delay(Orders, 6, 3, InitialOrders)' },
    { type: 'auxiliary', name: 'Lagged', expression: 'Lag(Target, 2, 0)' }
  ], { form: 'integral', sort: 'name' });
  const byName = Object.fromEntries(rows.map(row => [row.name, row]));
  assert.equal(byName.Smoothed.equation, 'Smoothed = Smooth(Demand, 4, 2, Smoothed(t0))');
  assert.equal(byName.Smoothed.initialCondition, 'Smoothed(t0) = 100');
  assert.equal(byName.Delayed.equation, 'Delayed = Delay(Orders, 6, 3, Delayed(t0))');
  assert.equal(byName.Delayed.initialCondition, 'Delayed(t0) = InitialOrders');
  assert.equal(byName.Lagged.equation, 'Lagged = Lag(Target, 2, Lagged(t0))');
  assert.equal(byName.Lagged.initialCondition, 'Lagged(t0) = 0');
  assert.match(Docs.toCSV(rows), /Smoothed\(t0\) = 100/);
  assert.match(Docs.toLaTeX(rows), /\\mathrm\{Smoothed\}\(t_0\) = 100/);
});
