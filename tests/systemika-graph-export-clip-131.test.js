'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const start = editor.indexOf('function graphXmlEscape(value) {');
const end = editor.indexOf('function chartDivToSvg(visual) {', start);
assert.ok(start >= 0 && end > start, 'graph SVG exporter source is present');

class ComparePlotVisual {}
class XyPlotVisual {}
class HistoPlotVisual {}

const sandbox = {
  ComparePlotVisual, XyPlotVisual, HistoPlotVisual,
  normalizeLegendDashPattern: () => '',
  isPlotMultiscaleEnabled: () => false,
  document: undefined,
};
vm.createContext(sandbox);
vm.runInContext(editor.slice(start, end), sandbox);

function makePlot(series, options = {}) {
  const xaxis = { show: true, min: 0, max: 10, _ticks: [], u2p: x => 30 + x * 10, label: 'Time' };
  const yaxis = { show: true, min: 0, max: 10, _ticks: [], u2p: y => 125 - y * 10, label: 'Values' };
  const ys = series.map(s => ({ color: '#0a87a6', showLine: true, lineWidth: 2, _xaxis: xaxis, _yaxis: yaxis, ...s }));
  const plot = { _gridPadding: { left: 30, right: 20, top: 25, bottom: 35 },
    axes: { xaxis, yaxis }, series: ys,
    title: { text: 'Clipped graph' },
    legend: options.legend ? { show: true } : { show: false } };
  const chartDiv = { getBoundingClientRect: () => ({ width: 160, height: 160 }) };
  return { chartDiv, plot, primitive: { getAttribute: key => key === 'ShowNumber' ? 'true' : '' }, mainRunSeriesCount: 1 };
}

function exportSvg(visual) {
  return vm.runInContext('buildGraphSvgPayload(visual).svg', Object.assign(sandbox, { visual }));
}

function validateClippedPlot(svg) {
  const def = svg.match(/<clipPath id="([^"]+)" clipPathUnits="userSpaceOnUse"><rect x="30" y="25" width="110" height="100"\/><\/clipPath>/);
  assert.ok(def, 'SVG defines a grid-sized clip rectangle');
  const group = svg.match(/<g class="systemika-export-plot-data" clip-path="url\(#([^)]+)\)">([\s\S]*?)<\/g>/);
  assert.ok(group, 'the exported data uses a clip group');
  assert.equal(group[1], def[1], 'clip reference resolves to the declared boundary');
  assert.match(group[2], /<path d=/, 'the complete vector path is exported');
  assert.match(svg.slice(svg.indexOf('</g>', svg.indexOf('systemika-export-plot-data'))), /stroke="#b8b8b8"/, 'plot border is painted after the clipped data');
  assert.match(svg.slice(svg.indexOf('</g>', svg.indexOf('systemika-export-plot-data'))), /Clipped graph/, 'the chart title is not clipped');
  return group[2];
}

test('1.3.1: manually limited Y axis clips out-of-range curves without dropping intersections', () => {
  const visual = makePlot([{ data: [[0, 1], [5, 20], [10, 1]] }]);
  const group = validateClippedPlot(exportSvg(visual));
  assert.match(group, /-75/, 'out-of-range geometry is retained for accurate clipping at grid edge');
});

test('1.3.1: X axis, steps, fills and markers share the same clipping rectangle', () => {
  const visual = makePlot([{ data: [[-5, 3], [5, 15], [15, 6]], step: true,
    fill: true, fillAlpha: 0.4, showMarker: true, markerOptions: { style: 'square', size: 6 } }]);
  const group = validateClippedPlot(exportSvg(visual));
  assert.match(group, /M -20 95/, 'out-of-range X value is retained for clipped path');
  assert.match(group, /fill-opacity="0.4"/, 'area fill is clipped along with the curve');
  assert.match(group, /<rect x=/, 'markers are clipped along with the curve');
});

test('1.3.1: numbered XY curves and compare point labels are also clipped', () => {
  const xyVisual = Object.assign(new XyPlotVisual(), makePlot([{ data: [[0, 2], [5, 20], [10, 2]] }]));
  const xyGroup = validateClippedPlot(exportSvg(xyVisual));
  assert.match(xyGroup, /<text[^>]*font-weight="bold"/, 'numbered curve labels remain inside clipping group');

  const comparison = Object.assign(new ComparePlotVisual(), makePlot([{ data: [[0, 2, '0'], [5, 20, 'outside'], [10, 2, '10']] }]));
  const compareGroup = validateClippedPlot(exportSvg(comparison));
  assert.match(compareGroup, />outside<\/text>/, 'run annotations remain inside clipping group');
});

test('1.3.1: each exported SVG has its own clip identifier and legends stay outside the clipped plot', () => {
  const visual = makePlot([{ data: [[0, 1], [10, 3]], label: 'Base' }], { legend: true });
  const first = exportSvg(visual), second = exportSvg(visual);
  const id = svg => svg.match(/<clipPath id="([^"]+)"/)[1];
  assert.notEqual(id(first), id(second), 'clip identifiers are unique between figures');
  assert.match(first.slice(first.indexOf('</g>', first.indexOf('systemika-export-plot-data'))), /class="systemika-export-legend"/, 'legend is not clipped to the plot');
});
