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

test('annotation layer paints below all model entities so overlapping variables receive pointer events', () => {
  const annotation = html.indexOf('<g class="layer annotation"></g>');
  const anchor = html.indexOf('<g class="layer anchor"></g>');
  const stock = html.indexOf('<g class="layer stock"></g>');
  const variable = html.indexOf('<g class="layer variable"></g>');
  const constant = html.indexOf('<g class="layer constant"></g>');
  const converter = html.indexOf('<g class="layer converter"></g>');
  const flow = html.indexOf('<g class="layer flow"></g>');

  assert.ok(annotation >= 0, 'annotation layer should exist');
  assert.ok(anchor > annotation, 'editing anchors should remain above annotations');
  for (const [name, index] of Object.entries({ stock, variable, constant, converter, flow })) {
    assert.ok(index > annotation, `${name} layer must paint after annotations`);
  }
});

test('SVG exposes the dedicated annotation layer', () => {
  assert.match(svg, /static annotationLayer;/);
  assert.match(svg, /SVG\.annotationLayer = SVG\.svgElement\.querySelector\("g\.layer\.annotation"\)/);
});

test('text boxes and geometry shapes render in annotation layer instead of model/output layers', () => {
  const rectangle = between(editor, 'class RectangleVisual extends TwoPointer', 'class EllipseVisual extends TwoPointer');
  const ellipse = between(editor, 'class EllipseVisual extends TwoPointer', 'class HtmlTwoPointer extends TwoPointer');
  const textArea = between(editor, 'class TextAreaVisual extends HtmlTwoPointer', 'class HistoPlotVisual');
  const line = between(editor, 'class LineVisual extends TwoPointer', 'let informationLinksVisible = true;');

  assert.match(rectangle, /SVG\.append\(SVG\.annotationLayer, SVG\.group\(\[this\.element, this\.clickRect\]\)\)/);
  assert.doesNotMatch(rectangle, /SVG\.plotLayer/);

  assert.match(ellipse, /SVG\.append\(SVG\.annotationLayer, SVG\.group\(\[this\.element, this\.clickEllipse, this\.selector\]\)\)/);
  assert.doesNotMatch(ellipse, /SVG\.plotLayer/);

  assert.match(textArea, /this\.element = SVG\.rect\(/);
  assert.match(textArea, /this\.htmlElement = SVG\.append\(SVG\.annotationLayer,/);
  assert.match(textArea, /this\.group = SVG\.append\(SVG\.annotationLayer, SVG\.group\(\[this\.element, this\.clickRect\]\)\)/);
  assert.doesNotMatch(textArea, /SVG\.plotLayer/);

  assert.match(line, /this\.group = SVG\.append\(SVG\.annotationLayer,/);
  assert.doesNotMatch(line, /SVG\.append\(SVG\.svgElement,/);
});

test('Rectangle resize handles may rise for editing without raising the Rectangle itself', () => {
  const rectangle = between(editor, 'class RectangleVisual extends TwoPointer', 'class EllipseVisual extends TwoPointer');
  assert.match(rectangle, /editing && SVG\.flowAnchorEditLayer \? SVG\.flowAnchorEditLayer : SVG\.anchorLayer/);
  assert.match(rectangle, /this\.group = SVG\.append\(SVG\.annotationLayer,/);
});
