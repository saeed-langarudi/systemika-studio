'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Docs = require('../OpenSystemDynamics/src/systemika-documentation.js');

const entities = [
  { type: 'stock', name: 'Population', expression: '100', inflows: ['Births'], outflows: ['Deaths'], units: 'Person', comment: 'Population stock' },
  { type: 'flow', name: 'Deaths', expression: '[Population] * [Death rate]', units: 'Person/Year' },
  { type: 'flow', name: 'Births', expression: '[Population] * [Birth rate]', units: 'Person/Year' },
  { type: 'constant', name: 'Death rate', expression: '0.01', units: '1/Year' },
  { type: 'constant', name: 'Birth rate', expression: '0.02', units: '1/Year' },
  { type: 'auxiliary', name: 'Net growth', expression: '[Births] - [Deaths]', units: 'Person/Year' },
  { type: 'lookup', name: 'Response', expression: '0,0;1,1', lookupInput: 'Net growth', units: 'dmnl' }
];

test('stock equations can be rendered as integral, differential, or difference equations', () => {
  const stock = entities[0];
  assert.match(Docs.equationFor(stock, 'integral'), /∫\(t0→t\)/);
  assert.match(Docs.equationFor(stock, 'integral'), /Births.*- Deaths/);
  assert.equal(Docs.equationFor(stock, 'differential'), 'dPopulation/dt = Births - Deaths');
  assert.equal(Docs.equationFor(stock, 'difference'), 'Population(t + DT) = Population(t) + DT * (Births - Deaths)');
});

test('type sorting uses the requested Systemika documentation order', () => {
  const rows = Docs.buildRows(entities, { form: 'integral', sort: 'type' });
  assert.deepEqual(rows.map(row => row.type), [
    'Stock', 'Flow', 'Flow', 'Auxiliary', 'Constant', 'Constant', 'Lookup'
  ]);
});

test('name sorting is alphabetical regardless of variable type', () => {
  const rows = Docs.buildRows(entities, { form: 'integral', sort: 'name' });
  assert.deepEqual(rows.map(row => row.name), [
    'Birth rate', 'Births', 'Death rate', 'Deaths', 'Net growth', 'Population', 'Response'
  ]);
});

test('computation sorting places dependencies before dependent algebraic equations', () => {
  const rows = Docs.buildRows(entities, { form: 'differential', sort: 'computation' });
  const names = rows.map(row => row.name);
  assert.equal(names[0], 'Population'); // state is available at the beginning of a step
  assert.ok(names.indexOf('Birth rate') < names.indexOf('Births'));
  assert.ok(names.indexOf('Death rate') < names.indexOf('Deaths'));
  assert.ok(names.indexOf('Births') < names.indexOf('Net growth'));
  assert.ok(names.indexOf('Deaths') < names.indexOf('Net growth'));
  assert.ok(names.indexOf('Net growth') < names.indexOf('Response'));
});

test('plain text is a list of equations and CSV is a quoted equation table', () => {
  const rows = Docs.buildRows(entities.slice(0, 2), { form: 'difference', sort: 'type' });
  const text = Docs.toPlainText(rows);
  assert.equal(text.split('\n').filter(Boolean).length, 4);
  assert.match(text, /Population\(t0\) = 100/);
  const csv = Docs.toCSV(rows);
  assert.match(csv, /^Order,Type,Name,Equation,Initial Condition,Units,Comment\n/);
  assert.match(csv, /Population[^\n]*,Population\(t0\) = 100,Person,Population stock/);
  const latex = Docs.toLaTeX(rows);
  assert.match(latex, /\\documentclass\{article\}/);
  assert.match(latex, /Population/);
  assert.match(csv, /Population/);
  assert.match(csv, /Deaths/);
});
