'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const engine = require(path.join('..', 'OpenSystemDynamics', 'src', 'systemika-engine.js'));

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(a, -1, `missing ${start}`);
  assert.notEqual(b, -1, `missing ${end}`);
  return source.slice(a, b);
}

test('Flow endpoint dragging preserves Shift-to-elbow editing for new and completed Flows', () => {
  const flowTool = between(editor, 'class FlowTool extends TwoPointerTool', 'FlowTool.init();');
  assert.match(flowTool, /static mouseMove\(x, y, shiftKey\)[\s\S]*this\.mouseMoveSingleAnchor\(x, y, shiftKey, this\.current_connection\.end_anchor\.id\)/);
  assert.match(flowTool, /maybeCreateShiftElbow\(parent, mainAnchor, shiftKey\)/);
  assert.match(flowTool, /let insertIndex = anchorType === "start" \? 0 : parent\.middleAnchors\.length/);
  assert.match(flowTool, /parent\.createMiddleAnchorPoint\(anchorPos\[0\], anchorPos\[1\], insertIndex\)/);
  assert.match(flowTool, /this\.shiftElbowWasDown = true/);
  assert.match(flowTool, /static mouseUpSingleAnchor[\s\S]*this\.resetShiftElbowGesture\(\)/);
});

test('Lookup parser accepts actual and XML-stored line breaks after semicolons', () => {
  const expected = [[1991, 12], [1992, 14], [1993, 13]];
  assert.deepEqual(engine.parseConverterData('1991, 12;\n1992, 14;\n1993, 13'), expected);
  assert.deepEqual(engine.parseConverterData('1991, 12;\\n1992, 14;\\n1993, 13'), expected);

  const results = engine.simulate({
    timeStart: 1991,
    timeLength: 2,
    dt: 1,
    method: 'Euler',
    converters: [{
      id: 'lookup',
      name: 'Lookup',
      data: '1991, 12;\\n1992, 14;\\n1993, 13',
      sourceId: 'Time',
      interpolation: 'Linear'
    }]
  });
  assert.deepEqual(results.value('lookup'), [12, 14, 13]);
});

test('selected Rectangle raises its resize handles above its background annotation border', () => {
  const rectangle = between(editor, 'class RectangleVisual extends TwoPointer', 'class EllipseVisual extends TwoPointer');
  assert.match(rectangle, /setAnchorsInEditLayer\(editing\)/);
  assert.match(rectangle, /editing && SVG\.flowAnchorEditLayer \? SVG\.flowAnchorEditLayer : SVG\.anchorLayer/);
  assert.match(rectangle, /select\(\)[\s\S]*super\.select\(\)[\s\S]*this\.setAnchorsInEditLayer\(true\)/);
  assert.match(rectangle, /unselect\(\)[\s\S]*super\.unselect\(\)[\s\S]*this\.setAnchorsInEditLayer\(false\)/);
});
