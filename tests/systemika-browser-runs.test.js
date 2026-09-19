'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const desktopStore = require('../electron/systemika-run-package');

const browserStoreSource = fs.readFileSync(
  path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'systemika-run-browser-store.js'),
  'utf8'
);

function notFound(name) {
  const error = new Error(`${name} not found`);
  error.name = 'NotFoundError';
  return error;
}

class FakeFileHandle {
  constructor(name, initial = new Uint8Array()) {
    this.kind = 'file';
    this.name = name;
    this.bytes = new Uint8Array(initial);
    this.lastModified = Date.now();
  }
  async isSameEntry(other) { return this === other; }
  async getFile() {
    return new File([this.bytes], this.name, { lastModified: this.lastModified });
  }
  async createWritable() {
    const handle = this;
    let pending = handle.bytes;
    return {
      async write(value) {
        if (value instanceof Uint8Array) pending = new Uint8Array(value);
        else if (value instanceof ArrayBuffer) pending = new Uint8Array(value);
        else pending = new Uint8Array(await new Blob([value]).arrayBuffer());
      },
      async close() {
        handle.bytes = new Uint8Array(pending);
        handle.lastModified = Date.now();
      },
      async abort() {},
    };
  }
}

class FakeDirectoryHandle {
  constructor(name) {
    this.kind = 'directory';
    this.name = name;
    this.children = new Map();
  }
  async getDirectoryHandle(name, options = {}) {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== 'directory') throw new TypeError(`${name} is not a directory`);
      return existing;
    }
    if (!options.create) throw notFound(name);
    const handle = new FakeDirectoryHandle(name);
    this.children.set(name, handle);
    return handle;
  }
  async getFileHandle(name, options = {}) {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== 'file') throw new TypeError(`${name} is not a file`);
      return existing;
    }
    if (!options.create) throw notFound(name);
    const handle = new FakeFileHandle(name);
    this.children.set(name, handle);
    return handle;
  }
  async removeEntry(name) {
    if (!this.children.has(name)) throw notFound(name);
    this.children.delete(name);
  }
  async *entries() {
    for (const entry of this.children.entries()) yield entry;
  }
}

function loadBrowserStore(projectDirectory = new FakeDirectoryHandle('Project'), options = {}) {
  const fileManager = {
    fileName: 'Model.ssd',
    supportsProjectRunStorage: () => true,
    getRunStorageDirectoryHandle: () => projectDirectory,
    ensureRunStorageAccess: async () => projectDirectory,
  };
  const context = {
    console,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    Promise,
    Uint8Array,
    Uint32Array,
    ArrayBuffer,
    DataView,
    TextEncoder,
    TextDecoder,
    Blob,
    File,
    Response,
    fileManager,
  };
  if (!options.withoutDecompressionStream) context.DecompressionStream = DecompressionStream;
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(browserStoreSource, context);
  return { context, projectDirectory };
}


test('browser run persistence remains supported without DEFLATE decompression support', async () => {
  const { context } = loadBrowserStore(new FakeDirectoryHandle('Project'), { withoutDecompressionStream: true });
  assert.equal(context.systemikaBrowserRuns.isSupported(), true);
  await context.systemikaBrowserRuns.save('Model.ssd', {
    runLabel: 'Base',
    csv: 'Time,X\r\n0,1\r\n',
    metadata: {},
    overwrite: false,
  });
  assert.equal(await context.systemikaBrowserRuns.exists('Model.ssd', 'Base'), true);
});

test('browser-created .sysrun ZIP is readable by the desktop package implementation', async () => {
  const { context } = loadBrowserStore();
  const csv = 'Time,X\r\n0,1\r\n';
  const metadata = { runName: 'Base', simulation: { timeStep: 1 } };
  const zip = await context.SystemikaBrowserRunStoreInternals.makeZip([
    { name: 'data.csv', data: csv },
    { name: 'metadata.json', data: JSON.stringify(metadata) },
  ]);

  const files = await desktopStore._internal.readZip(Buffer.from(zip));
  assert.equal(files.get('data.csv').toString('utf8'), csv);
  assert.deepEqual(JSON.parse(files.get('metadata.json').toString('utf8')), metadata);
});

test('browser reader opens desktop-compressed .sysrun ZIP content', async () => {
  const { context } = loadBrowserStore();
  const csv = 'Time,X\r\n0,5\r\n';
  const metadata = { runName: 'Desktop Run' };
  const zip = await desktopStore._internal.makeZip([
    { name: 'data.csv', data: csv },
    { name: 'metadata.json', data: JSON.stringify(metadata) },
  ]);

  const files = await context.SystemikaBrowserRunStoreInternals.readZip(new Uint8Array(zip));
  assert.equal(new TextDecoder().decode(files.get('data.csv')), csv);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(files.get('metadata.json'))), metadata);
});

test('browser run store uses Runs/*.sysrun and supports save list load duplicate rename delete', async () => {
  const { context, projectDirectory } = loadBrowserStore();
  const api = context.systemikaBrowserRuns;
  const csv = 'Time,X\r\n0,10\r\n1,11\r\n';

  const saved = await api.save('Model.ssd', {
    runLabel: 'Policy: High/Low',
    csv,
    metadata: { simulation: { timeStep: 1 } },
    overwrite: false,
  });
  assert.equal(saved.path, 'Runs/Policy_ High_Low.sysrun');
  assert.equal(saved.metadata.runName, 'Policy: High/Low');

  const runsDir = projectDirectory.children.get('Runs');
  assert.ok(runsDir, 'Runs directory should be created beside the model');
  assert.ok(runsDir.children.has('Policy_ High_Low.sysrun'));
  assert.equal(await api.exists('Model.ssd', 'Policy: High/Low'), true);

  const loaded = await api.load('Model.ssd', 'Policy: High/Low');
  assert.equal(loaded.csv, csv);
  assert.equal(loaded.metadata.runName, 'Policy: High/Low');

  let listed = await api.list('Model.ssd');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].runName, 'Policy_ High_Low');

  await api.duplicate('Model.ssd', 'Policy: High/Low', 'Copy');
  assert.equal(await api.exists('Model.ssd', 'Copy'), true);
  await api.rename('Model.ssd', 'Copy', 'Renamed');
  assert.equal(await api.exists('Model.ssd', 'Copy'), false);
  assert.equal(await api.exists('Model.ssd', 'Renamed'), true);
  await api.delete('Model.ssd', 'Renamed');
  assert.equal(await api.exists('Model.ssd', 'Renamed'), false);
});

test('browser run store can load a desktop-created compressed package from Runs', async () => {
  const { context, projectDirectory } = loadBrowserStore();
  const runsDir = await projectDirectory.getDirectoryHandle('Runs', { create: true });
  const desktopZip = await desktopStore._internal.makeZip([
    { name: 'data.csv', data: 'Time,X\r\n0,42\r\n' },
    { name: 'metadata.json', data: JSON.stringify({ runName: 'Desktop', application: 'Systemika', formatVersion: 1 }) },
  ]);
  runsDir.children.set('Desktop.sysrun', new FakeFileHandle('Desktop.sysrun', new Uint8Array(desktopZip)));

  const loaded = await context.systemikaBrowserRuns.load('Model.ssd', 'Desktop');
  assert.match(loaded.csv, /0,42/);
  assert.equal(loaded.metadata.runName, 'Desktop');
});
