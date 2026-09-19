'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const editorPath = path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js');
const editor = fs.readFileSync(editorPath, 'utf8');

test('Simulation Settings opens from a single click on the progress/status control', () => {
  assert.match(editor, /\$\("#progress-bar"\)\.click\(openSimulationSettings\)/);
  assert.doesNotMatch(editor, /\$\("#progress-bar"\)\.dblclick\(openSimulationSettings\)/);
});
