'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const jquery183 = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/jquery/jquery-1.8.3.min.js'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(a, -1, `missing ${start}`);
  assert.notEqual(b, -1, `missing ${end}`);
  return source.slice(a, b);
}

test('annotation double-clicks use top-most painted hit-testing before the geometry fallback', () => {
  const helper = between(editor, 'function modelEntityUnderAnnotationEvent(event)', 'class RectangleVisual extends TwoPointer');
  assert.match(helper, /annotationLayer\.style\.pointerEvents = "none"/);
  assert.match(helper, /document\.elementFromPoint\(event\.clientX, event\.clientY\)/);
  assert.match(helper, /annotationLayer\.style\.pointerEvents = previousPointerEvents/);
  assert.match(helper, /getAttribute\("node_id"\)/);
  assert.match(helper, /\["stock", "variable", "constant", "converter", "flow"\]/);
  assert.match(helper, /return null;[\s\S]{0,700}Compatibility fallback/);
  assert.match(helper, /mousePosition\(event\)/);
  assert.match(helper, /find_elements_under\(point\.x, point\.y\)/);
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


test('a selected Text Box opens its properties with Enter', () => {
  const keyboard = between(editor, '$(document).keydown(function (event)', 'applyPlatformShortcutLabels();');
  assert.match(keyboard, /getType\(primitive\) === "TextArea"/);
  assert.match(keyboard, /selected\.dialog && typeof selected\.dialog\.show === "function"/);
  assert.match(keyboard, /selected\.dialog\.show\(\)/);
});

test('Text Box uses a stable SVG hit target instead of foreignObject mouse events', () => {
  const textArea = between(editor, 'class TextAreaVisual extends HtmlTwoPointer', 'class HistoPlotVisual');
  assert.match(textArea, /this\.htmlElement\.style\.pointerEvents = "none"/);
  assert.match(textArea, /this\.htmlElement\.cutDiv\.style\.pointerEvents = "none"/);
  assert.match(textArea, /this\.clickRect = SVG\.rect\([\s\S]{0,300}"pointer-events": "all"/);
  assert.match(textArea, /this\.group = SVG\.append\(SVG\.annotationLayer, SVG\.group\(\[this\.element, this\.clickRect\]\)\)/);
  assert.match(textArea, /\$\(this\.group\)\.dblclick\(\(event\) => \{[\s\S]{0,120}this\.doubleClick\(event\)/);
  assert.doesNotMatch(textArea, /\$\(this\.htmlElement\.cutDiv\)\.mousedown/);
  assert.doesNotMatch(textArea, /\$\(this\.htmlElement\.cutDiv\)\.dblclick/);
  assert.doesNotMatch(textArea, /_textBoxLastPrimaryPress|_textBoxPointerDoubleClickAt/);
});

test('bundled jQuery 1.8.3 does not copy MouseEvent.detail into wrapped mouse events', () => {
  const props = jquery183.match(/props:\"([^\"]+)\"\.split\(\" \"\),fixHooks/);
  assert.ok(props, 'jQuery event core property list should be detectable');
  assert.equal(props[1].split(' ').includes('detail'), false);
  assert.match(jquery183, /mouseHooks:\{props:\"button buttons clientX clientY/);
});
