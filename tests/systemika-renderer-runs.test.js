'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeContext(options = {}) {
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
    document: {
      getElementById(id) {
        if (id === 'systemika-run-name') return context.runInput;
        if (id === 'systemika-run-controls') return context.controls;
        if (id === 'btn_open_runs_folder') return context.folderButton;
        return null;
      },
    },
    runInput: {
      value: options.runName || 'Base',
      disabled: false,
      addEventListener() {},
    },
    controls: { style: {}, dataset: {} },
    folderButton: { disabled: false, addEventListener() {} },
    fileManager: {
      fileName: Object.prototype.hasOwnProperty.call(options, 'modelPath') ? options.modelPath : '/models/Test.ssd',
      async saveModelAs() {
        this.fileName = '/models/Saved.ssd';
        return this.fileName;
      },
    },
    isRunningElectron: () => options.electron !== false,
    confirm: () => options.confirm !== false,
    alert(message) { context.alertMessages.push(String(message)); },
    alertMessages: [],
    History: { unsavedChanges: false },
    getTimeStart: () => 0,
    getTimeLength: () => 10,
    getTimeStep: () => 1,
    getTimeUnits: () => 'Years',
    getAlgorithm: () => 'RK1',
    primitives(type) {
      if (type === 'Setting') return [{ value: { attributes: [] } }];
      return [];
    },
    getPrimitiveList: () => [],
    getTypeNew: () => 'Variable',
    RunResults: {
      ignoreUnits: false,
      lastSimulationStochastic: false,
      varnameList: ['Time', 'X'],
      varIdList: [0, 1],
      results: [[0, 1], [1, 2]],
    },
  };
  context.window = context;
  context.globalThis = context;
  context.systemikaRuns = {
    async exists(modelPath, runName) {
      context.lastExists = { modelPath, runName };
      return Boolean(options.exists);
    },
    async save(modelPath, payload) {
      context.lastSave = { modelPath, payload };
      return { path: '/models/Runs/Base.sysrun' };
    },
    async load() { throw new Error('not used'); },
    async list() { return []; },
    async openFolder(modelPath) { context.openedFolderFor = modelPath; },
    async confirmOverwrite(runLabel) {
      context.confirmedOverwriteFor = runLabel;
      return options.confirm !== false;
    },
  };
  return context;
}

