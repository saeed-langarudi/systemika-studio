'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics/src/editor.js'), 'utf8');
const from = editor.indexOf('function graphXmlEscape(value) {');
const to = editor.indexOf('function chartDivToSvg(visual) {', from);
assert.ok(from >= 0 && to > from);
class ComparePlotVisual {}
class XyPlotVisual {}
class HistoPlotVisual {}
const ctx = { ComparePlotVisual, XyPlotVisual, HistoPlotVisual,
  normalizeLegendDashPattern: () => '', isPlotMultiscaleEnabled: () => false,
  document: undefined };
vm.createContext(ctx);
vm.runInContext(editor.slice(from, to), ctx);

function generate({ height = 160, bottomPadding = 22, legend = true, xLabel = 'Time (Month)', ticks = true } = {}) {
  const xaxis = { show: true, label: xLabel, min: 0, max: 100,
    _ticks: ticks ? [{ value: 50, label: '50' }] : [], u2p: x => 30 + x * 1.6 };
  const yaxis = { show: true, label: 'Values', _ticks: [], u2p: y => height - bottomPadding - y };
  const plot = { _gridPadding: { left: 30, right: 20, top: 25, bottom: bottomPadding },
    axes: { xaxis, yaxis },
    series: Array.from({ length: legend ? 5 : 1 }, (_, i) => ({
      label: `Euler_${i}`, color: '#0a87a6', showLine: true, lineWidth: 1.5,
      _xaxis: xaxis, _yaxis: yaxis, data: [[0, 5], [100, 10]]
    })),
    title: { text: 'Plot' }, legend: { show: legend }
  };
  const visual = { plot, chartDiv: { getBoundingClientRect: () => ({ width: 220, height }) },
    primitive: { getAttribute: () => '' } };
  ctx.visual = visual;
  return vm.runInContext('buildGraphSvgPayload(visual)', ctx);
}

function textY(svg, label) {
  const expression = new RegExp(`<text\\s+[^>]*\\sy="([^"]+)"[^>]*>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/text>`);
  const match = svg.match(expression);
  assert.ok(match, `SVG has text element for ${label}`);
  return Number(match[1]);
}

function legendTop(svg) {
  const match = svg.match(/class="systemika-export-legend"><rect x="[^"]+" y="([^"]+)"/);
  assert.ok(match, 'SVG has its legend');
  return Number(match[1]);
}

test('Export SVG separates X-axis tick labels from title with five-run legend', () => {
  const { svg, height } = generate();
  const tick = textY(svg, '50');
  const xlabel = textY(svg, 'Time (Month)');
  assert.ok(xlabel - tick >= 24, `label baseline ${xlabel} must be at least 24px after tick ${tick}`);
  assert.ok(legendTop(svg) - xlabel >= 19, 'legend must clear X-axis title descenders');
  const actualSvgHeight = Number(svg.match(/<svg[^>]* height="([^"]+)"/)[1]);
  assert.equal(actualSvgHeight, height);
  assert.ok(actualSvgHeight > legendTop(svg) + 100, 'legend must be inside SVG bounds');
});

test('Export SVG extends short plot even when there is no legend', () => {
  const { svg, height } = generate({ height: 95, bottomPadding: 9, legend: false });
  assert.ok(textY(svg, 'Time (Month)') - textY(svg, '50') >= 24);
  assert.ok(height > textY(svg, 'Time (Month)') + 5, 'axis title must remain inside SVG canvas');
});

test('Export SVG reserves tick space without a title and has no phantom legend', () => {
  const { svg, height } = generate({ height: 95, bottomPadding: 9, legend: false, xLabel: '' });
  assert.ok(height > textY(svg, '50') + 5);
  assert.doesNotMatch(svg, /systemika-export-legend/);
});
