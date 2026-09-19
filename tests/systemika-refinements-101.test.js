'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Engine = require('../OpenSystemDynamics/src/systemika-engine.js');
const Docs = require('../OpenSystemDynamics/src/systemika-documentation.js');
const Pages = require('../OpenSystemDynamics/src/systemika-plot-pages.js');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const entitiesSource = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-entities.js'), 'utf8');
const modelApiSource = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-model-api.js'), 'utf8');
const defErrorSource = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/definition-error.js'), 'utf8');

function primitive(type, attrs = {}) {
  const data = Object.assign({}, attrs);
  return {
    value: { nodeName: type },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(data, name) ? String(data[name]) : ''; },
    setAttribute(name, value) { data[name] = String(value); },
    data
  };
}

test('bare Systemika model-entity names work while legacy bracket references remain compatible', () => {
  const bare = Engine.simulate(Engine.compileModel({
    timeStart: 0, timeLength: 1, dt: 1, method: 'euler',
    variables: [
      { id: 'a', name: 'A', equation: '2' },
      { id: 'b', name: 'B', equation: 'A * 3' }
    ]
  }));
  assert.equal(bare.value('B')[0], 6);

  const legacy = Engine.simulate(Engine.compileModel({
    timeStart: 0, timeLength: 1, dt: 1, method: 'euler',
    variables: [
      { id: 'a', name: 'A', equation: '2' },
      { id: 'b', name: 'B', equation: '[A] * 4' }
    ]
  }));
  assert.equal(legacy.value('B')[0], 8);
});

test('nested IfThenElse can span physical lines without an escape character', () => {
  const equation = `IfThenElse(T<20, 1,\nIfThenElse(T<40, 2,\nIfThenElse(T<60, 3, 4)))`;
  const model = Engine.compileModel({
    timeStart: 0, timeLength: 60, dt: 20, method: 'euler',
    variables: [{ id: 'v', name: 'Stage', equation }]
  });
  const result = Engine.simulate(model);
  assert.deepEqual(result.value('Stage'), [1, 2, 3, 4]);
});

test('definition bracket checker treats a multiline function as one expression', () => {
  const context = { console, SystemikaEngine: Engine };
  vm.createContext(context);
  vm.runInContext(defErrorSource, context);
  const equation = `IfThenElse(T<20, 1,\nIfThenElse(T<40, 2,\nIfThenElse(T<60, 3, 4)))`;
  assert.equal(context.checkBracketErrors(equation), '');
});

test('equation storage canonicalizes legacy references and safely encodes multiline definitions', () => {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(modelApiSource, context);
  assert.equal(context.canonicalizeEquationReferences('[Stock1] * [Flow1]'), 'Stock1 * Flow1');
  const source = 'IfThenElse(T<20, 1,\n  2)';
  const encoded = context.encodeStoredDefinition(source);
  assert.equal(encoded, 'IfThenElse(T<20, 1,\\n  2)');
  assert.equal(context.decodeStoredDefinition(encoded), source);
});

test('documentation stores stock initial values separately and exports CSV and LaTeX', () => {
  const rows = Docs.buildRows([
    { type: 'stock', name: 'Stock1', expression: '1', inflows: ['Flow1'], outflows: [], units: 'Item' },
    { type: 'flow', name: 'Flow1', expression: '2', units: 'Item/Year' }
  ], { form: 'difference', sort: 'type' });
  assert.equal(rows[0].equation, 'Stock1(t + DT) = Stock1(t) + DT * (Flow1)');
  assert.equal(rows[0].initialCondition, 'Stock1(t0) = 1');
  assert.doesNotMatch(rows[0].equation, /;/);
  assert.match(Docs.toCSV(rows), /^Order,Type,Name,Equation,Initial Condition,Units,Comment\n/);
  assert.match(Docs.toCSV(rows), /Stock1[^\n]*,Stock1\(t0\) = 1,Item/);
  assert.match(Docs.toLaTeX(rows), /\\begin\{align\*\}/);
  assert.match(editor, /label: "Export LaTeX"/);
  assert.match(editor, /SystemikaDocumentation\.toLaTeX\(equationList\.getRows\(\)\)/);
});

test('plot line styling is integrated into each selected-variable row with one uniform default', () => {
  assert.match(entitiesSource, /stock:\s*\{ pattern: \[1\], width: 2 \}/);
  assert.match(entitiesSource, /flow:\s*\{ pattern: \[1\], width: 2 \}/);
  assert.match(entitiesSource, /variable:\s*\{ pattern: \[1\], width: 2 \}/);
  assert.match(editor, /class="line-pattern-select plot-variable-style-select"/);
  assert.match(editor, /class="line-width-select plot-variable-style-select"/);
  assert.doesNotMatch(editor, /<th colspan="2">Line Style<\/th>/);
  assert.doesNotMatch(editor, /class LineOptionsComponent extends HtmlComponent/);
  assert.match(editor, /getPlotLineStyle\(this\.primitive, id\)/);
});

test('plot pages keep independent per-entity line styles and new blank pages reset styles', () => {
  const p = primitive('TimePlot', {
    Primitives: '1,2', Sides: 'L,L', LineStyles: '{"1":{"pattern":[10,5],"width":3}}'
  });
  Pages.ensure(p);
  const added = Pages.addPage(p);
  assert.equal(added.page.attrs.LineStyles, '{}');
  p.setAttribute('Primitives', '2');
  p.setAttribute('Sides', 'L');
  p.setAttribute('LineStyles', '{"2":{"pattern":[2,4],"width":1}}');
  Pages.persistCurrentPage(p);
  Pages.selectPage(p, 0);
  assert.match(p.data.LineStyles, /"1"/);
  Pages.selectPage(p, 1);
  assert.match(p.data.LineStyles, /"2"/);
});

test('equation editor starts on Name and Tab moves through form fields instead of inserting indentation', () => {
  assert.match(editor, /function openPrimitiveDialog\(id, field = "name"\)/);
  assert.match(editor, /"Tab": \(\) => \{\s*if \(this\.unitField\) this\.unitField\.focus\(\)/);
  assert.match(editor, /event\.key === "Tab" && !event\.shiftKey[\s\S]*this\.cmValueField\.focus\(\)/);
  assert.match(editor, /displayText: name,[\s\S]*text: name,/);
  assert.doesNotMatch(editor, /displayText: `\[\$\{name\}\]`/);
});
