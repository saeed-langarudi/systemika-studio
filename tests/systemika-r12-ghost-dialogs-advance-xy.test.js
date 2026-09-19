'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const newApi = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'newAPI.js'), 'utf8');
const entities = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-entities.js'), 'utf8');
const runManager = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-run-manager.js'), 'utf8');
const analyserUtil = fs.readFileSync(path.join(root, 'MultiSimulationAnalyser', 'util.js'), 'utf8');
const analyserMain = fs.readFileSync(path.join(root, 'MultiSimulationAnalyser', 'stocsd.js'), 'utf8');

function between(source, a, b) {
  const start = source.indexOf(a);
  const end = source.indexOf(b, start + a.length);
  assert.notEqual(start, -1, `missing ${a}`);
  assert.notEqual(end, -1, `missing ${b}`);
  return source.slice(start, end);
}

test('Ghost without a preselection opens an in-app source chooser after canvas placement', () => {
  const ghostTool = between(editor, 'class GhostTool extends OnePointCreateTool', 'GhostTool.init();');
  assert.doesNotMatch(ghostTool, /\bprompt\s*\(/);
  assert.match(ghostTool, /new GhostSourceDialog\(x, y\)/);
  assert.match(ghostTool, /if \(selectedObjects\.length === 0\)[\s\S]*return;/);

  const chooser = between(editor, 'class GhostSourceDialog extends jqDialog', 'class XPromptDialog extends jqDialog');
  assert.match(chooser, /Select Ghost Source/);
  assert.match(chooser, /getPrimitiveList\(\)/);
  assert.match(chooser, /Create Ghost/);
  assert.match(chooser, /GhostTool\.createFromSource\(source, this\.x, this\.y\)/);
});

test('missing Ghost source no longer opens the browser-native Item must be provided alert', () => {
  assert.doesNotMatch(newApi, /alert\(["']Item must be provided["']\)/);
  assert.match(newApi, /xAlert\("Please select an item to ghost\."\)/);
});

test('ordinary application alerts are routed through in-app dialogs in editor and analyser', () => {
  assert.match(editor, /window\.alert = \(message\) =>/);
  assert.match(editor, /xAlert\(safe\.replace/);
  assert.match(analyserUtil, /window\.alert = function\(message\)/);
  assert.match(analyserUtil, /xalert\(String\(message/);
  assert.doesNotMatch(runManager, /root\.confirm\s*\(/);
  assert.match(analyserMain, /xprompt\("Enter name of model"/);
  assert.doesNotMatch(analyserMain, /var new_model_name=prompt\(/);
});

test('Advance By stays editable during Advance while compiled simulation settings stay locked', () => {
  const settings = between(editor, 'class SimulationSettings extends jqDialog', 'class TimeUnitDialog extends jqDialog');
  assert.match(settings, /this\.advanceMode = Boolean/);
  assert.match(settings, /this\.start_field\.prop\("disabled", true\)/);
  assert.match(settings, /this\.length_field\.prop\("disabled", true\)/);
  assert.match(settings, /this\.step_field\.prop\("disabled", true\)/);
  assert.match(settings, /this\.method_select\.prop\("disabled", true\)/);
  assert.doesNotMatch(settings, /this\.advance_by_field\.prop\("disabled", true\)/);
  assert.match(settings, /setAdvanceBy\(value\)/);

  const step = between(editor, 'static stepSimulation()', 'static setProgressStatus');
  assert.match(step, /setPauseInterval\(1\)/);
  assert.match(step, /advanceTargetTime = Math\.min/);
  assert.match(step, /getAdvanceBy\(\)/);
  assert.match(step, /res\.resume\(\)/);
});

test('XY Plot stores and renders multiple selected run sources', () => {
  assert.match(entities, /primitiveBank\.xyplot[\s\S]*RunNames:\s*JSON\.stringify\(\[""\]\)/);

  const visual = between(editor, 'class XyPlotVisual extends PlotVisual', 'class LineVisual extends TwoPointer');
  assert.match(visual, /initializeMultiRunSelection\(this\.primitive\)/);
  assert.match(visual, /let runNames = getCompareRunNames\(this\.primitive\)/);
  assert.match(visual, /for \(let runName of runNames\)/);
  assert.match(visual, /label = runName \|\| getCurrentRunSourceName\(\) \|\| "Current"/);
  assert.match(visual, /plotOptions\.legend = plotBottomLegendOptions\(this\.mainRunSeriesCount > 1 \|\| showNumbers\)/);

  const dialog = between(editor, 'class XyPlotDialog extends DisplayDialog', 'class TableData');
  assert.match(dialog, /new CompareRunsSelectorComponent\(this\)/);
  assert.match(dialog, /getCompareRunNames\(this\.primitive\)/);
});