function loadScripts(context) {
  const root = path.join(__dirname, '..', 'OpenSystemDynamics', 'src');
  vm.runInNewContext(fs.readFileSync(path.join(root, 'systemika-run-data-manager.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'systemika-run-manager.js'), 'utf8'), context);
}

test('prepare checks existing run before simulation and honors overwrite cancellation', async () => {
  const context = makeContext({ exists: true, confirm: false, runName: 'Base' });
  loadScripts(context);
  const decision = await context.SystemikaRunManager.prepareUserRun();
  assert.equal(decision.proceed, false);
  assert.deepEqual(context.lastExists, { modelPath: '/models/Test.ssd', runName: 'Base' });
  assert.equal(context.confirmedOverwriteFor, 'Base');
});

test('commit mirrors completed RunResults and persists the selected label', async () => {
  const context = makeContext({ exists: false, runName: 'Policy A' });
  loadScripts(context);
  const decision = await context.SystemikaRunManager.prepareUserRun();
  assert.equal(decision.proceed, true);
  await context.SystemikaRunManager.commitUserRun(decision);
  assert.equal(context.systemikaSimulationData.getCurrentRun().runName, 'Policy A');
  assert.deepEqual(context.systemikaSimulationData.getCurrentRun().rows, [[0, 1], [1, 2]]);
  assert.equal(JSON.stringify(context.systemikaSimulationData.getSelectiveIdResults([1])), JSON.stringify([[0, 1], [1, 2]]));
  assert.equal(context.lastSave.modelPath, '/models/Test.ssd');
  assert.equal(context.lastSave.payload.runLabel, 'Policy A');
  assert.match(context.lastSave.payload.csv, /^Time,X\r?\n0,1/m);
});

test('unsaved desktop model is saved before checking the Runs directory', async () => {
  const context = makeContext({ exists: false, modelPath: '' });
  loadScripts(context);
  const decision = await context.SystemikaRunManager.prepareUserRun();
  assert.equal(decision.proceed, true);
  assert.equal(context.fileManager.fileName, '/models/Saved.ssd');
  assert.equal(context.lastExists.modelPath, '/models/Saved.ssd');
});

test('web mode keeps the run-name field visible and explains unavailable local persistence', async () => {
  const context = makeContext({ electron: false });
  context.systemikaRuns = undefined;
  loadScripts(context);
  context.SystemikaRunManager.initControls();
  assert.equal(context.controls.style.display, '');
  assert.equal(context.controls.dataset.persistence, 'unavailable');
  assert.equal(context.folderButton.disabled, false);
  const decision = await context.SystemikaRunManager.prepareUserRun();
  assert.equal(decision.proceed, true);
  assert.equal(decision.persist, false);
  assert.equal(context.lastExists, undefined);
});


test('Firefox limited mode disables Manage Runs and does not show persistence error dialogs', async () => {
  const context = makeContext({ electron: false });
  context.systemikaRuns = undefined;
  context.fileManager.shouldSuppressRunManagerUnavailableAlert = () => true;
  context.fileManager.getProjectStorageUnavailableMessage = () => 'should not be shown';
  context.xAlert = (message) => context.alertMessages.push(String(message));
  loadScripts(context);
  context.SystemikaRunManager.initControls();
  assert.equal(context.controls.dataset.persistence, 'unavailable');
  assert.equal(context.folderButton.disabled, true);
  assert.match(context.folderButton.title, /Chromium-based browser/);

  await context.SystemikaRunManager.openRunsFolder();
  assert.deepEqual(context.alertMessages, []);
});

test('renderer can use the run bridge exposed only on its parent frame', async () => {
  const context = makeContext({ exists: false, runName: 'Parent Bridge' });
  const parentApi = context.systemikaRuns;
  context.systemikaRuns = undefined;
  context.parent = { systemikaRuns: parentApi };
  context.top = context.parent;
  context.isRunningElectron = () => true;
  loadScripts(context);
  context.SystemikaRunManager.initControls();
  assert.equal(context.controls.dataset.persistence, 'available');
  const decision = await context.SystemikaRunManager.prepareUserRun();
  assert.equal(decision.proceed, true);
  await context.SystemikaRunManager.commitUserRun(decision);
  assert.equal(context.lastSave.payload.runLabel, 'Parent Bridge');
});


test('renderer prefers the established electronAPI.runs bridge', async () => {
  const context = makeContext({ exists: true, confirm: false, runName: 'Base' });
  const runsApi = context.systemikaRuns;
  context.systemikaRuns = undefined;
  context.electronAPI = { isElectron: true, runs: runsApi };
  context.getElectronAPI = () => context.electronAPI;
  context.isRunningElectron = () => true;
  loadScripts(context);
  context.SystemikaRunManager.initControls();
  assert.equal(context.controls.dataset.persistence, 'available');
  const decision = await context.SystemikaRunManager.prepareUserRun();
  assert.equal(decision.proceed, false);
  assert.deepEqual(context.lastExists, { modelPath: '/models/Test.ssd', runName: 'Base' });
});


test('Advance can snapshot partial results into the current named run without saving to disk', async () => {
  const context = makeContext({ exists: false, runName: 'Base' });
  context.RunResults.simulationDone = false;
  context.RunResults.results = [[0, 1], [1, 2], [2, 3]];
  loadScripts(context);
  const run = context.SystemikaRunManager.captureLiveRun();
  assert.equal(run.runName, 'Base');
  assert.deepEqual(run.rows, [[0, 1], [1, 2], [2, 3]]);
  assert.equal(run.metadata.simulation.partial, true);
  assert.equal(run.metadata.simulation.currentTime, 2);
  assert.equal(context.lastSave, undefined);
});

test('Advance can register a zero-row live run before first pause so auto-selection is not pruned', () => {
  const context = makeContext({ exists: false, runName: 'Run 2' });
  context.RunResults.simulationDone = false;
  context.RunResults.results = [];
  context.getAdvanceBy = () => 1;
  loadScripts(context);
  const run = context.SystemikaRunManager.captureLiveRun('Run 2', true);
  assert.equal(run.runName, 'Run 2');
  assert.deepEqual(run.rows, []);
  assert.equal(context.systemikaSimulationData.getCurrentRun().runName, 'Run 2');
  assert.equal(run.metadata.simulation.currentTime, 0);
  assert.equal(context.lastSave, undefined);
});

test('modern web mode authorizes the project folder and persists through the browser run store', async () => {
  const context = makeContext({ electron: false, runName: 'Web Run' });
  context.systemikaRuns = undefined;
  context.systemikaBrowserRuns = {
    isSupported: () => true,
    isReady: () => true,
    async ensureAccess() { context.browserAccessRequested = true; },
    async exists(modelPath, runName) {
      context.lastExists = { modelPath, runName };
      return false;
    },
    async save(modelPath, payload) {
      context.lastSave = { modelPath, payload };
      return { path: 'Runs/Web Run.sysrun' };
    },
    async load() { throw new Error('not used'); },
    async list() { return []; },
  };
  loadScripts(context);
  context.SystemikaRunManager.initControls();
  assert.equal(context.controls.dataset.persistence, 'available');

  const decision = await context.SystemikaRunManager.prepareUserRun();
  assert.equal(context.browserAccessRequested, true);
  assert.equal(decision.proceed, true);
  assert.equal(decision.persist, true);
  await context.SystemikaRunManager.commitUserRun(decision);
  assert.equal(context.lastSave.modelPath, '/models/Test.ssd');
  assert.equal(context.lastSave.payload.runLabel, 'Web Run');
});
