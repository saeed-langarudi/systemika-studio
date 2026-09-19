'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const preload = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.js'), 'utf8');

test('run storage is exposed through the established electronAPI bridge', () => {
  assert.match(preload, /runs:\s*\{/);
  assert.match(preload, /systemika:runs:open-folder/);
  assert.match(preload, /systemika:runs:exists/);
  assert.match(preload, /systemika:runs:confirm-overwrite/);
});

test('ordinary single-run Time Plot exposes a single saved-run selector', () => {
  const start = editor.indexOf('class TimePlotDialog');
  assert.notEqual(start, -1);
  const next = editor.indexOf('\nclass ', start + 10);
  const body = editor.slice(start, next === -1 ? editor.length : next);
  assert.match(body, /new RunSelectorComponent\(this\)/);
});

test('Histogram exposes the same multi-run selector used by comparison displays', () => {
  const start = editor.indexOf('class HistoPlotDialog');
  assert.notEqual(start, -1);
  const next = editor.indexOf('\nclass ', start + 10);
  const body = editor.slice(start, next === -1 ? editor.length : next);
  assert.match(body, /new CompareRunsSelectorComponent\(this\)/);
});


test('XY Plot exposes the same multi-run selector used by Time Plot comparisons', () => {
  const start = editor.indexOf('class XyPlotDialog');
  assert.notEqual(start, -1);
  const next = editor.indexOf('\nclass ', start + 10);
  const body = editor.slice(start, next === -1 ? editor.length : next);
  assert.match(body, /new CompareRunsSelectorComponent\(this\)/);
  assert.match(body, /getCompareRunNames\(this\.primitive\)/);
});

test('Compare Plot exposes a multi-run selector and persists a run list', () => {
  const start = editor.indexOf('class ComparePlotDialog');
  const next = editor.indexOf('\nclass ', start + 10);
  const body = editor.slice(start, next);
  assert.match(body, /new CompareRunsSelectorComponent\(this\)/);
  assert.match(editor, /function getCompareRunNames\(primitive\)/);
  assert.match(editor, /primitive\.setAttribute\("RunNames", JSON\.stringify\(unique\)\)/);
  assert.match(editor, /Promise\.all\(savedNames\.map\(name => systemikaSimulationData\.ensureRunLoaded\(name\)\)\)/);
});

test('Compare Plot created after a run refreshes live data, including partial Advance data', () => {
  const start = editor.indexOf('class ComparePlotVisual');
  const next = editor.indexOf('\nclass TextAreaVisual', start);
  const body = editor.slice(start, next);
  assert.match(body, /setTimeout\(\(\) => this\.refreshRunSources\(\), 0\)/);
  assert.doesNotMatch(body, /!RunResults\.simulationDone \|\|/);
  assert.match(body, /!RunResults\.results \|\| !RunResults\.results\.length/);
  assert.match(body, /this\.gens\.append\(this\.fetchedIds, results, this\.primitive, label, true\)/);
});

test('run selectors show the actual current run name and do not expose a Current/latest label', () => {
  const selectorStart = editor.indexOf('class CompareRunsSelectorComponent');
  const selectorEnd = editor.indexOf('// This is the super class for ComparePlotDialog and TableDialog', selectorStart);
  const selectorSource = editor.slice(selectorStart, selectorEnd);
  assert.doesNotMatch(selectorSource, /Current \/ latest/);
  assert.match(selectorSource, /getCurrentRunSourceName\(\)/);
  assert.match(selectorSource, /name === currentName\) continue/);
});

test('legacy Compare Plot generation-management panel is no longer mounted', () => {
  const start = editor.indexOf('class ComparePlotDialog');
  const next = editor.indexOf('\nclass ', start + 10);
  const body = editor.slice(start, next);
  assert.doesNotMatch(body, /new GenerationsComponent/);
});

test('Table properties use the same multi-run checklist as Compare Plot', () => {
  const start = editor.indexOf('class TableDialog');
  const next = editor.indexOf('\nclass ', start + 10);
  const body = editor.slice(start, next);
  assert.match(body, /new CompareRunsSelectorComponent\(this, "Runs to include"\)/);
  assert.match(body, /getCompareRunBounds\(this\.primitive\)/);
});

test('Table renderer combines multiple selected runs side-by-side in run column groups', () => {
  const start = editor.indexOf('class TableVisual');
  const next = editor.indexOf('\nclass ', start + 10);
  const body = editor.slice(start, next);
  assert.match(body, /let runNames = getCompareRunNames\(this\.primitive\)/);
  assert.match(body, /buildSideBySideRunTable\(runBlocks, IdsToDisplay\.length\)/);
  assert.match(body, /rowspan='2'/);
  assert.doesNotMatch(body, /\[block\.label\]\.concat\(row\)/);
  const dataStart = editor.indexOf('class TableData');
  const dataNext = editor.indexOf('\nclass ', dataStart + 10);
  const dataBody = editor.slice(dataStart, dataNext);
  assert.match(dataBody, /\$\{name\} \[\$\{runName\}\]/);
});

test('display data access accepts an individual run name', () => {
  assert.match(editor, /static getSelectiveIdResults\(varIdList, runName\)/);
  assert.match(editor, /static getFilteredSelectiveIdResults\(varIdList, start, length, step, runName\)/);
  assert.match(editor, /getDisplayRunName\(this\.primitive\)/);
});
