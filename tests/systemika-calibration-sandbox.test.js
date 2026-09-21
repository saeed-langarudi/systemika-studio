const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-calibration-sandbox.js'), 'utf8');

test('Calibration Sandbox toolbar tool uses the supplied icon and has no keyboard shortcut', () => {
  assert.match(html, /id="btn_calibration_sandbox"[\s\S]*data-title="Calibration Sandbox"[\s\S]*graphics\/calibration-sandbox\.svg/);
  assert.doesNotMatch(html, /Calibration Sandbox \([A-Z]\)/);
});

test('Calibration Sandbox is manual UI over the existing simulation engine', () => {
  assert.match(js, /RunResults\.runSimulation\(\)/);
  assert.match(js, /primitives\('Constant'\)/);
  assert.match(js, /Select Reference Mode/);
  assert.match(js, /Select Simulated Variable/);
  assert.match(js, /stroke-dasharray/);
  assert.match(js, /Reset All/);
  assert.match(js, /Save as Default/);
  assert.doesNotMatch(js, /optimis|optimizer|objective function|least squares/i);
});


test('Calibration Sandbox panel is wider and user-resizable', () => {
  assert.match(js, /grid-template-columns:minmax\(650px,1fr\) 6px 408px/);
  assert.match(js, /panel-splitter/);
  assert.match(js, /pointermove/);
});

test('Calibration live reruns avoid persistence and reset schedules a refresh', () => {
  assert.match(js, /runCalibration\(false\)/);
  assert.match(js, /persist:Boolean\(persist&&base\.persist\)/);
  assert.match(js, /reset[^;]*[\s\S]{0,220}scheduleRerun\(\)/i);
  assert.match(js, /resetAll\(\)[\s\S]{0,260}scheduleRerun\(\)/);
});

test('run saving snapshots current run before asynchronous disk IO', () => {
  const manager = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-run-data-manager.js'), 'utf8');
  assert.match(manager, /const run = this\.currentRun/);
  assert.match(manager, /this\.runCache\.set\(run\.runName, run\)/);
});

test('Calibration Sandbox persists its interface state in run metadata', () => {
  const manager = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-run-data-manager.js'), 'utf8');
  assert.match(js, /calibrationSandbox:snapshot\(\)/);
  assert.match(js, /metadata\.calibrationSandbox/);
  assert.match(manager, /async updateRunMetadata\(runName, patch\)/);
});

test('Calibration Sandbox uses universal teal and purple legend and plot colors', () => {
  assert.match(js, /universal-legend/);
  assert.match(js, /Reference/);
  assert.match(js, /Simulated/);
  assert.match(js, /#7E2F8E/);
  assert.match(js, /#009E73/);
});

test('copied model entities use underscore suffixes', () => {
  const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
  assert.match(editor, /candidate = `\$\{base\}_\$\{counter\}`/);
  assert.doesNotMatch(editor, /candidate = `\$\{base\} \$\{counter\}`/);
});
