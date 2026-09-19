'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const entities = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'systemika-entities.js'), 'utf8');

function between(startMarker, endMarker) {
  const start = editor.indexOf(startMarker);
  const end = editor.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return editor.slice(start, end);
}

test('Histogram stores a multi-run selection and properties expose Runs to compare', () => {
  assert.match(entities, /primitiveBank\.histoplot[\s\S]*RunNames:\s*JSON\.stringify\(\[""\]\)/);
  const dialog = between('class HistoPlotDialog extends DisplayDialog', 'class XySelectorComponent');
  assert.match(dialog, /new CompareRunsSelectorComponent\(this\)/);
  assert.doesNotMatch(dialog, /new RunSelectorComponent\(this\)/);
});

test('Histogram comparison uses common bins across selected runs', () => {
  const visual = between('class HistoPlotVisual extends PlotVisual', 'function getXyRunSeries');
  assert.match(visual, /getHistogramSettings\(dataSets\)/);
  assert.match(visual, /allData\.push\(\.\.\.data\)/);
  assert.match(visual, /this\.calcHistogram\(item\.results, settings\)/);
  assert.match(visual, /histogram\.min = settings\.min/);
  assert.match(visual, /histogram\.max = settings\.max/);
  assert.match(visual, /histogram\.numBars = settings\.numBars/);
});

test('Comparative histograms are translucent, outlined, and labeled by run', () => {
  const visual = between('class HistoPlotVisual extends PlotVisual', 'function getXyRunSeries');
  assert.match(visual, /if \(multipleRuns\) \{[\s\S]*fillAlpha:\s*0\.32/);
  assert.doesNotMatch(visual, /fillAlpha:\s*multipleRuns \?/);
  assert.match(visual, /fillAndStroke:\s*true/);
  assert.match(visual, /label:\s*item\.label/);
  assert.match(visual, /legend:\s*plotBottomLegendOptions\(multipleRuns\)/);
});

test('Histogram run lifecycle uses the shared multi-run selection helpers', () => {
  const helper = between('function renameRunInDisplaySelections', 'if (typeof window !== "undefined")');
  assert.match(helper, /\["ComparePlot", "Table", "XyPlot", "HistoPlot"\]/);
  assert.match(helper, /setCompareRunNames\(primitive/);
});
