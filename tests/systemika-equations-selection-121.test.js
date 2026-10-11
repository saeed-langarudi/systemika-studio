'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const editor = fs.readFileSync(path.join(__dirname, '../OpenSystemDynamics/src/editor.js'), 'utf8');
const classCode = editor.slice(editor.indexOf('class EquationListDialog extends jqDialog {'), editor.indexOf('// Compatibility alert hook retained', editor.indexOf('class EquationListDialog extends jqDialog {')));
const dockCode = editor.slice(editor.indexOf('const SystemikaOutputDock = {'), editor.indexOf('class TableVisual extends HtmlTwoPointer'));
const infoCode = editor.slice(editor.indexOf('class InfoBar {'), editor.indexOf('defaultAttributeChangeHandler = function', editor.indexOf('class InfoBar {')));

const stock = { id: 's', type: 'Stock', name: 'Population', value: '100', attrs: { Note: 'people' } };
const flow = { id: 'f', type: 'Flow', name: 'Births', value: '2', target: stock, attrs: {} };
const variable = { id: 'v', type: 'Variable', name: 'Rate', value: '0.02', attrs: { isConstant: 'true' } };
const lookup = { id: 'l', type: 'Converter', name: 'Multiplier', value: '1', attrs: {} };
const data = [stock, flow, variable, lookup];
for (const p of data) p.getAttribute = key => p.attrs[key] || '';
const visual = p => ({ primitive: p });

function makeFixture() {
  let selected = [];
  const rendered = [];
  const context = vm.createContext({
    jqDialog: class { setTitle() {} },
    get_selected_root_objects: () => Object.fromEntries(selected.map((v, i) => [String(i), v])),
    primitives: type => data.filter(p => p.type === type),
    getType: p => p.type,
    getID: p => p.id,
    getName: p => p.name,
    getValue: p => p.value,
    getUnits: () => 'Unitless',
    getConverterInput: () => null,
    findID: id => data.find(p => p.id === id),
    getTimeUnits: () => 'Years', getTimeStart: () => 0, getTimeLength: () => 10,
    getTimeStep: () => 1, getAlgorithm: () => 'RK1',
    fileManager: {fileName: 'Example.ssd'},
    htmlEscape: value => String(value),
    SystemikaDocumentation: { buildRows: values => values.map((v, i) => ({...v, order: i + 1, equation: v.expression, initialCondition: ''})) },
  });
  vm.runInContext(classCode + '\nthis.EquationListDialog = EquationListDialog;', context);
  const list = new context.EquationListDialog();
  list.dialogContent = {};
  list.updatePreview = () => rendered.push(list.getRows().map(v => v.name));
  return { list, selected: values => { selected = values; }, rendered };
}

test('Equations displays all equation-bearing model entities with no selection', () => {
  const {list} = makeFixture();
  assert.deepEqual(Array.from(list.getRows(), r => r.name), ['Population','Births','Rate','Multiplier']);
  assert.match(list.renderPreviewHtml(), /Total of 4 model entities/);
});

test('Equations limits rows to a single selected variable, and multiple selected variables', () => {
  const {list, selected} = makeFixture();
  selected([visual(stock)]);
  assert.deepEqual(Array.from(list.getRows(), r => r.name), ['Population']);
  assert.match(list.renderPreviewHtml(), /Selected: 1 model entity/);
  assert.deepEqual(Array.from(list.collectEntities()[0].inflows), ['Births']); // stock still references non-selected flows
  selected([visual(flow), visual(lookup)]);
  assert.deepEqual(Array.from(list.getRows(), r => r.name), ['Births','Multiplier']);
  assert.doesNotMatch(list.renderPreviewHtml(), /Population<\/td>/);
});

test('Equations ignores non-variable selection and resolves selected ghosts to their source entity', () => {
  const {list, selected} = makeFixture();
  selected([{primitive: {id:'other',type:'Link'}}]);
  assert.equal(list.getRows().length, 4);
  selected([{ is_ghost: true, primitive: {getAttribute: () => 'v'} }, visual(stock)]);
  assert.deepEqual(Array.from(list.getRows(), r => r.name), ['Population','Rate']);
  assert.equal(list.selectionKey(), 's|v');
});

test('Equations panel only redraws preview when selection changes, and exports use filtered getRows', () => {
  const {list, selected, rendered} = makeFixture();
  const start = dockCode.indexOf('\trefreshEquationsForSelection() {');
  const stop = dockCode.indexOf('\n\t}\n};', start);
  assert.ok(start >= 0 && stop > start);
  const methodCode = dockCode.slice(start, stop + 3);
  const ctx = vm.createContext({equationList: list});
  vm.runInContext(`this.refresh = function() { ${methodCode.replace(/^\trefreshEquationsForSelection\(\) \{/, '').replace(/\n\t\}$/, '')} };`, ctx);
  const dock = { activeType:'equations', _hidden:false, _equationsSelectionKey:list.selectionKey() };
  ctx.refresh.call(dock);
  assert.equal(rendered.length, 0);
  selected([visual(flow)]);
  ctx.refresh.call(dock);
  assert.deepEqual(rendered[0], ['Births']);
  ctx.refresh.call(dock);
  assert.equal(rendered.length, 1, 'non-changing selection should not repaint controls');
  selected([]);
  ctx.refresh.call(dock);
  assert.equal(rendered[1].length, 4, 'clearing selection restores the full view');
  assert.match(dockCode, /SystemikaDocumentation\.toCSV\(equationList\.getRows\(\)\)/);
  assert.match(infoCode, /window\.SystemikaOutputDock\.refreshEquationsForSelection\(\)/);
});
