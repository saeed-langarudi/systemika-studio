'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
const runManager = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-run-manager.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron', 'preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
const store = require(path.join(root, 'electron', 'systemika-run-package.js'));

function between(source, a, b) {
  const start = source.indexOf(a); const end = source.indexOf(b, start + a.length);
  assert.notEqual(start, -1, `missing ${a}`); assert.notEqual(end, -1, `missing ${b}`);
  return source.slice(start, end);
}

test('toolbar contains Clear before Run and Advance to End after Advance', () => {
  const area = between(index, '<div class="tool-grouping" id="runControllerArea">', '<div id="progress-bar">');
  assert.ok(area.indexOf('id="btn_clear"') < area.indexOf('id="btn_run"'));
  assert.ok(area.indexOf('id="btn_step"') < area.indexOf('id="btn_finish"'));
  assert.doesNotMatch(area, /id="btn_reset"/);
  assert.match(area, /Advance to End/);
  assert.match(area, /M3 6l6 6-6 6/);
});

test('Finish advances active stepped simulation to completion and completion refreshes displays', () => {
  const rr = between(editor, 'class RunResults {', 'RunResults.init();');
  assert.match(rr, /static finishAdvanceSimulation\(afterFinish = null\)/);
  assert.match(rr, /this\.advanceFinishRequested = true/);
  assert.doesNotMatch(rr, /simulate\.timePause = simulate\.timeEnd/);
  assert.match(rr, /this\.simulationController\.resume\(\)/);
  assert.match(rr, /SystemikaEngine\.runCurrentModel/);
  const step = between(editor, 'static stepSimulation()', 'static setProgressStatus');
  assert.match(step, /this\.advanceFinishRequested[\s\S]*res\.resume\(\)/);
  assert.match(step, /onSuccess:[\s\S]*this\.triggerRunFinished\(\)/);
});

test('Reset is not exposed as a user toolbar workflow', () => {
  assert.doesNotMatch(index, /id="btn_reset"/);
  assert.doesNotMatch(editor, /class ResetTool extends BaseTool/);
});

test('paused Advance hot-recompiles formulation changes and permits model additions', () => {
  const rr = between(editor, 'static syncAdvanceHeader', 'static stopSimulation()');
  assert.match(rr, /static recompileAdvanceModel\(\)/);
  assert.match(rr, /simulationController\.recompileCurrentModel\(\)/);
  assert.match(rr, /syncAdvanceHeader\(snapshot\)/);
  const definition = between(editor, 'class DefinitionEditor extends jqDialog', 'function printContentInNewWindow');
  assert.match(definition, /RunResults\.recompileAdvanceModel\(\)/);
  assert.match(definition, /hot-recompile the paused engine/);
  assert.doesNotMatch(definition, /state-dependent replacements may require ending/);
  const toolbox = between(editor, 'class ToolBox {', 'ToolBox.init();');
  assert.match(toolbox, /advanceSafeTools = \[[\s\S]*"stock"[\s\S]*"flow"/);
  assert.match(editor, /applyAdvanceStructureAddition\(beforeIds, "model entity"\)/);
  assert.match(editor, /applyAdvanceStructureAddition\(this\.advanceBeforeIds, "flow"\)/);
});

test('folder control opens an in-app Runs manager with rename delete delete-all and Close refresh', () => {
  assert.match(runManager, /openSystemikaRunsManager/);
  const openFn = between(runManager, 'async function openRunsFolder()', 'function updateBusyUi');
  assert.doesNotMatch(openFn, /\.openFolder\(/);
  const dlg = between(editor, 'class SystemikaRunsManagerDialog', 'let systemikaRunsManagerDialog');
  assert.match(dlg, /"Rename"/); assert.doesNotMatch(dlg, /"Duplicate"\s*:/); assert.match(dlg, /"Delete"/); assert.match(dlg, /"Delete All"/); assert.match(dlg, /"Close"/);
  assert.match(dlg, /afterClose\(\)[\s\S]*SystemikaOutputDevices\.refreshAll\(\)/);
});

test('Electron bridge exposes run rename duplicate and delete handlers', () => {
  for (const op of ['rename', 'duplicate', 'delete']) {
    assert.match(preload, new RegExp(`systemika:runs:${op}`));
    assert.match(main, new RegExp(`systemika:runs:${op}`));
  }
});

test('run package rename duplicate and delete preserve valid packages', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'systemika-r7-'));
  try {
    const model = path.join(dir, 'model.ssd'); await fsp.writeFile(model, '<xml/>');
    await store.writeRunPackage({ modelPath: model, runLabel: 'Base', csv: 'Time,A\r\n0,1\r\n', metadata: {}, overwrite: false });
    await store.duplicateRun(model, 'Base', 'Run 1');
    let copied = await store.readRunPackage({ modelPath: model, runLabel: 'Run 1' });
    assert.equal(copied.metadata.runName, 'Run 1');
    await store.renameRun(model, 'Run 1', 'Policy A');
    assert.equal(await store.runExists(model, 'Run 1'), false);
    assert.equal(await store.runExists(model, 'Policy A'), true);
    let renamed = await store.readRunPackage({ modelPath: model, runLabel: 'Policy A' });
    assert.equal(renamed.metadata.runName, 'Policy A');
    await store.deleteRun(model, 'Policy A');
    assert.equal(await store.runExists(model, 'Policy A'), false);
  } finally { await fsp.rm(dir, { recursive: true, force: true }); }
});


test('normal native Run startup has no legacy simulate fallback', () => {
  const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
  const stop = between(editor, 'static stopSimulation()', 'static subscribeRun');
  assert.doesNotMatch(stop, /endRunningSimulation/);

  const api = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-model-api.js'), 'utf8');
  assert.doesNotMatch(api, /\bsimulate\b/);
  assert.match(api, /SystemikaEngine\.runCurrentModel/);
});
