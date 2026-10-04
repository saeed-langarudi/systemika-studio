'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const environment = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/environment.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/style/editor.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
const entities = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-entities.js'), 'utf8');

test('modern WebApp implements generic exportFile for equation exports', () => {
  const start = environment.indexOf('class WebFileManagerModern');
  const end = environment.indexOf('class ElectronFileManager', start);
  const body = environment.slice(start, end);
  assert.match(body, /async exportFile\(dataToSave, fileExtension, onSuccess\)/);
  assert.match(body, /window\.showSaveFilePicker/);
  assert.match(body, /createWritable\(\)/);
  assert.match(body, /a\.download = suggestedName/);
  assert.match(editor, /Export equations as TXT/);
  assert.match(editor, /fileManager\.exportFile\(SystemikaDocumentation\.toPlainText/);
});

test('Systemika supports multiple independent model windows in WebApp and Electron', () => {
  assert.match(index, /id="btn_new_window"/);
  assert.match(editor, /#btn_new_window/);
  assert.match(environment, /openNewWindow\(\)/);
  assert.match(environment, /host\.open\("about:blank", "_blank"\)/);
  assert.match(environment, /opened\.sessionStorage\.clear\(\)/);
  assert.match(preload, /openNewWindow:\s*\(\) => ipcRenderer\.invoke\("window:new"\)/);
  assert.match(main, /const modelWindows = new Set\(\)/);
  assert.match(main, /ipcMain\.handle\("window:new"/);
  assert.match(main, /createWindow\(filePath \|\| null\)/);
  assert.match(main, /BrowserWindow\.fromWebContents\(event\.sender\)/);
});

test('per-window reload and file-handle state is isolated while the structure clipboard is shared', () => {
  assert.match(editor, /function modelSessionStorage\(\)/);
  assert.match(editor, /if \(typeof sessionStorage !== "undefined"\) return sessionStorage/);
  assert.match(environment, /systemika\.windowSessionId/);
  assert.match(environment, /fileHandle:\$\{sessionId\}/);
  assert.match(environment, /systemikaProjectDirectoryHandle:\$\{sessionId\}/);
  assert.match(editor, /systemika\.shared-structure-clipboard\.v1/);
  assert.match(editor, /localStorage\.setItem\(this\.sharedStorageKey/);
  assert.match(editor, /window\.addEventListener\("storage"/);
  assert.match(editor, /this\.refreshFromShared\(\)/);
});

test('cross-model paste preserves free names and renames only destination collisions', () => {
  assert.match(editor, /static destinationPasteName\(originalName, reservedNames\)/);
  assert.match(editor, /if \(findName\(base\) == null && !reservedNames\.has\(key\)\)/);
  assert.match(editor, /reservedNames\.add\(key\);\s*return base;/s);
  assert.match(editor, /return this\.freeCopyName\(base, reservedNames\)/);
  assert.match(editor, /this\.destinationPasteName\(item\.name, reservedNames\)/);
  assert.match(editor, /this\.remapFormulaAttributes\(clone, nameMap\)/);
});

test('model-page and direct structure-import features are not exposed in 1.1.8', () => {
  assert.doesNotMatch(index, /btn_import_structure|systemika-model-pages/);
  assert.doesNotMatch(editor, /SystemikaModelPages|importModelStructureFromFile|chooseModelStructureFile|systemikaExternalNodeClipboardItem/);
  assert.doesNotMatch(css, /systemika-model-page|systemika-model-pages/);
});

test('Feedback Loop remains a persistable graphical primitive', () => {
  assert.match(entities, /"TextArea", "FeedbackLoop", "Rectangle"/);
});
