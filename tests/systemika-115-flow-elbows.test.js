'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(a, -1, `missing ${start}`);
  assert.notEqual(b, -1, `missing ${end}`);
  return source.slice(a, b);
}

test('each Shift press during one Flow endpoint drag can add another elbow', () => {
  const flowTool = between(editor, 'class FlowTool extends TwoPointerTool', 'FlowTool.init();');
  assert.match(flowTool, /static getDraggedEndpoint\(\)[\s\S]*this\.current_connection\.end_anchor/);
  assert.match(flowTool, /static handleShiftKeyDown\(\)[\s\S]*this\.maybeCreateShiftElbow\(dragged\.parent, dragged\.anchor, true\)/);
  assert.match(flowTool, /static handleShiftKeyUp\(\)[\s\S]*this\.shiftElbowWasDown = false/);
  assert.match(flowTool, /let insertIndex = anchorType === "start" \? 0 : parent\.middleAnchors\.length/);

  // Keyboard release, rather than an intervening mousemove, must re-arm the
  // gesture. This is what permits Shift, release, Shift, release... without a
  // fixed elbow limit during the same drag.
  assert.match(editor, /if \(event\.key === "Shift" && mouse\.isLeftDown\)[\s\S]*FlowTool\.handleShiftKeyDown\(\)/);
  assert.match(editor, /\$\(document\)\.keyup\(function \(event\)[\s\S]*event\.key === "Shift"[\s\S]*FlowTool\.handleShiftKeyUp\(\)/);
  assert.doesNotMatch(editor, /else if \(event\.key === "Shift"\) FlowTool\.rightMouseDown/);
});
