const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('OpenSystemDynamics/src/index.html', 'utf8');
const svg = fs.readFileSync('OpenSystemDynamics/src/SVG.js', 'utf8');
const editor = fs.readFileSync('OpenSystemDynamics/src/editor.js', 'utf8');

test('stock-label layer is the final SVG model layer', () => {
  const anchorIndex = html.indexOf('<g class="layer anchor"></g>');
  const labelIndex = html.indexOf('<g class="layer stock-label"></g>');
  const svgCloseIndex = html.indexOf('</svg>', labelIndex);
  assert.ok(anchorIndex >= 0, 'anchor layer should exist');
  assert.ok(labelIndex > anchorIndex, 'stock-label layer must paint after anchors and model entities');
  assert.ok(svgCloseIndex > labelIndex, 'stock-label layer must be inside the model SVG');
  assert.equal(html.slice(labelIndex + '<g class="layer stock-label"></g>'.length, svgCloseIndex).match(/<g class="layer /g), null,
    'no later model layer should be able to paint over stock labels');
});

test('SVG exposes the dedicated stock-label layer', () => {
  assert.match(svg, /static stockLabelLayer;/);
  assert.match(svg, /SVG\.stockLabelLayer = SVG\.svgElement\.querySelector\("g\.layer\.stock-label"\)/);
});

test('stock names and backgrounds are re-parented to the top label layer and track stock movement', () => {
  assert.match(editor, /this\.type === "stock" && this\.name_element && SVG\.stockLabelLayer/);
  assert.match(editor, /SVG\.group\(\[this\.name_background_element, this\.name_element\]\)/);
  assert.match(editor, /this\.name_overlay_group\.setAttribute\("transform", primitiveTransform\)/);
});

test('stock label overlay is removed with the primitive visual', () => {
  assert.match(editor, /if \(this\.name_overlay_group\) \{[\s\S]*?this\.name_overlay_group\.remove\(\);[\s\S]*?this\.name_overlay_group = null;[\s\S]*?this\.name_background_element = null;/);
});

test('stock label background is translucent, rounded, and does not intercept pointer events', () => {
  assert.match(editor, /"stock-name-background"/);
  assert.match(editor, /"fill-opacity": "0\.72"/);
  assert.match(editor, /"rx": "3"/);
  assert.match(editor, /"ry": "3"/);
  assert.match(editor, /"pointer-events": "none"/);
});

test('stock label background follows the rendered text bounds with compact padding', () => {
  assert.match(editor, /box = this\.name_element\.getBBox\(\)/);
  assert.match(editor, /const paddingX = 4;/);
  assert.match(editor, /const paddingY = 2;/);
  assert.match(editor, /let backgroundWidth = box\.width \+ paddingX \* 2;/);
  assert.match(editor, /let backgroundHeight = box\.height \+ paddingY \* 2;/);
  assert.match(editor, /setAttribute\("width", backgroundWidth\)/);
  assert.match(editor, /setAttribute\("height", backgroundHeight\)/);
});

test('stock label background is clamped clear of the visible stock border for every label side', () => {
  assert.match(editor, /const stockLeft = -stockWidth \/ 2;/);
  assert.match(editor, /const stockRight = stockWidth \/ 2;/);
  assert.match(editor, /const stockTop = -stockHeight \/ 2;/);
  assert.match(editor, /const stockBottom = stockHeight \/ 2;/);
  assert.match(editor, /outlineStrokeWidth = parseFloat\(window\.getComputedStyle\(outlineElement\)\.strokeWidth\)/);
  assert.match(editor, /const borderClearance = outlineStrokeWidth \/ 2 \+ 1;/);
  assert.match(editor, /const stockOuterLeft = stockLeft - borderClearance;/);
  assert.match(editor, /const stockOuterRight = stockRight \+ borderClearance;/);
  assert.match(editor, /const stockOuterTop = stockTop - borderClearance;/);
  assert.match(editor, /const stockOuterBottom = stockBottom \+ borderClearance;/);
  assert.match(editor, /case 0: \{ \/\/ Below[\s\S]*?stockOuterBottom - backgroundY/);
  assert.match(editor, /case 1: \{ \/\/ Right[\s\S]*?stockOuterRight - backgroundX/);
  assert.match(editor, /case 2: \{ \/\/ Above[\s\S]*?backgroundBottom - stockOuterTop/);
  assert.match(editor, /case 3: \{ \/\/ Left[\s\S]*?backgroundRight - stockOuterLeft/);
});

test('stock label background leaves an anti-aliasing gap beyond the stock stroke', () => {
  assert.match(editor, /borderClearance = outlineStrokeWidth \/ 2 \+ 1/);
  assert.match(editor, /merely stopping at stockTop\/stockBottom\/etc\. still paints over half of/);
});

test('stock label background adapts to light and dark text', () => {
  assert.match(editor, /const luminance = 0\.2126 \* linear\[0\] \+ 0\.7152 \* linear\[1\] \+ 0\.0722 \* linear\[2\];/);
  assert.match(editor, /return luminance > 0\.5 \? "#111111" : "#ffffff";/);
  assert.match(editor, /this\.name_background_element\.setAttribute\("fill", this\.getStockNameBackgroundColor\(\)\)/);
});

test('stock label background refreshes after rename, recolor, and name rotation', () => {
  const setNameBlock = editor.slice(editor.indexOf('\tsetName(new_name)'), editor.indexOf('\n\tgetStockNameTextRgb()', editor.indexOf('\tsetName(new_name)')));
  assert.match(setNameBlock, /this\.updateStockNameBackground\(\);/);

  const setColorBlock = editor.slice(editor.indexOf('\tsetColor(color)'), editor.indexOf('\n\tupdateDefinitionError()', editor.indexOf('\tsetColor(color)')));
  assert.match(setColorBlock, /this\.updateStockNameBackground\(\);/);

  const updateNamePosBlock = editor.slice(editor.indexOf('function update_name_pos(node_id)'), editor.indexOf('\n}\n\n\/\/ Canvas zoom', editor.indexOf('function update_name_pos(node_id)')) + 2);
  assert.match(updateNamePosBlock, /object\.updateStockNameBackground\(\);/);
});
