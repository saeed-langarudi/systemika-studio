'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = editor.indexOf(startMarker);
  const end = editor.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return editor.slice(start, end);
}

test('Advance keeps the workspace interactive while structural anchors remain protected', () => {
  const step = sourceBetween('static stepSimulation()', 'static setProgressStatus');
  assert.match(step, /runOverlay\.blockModelEditing\(\)/);
  assert.doesNotMatch(step, /runOverlay\.block\(\)/);

  const overlay = sourceBetween('class runOverlay {', 'runOverlay.init();');
  assert.doesNotMatch(overlay, /SVG\.plotLayer\.insertBefore\(shield, SVG\.plotLayer\.firstChild\)/);
  assert.match(overlay, /SVG\.anchorLayer\.style\.pointerEvents = "none"/);
  assert.match(overlay, /requestAdvanceTermination/);
});

test('Advance lifecycle is explicit and ends on completion or stop', () => {
  const runResults = sourceBetween('class RunResults {', 'RunResults.init();');
  assert.match(runResults, /this\.advanceActive = false/);
  assert.match(runResults, /static isAdvanceActive\(\)/);
  assert.match(runResults, /this\.advanceActive = true/);
  assert.match(runResults, /onSuccess:[\s\S]*this\.advanceActive = false/);
  assert.match(runResults, /static stopSimulation\(\)[\s\S]*this\.advanceActive = false/);
});

test('Advance keeps output tools and model-addition tools available while destructive/global actions stay guarded', () => {
  const toolbox = sourceBetween('class ToolBox {', 'ToolBox.init();');
  assert.match(toolbox, /advanceSafeTools = \[[\s\S]{0,500}"stock"[\s\S]{0,160}"variable"[\s\S]{0,160}"flow"[\s\S]{0,260}"table"[\s\S]{0,160}"histoplot"/);
  assert.match(toolbox, /RunResults\.isAdvanceActive\(\)/);
  assert.match(toolbox, /runOverlay\.requestAdvanceTermination/);
  assert.match(toolbox, /toolName === "run"/);
});

test('time settings remain protected during Advance while the read-only unit report stays available', () => {
  const events = sourceBetween('$("#btn_timeunit").click', '$("#btn_zoom_in").click');
  const timeButton = sourceBetween('$("#btn_timeunit").click', '$("#btn_check_units").click');
  const unitButton = sourceBetween('$("#btn_check_units").click', '$("#btn_zoom_in").click');
  assert.match(timeButton, /RunResults\.isAdvanceActive\(\)/);
  assert.match(timeButton, /changing simulation time settings/);
  assert.match(timeButton, /runOverlay\.requestAdvanceTermination/);
  assert.match(unitButton, /unitCheckDialog\.show\(\)/);
  assert.doesNotMatch(unitButton, /requestAdvanceTermination/);
  assert.match(events, /#btn_check_units/);
});


test('direct tool and keyboard paths keep destructive Advance actions explicit', () => {
  const runTool = sourceBetween('class RunTool extends BaseTool', 'class StepTool extends BaseTool');
  const deleteTool = sourceBetween('class DeleteTool extends BaseTool', 'DeleteTool.init();');
  const undoTool = sourceBetween('class UndoTool extends BaseTool', 'UndoTool.init();');
  const redoTool = sourceBetween('class RedoTool extends BaseTool', 'RedoTool.init();');
  for (const source of [runTool, undoTool, redoTool]) {
    assert.match(source, /RunResults\.isAdvanceActive\(\)/);
    assert.match(source, /runOverlay\.requestAdvanceTermination/);
  }
  assert.match(deleteTool, /RunResults\.isAdvanceActive\(\)/);
  assert.match(deleteTool, /runOverlay\.requestAdvanceFinish/);
  assert.match(deleteTool, /Finish the current Advance run to the end/);
  const keyboard = sourceBetween('$(document).keydown(function (event)', 'applyPlatformShortcutLabels();');
  assert.match(keyboard, /UndoTool\.enterTool\(\)/);
  assert.match(keyboard, /RedoTool\.enterTool\(\)/);
});


test('simulation settings remain accessible during Advance so Advance By can change live', () => {
  const events = sourceBetween('let openSimulationSettings = () => {', '$("#btn_copy").click');
  assert.doesNotMatch(events, /requestAdvanceTermination/);
  assert.match(events, /simulationSettings\.show\(\)/);
  assert.match(events, /#btn_simulation_settings/);
  assert.match(events, /#progress-bar/);

  const settings = sourceBetween('class SimulationSettings', 'class TimeUnitDialog');
  assert.match(settings, /this\.advanceMode = Boolean/);
  assert.match(settings, /this\.start_field\.prop\("disabled", true\)/);
  assert.match(settings, /this\.step_field\.prop\("disabled", true\)/);
  assert.match(settings, /setAdvanceBy\(value\)/);
});
