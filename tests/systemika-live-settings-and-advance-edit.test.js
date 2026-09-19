'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'style', 'editor.css'), 'utf8');
const Engine = require(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-engine.js'));

function between(source, a, b) {
  const start = source.indexOf(a); const end = source.indexOf(b, start + a.length);
  assert.notEqual(start, -1, `missing ${a}`); assert.notEqual(end, -1, `missing ${b}`);
  return source.slice(start, end);
}

test('plot and Table dialogs put Selected Variable(s) before run/settings controls', () => {
  for (const [start, end] of [
    ['class TimePlotDialog extends DisplayDialog', 'class GenerationsComponent'],
    ['class ComparePlotDialog extends DisplayDialog', 'class HistogramOptionsComponent'],
    ['class HistoPlotDialog extends DisplayDialog', 'class XySelectorComponent'],
    ['class XyPlotDialog extends DisplayDialog', 'const SYSTEMIKA_TABLE_DEFAULT_DECIMALS'],
    ['class TableDialog extends DisplayDialog', 'class NewModelDialog']
  ]) {
    const block = between(editor, start, end);
    assert.match(block, /topComponents = \[entitySelector\]/);
  }
  const display = between(editor, 'class DisplayDialog extends jqDialog', '/**\n * @param axisOptions');
  assert.match(display, /systemika-output-primary-selector/);
  assert.ok(display.indexOf('topComponents.map') < display.indexOf('this.components.map'));
});

test('docked plot and Table settings are live and have no Apply footer', () => {
  const display = between(editor, 'class DisplayDialog extends jqDialog', '/**\n * @param axisOptions');
  assert.match(display, /systemikaLiveSettings/);
  assert.match(display, /requestLiveApply\(delay = 80\)/);
  assert.match(display, /subscribePool\.publish\("dock live change"\)/);
  assert.doesNotMatch(display, /systemika-dock-apply|>Apply</);
  assert.doesNotMatch(css, /systemika-dock-settings-footer/);
  assert.match(css, /\.systemika-output-settings\s*\{[\s\S]{0,260}overflow-y:\s*auto[\s\S]{0,220}padding:\s*8px 8px 10px/);
});

test('Advance controller can hot-recompile a state-dependent flow and add a variable without losing stock state', () => {
  const spec = {
    timeStart: 0, timeLength: 3, dt: 1, method: 'euler', pauseInterval: 1,
    stocks: [{ id: 's', name: 'Stock1', initial: '100' }],
    flows: [{ id: 'f', name: 'Flow1', equation: '1', sourceId: 's', targetId: null }],
    variables: [], converters: []
  };
  const pauses = [];
  let final = null;
  const controller = Engine.createController(spec, {
    asyncCallbacks: false,
    pauseInterval: 1,
    onPause: result => pauses.push(result),
    onSuccess: result => { final = result; }
  });
  controller.start();
  assert.equal(controller.runtime.time, 1);
  assert.equal(pauses[0].value('Stock1').at(-1), 99);

  const changed = {
    ...spec,
    flows: [{ id: 'f', name: 'Flow1', equation: 'Stock1 * 0.1', sourceId: 's', targetId: null }],
    variables: [{ id: 'a', name: 'AddedAux', equation: '2' }]
  };
  const snap = controller.recompile(changed);
  assert.equal(snap.value('Stock1').at(-1), 99);
  assert.equal(snap.value('Flow1').at(-1), 9.9);
  assert.deepEqual(snap.value('AddedAux'), [null, 2]);

  controller.resume();
  assert.equal(controller.runtime.time, 2);
  assert.equal(pauses.at(-1).value('Stock1').at(-1), 89.1);
  controller.resume();
  assert.ok(final);
  assert.deepEqual(final.value('Stock1'), [100, 99, 89.1, 80.19]);
});

test('Advance additions are allowed while deletion explicitly finishes the stepped run first', () => {
  const toolbox = between(editor, 'class ToolBox {', 'ToolBox.init();');
  assert.match(toolbox, /advanceSafeTools = \[[\s\S]{0,450}"stock"[\s\S]{0,180}"variable"[\s\S]{0,180}"flow"/);
  assert.match(editor, /function applyAdvanceStructureAddition/);
  const deletion = between(editor, 'class DeleteTool extends BaseTool', 'DeleteTool.init();');
  assert.match(deletion, /requestAdvanceFinish/);
  assert.match(deletion, /Finish the current Advance run to the end/);
  const overlay = between(editor, 'class runOverlay {', 'runOverlay.init();');
  assert.match(overlay, /requestAdvanceFinish\(message, afterFinish\)/);
  assert.match(overlay, /RunResults\.finishAdvanceSimulation\(afterFinish\)/);
});
