'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const editor = read('OpenSystemDynamics/src/editor.js');
const html = read('OpenSystemDynamics/src/index.html');
const help = read('SYSTEMIKA_HELP.md');

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

test('equation help uses Enter for line breaks and Apply for saving', () => {
  assert.doesNotMatch(editor, /"Ctrl-Enter"|"Cmd-Enter"/);
  assert.doesNotMatch(help, /Ctrl\/Cmd\+Enter|Ctrl\+Enter|Cmd\+Enter/);
  assert.match(editor, /Press <b>Enter<\/b> to insert a line break; use <b>Apply<\/b> to save the definition/);
});

test('top-right hyperlinks are removed and About contains current project/provenance links', () => {
  assert.doesNotMatch(html, /homepage-info|systemika\.org|Editor lineage:/);
  for (const url of ['https://systemika.no', 'https://stochsd.sourceforge.io', 'https://insightmaker.com']) {
    assert.match(editor, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
