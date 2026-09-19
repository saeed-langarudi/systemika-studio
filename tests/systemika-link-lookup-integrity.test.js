'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'newAPI.js'), 'utf8');

function between(source, a, b) {
  const start = source.indexOf(a); const end = source.indexOf(b, start + a.length);
  assert.notEqual(start, -1, `missing ${a}`); assert.notEqual(end, -1, `missing ${b}`);
  return source.slice(start, end);
}

test('directed linked-entity helper exists for equation/editor references', () => {
  const helper = between(api, 'function getLinkedPrimitives(primitive)', '/*\n\tMethod: replaceName');
  assert.match(helper, /primitives\("Link"\)/);
  assert.match(helper, /link\.target[\s\S]*add\(link\.source\)/);
  assert.match(helper, /BiDirectional[\s\S]*add\(link\.target\)/);
});

test('Lookup accepts only one incoming Link and ignores outgoing Links for that constraint', () => {
  const linkVisual = between(editor, 'class LinkVisual extends BaseConnection', 'class BaseTool');
  assert.match(linkVisual, /attachVisual\.getType\(\) === "converter"/);
  assert.match(linkVisual, /primitives\("Link"\)\.filter/);
  assert.match(linkVisual, /link\.target/);
  assert.match(linkVisual, /String\(getID\(link\)\) !== String\(this\.id\)/);
});

test('Lookup source follows only incoming Links and falls back to Time', () => {
  const converter = between(editor, 'class ConverterVisual extends BasePrimitive', 'class TwoPointer extends BaseObject');
  assert.match(converter, /findLinkedInPrimitives\(this\.id\)/);
  assert.match(converter, /incoming\.length > 0 \? incoming\[0\]\.id : "Time"/);
  assert.doesNotMatch(converter, /getLinkedPrimitives\(this\.primitive\)/);
});

test('incomplete Links are explicitly deleted instead of depending on selection state', () => {
  const linkTool = between(editor, 'class LinkTool extends TwoPointerTool', 'LinkTool.init();');
  assert.match(linkTool, /parent\.getStartAttach\(\) === null \|\| parent\.getEndAttach\(\) === null/);
  assert.match(linkTool, /tool_deletePrimitive\(parent\.id\)/);
  assert.doesNotMatch(linkTool, /delete_selected_objects\(\)/);
});


test('model load and Undo synchronization remove legacy half-connected Links', () => {
  const sync = between(editor, 'function syncAllVisuals()', 'function findFreeName');
  assert.match(sync, /cleanUnconnectedLinks\(\)/);
});
