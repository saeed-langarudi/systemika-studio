'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const store = require('../electron/systemika-run-package');

const main = fsSync.readFileSync(path.join(__dirname, '..', 'electron/main.js'), 'utf8');
const from = main.indexOf('ipcMain.handle("systemika:runs:export-portable"');
const to = main.indexOf('ipcMain.handle("systemika:runs:open-folder"', from);
assert.ok(from >= 0 && to > from, 'Electron portable export must have its own IPC handler');
const handlerSource = main.slice(from, to);

function desktopExportHandler(target) {
  let callback;
  vm.runInNewContext(handlerSource, {
    ipcMain: { handle(name, fn) {
      assert.equal(name, 'systemika:runs:export-portable');
      callback = fn;
    } },
    systemikaRunStore: store,
    fs,
    path,
    BrowserWindow: { fromWebContents() { return null; } },
    mainWindow: null,
    dialog: { async showSaveDialog() { return target
      ? { canceled: false, filePath: target }
      : { canceled: true }; } },
  });
  return callback;
}

test('desktop IPC portable export produces a ZIP with original .ssd and separate Runs files', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'systemika-export-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const modelPath = path.join(dir, 'Exercise 1.ssd');
  const modelXml = '<InsightMakerModel><root/></InsightMakerModel>';
  await fs.writeFile(modelPath, modelXml);
  const saved = await store.writeRunPackage({
    modelPath, runLabel: 'Base', csv: 'Time,X\r\n0,42\r\n',
    metadata: { model: { file: 'Exercise 1.ssd' } }, overwrite: false,
  });
  assert.ok(saved.path.endsWith('.sysrun'));
  const sidecar = path.join(dir, 'Runs', 'Base.sysrun.metadata.json');
  await fs.writeFile(sidecar, JSON.stringify({ note: 'keep separate' }));

  const zipPath = path.join(dir, 'Export.zip');
  const result = await desktopExportHandler(zipPath)({ sender: null }, modelPath);
  assert.equal(result.path, zipPath);
  assert.equal(result.runFiles, 2);
  const entries = await store._internal.readZip(await fs.readFile(zipPath));
  assert.equal(entries.get('Exercise 1.ssd').toString(), modelXml);
  assert.ok(entries.get('Runs/Base.sysrun'));
  assert.deepEqual(JSON.parse(entries.get('Runs/Base.sysrun.metadata.json').toString()),
    { note: 'keep separate' });
  const nestedRun = await store._internal.readZip(entries.get('Runs/Base.sysrun'));
  assert.equal(nestedRun.get('data.csv').toString(), 'Time,X\r\n0,42\r\n');
});

test('canceling desktop portable export does not throw', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'systemika-export-cancel-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const modelPath = path.join(dir, 'Example.ssd');
  await fs.writeFile(modelPath, '<InsightMakerModel/>');
  const result = await desktopExportHandler(null)({ sender: null }, modelPath);
  assert.equal(result, null);
});

test('Runs dialog shows persistent outcome and changes its folder button label when connected', () => {
  const editor = fsSync.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics/src/editor.js'), 'utf8');
  assert.match(editor, /\.text\(connectedFolder \? 'Change Model Folder' : 'Connect Model Folder'\)/);
  assert.match(editor, /await this\.reload\(\);[\s\S]{0,900}this\.status\(folder \?/);
  assert.match(editor, /this\.status\('Folder selection cancelled\. The previous connection is unchanged\.'\)/);
});
