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
