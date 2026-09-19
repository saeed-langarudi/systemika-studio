'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = editor.indexOf(startMarker);
  const end = editor.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return editor.slice(start, end);
}

test('Compare Plot run-list helpers default to current and preserve multiple named runs', () => {
  const helperSource = sourceBetween('function getDisplayRunName(primitive)', 'function ensureDisplayRunAvailable(primitive, onLoaded)');
  const context = {
    console,
    JSON,
    String,
    Number,
    Array,
    window: {},
    RunResults: { results: [] },
  };
  context.window = context;
  vm.runInNewContext(`${helperSource}\nthis.getCompareRunNames = getCompareRunNames; this.setCompareRunNames = setCompareRunNames;`, context);

  const attrs = new Map();
  const primitive = {
    getAttribute(name) { return attrs.get(name) || ''; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
  };

  assert.deepEqual(Array.from(context.getCompareRunNames(primitive)), ['']);
  context.setCompareRunNames(primitive, ['Base', 'Policy A', 'Base']);
  assert.deepEqual(Array.from(context.getCompareRunNames(primitive)), ['Base', 'Policy A']);
  assert.equal(attrs.get('RunName'), '');
  assert.equal(attrs.get('RunNames'), '["Base","Policy A"]');
});

test('existing DataGenerations plotting engine renders the same primitive from two selected runs as two series', () => {
  const classSource = sourceBetween('class DataGenerations {', 'class ComparePlotVisual extends PlotVisual');
  const primitives = {
    1: { id: 1, name: 'Population', getAttribute(name) { return name === 'Color' ? 'blue' : ''; } },
  };
  const context = {
    console,
    JSON,
    Number,
    Array,
    Math,
    RunResults: { simulationDone: true },
    findID: (id) => primitives[id] || null,
    getName: (p) => p.name,
    getValue: () => '1',
    hasRandomFunction: () => false,
    getTypeNew: () => 'Stock',
    get_object: () => ({ type: 'stock' }),
    defaultStroke: 'black',
  };
  vm.runInNewContext(`${classSource}\nthis.DataGenerations = DataGenerations;`, context);
  const gens = new context.DataGenerations();
  const lineOptions = { stock: { pattern: [1], width: 2 } };

  gens.append([1], [[0, 100], [1, 110]], lineOptions, 'Base', true);
  gens.append([1], [[0, 100], [1, 125]], lineOptions, 'Policy A', true);

  const series = gens.getSeriesArray([1], false);
  const settings = gens.getSeriesSettingsArray([1], false, true);
  assert.equal(series.length, 2);
  assert.deepEqual(Array.from(series[0], row => Array.from(row).slice(0, 2)), [[0, 100], [1, 110]]);
  assert.deepEqual(Array.from(series[1], row => Array.from(row).slice(0, 2)), [[0, 100], [1, 125]]);
  assert.equal(settings[0].label, 'Base');
  assert.equal(settings[1].label, 'Policy A');
});
