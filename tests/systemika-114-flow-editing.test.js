'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const svg = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/SVG.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(a, -1, `missing ${start}`);
  assert.notEqual(b, -1, `missing ${end}`);
  return source.slice(a, b);
}

test('selected Flow endpoints and elbows use enlarged hit targets above Stocks', () => {
  assert.match(editor, /class FlowAnchorPoint extends AnchorPoint[\s\S]*SVG\.circle\(0, 0, 11,[\s\S]*pointer-events": "all"/);
  assert.match(editor, /class FlowOrthoAnchorPoint extends OrthoAnchorPoint[\s\S]*SVG\.circle\(0, 0, 11,[\s\S]*pointer-events": "all"/);
  assert.match(editor, /createInitialAnchors\(pos0, pos1\)[\s\S]*new FlowAnchorPoint/);
  assert.match(editor, /setAnchorsInEditLayer\(editing\)/);
  assert.match(editor, /select\(\)[\s\S]*this\.setAnchorsInEditLayer\(true\)/);
  assert.match(html, /<g class="layer flow-anchor-edit"><\/g>/);
  assert.match(svg, /static flowAnchorEditLayer/);
});

test('dragging either attached Flow endpoint detaches before movement and can reattach on mouse-up', () => {
  const flowTool = between(editor, 'class FlowTool extends TwoPointerTool', 'FlowTool.init();');
  assert.match(flowTool, /mainAnchor\.getAnchorType\(\) === "start"[\s\S]*parent\.setStartAttach\(null\)/);
  assert.match(flowTool, /mainAnchor\.getAnchorType\(\) === "end"[\s\S]*parent\.setEndAttach\(null\)/);
  assert.match(flowTool, /parent\.requestNewAnchorPos\(\[x, y\], anchor_id\)/);
  assert.match(flowTool, /static mouseUpSingleAnchor[\s\S]*attach_anchor\(object_array\[node_id\]\)/);
});

test('completed Flows support adding, dragging, and removing elbow handles', () => {
  const flowVisual = between(editor, 'class FlowVisual extends BaseConnection', 'class RectangleVisual extends TwoPointer');
  assert.match(flowVisual, /createMiddleAnchorPoint\(x, y, insertIndex = this\.middleAnchors\.length\)/);
  assert.match(flowVisual, /closestPipeSegment\(point, maxDistance = Infinity\)/);
  assert.match(flowVisual, /middleAnchorNear\(point, radius = 12\)/);
  assert.match(flowVisual, /removeMiddleAnchorPoint\(index\)/);

  const mouseTool = between(editor, 'class MouseTool extends BaseTool', 'class TwoPointerTool extends BaseTool');
  assert.match(mouseTool, /let elbowIndex = flow\.middleAnchorNear\(point, 12\)/);
  assert.match(mouseTool, /flow\.removeMiddleAnchorPoint\(elbowIndex\)/);
  assert.match(mouseTool, /flow\.closestPipeSegment\(point, 10\)/);
  assert.match(mouseTool, /flow\.createMiddleAnchorPoint\(segment\.point\[0\], segment\.point\[1\], segment\.segmentIndex\)/);

  const deleteTool = between(editor, 'class DeleteTool extends BaseTool', 'DeleteTool.init();');
  assert.match(deleteTool, /anchor\.getAnchorType\(\) === "orthoMiddle"/);
  assert.match(deleteTool, /parent\.removeMiddleAnchorPoint\(elbowIndex\)/);
});

test('Flow editing instructions are exposed in Getting Started help', () => {
  assert.match(editor, /Editing Flow pipes:/);
  assert.match(editor, /Right-click a selected pipe to add an elbow handle/);
  assert.match(editor, /Right-click an elbow handle, or select it and press Delete\/Backspace/);
});
