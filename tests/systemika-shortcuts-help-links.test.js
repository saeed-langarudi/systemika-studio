'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const editor = read('OpenSystemDynamics/src/editor.js');
const html = read('OpenSystemDynamics/src/index.html');
const help = read('docs/reference/SYSTEMIKA_HELP.md');

test('keyboard shortcut help matches current output, run, canvas, and dialog shortcuts', () => {
  const start = editor.indexOf('class KeyboardShortcutsDialog extends CloseDialog');
  const end = editor.indexOf('function helpTemplateText', start);
  const shortcuts = editor.slice(start, end);
  for (const text of [
    'Equations / Table',
    'Time Plot / XY Plot / Histogram',
    'Run / Pause from Run Name',
    'Return canvas to origin',
    'Scroll canvas left / right',
    'Close dialog'
  ]) assert.match(shortcuts, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(shortcuts, /Apply multiline equation|modifierKey\}\+Enter/);
  assert.match(help, /\| Equations \/ Table \| E \/ T \|/);
  assert.match(help, /\| Close dialog \| Esc \|/);
});

test('equation help uses Enter to apply and Shift+Enter for line breaks', () => {
  assert.match(editor, /event\.key === "Enter" && !event\.shiftKey/);
  assert.match(help, /Shift\+Enter/);
  assert.match(editor, /Press <b>Enter<\/b> to apply changes\. Equations can span multiple lines; press <b>Shift\+Enter<\/b> to insert a line break/);
});

test('top-right hyperlinks are removed and About contains current project/provenance links', () => {
  assert.doesNotMatch(html, /homepage-info|systemika\.org|Editor lineage:/);
  for (const url of ['https://systemika.no', 'https://stochsd.sourceforge.io', 'https://insightmaker.com']) {
    assert.match(editor, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('New model and dialog Apply shortcuts are exposed and implemented', () => {
  const start = editor.indexOf('class KeyboardShortcutsDialog extends CloseDialog');
  const end = editor.indexOf('function helpTemplateText', start);
  const shortcuts = editor.slice(start, end);
  assert.match(html, /id="btn_new"[^>]*data-title="New \(Ctrl\+N\)"/);
  assert.match(editor, /event\.key\.toLowerCase\(\) == "n"[\s\S]{0,120}#btn_new/);
  assert.match(shortcuts, /New model/);
  assert.match(shortcuts, /Apply changes in dialog/);
  assert.match(editor, /event\.key === "Enter" && !event\.shiftKey/);
  assert.match(help, /\| New model \| Ctrl\/Cmd\+N \|/);
  assert.match(help, /\| Apply changes in dialog \| Enter \|/);
  assert.match(help, /\| Insert line break in a multiline dialog field \| Shift\+Enter \|/);
});


test('Time Unit Enter uses the common Apply path and canvas Enter opens a selected equation', () => {
  const timeStart = editor.indexOf('class TimeUnitDialog extends jqDialog');
  const timeEnd = editor.indexOf('class GeometryDialog', timeStart);
  const timeUnit = editor.slice(timeStart, timeEnd);
  assert.match(timeUnit, /makeApply\(\)/);
  assert.match(timeUnit, /"Apply": \(\) => this\.applyChanges\(\)/);
  assert.doesNotMatch(timeUnit, /dialogParameters\.buttons\["Apply"\]\(\)/);
  assert.match(editor, /event\.key === "Enter"[\s\S]{0,700}openPrimitiveDialog\(selected\.id, "value"\)/);
});

test('Mouse, Undo, and Redo toolbar tooltips expose keyboard shortcuts', () => {
  assert.match(html, /id="btn_mouse"[^>]*data-title="Mouse \(M\)"/);
  assert.match(html, /id="btn_undo"[^>]*data-title="Undo \(Ctrl\+Z\)"/);
  assert.match(html, /id="btn_redo"[^>]*data-title="Redo \(Ctrl\+Y\)"/);
  assert.match(editor, /if \(key === "m"\)[\s\S]{0,120}ToolBox\.setTool\("mouse"\)/);
  assert.match(help, /\| Mouse tool \| M \|/);
});

test('attached flow endpoints require their flow to be selected before the endpoint can steal a stock click', () => {
  assert.match(editor, /attachedStock[\s\S]{0,900}!parentConnection\.isSelected\(\)[\s\S]{0,400}attachedStock\.select\(\)/);
});
