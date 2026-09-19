'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
const manager = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'systemika-run-manager.js'), 'utf8');

test('overwrite confirmation is owned by Electron main process', () => {
  assert.match(main, /ipcMain\.handle\("systemika:runs:confirm-overwrite"/);
  assert.match(main, /dialog\.showMessageBox/);
  assert.match(main, /buttons:\s*\["Overwrite", "Cancel"\]/);
  assert.match(main, /cancelId:\s*1/);
});

test('renderer awaits the asynchronous overwrite result instead of window.confirm in desktop path', () => {
  assert.match(manager, /await api\.confirmOverwrite\(runName\)/);
});
