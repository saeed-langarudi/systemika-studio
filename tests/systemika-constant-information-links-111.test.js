
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const engine = require(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-engine.js'));
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');

function between(source, a, b) {
  const start = source.indexOf(a);
  const end = source.indexOf(b, start + a.length);
  assert.notEqual(start, -1, `missing ${a}`);
  assert.notEqual(end, -1, `missing ${b}`);
  return source.slice(start, end);
}

test('constants may accept incoming Links and those Links use information-link presentation', () => {
  const linkVisual = between(editor, 'class LinkVisual extends BaseConnection', 'class BaseTool');
  assert.match(linkVisual, /okAttachTypes = \["stock", "variable", "constant", "converter", "flow"\]/);
  assert.match(linkVisual, /\["stock", "constant"\]\.includes\(end\.getType\(\)\)/);
  assert.match(linkVisual, /stroke-dasharray", "6 4"/);
});

test('View menu can hide and show information Links without changing model structure', () => {
  assert.match(html, /id="btn_toggle_information_links"[^>]*>Hide Information Links<\/button>/);
  assert.match(editor, /let informationLinksVisible = true/);
  assert.match(editor, /setInformationLinksVisible\(!informationLinksVisible\)/);
  assert.match(editor, /connection instanceof LinkVisual/);
  assert.match(editor, /setInformationLinkVisible\(!informationLink \|\| informationLinksVisible\)/);
});

test('constant values are frozen at simulation start even when their inputs later change', () => {
  const results = engine.simulate({
    timeStart: 0, timeLength: 3, dt: 1, method: 'Euler',
    stocks: [{ id: 's', name: 'Stock', initial: '10' }],
    variables: [{ id: 'c', name: 'Derived Constant', equation: '2 * [Stock]', isConstant: true }],
    flows: [{ id: 'f', name: 'Growth', equation: '1', targetId: 's' }]
  });
  assert.deepEqual(results.value('s'), [10, 11, 12, 13]);
  assert.deepEqual(results.value('c'), [20, 20, 20, 20]);
});

test('constants can depend on other constants and on start-time auxiliary values', () => {
  const results = engine.simulate({
    timeStart: 5, timeLength: 2, dt: 1, method: 'Euler',
    variables: [
      { id: 'a', name: 'A', equation: '3', isConstant: true },
      { id: 'aux', name: 'Aux', equation: 'T() + [A]' },
      { id: 'b', name: 'B', equation: '[A] * [Aux]', isConstant: true }
    ]
  });
  assert.deepEqual(results.value('a'), [3, 3, 3]);
  assert.deepEqual(results.value('aux'), [8, 9, 10]);
  assert.deepEqual(results.value('b'), [24, 24, 24]);
});


test('constant start evaluation can use a Lookup driven by a Stock initial value', () => {
  const results = engine.simulate({
    timeStart: 0, timeLength: 1, dt: 1, method: 'Euler',
    stocks: [{ id: 's', name: 'S', initial: '5' }],
    converters: [{ id: 'l', name: 'L', data: '0,0; 10,100', sourceId: 's', interpolation: 'Linear' }],
    variables: [{ id: 'c', name: 'C', equation: '[L]', isConstant: true }],
    flows: [{ id: 'f', name: 'F', equation: '1', targetId: 's' }]
  });
  assert.deepEqual(results.value('c'), [50, 50]);
});

test('circular dependencies among fixed initial values are rejected', () => {
  assert.throws(() => engine.simulate({
    stocks: [{ id: 's', name: 'S', initial: '[C]' }],
    variables: [{ id: 'c', name: 'C', equation: '[S] + 1', isConstant: true }]
  }), /Circular dependency while evaluating initial value/i);
});
