'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics/src/environment.js'), 'utf8');
const MODEL_XML = '<?xml version="1.0"?><InsightMakerModel><root/></InsightMakerModel>';

function setup() {
  const memory = new Map();
  const idbKeyval = {
    async get(k) { return memory.get(k); },
    async set(k, v) { memory.set(k, v); },
    async del(k) { memory.delete(k); },
  };
  const storage = new Map();
  const sessionStorage = {
    getItem(k) { return storage.get(k) || null; },
    setItem(k, v) { storage.set(k, v); },
    removeItem(k) { storage.delete(k); },
  };
  const inputs = [];
  const document = {
    body: { appendChild(input) { inputs.push(input); } },
    createElement(tag) {
      assert.equal(tag, 'input');
      const handlers = {};
      return {
        type: '', accept: '', style: {}, files: [], handlers,
        addEventListener(event, callback) { handlers[event] = callback; },
        click() { this.clicked = true; },
        remove() { this.removed = true; },
      };
    },
    getElementById() { return null; },
  };
  const window = { location: { protocol: 'https:', origin: 'https://systemika.no' },
    isSecureContext: true, sessionStorage, localStorage: sessionStorage, document,
    navigator: { userAgent: 'Chrome/130' },
    showOpenFilePicker: async () => { throw new Error('Chromium showOpenFilePicker MUST NOT be called'); },
    showDirectoryPicker: async () => null };
  window.top = window;
  window.parent = window;
  const history = [];
  const context = { window, document, location: window.location, sessionStorage,
    localStorage: sessionStorage, idbKeyval, console,
    Settings: { fileExtension: '.ssd', MaxRecentFiles: 8 },
    History: { forceCustomUndoState(content) { history.push(content); } },
    preserveRestart() {}, markModelSaved() {}, setParentTitle() {},
    crypto: { randomUUID() { return 'session-test'; } },
  };
  vm.runInNewContext(source, context);
  const manager = context.fileManager;
  assert.equal(manager.constructor.name, 'WebFileManagerModern');
  async function choose(file) {
    manager.loadModel();
    const input = inputs.at(-1);
    assert.ok(input && input.clicked);
    assert.equal(input.type, 'file');
    assert.equal(input.accept, '.ssd');
    input.files = file ? [file] : [];
    await input.handlers.change();
    assert.equal(input.removed, true);
    return input;
  }
  return { window, manager, memory, history, inputs, choose, storage };
}

function makeSelectedFile(name = 'Example.ssd', content = MODEL_XML) {
  return { name, async text() { return content; } };
}
function makeHandle(name = 'Example.ssd', content = MODEL_XML) {
  return {
    name, kind: 'file',
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; },
    async isSameEntry(other) { return this === other; },
    async getFile() { return makeSelectedFile(name, content); },
  };
}
function makeDirectory(files) {
  return {
    name: 'Exercises', kind: 'directory',
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; },
    async isSameEntry(other) { return this === other; },
    async getFileHandle(name) {
      if (files.has(name)) return files.get(name);
      const error = new Error('not found'); error.name = 'NotFoundError'; throw error;
    },
  };
}

test('Open Model uses the standard HTML .ssd picker; never invokes Chromium native picker or folder picker', async () => {
  const { window, manager, history, choose, storage } = setup();
  window.showDirectoryPicker = async () => { throw new Error('Unexpected folder picker'); };
  await choose(makeSelectedFile());
  assert.equal(manager.fileHandle, null);
  assert.deepEqual(history, [MODEL_XML]);
  assert.equal(manager.getRunStorageDirectoryHandle(), null);
  assert.equal(manager.fileName, 'Example.ssd');
  assert.ok(storage.get(manager.openedModelFingerprintKey));
});

test('Opening another model reconnects a prior authorized folder by exact contents and filename', async () => {
  const { manager, choose } = setup();
  const modelA = makeHandle('A.ssd');
  const modelB = makeHandle('B.ssd');
  const folderA = makeDirectory(new Map([[modelA.name, modelA]]));
  const folderB = makeDirectory(new Map([[modelB.name, modelB]]));
  await manager.rememberProjectFolder(folderA);
  await manager.rememberProjectFolder(folderB);
  await choose(makeSelectedFile('B.ssd'));
  assert.equal(manager.fileHandle, modelB);
  assert.equal(manager.getRunStorageDirectoryHandle(), folderB);
});

