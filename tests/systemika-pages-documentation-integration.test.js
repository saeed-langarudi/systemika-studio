'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');
const entities = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-entities.js'), 'utf8');

test('paged plot and documentation modules load before the editor', () => {
  assert.ok(index.indexOf('systemika-plot-pages.js') < index.indexOf('editor.js'));
  assert.ok(index.indexOf('systemika-documentation.js') < index.indexOf('editor.js'));
});

test('all plot types persist page metadata and expose compact on-figure page controls', () => {
  for (const type of ['TimePlot', 'ComparePlot', 'XyPlot', 'HistoPlot']) {
    const start = entities.indexOf(`createTemplate("${type}"`);
    assert.notEqual(start, -1);
    const block = entities.slice(start, start + 1200);
    assert.match(block, /PlotPages:\s*""/);
    assert.match(block, /PlotPageIndex:\s*0/);
  }
  assert.doesNotMatch(editor, /class PlotPagesComponent extends HtmlComponent/);
  assert.doesNotMatch(editor, /Figure Pages/);
  assert.match(editor, /class="plot-page-add"/);
  assert.match(editor, /class="plot-page-delete"/);
  assert.match(editor, /class="plot-page-delete"[^>]*>−<\/button>/);
  assert.doesNotMatch(editor, /class="plot-settings-button"/);
});

test('model documentation offers requested equation forms, sorting, and exports', () => {
  assert.match(index, /id="btn_equations"[^>]*Equations \(E\)/);
  assert.doesNotMatch(index, /Print Equations/);
  assert.match(editor, /Integral equations/);
  assert.match(editor, /Differential equations/);
  assert.match(editor, /Difference equations/);
  assert.match(editor, /Variable type/);
  assert.match(editor, /Variable name/);
  assert.match(editor, /Order of computation/);
  assert.match(editor, /label: "Export TXT"/);
  assert.match(editor, /label: "Export CSV"/);
  assert.match(editor, /SystemikaDocumentation\.toPlainText\(equationList\.getRows\(\)\)/);
});
