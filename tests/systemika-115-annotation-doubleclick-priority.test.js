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

test('annotation double-clicks are explicitly routed to an overlapping model entity before opening annotation properties', () => {
  const helper = between(editor, 'function modelEntityUnderAnnotationEvent(event)', 'class RectangleVisual extends TwoPointer');
  assert.match(helper, /mousePosition\(event\)/);
  assert.match(helper, /find_elements_under\(point\.x, point\.y\)/);
  assert.match(helper, /\["stock", "variable", "constant", "converter", "flow"\]/);
  assert.match(helper, /modelVisual\.select\(\)/);
  assert.match(helper, /modelVisual\.doubleClick\(modelVisual\.id\)/);
  assert.match(helper, /event\.stopImmediatePropagation\(\)/);
});

test('Rectangle, Ellipse, Text Box, and Line pass the dblclick event through the model-priority router', () => {
  const rectangle = between(editor, 'class RectangleVisual extends TwoPointer', 'class EllipseVisual extends TwoPointer');
  const ellipse = between(editor, 'class EllipseVisual extends TwoPointer', 'class HtmlTwoPointer extends TwoPointer');
  const textArea = between(editor, 'class TextAreaVisual extends HtmlTwoPointer', 'class HistoPlotVisual');
  const line = between(editor, 'class LineVisual extends TwoPointer', 'let informationLinksVisible = true;');

  for (const [name, source] of Object.entries({ rectangle, ellipse, textArea, line })) {
    assert.match(source, /this\.doubleClick\(event\)/, `${name} should preserve the native dblclick event`);
    assert.match(source, /if \(event && routeAnnotationDoubleClick\(event\)\) return;/, `${name} should yield to overlapping model entities`);
  }
});
