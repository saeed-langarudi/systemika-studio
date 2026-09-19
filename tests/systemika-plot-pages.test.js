'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Pages = require('../OpenSystemDynamics/src/systemika-plot-pages.js');

function primitive(type, attrs = {}) {
  const data = Object.assign({}, attrs);
  return {
    value: { nodeName: type },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(data, name) ? String(data[name]) : ''; },
    setAttribute(name, value) { data[name] = String(value); },
    data
  };
}

test('legacy plot becomes one page without changing its current configuration', () => {
  const p = primitive('TimePlot', { Primitives: '3,4', Sides: 'L,R', TitleLabel: 'Main' });
  const info = Pages.ensure(p);
  assert.equal(info.pages.length, 1);
  assert.equal(info.pages[0].attrs.Primitives, '3,4');
  assert.equal(info.pages[0].attrs.Sides, 'L,R');
  assert.equal(info.pages[0].attrs.TitleLabel, 'Main');
  assert.equal(p.data.PlotPageIndex, '0');
});

test('add page preserves plot settings but starts with a blank variable selection', () => {
  const p = primitive('XyPlot', {
    Primitives: '3,4', RunNames: '["Base"]', TitleLabel: 'Phase portrait',
    AxisLimits: '{"xaxis":{"auto":true},"yaxis":{"auto":true}}'
  });
  Pages.ensure(p);
  const added = Pages.addPage(p);
  assert.equal(added.pages.length, 2);
  assert.equal(added.index, 1);
  assert.equal(p.data.Primitives, '');
  assert.equal(p.data.TitleLabel, '');
  assert.equal(p.data.RunNames, '["Base"]');
});

test('switching pages persists independent configurations', () => {
  const p = primitive('HistoPlot', { Primitives: '7', RunNames: '["Base"]', NumberOfBars: '10' });
  Pages.ensure(p);
  Pages.addPage(p);
  p.setAttribute('Primitives', '8');
  p.setAttribute('NumberOfBars', '25');
  Pages.persistCurrentPage(p);

  Pages.selectPage(p, 0);
  assert.equal(p.data.Primitives, '7');
  assert.equal(p.data.NumberOfBars, '10');
  Pages.selectPage(p, 1);
  assert.equal(p.data.Primitives, '8');
  assert.equal(p.data.NumberOfBars, '25');
});

test('duplicate page copies configuration and deleting returns to a valid page', () => {
  const p = primitive('ComparePlot', { Primitives: '1,2', RunNames: '["Base","Policy"]', TitleLabel: 'Compare' });
  Pages.ensure(p);
  const duplicated = Pages.duplicatePage(p);
  assert.equal(duplicated.pages.length, 2);
  assert.equal(p.data.Primitives, '1,2');
  assert.equal(duplicated.page.name, 'Page 1 copy');
  const deleted = Pages.deletePage(p);
  assert.equal(deleted.pages.length, 1);
  assert.equal(deleted.index, 0);
});

test('removing a model entity removes it from every saved plot page', () => {
  const p = primitive('TimePlot', { Primitives: '1,2', Sides: 'L,R', TitleLabel: 'One' });
  Pages.ensure(p);
  Pages.addPage(p);
  p.setAttribute('Primitives', '2,3');
  p.setAttribute('Sides', 'L,L');
  Pages.persistCurrentPage(p);
  assert.equal(Pages.removeReference(p, '2'), true);
  const state = Pages.ensure(p);
  assert.equal(state.pages[0].attrs.Primitives, '1');
  assert.equal(state.pages[0].attrs.Sides, 'L');
  assert.equal(state.pages[1].attrs.Primitives, '3');
  assert.equal(state.pages[1].attrs.Sides, 'L');
});
