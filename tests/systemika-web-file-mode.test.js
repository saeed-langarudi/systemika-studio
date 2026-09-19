'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const environmentSource = fs.readFileSync(
  path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'environment.js'),
  'utf8'
);

function loadEnvironment(windowOverrides = {}, locationOverrides = {}, sharedStorage = null) {
  const location = { protocol: 'file:', origin: 'null', ...locationOverrides };
  const window = {
    parent: null,
    top: null,
    isSecureContext: true,
    location,
    ...windowOverrides,
  };
  window.parent = window.parent || window;
  window.top = window.top || window;
  const memory = new Map();
  const storage = sharedStorage || new Map();
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };
  window.localStorage = window.localStorage || localStorage;
  const context = {
    console,
    window,
    location,
    localStorage: window.localStorage,
    document: window.document,
    Settings: { fileExtension: '.ssd', MaxRecentFiles: 8 },
    idbKeyval: {
      async get(key) { return memory.get(key); },
      async set(key, value) { memory.set(key, value); },
      async del(key) { memory.delete(key); },
    },
    createModelFileData: () => '<model/>',
    markModelSaved: () => {},
  };
  vm.runInNewContext(environmentSource, context);
  return context;
}


test('top-level file page can use full project-file mode when picker APIs are exposed', () => {
  const noop = async () => {};
  const context = loadEnvironment({
    showOpenFilePicker: noop,
    showDirectoryPicker: noop,
  });
  assert.equal(context.fileManager.constructor.name, 'WebFileManagerModern');
  assert.equal(context.fileManager.softwareName, 'Systemika Studio');
  assert.equal(context.fileManager.usesBrowserStorage(), false);
});

test('web browser tab title stays exactly Systemika Studio', () => {
  const document = { title: '' };
  const noop = async () => {};
  const context = loadEnvironment({
    showOpenFilePicker: noop,
    showDirectoryPicker: noop,
    document,
  });
  context.fileManager.fileName = 'A very long model name.ssd';
  context.fileManager.lastSaved = '19:15:00';
  context.fileManager.updateTitle();
  assert.equal(document.title, 'Systemika Studio');
});

test('file:// editor iframe falls back before Chromium can throw cross-origin picker SecurityError', () => {
  const noop = async () => {};
  const top = { location: { protocol: 'file:', origin: 'null' } };
  const context = loadEnvironment({
    top,
    parent: top,
    showOpenFilePicker: noop,
    showDirectoryPicker: noop,
  });
  assert.equal(context.fileManager.constructor.name, 'WebFileManagerBasic');
  assert.equal(context.fileManager.storageLimitationReason, 'FILE_IFRAME_CONTEXT');
  assert.match(context.fileManager.getProjectStorageUnavailableMessage(), /localhost/);
});

test('same-origin localhost editor iframe uses full project-file mode', () => {
  const noop = async () => {};
  const top = { location: { protocol: 'http:', origin: 'http://localhost:8765' } };
  const context = loadEnvironment({
    top,
    parent: top,
    showOpenFilePicker: noop,
    showDirectoryPicker: noop,
  }, { protocol: 'http:', origin: 'http://localhost:8765' });
  assert.equal(context.fileManager.constructor.name, 'WebFileManagerModern');
});

test('web file manager clearly falls back when project directory picker is unavailable', () => {
  const noop = async () => {};
  const context = loadEnvironment({
    showOpenFilePicker: noop,
    // showDirectoryPicker intentionally missing.
  });
  assert.equal(context.fileManager.constructor.name, 'WebFileManagerBasic');
  assert.equal(context.fileManager.usesBrowserStorage(), true);
  assert.equal(context.fileManager.softwareName, 'Systemika Studio');
});