test('Different model with the same filename is never automatically connected', async () => {
  const { manager, choose } = setup();
  const other = makeHandle('Example.ssd', MODEL_XML.replace('<root/>', '<root id="wrong"/>'));
  const folder = makeDirectory(new Map([[other.name, other]]));
  await manager.rememberProjectFolder(folder);
  await choose(makeSelectedFile());
  assert.equal(manager.fileHandle, null);
  assert.equal(manager.getRunStorageDirectoryHandle(), null);
});

test('No directory permission: model still opens without automatic permission prompts', async () => {
  const { window, manager, choose } = setup();
  const model = makeHandle();
  const folder = makeDirectory(new Map([[model.name, model]]));
  folder.queryPermission = async () => 'prompt';
  await manager.rememberProjectFolder(folder);
  let directoryPickCount = 0;
  window.showDirectoryPicker = async () => { directoryPickCount++; return folder; };
  await choose(makeSelectedFile());
  assert.equal(manager.fileName, model.name);
  assert.equal(manager.getRunStorageDirectoryHandle(), null);
  await assert.rejects(manager.ensureRunStorageAccess(), error => error.code === 'PROJECT_DIRECTORY_NOT_CONNECTED');
  assert.equal(directoryPickCount, 0);
});

test('Connect Model Folder restores a matching file handle after standard file-input opening', async () => {
  const { window, manager, choose, memory } = setup();
  const file = makeHandle();
  const unrelatedFile = makeHandle('Example.ssd', MODEL_XML + '<!--changed-->');
  const wrong = makeDirectory(new Map([[file.name, unrelatedFile]]));
  const correct = makeDirectory(new Map([[file.name, file]]));
  await choose(makeSelectedFile());
  window.showDirectoryPicker = async opts => {
    assert.equal(opts.startIn, 'documents');
    return wrong;
  };
  await assert.rejects(manager.ensureRunStorageAccess({ promptForDirectory: true }),
    err => err.code === 'WRONG_PROJECT_DIRECTORY');
  assert.equal(manager.getRunStorageDirectoryHandle(), null);
  assert.equal(memory.get(manager.knownProjectFoldersKey), undefined);
  window.showDirectoryPicker = async () => correct;
  const result = await manager.ensureRunStorageAccess({ promptForDirectory: true });
  assert.equal(result, correct);
  assert.equal(manager.fileHandle, file);
  assert.equal(manager.getRunStorageDirectoryHandle(), correct);
  assert.ok(memory.get(manager.knownProjectFoldersKey).includes(correct));
});

test('Explicit Connect Model Folder still checks exact FileSystemHandle when one is present', async () => {
  const { window, manager } = setup();
  const model = makeHandle();
  const other = makeHandle();
  manager.fileHandle = model;
  const unrelated = makeDirectory(new Map([[model.name, other]]));
  window.showDirectoryPicker = async () => unrelated;
  await assert.rejects(manager.ensureRunStorageAccess({ promptForDirectory: true }),
    err => err.code === 'WRONG_PROJECT_DIRECTORY');
});

test('Cancel Open Model preserves the previously open model', async () => {
  const { manager, choose, history } = setup();
  const model = makeHandle('Previous.ssd');
  manager.fileHandle = model;
  manager.fileName = model.name;
  await choose(null);
  assert.equal(manager.fileHandle, model);
  assert.equal(manager.fileName, 'Previous.ssd');
  assert.equal(history.length, 0);
});

test('Embedded editor never invokes top-level showOpenFilePicker, preventing native-picker frame path', async () => {
  const { window, manager, history, choose } = setup();
  window.top = { location: { origin: window.location.origin },
    showOpenFilePicker: async () => { throw new Error('Top-level picker must not be called'); } };
  await choose(makeSelectedFile('Inside.ssd'));
  assert.equal(manager.fileHandle, null);
  assert.deepEqual(history, [MODEL_XML]);
});

test('Invalid file does not replace the current model', async () => {
  const { manager, choose, history } = setup();
  const old = makeHandle('Existing.ssd');
  manager.fileHandle = old;
  manager.fileName = old.name;
  const alerts = [];
  // xAlert is resolved at runtime from the evaluated environment.
  // Use the window.alert fallback to capture validation failures.
  const input = choose(makeSelectedFile('Bad.ssd', 'not a model'));
  await input;
  assert.equal(manager.fileHandle, old);
  assert.equal(manager.fileName, 'Existing.ssd');
  assert.equal(history.length, 0);
});
