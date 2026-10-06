'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function csvFor(value) { return `Time,X\r\n0,${value}\r\n1,${value + 1}\r\n`; }
function metadata(name) {
  return { runName: name, data: { columnIds: [0, 1] }, simulation: { startTime: 0, timeLength: 1, timeStep: 1, timeUnits: 'Years' } };
}

test('multiple saved runs can be cached and queried independently', async () => {
  const api = {
    async load(modelPath, runName) { return { csv: csvFor(runName === 'Base' ? 10 : 20), metadata: metadata(runName) }; },
    async list() { return [{ runName: 'Base' }, { runName: 'Policy A' }]; },
    async exists() { return true; },
    async save() {},
    async openFolder() {},
  };
  const context = {
    console, Date, JSON, Number, String, Boolean, Array, Object, Map, Set, Promise,
    fileManager: { fileName: '/models/Test.ssd' },
    getElectronAPI: () => ({ isElectron: true, runs: api }),
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'systemika-run-data-manager.js'), 'utf8'), context);

  await context.systemikaSimulationData.ensureRunLoaded('Base');
  await context.systemikaSimulationData.ensureRunLoaded('Policy A');

  assert.equal(JSON.stringify(context.systemikaSimulationData.getSelectiveIdResults([1], 'Base')), JSON.stringify([[0, 10], [1, 11]]));
  assert.equal(JSON.stringify(context.systemikaSimulationData.getSelectiveIdResults([1], 'Policy A')), JSON.stringify([[0, 20], [1, 21]]));
  assert.equal(context.systemikaSimulationData.getCurrentRun(), null, 'loading a display run must not globally switch the current run');
});

test('stale display run reference is treated as unavailable when model was copied without Runs folder', async () => {
  let loadCalls = 0;
  const api = {
    async exists(modelPath, runName) {
      assert.equal(modelPath, '/copied/Test.ssd');
      assert.equal(runName, 'Old Run');
      return false;
    },
    async load() { loadCalls += 1; throw new Error('load must not be attempted for a missing run'); },
  };
  const context = {
    console, Date, JSON, Number, String, Boolean, Array, Object, Map, Set, Promise,
    fileManager: { fileName: '/copied/Test.ssd' },
    getElectronAPI: () => ({ isElectron: true, runs: api }),
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'systemika-run-data-manager.js'), 'utf8'), context);

  const run = await context.systemikaSimulationData.ensureRunLoadedIfExists('Old Run');
  assert.equal(run, null);
  assert.equal(loadCalls, 0);
});

test('run removed between existence check and load is treated as stale rather than surfacing ENOENT', async () => {
  const api = {
    async exists() { return true; },
    async load() { throw new Error("Error invoking remote method 'systemika:runs:load': Error: ENOENT: no such file or directory"); },
  };
  const context = {
    console, Date, JSON, Number, String, Boolean, Array, Object, Map, Set, Promise,
    fileManager: { fileName: '/copied/Test.ssd' },
    getElectronAPI: () => ({ isElectron: true, runs: api }),
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'systemika-run-data-manager.js'), 'utf8'), context);

  const run = await context.systemikaSimulationData.ensureRunLoadedIfExists('Old Run');
  assert.equal(run, null);
});


test('ENOENT during existence check is also treated as a stale run reference', async () => {
  const api = {
    async exists() { throw new Error("Error invoking remote method 'systemika:runs:exists': Error: ENOENT: no such file or directory"); },
    async load() { throw new Error('load must not be attempted'); },
  };
  const context = {
    console, Date, JSON, Number, String, Boolean, Array, Object, Map, Set, Promise,
    fileManager: { fileName: '/models/Test.ssd' },
    getElectronAPI: () => ({ isElectron: true, runs: api }),
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'systemika-run-data-manager.js'), 'utf8'), context);

  const run = await context.systemikaSimulationData.ensureRunLoadedIfExists('Deleted Run');
  assert.equal(run, null);
});

test('deleting a run at the data layer automatically removes it from display selections', async () => {
  const removed = [];
  const api = { async delete(modelPath, runName) { return { runName }; } };
  const context = {
    console, Date, JSON, Number, String, Boolean, Array, Object, Map, Set, Promise,
    fileManager: { fileName: '/models/Test.ssd' },
    SystemikaDisplayRuns: { removeRun(name) { removed.push(name); } },
    getElectronAPI: () => ({ isElectron: true, runs: api }),
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'systemika-run-data-manager.js'), 'utf8'), context);

  await context.systemikaSimulationData.deleteRun('Policy A');
  assert.deepEqual(removed, ['Policy A']);
});
