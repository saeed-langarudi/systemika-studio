'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
function between(startMarker, endMarker) {
  const start = editor.indexOf(startMarker);
  const end = editor.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return editor.slice(start, end);
}
test('Histogram falls back to the live current run when its selected label is the current run label', () => {
  const visual = between('class HistoPlotVisual extends PlotVisual', 'function getXyRunSeries');
  assert.match(visual, /runName === getCurrentRunSourceName\(\) && hasCurrentRunSource\(\)/);
  assert.match(visual, /RunResults\.getSelectiveIdResults\(idsToDisplay, ""\)/);
  assert.match(visual, /if \(!runResults\.length && hasCurrentRunSource\(\)\)/);
});
test('Histogram series explicitly disable jqPlot point markers', () => {
  const visual = between('class HistoPlotVisual extends PlotVisual', 'function getXyRunSeries');
  assert.match(visual, /showMarker:\s*false/);
  const occurrences = (visual.match(/showMarker:\s*false/g) || []).length;
  assert.ok(occurrences >= 3, 'markers should be disabled in single-run, multi-run, and default settings');
});

test('Single-run histogram preserves the proven pre-comparison jqPlot step/fill renderer', () => {
  const visual = between('class HistoPlotVisual extends PlotVisual', 'function getXyRunSeries');
  assert.match(visual, /if \(multipleRuns\) \{[\s\S]*?\} else \{[\s\S]*?color:\s*"#000000"[\s\S]*?fillColor:\s*"#d9d9d9"[\s\S]*?showMarker:\s*false/);
  assert.match(visual, /seriesDefaults:\s*multipleRuns \?[\s\S]*?:\s*\{[\s\S]*?step:\s*true,[\s\S]*?fill:\s*true,[\s\S]*?showMarker:\s*false/);
  const singleDefaults = visual.match(/seriesDefaults:\s*multipleRuns \?[\s\S]*?:\s*\{([\s\S]*?)\},\n\s*axes:/);
  assert.ok(singleDefaults, 'single-run jqPlot defaults should be present');
  assert.doesNotMatch(singleDefaults[1], /fillAndStroke/);
  assert.doesNotMatch(singleDefaults[1], /fillAlpha/);
});


test('Single-run histogram passes visibility to the shared bottom-legend helper', () => {
  const visual = between('class HistoPlotVisual extends PlotVisual', 'function getXyRunSeries');
  assert.match(visual, /legend:\s*plotBottomLegendOptions\(multipleRuns\)/);
});


test('Single-run histogram uses light gray fill with black borders', () => {
  const visual = between('class HistoPlotVisual extends PlotVisual', 'function getXyRunSeries');
  assert.match(visual, /color:\s*"#000000"/);
  assert.match(visual, /fillColor:\s*"#d9d9d9"/);
  assert.match(visual, /ctx\.strokeStyle\s*=\s*"#000000"/);
  assert.match(visual, /ctx\.strokeRect\(x1, yTop, x2 - x1, yBase - yTop\)/);
});
