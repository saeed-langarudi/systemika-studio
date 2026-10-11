'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const editor = fs.readFileSync('OpenSystemDynamics/src/editor.js', 'utf8');
const newApi = fs.readFileSync('OpenSystemDynamics/src/newAPI.js', 'utf8');
const types = [
  ['Stock', 'stock'],
  ['Flow', 'variable'],
  ['Variable', 'variable'],        // Auxiliary
  ['Variable', 'variable'],        // Constant (isConstant="true")
  ['Converter', 'converter']      // Lookup
];

function functionSource(src, name, nextName) {
  const begin = src.indexOf(`function ${name}(`);
  const end = src.indexOf(`function ${nextName}(`, begin + 1);
  assert.ok(begin >= 0 && end > begin, `cannot extract ${name}`);
  return src.slice(begin, end);
}

test('Ghost aliases never reserve a variable name, regardless of source type', () => {
  const modelItems = types.map(([type], index) => ({
    id: `original${index}`, value: { nodeName: type }, name: `ModelVariable${index}`
  }));
  const ghostItems = modelItems.flatMap(source => [0, 1].map(n => ({
    id: `alias${source.id}-${n}`, value: { nodeName: 'Ghost' },
    name: source.name, sourceId: source.id
  })));
  const ctx = {
    primitives: () => [...modelItems, ...ghostItems],
    getName: prim => prim.name,
    getType: prim => prim.value.nodeName
  };
  vm.createContext(ctx);
  vm.runInContext(functionSource(newApi, 'isNameFree', 'setValue2'), ctx);

  for (const source of modelItems) {
    assert.equal(ctx.isNameFree(source.name, source.id), true,
      `${source.value.nodeName} must remain editable when ghosts have the same name`);
    assert.equal(ctx.isNameFree(source.name, 'an-unrelated-model-entity'), false,
      `${source.value.nodeName} names must remain unique among real variables`);
  }
  assert.equal(ctx.isNameFree('CompletelyNewName'), true);
});

test('Find Ghost navigates original → ghost 1 → ghost 2 → original for every ghostable type', () => {
  const definition = editor.slice(
    editor.indexOf('function getSelectedGhostNavigationContext()'),
    editor.indexOf('function updateFindGhostsButtonState()')
  );
  const next = editor.slice(
    editor.indexOf('function findNextGhostOfSelection()'),
    editor.indexOf('class FindVariableDialog', editor.indexOf('function findNextGhostOfSelection()'))
  );

  for (const [index, [sourceType, visualType]] of types.entries()) {
    const sourceId = `src${index}`;
    const aliases = [`ghost${index}-a`, `ghost${index}-b`];
    const primitives = new Map([[sourceId, {
      id: sourceId, value: { nodeName: sourceType }, getAttribute: () => null
    }]]);
    for (const id of aliases) {
      primitives.set(id, {
        id, value: { nodeName: 'Ghost' }, getAttribute: key => key === 'Source' ? sourceId : null
      });
    }
    let selectedId = sourceId;
    const visuals = new Map(Array.from(primitives.keys(), id => [id, {
      id, type: visualType, is_ghost: id !== sourceId,
      primitive: primitives.get(id)
    }]));
    const ctx = {
      get_selected_root_objects: () => ({ [selectedId]: visuals.get(selectedId) }),
      findID: id => primitives.get(String(id)) || null,
      getType: primitive => primitive.value.nodeName,
      get_object: id => visuals.get(String(id)) || null,
      findGhostsOfID: id => id === sourceId ? aliases : [],
      getName: () => 'variable',
      xAlert: message => { throw new Error(`unexpected alert: ${message}`); },
      focusModelEntityById: id => { selectedId = String(id); return true; }
    };
    vm.createContext(ctx);
    vm.runInContext(definition + '\n' + next, ctx);
    assert.equal(ctx.getSelectedGhostNavigationContext().sourceId, sourceId);
    for (const expectedId of [...aliases, sourceId]) {
      assert.equal(ctx.findNextGhostOfSelection(), true);
      assert.equal(selectedId, expectedId,
        `${sourceType} navigation should advance to ${expectedId}`);
      assert.equal(ctx.getSelectedGhostNavigationContext().sourceId, sourceId);
    }
  }
});

test('all ghost symbols receive a single delegated mouse selection handler', () => {
  assert.match(editor, /if \(this\.is_ghost\) \{[\s\S]*?this\.group\.setAttribute\("pointer-events", "all"\)/);
  assert.match(editor, /\$\(this\.group\)\.on\("mousedown", \(event\) => \{\s*primitive_mousedown\(this\.id, event\)/);
  assert.match(editor, /this\.name_overlay_group && this\.name_element[\s\S]*?primitive_mousedown\(this\.id, event\)/);
});

test('Lookup Ghost editing always resolves to the original Lookup', () => {
  const converterStart = editor.indexOf('class ConverterDialog extends jqDialog');
  const converterEnd = editor.indexOf('class DebugDialog', converterStart);
  const converter = editor.slice(converterStart, converterEnd);
  assert.match(converter, /requestedPrimitive = findID\(id\)/);
  assert.match(converter, /getType\(requestedPrimitive\) === "Ghost"/);
  assert.match(converter, /id = requestedPrimitive\.getAttribute\("Source"\)/);
  assert.match(converter, /this\.primitive = findID\(id\)/);
  assert.match(converter, /validateLookupName\(true\)/);
  assert.match(converter, /changeReferencesToName\(this\.primitive\.id, oldName, newName\)/);
});


test('the status bar identifies a Ghost by the source variable type, not its drawing shape', () => {
  assert.match(editor, /let Type = selected\.is_ghost \? systemikaTypeName\(primitive\) : type_basename\[type\]/);
  // In particular, Flow and Constant ghosts are drawn as VariableVisuals;
  // their source types must not be reported as Auxiliary.
  assert.match(editor, /case "Flow":\s*visualObject = new VariableVisual\(tprimitive\.id, "variable", position, \{ "is_ghost": true \}\)/);
  assert.match(editor, /case "Variable":\s*if \(source_primitive\.getAttribute\("isConstant"\) == "true"\)/);
});
