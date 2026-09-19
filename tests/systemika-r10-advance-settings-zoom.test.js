'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-model-api.js'), 'utf8');
const manager = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-run-manager.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');

function between(source, a, b) {
  const start = source.indexOf(a), end = source.indexOf(b, start + a.length);
  assert.notEqual(start, -1, `missing ${a}`); assert.notEqual(end, -1, `missing ${b}`);
  return source.slice(start, end);
}

test('new models default to DT 0.25 and Advance By 1', () => {
  assert.match(editor, /TimeStep="0\.25" AdvanceBy="1"/);
});

test('Simulation Settings exposes Time Step (DT) and integer Advance By >= 1', () => {
  const settings = between(editor, 'class SimulationSettings', 'class TimeUnitDialog');
  assert.match(settings, />Time Step \(DT\)</);
  assert.match(settings, />Advance By</);
  assert.match(settings, /class="input-advance-by[^>]+min="1" step="1"/);
  assert.match(settings, /Number\.isInteger\(Number\(this\.advance_by_field\.val\(\)\)\)/);
  assert.match(settings, /setAdvanceBy\(Number\(this\.advance_by_field\.val\(\)\)\)/);
});

test('Advance By API defaults old models to 1 and rejects invalid values', () => {
  assert.match(api, /function getAdvanceBy\(\)/);
  assert.match(api, /return Number\.isInteger\(value\) && value >= 1 \? value : 1/);
  assert.match(api, /function setAdvanceBy\(value\)/);
  assert.match(api, /!Number\.isInteger\(value\) \|\| value < 1/);
});

test('Advance uses dynamic Advance By targets over stable one-unit checkpoints', () => {
  const step = between(editor, 'static stepSimulation()', 'static setProgressStatus');
  assert.match(step, /setPauseInterval\(1\)/);
  assert.match(step, /advanceTargetTime = Math\.min/);
  assert.match(step, /getAdvanceBy\(\)/);
  assert.match(step, /this\.simulationTime\) \+ 1e-10 < Number\(this\.advanceTargetTime\)/);
  assert.doesNotMatch(step, /setPauseInterval\(getTimeStep\(\)\)/);
});

test('Advance creates the live named run before auto-selecting it', () => {
  const step = between(editor, 'static stepSimulation()', 'static setProgressStatus');
  const live = step.indexOf('captureLiveRun(advanceRunName, true)');
  const select = step.indexOf('selectNewRun(advanceRunName)');
  assert.ok(live >= 0, 'must initialize a live run placeholder');
  assert.ok(select > live, 'must select only after live run exists');
  assert.match(manager, /function captureLiveRun\(runName, allowEmpty = false\)/);
});

test('Advance to End is the only post-Advance toolbar completion control', () => {
  assert.doesNotMatch(html, /id="btn_reset"/);
  assert.match(html, /id="btn_finish"[^>]+data-title="Advance to End \(Ctrl\+3\)"/);
  assert.doesNotMatch(html, /Advance to End \/ Finish/);
});

test('plot HTML overlays scale and reposition with canvas zoom', () => {
  assert.match(editor, /canvas-scaled-html-overlay/);
  const zoom = between(editor, 'class Zoom {', 'class MousePan');
  assert.match(zoom, /querySelectorAll\("\.canvas-scaled-html-overlay"\)/);
  assert.match(zoom, /element\.style\.transform = `scale\(\$\{this\.level\}\)`/);
  assert.match(zoom, /element\.style\.left = \(left \* this\.level\)/);
  assert.match(zoom, /element\.style\.top = \(top \* this\.level\)/);
});