test('Firefox fallback shows a persistent compatibility notice in the status bar', () => {
  const modalNotices = [];

  function makeDocument() {
    const statusNotice = { id: 'systemika-browser-compatibility-status', style: { display: 'none' } };
    const aboutButton = { textContent: '' };
    return {
      title: '',
      getElementById(id) {
        if (id === 'systemika-browser-compatibility-status') return statusNotice;
        if (id === 'btn_about') return aboutButton;
        return null;
      },
      statusNotice,
      aboutButton,
    };
  }

  const firstDocument = makeDocument();
  const first = loadEnvironment({
    navigator: { userAgent: 'Mozilla/5.0 Firefox/142.0' },
    document: firstDocument,
  }, { protocol: 'http:', origin: 'http://localhost:8765' });
  first.xAlert = (message) => modalNotices.push(message);
  first.environment.ready();
  assert.equal(first.fileManager.constructor.name, 'WebFileManagerBasic');
  assert.equal(first.fileManager.softwareName, 'Systemika Studio');
  assert.equal(first.fileManager.isFirefoxLimitedMode(), true);
  assert.equal(first.fileManager.shouldSuppressRunManagerUnavailableAlert(), true);
  assert.equal(modalNotices.length, 0);
  assert.equal(firstDocument.statusNotice.style.display, 'flex');
  assert.equal(firstDocument.aboutButton.textContent, 'About Systemika Studio');

  // The notice is deliberately permanent rather than a one-time/dismissible warning.
  const secondDocument = makeDocument();
  const second = loadEnvironment({
    navigator: { userAgent: 'Mozilla/5.0 Firefox/142.0' },
    document: secondDocument,
  }, { protocol: 'http:', origin: 'http://localhost:8765' });
  second.xAlert = (message) => modalNotices.push(message);
  second.environment.ready();
  assert.equal(secondDocument.statusNotice.style.display, 'flex');
  assert.equal(modalNotices.length, 0);
});

test('Firefox storage-mode explanation is suppressed while the persistent compatibility notice is visible', () => {
  const context = loadEnvironment(
    { navigator: { userAgent: 'Mozilla/5.0 Firefox/142.0' } },
    { protocol: 'http:', origin: 'http://localhost:8765' }
  );
  let alerts = 0;
  context.xAlert = () => { alerts += 1; };
  context.fileManager.explainStorageMode();
  assert.equal(alerts, 0);
});

test('Safari fallback shares the persistent compatibility notice and suppresses repeated storage alerts', () => {
  const statusNotice = { style: { display: 'none' } };
  const document = { title: '', getElementById(id) { if (id === 'systemika-browser-compatibility-status') return statusNotice; if (id === 'btn_about') return { textContent: '' }; return null; } };
  const context = loadEnvironment({ navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15' }, document }, { protocol: 'http:', origin: 'http://localhost:8765' });
  let alerts = 0;
  context.xAlert = () => { alerts += 1; };
  context.environment.ready();
  assert.equal(context.fileManager.constructor.name, 'WebFileManagerBasic');
  assert.equal(context.fileManager.isFirefoxLimitedMode(), true);
  assert.equal(context.fileManager.shouldSuppressRunManagerUnavailableAlert(), true);
  context.fileManager.explainStorageMode();
  assert.equal(statusNotice.style.display, 'flex');
  assert.equal(alerts, 0);
});

test('modern Save As selects a project directory and creates the .ssd file inside it', async () => {
  const files = new Map();
  const directory = {
    kind: 'directory',
    name: 'Project',
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; },
    async getFileHandle(name, options = {}) {
      if (files.has(name)) return files.get(name);
      if (!options.create) {
        const error = new Error('not found');
        error.name = 'NotFoundError';
        throw error;
      }
      const handle = {
        kind: 'file',
        name,
        async isSameEntry(other) { return this === other; },
        async createWritable() { return { async write() {}, async close() {} }; },
      };
      files.set(name, handle);
      return handle;
    },
  };
  const context = loadEnvironment({
    showOpenFilePicker: async () => [],
    showDirectoryPicker: async () => directory,
    prompt: () => 'Epidemic',
    confirm: () => true,
  });

  const chosen = await context.fileManager.chooseFilename();
  assert.equal(chosen, true);
  assert.equal(context.fileManager.fileName, 'Epidemic.ssd');
  assert.equal(context.fileManager.getRunStorageDirectoryHandle(), directory);
  assert.ok(files.has('Epidemic.ssd'));
});
