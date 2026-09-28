'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');

function sourceBetween(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(a, -1, `missing ${start}`);
  assert.notEqual(b, -1, `missing ${end}`);
  return source.slice(a, b);
}

test('hidden jqPlot legends do not use outsideGrid placement', () => {
  const snippet = sourceBetween(editor, 'function plotBottomLegendOptions', 'let systemikaDetachedPlotStageCounter');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${snippet}\nthis.plotBottomLegendOptions = plotBottomLegendOptions;`, context);

  const hidden = context.plotBottomLegendOptions(false);
  assert.equal(hidden.show, false);
  assert.equal(hidden.location, 's');
  assert.equal(Object.hasOwn(hidden, 'placement'), false);

  const visible = context.plotBottomLegendOptions(true);
  assert.equal(visible.show, true);
  assert.equal(visible.placement, 'outsideGrid');
});

test('all output plot types use the detached-window-safe jqPlot renderer', () => {
  const helper = sourceBetween(editor, 'function renderSystemikaJqPlot', 'function spacePlotLegendFromGrid');
  assert.match(helper, /chartDiv\.ownerDocument === document/);
  assert.match(helper, /document\.body\.appendChild\(stage\)/);
  assert.match(helper, /while \(stage\.firstChild\) chartDiv\.appendChild\(stage\.firstChild\)/);
  assert.match(helper, /plot\.target = \$\(chartDiv\)/);

  const calls = editor.match(/renderSystemikaJqPlot\(this\.chartDiv,/g) || [];
  assert.equal(calls.length, 4, 'Time, Compare, Histogram, and XY plots should all use the safe renderer');
});

test('single-run histogram keeps the reliable one-series rendering path', () => {
  const snippet = sourceBetween(editor, 'class HistoPlotVisual', 'class XyPlotVisual');
  assert.match(snippet, /let multipleRuns = this\.serieArray\.length > 1;/);
  assert.match(snippet, /seriesDefaults: multipleRuns \?/);
  assert.match(snippet, /legend: plotBottomLegendOptions\(multipleRuns\)/);
  assert.match(snippet, /showMarker: false/);
});

test('copy/paste translates Link handles and Flow bend points with the copied structure', () => {
  const snippet = sourceBetween(editor, 'function translateCopiedConnectorGeometry', 'class Clipboard');
  const context = {
    getType: primitive => primitive.type,
  };
  vm.createContext(context);
  vm.runInContext(`${snippet}\nthis.translateCopiedConnectorGeometry = translateCopiedConnectorGeometry;`, context);

  function primitive(type, attrs) {
    return {
      type,
      getAttribute(name) { return Object.hasOwn(attrs, name) ? attrs[name] : null; },
      value: { setAttribute(name, value) { attrs[name] = String(value); } },
    };
  }

  const linkAttrs = { b1x: '10', b1y: '20', b2x: '30', b2y: '40' };
  context.translateCopiedConnectorGeometry(primitive('Link', linkAttrs), [50, -5]);
  assert.deepEqual(linkAttrs, { b1x: '60', b1y: '15', b2x: '80', b2y: '35' });

  const linkWithoutHandles = {};
  context.translateCopiedConnectorGeometry(primitive('Link', linkWithoutHandles), [50, -5]);
  assert.deepEqual(linkWithoutHandles, {}, 'missing handle attributes must stay missing');

  const flowAttrs = { MiddlePoints: '10,20 30,40 50,60' };
  context.translateCopiedConnectorGeometry(primitive('Flow', flowAttrs), [5, 7]);
  assert.equal(flowAttrs.MiddlePoints, '15,27 35,47 55,67');

  const paste = sourceBetween(editor, 'static paste() {', 'static init() {');
  assert.match(paste, /setCenterPosition\(entry\.clone,[\s\S]*translateCopiedConnectorGeometry\(entry\.clone, delta\)/);
});


test('copy/paste remaps canonical bare-name equation references to copied inputs', () => {
  const start = editor.indexOf('class Clipboard {');
  const end = editor.indexOf('\nClipboard.init();', start);
  assert.ok(start >= 0 && end > start, 'Clipboard class should exist');
  const source = editor.slice(start, end) + '\nthis.Clipboard = Clipboard;';
  const context = {
    document: { getElementById() { return null; } },
    findName() { return null; },
    Set, Map, Number, Math,
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const names = new Map([
    ['Input', 'Input_1'],
    ['Multiplier', 'Multiplier_1'],
    ['Auxiliary', 'Auxiliary_1'],
  ]);
  assert.equal(
    context.Clipboard.replaceFormulaNames('Input * Multiplier + Auxiliary', names),
    'Input_1 * Multiplier_1 + Auxiliary_1'
  );
  assert.equal(
    context.Clipboard.replaceFormulaNames('[Input] * [Multiplier]', names),
    '[Input_1] * [Multiplier_1]'
  );
  assert.equal(
    context.Clipboard.replaceFormulaNames('InputGrowth + Max(Input, Multiplier)', new Map([['Input', 'Input_1'], ['Max', 'Max_1']])),
    'InputGrowth + Max(Input_1, Multiplier)'
  );
});
