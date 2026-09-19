'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const runManagerSource = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-run-manager.js'), 'utf8');
const dataManagerSource = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-run-data-manager.js'), 'utf8');

function between(source, a, b) {
  const start = source.indexOf(a); const end = source.indexOf(b, start + a.length);
  assert.notEqual(start, -1, `missing ${a}`); assert.notEqual(end, -1, `missing ${b}`);
  return source.slice(start, end);
}

test('desktop overwrite prefers the in-app Yes/No dialog before the Electron native fallback', async () => {
  let nativeConfirmCalls = 0;
  let inAppCalls = 0;
  const context = {
    console, Date, JSON, Number, String, Boolean, Array, Object, Map, Set, Promise,
    runInput: { value: 'Base', disabled: false, addEventListener() {} },
    controls: { style: {}, dataset: {} },
    folderButton: { disabled: false, addEventListener() {} },
    document: { getElementById(id) {
      if (id === 'systemika-run-name') return context.runInput;
      if (id === 'systemika-run-controls') return context.controls;
      if (id === 'btn_open_runs_folder') return context.folderButton;
      return null;
    }},
    fileManager: { fileName: '/tmp/Test.ssd', async saveModelAs() { return this.fileName; } },
    isRunningElectron: () => true,
    History: { unsavedChanges: false },
    RunResults: { ignoreUnits:false, lastSimulationStochastic:false, varnameList:['Time'], varIdList:[0], results:[[0]], simulationDone:true },
    getTimeStart:()=>0, getTimeLength:()=>10, getTimeStep:()=>1, getTimeUnits:()=> 'Years', getAlgorithm:()=> 'RK1',
    getPrimitiveList:()=>[], primitives:()=>[], alert() {}, confirm:()=>{ throw new Error('window.confirm should not be used'); },
    yesNoAlert(message, callback) { inAppCalls += 1; callback('no'); },
    electronAPI: { isElectron:true, runs: {
      async exists(){ return true; }, async save(){}, async load(){}, async list(){ return []; },
      async confirmOverwrite(){ nativeConfirmCalls += 1; return true; }
    }}
  };
  context.window=context; context.globalThis=context; context.parent=context; context.top=context;
  context.getElectronAPI=()=>context.electronAPI;
  vm.runInNewContext(dataManagerSource, context);
  vm.runInNewContext(runManagerSource, context);
  const result = await context.SystemikaRunManager.prepareUserRun();
  assert.equal(result.proceed, false);
  assert.equal(inAppCalls, 1);
  assert.equal(nativeConfirmCalls, 0);
});

test('Runs to compare offers a Select All / Deselect All toggle for plots and tables', () => {
  const selector = between(editor, 'class CompareRunsSelectorComponent', 'class RunSelectorComponent');
  assert.match(selector, /systemika-compare-runs-toggle-all/);
  assert.match(selector, /Select \/ Deselect All/);
  assert.match(selector, /min-width:132px/);
  assert.match(selector, /\.prop\("checked", shouldSelect\)/);
  assert.match(selector, /this\.applySelection\(\)/);
});

test('Advance live value edits are capability-based, not restricted to isConstant metadata', () => {
  const change = between(editor, 'static applyAdvanceParameterChange', 'static stopSimulation()');
  assert.match(change, /simulationController\.setValue\(primitive, value\)/);
  assert.doesNotMatch(change, /let isConstant|reason: \"not-parameter\"/);
  assert.doesNotMatch(change, /not-parameter/);
});

test('Reset toolbar control is absent in the simplified Advance workflow', () => {
  const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /id="btn_reset"/);
});

test('deleted runs are pruned and run selectors refresh when the run set changes', () => {
  const remove = between(editor, 'function removeRunFromDisplaySelections', 'function selectNewRunForDisplays');
  assert.match(remove, /filter\(name => name !== doomed\)/);
  assert.match(remove, /notifySystemikaRunsChanged/);
  const selector = between(editor, 'class CompareRunsSelectorComponent', 'class RunSelectorComponent');
  assert.match(selector, /let prunedSelected = selected\.filter/);
  assert.match(selector, /setCompareRunNames\(this\.primitive, prunedSelected\)/);
  assert.match(selector, /systemika:runs-changed/);
  const manager = between(editor, 'class SystemikaRunsManagerDialog', 'let systemikaRunsManagerDialog');
  assert.match(manager, /removeRunFromDisplaySelections\(doomed\)/);
  assert.match(manager, /SystemikaOutputDevices\.refreshAll\(\)/);
});
