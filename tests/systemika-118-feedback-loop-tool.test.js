'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'style', 'editor.css'), 'utf8');
const entities = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-entities.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-model-api.js'), 'utf8');
const graphicsDir = path.join(root, 'OpenSystemDynamics', 'src', 'graphics');

function classBody(name, nextName) {
  const start = editor.indexOf(`class ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = nextName ? editor.indexOf(`class ${nextName}`, start + 1) : editor.length;
  return editor.slice(start, end === -1 ? editor.length : end);
}

test('Feedback Loop tool sits immediately above Text and offers four directional loop choices', () => {
  const loopButton = index.indexOf('id="btn_feedbackloop"');
  const textButton = index.indexOf('id="btn_text"');
  assert.ok(loopButton >= 0 && textButton > loopButton, 'Feedback Loop must precede Text in the vertical toolbar');
  assert.ok(index.slice(loopButton, textButton).includes('id="feedback-loop-picker"'));

  for (const type of [
    'reinforcing-clockwise',
    'reinforcing-counterclockwise',
    'balancing-clockwise',
    'balancing-counterclockwise'
  ]) {
    assert.ok(index.includes(`data-loop-type="${type}"`), `picker must include ${type}`);
  }
  assert.match(index, /data-loop-type="reinforcing-clockwise"[^>]*data-title="Reinforcing \(\+\) — clockwise"[\s\S]{0,220}?feedback-loop-r-cw\.svg/);
  assert.match(index, /data-loop-type="reinforcing-counterclockwise"[^>]*data-title="Reinforcing \(\+\) — counterclockwise"[\s\S]{0,220}?feedback-loop-r-ccw\.svg/);
  assert.match(index, /data-loop-type="balancing-clockwise"[^>]*data-title="Balancing \(−\) — clockwise"[\s\S]{0,220}?feedback-loop-b-cw\.svg/);
  assert.match(index, /data-loop-type="balancing-counterclockwise"[^>]*data-title="Balancing \(−\) — counterclockwise"[\s\S]{0,220}?feedback-loop-b-ccw\.svg/);
  assert.match(css, /\.feedback-loop-picker\s*\{/);
  assert.match(editor, /FeedbackLoopTool\.setLoopType\(\$\(this\)\.attr\("data-loop-type"\)\)/);
  assert.match(editor, /ToolBox\.setTool\("feedbackloop", mouse\.left\)/);
  assert.match(editor, /Feedback Loop graphics:/);
  assert.match(editor, /annotations only and do not affect simulation equations/);
});

test('Feedback Loop is a persisted graphical connector with scalable annotation rendering', () => {
  assert.match(entities, /primitiveBank\.feedbackloop\s*=\s*createTemplate\("FeedbackLoop"/);
  assert.match(entities, /LoopType:\s*"reinforcing-clockwise"/);
  assert.match(entities, /Label:\s*""/);
  assert.match(api, /"FeedbackLoop"/);

  const visual = classBody('FeedbackLoopVisual', 'RectangleVisual');
  assert.match(visual, /SVG\.annotationLayer/);
  assert.match(visual, /this\.loopPath/);
  assert.match(visual, /this\.arrowHead/);
  assert.match(visual, /this\.signText/);
  assert.match(visual, /this\.labelText/);
  assert.match(visual, /setAnchorsInEditLayer\(true\)/);
  assert.match(visual, /routeAnnotationDoubleClick\(event\)/);
  assert.match(visual, /this\.dialog\.show\(\)/);
  assert.match(visual, /this\.getWidth\(\)/);
  assert.match(visual, /this\.getHeight\(\)/);
  assert.match(visual, /ensureSquareGeometry\(\)/);
  assert.match(visual, /let size = Math\.max\(24, Math\.max\(this\.getWidth\(\), this\.getHeight\(\)\)\)/);
  assert.match(visual, /this\.labelText\.setAttribute\("y", minY \+ size \+ labelSize \+ 5\)/);
  assert.match(visual, /let color = String\(this\.primitive\.getAttribute\("Color"\)/);
  assert.match(visual, /this\.loopPath\.setAttribute\("stroke", color\)/);
  assert.match(visual, /this\.arrowHead\.setAttribute\("fill", color\)/);
  assert.match(visual, /this\.signText\.setAttribute\("fill", color\)/);
  assert.match(visual, /this\.labelText\.setAttribute\("fill", color\)/);

  assert.match(editor, /case "FeedbackLoop":/);
  assert.match(editor, /new FeedbackLoopVisual\(tprimitive\.id, "feedbackloop", source_pos, target_pos\)/);
});

test('Feedback Loop placement is one-click, always square, defaults to 50 points, and its dialog edits one size plus label', () => {
  const tool = classBody('FeedbackLoopTool', 'TextAreaTool');
  assert.match(tool, /extends OnePointCreateTool/);
  assert.match(editor, /"feedbackloop": \[50, 50\]/);
  assert.match(tool, /type_size\.feedbackloop \|\| \[50, 50\]/);
  assert.match(tool, /createConnector\("Feedback Loop", "FeedbackLoop"/);
  assert.match(tool, /primitive\.setAttribute\("LoopType", this\.loopType\)/);
  assert.match(tool, /visual\.syncAnchorToPrimitive\("start"\)/);
  assert.match(tool, /visual\.syncAnchorToPrimitive\("end"\)/);
  assert.match(tool, /static mouseMoveSingleAnchor/);
  assert.match(tool, /let side = Math\.max\(24, Math\.max\(Math\.abs\(dx\), Math\.abs\(dy\)\)\)/);
  assert.doesNotMatch(tool, /if \(shiftKey\)/);

  assert.match(entities, /Color:\s*"red"/);
  assert.match(editor, /color: reinforcing \? "red" : "blue"/);
  const dialog = classBody('FeedbackLoopDialog', 'GeometryDialog');
  assert.match(dialog, /Feedback Loop Properties/);
  assert.match(dialog, /Size \(points\):/);
  assert.doesNotMatch(dialog, /Width \(points\):/);
  assert.doesNotMatch(dialog, /Height \(points\):/);
  assert.match(dialog, /feedback-loop-size/);
  assert.match(dialog, /: 50;/);
  assert.match(dialog, /Label:/);
  assert.match(dialog, /primitive\.setAttribute\("Label"/);
  assert.match(dialog, /center\[0\] - size \/ 2, center\[1\] - size \/ 2/);
  assert.match(dialog, /center\[0\] \+ size \/ 2, center\[1\] \+ size \/ 2/);
  assert.match(dialog, /visual\.syncAnchorToPrimitive\("start"\)/);
  assert.match(dialog, /visual\.syncAnchorToPrimitive\("end"\)/);
});


test('Feedback Loop label formatting is persisted and the toolbar Color tool controls the whole annotation', () => {
  for (const [attribute, value] of [
    ['FontFamily', 'Arial, Helvetica, sans-serif'],
    ['FontSize', '12'],
    ['FontWeight', 'bold'],
    ['FontStyle', 'italic'],
    ['TextDecoration', 'underline']
  ]) {
    assert.match(entities, new RegExp(`${attribute}:\\s*"${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }

  const visual = classBody('FeedbackLoopVisual', 'RectangleVisual');
  assert.match(visual, /let labelX = cx/);
  assert.match(visual, /let textAnchor = "middle"/);
  assert.match(visual, /setColor\(color\)/);
  assert.match(visual, /super\.setColor\(resolvedColor\)/);
  assert.match(visual, /this\.primitive\.getAttribute\("Color"\)/);
  assert.match(visual, /this\.labelText\.setAttribute\("font-family", fontFamily\)/);
  assert.match(visual, /this\.labelText\.setAttribute\("font-size", `\$\{labelSize\}px`\)/);
  assert.match(visual, /this\.labelText\.setAttribute\("font-weight", fontWeight\)/);
  assert.match(visual, /this\.labelText\.setAttribute\("font-style", fontStyle\)/);
  assert.match(visual, /this\.labelText\.setAttribute\("text-decoration", textDecoration\)/);
  assert.match(visual, /this\.labelText\.setAttribute\("text-anchor", textAnchor\)/);

  const dialog = classBody('FeedbackLoopDialog', 'GeometryDialog');
  assert.match(dialog, /feedback-loop-font-family/);
  assert.match(dialog, /feedback-loop-font-size/);
  assert.match(dialog, /feedback-loop-bold/);
  assert.match(dialog, /feedback-loop-italic/);
  assert.match(dialog, /feedback-loop-underline/);
  assert.doesNotMatch(dialog, /feedback-loop-text-align/);
  assert.match(dialog, /primitive\.setAttribute\("FontFamily"/);
  assert.match(dialog, /primitive\.setAttribute\("FontSize"/);
  assert.match(dialog, /primitive\.setAttribute\("FontWeight"/);
  assert.match(dialog, /primitive\.setAttribute\("FontStyle"/);
  assert.match(dialog, /primitive\.setAttribute\("TextDecoration"/);
  assert.doesNotMatch(dialog, /primitive\.setAttribute\("TextAlign"/);
  assert.doesNotMatch(dialog, /type=["']color["']/i);
  assert.doesNotMatch(dialog, /feedback-loop-(?:text-)?color/i);
});

test('Feedback Loop toolbar artwork is bundled, clean vector artwork, and direction filenames match their tooltips', () => {
  for (const file of [
    'feedback-loop.svg',
    'feedback-loop-r-cw.svg',
    'feedback-loop-r-ccw.svg',
    'feedback-loop-b-cw.svg',
    'feedback-loop-b-ccw.svg'
  ]) {
    const full = path.join(graphicsDir, file);
    assert.ok(fs.existsSync(full), `${file} must be bundled`);
    const svg = fs.readFileSync(full, 'utf8');
    assert.ok(svg.includes('<svg'), `${file} must be SVG artwork`);
    assert.match(svg, /markerUnits="userSpaceOnUse"/);
    assert.match(svg, /stroke-linecap="round"/);
  }
  const toolbar = fs.readFileSync(path.join(graphicsDir, 'feedback-loop.svg'), 'utf8');
  const rCw = fs.readFileSync(path.join(graphicsDir, 'feedback-loop-r-cw.svg'), 'utf8');
  const rCcw = fs.readFileSync(path.join(graphicsDir, 'feedback-loop-r-ccw.svg'), 'utf8');
  const bCw = fs.readFileSync(path.join(graphicsDir, 'feedback-loop-b-cw.svg'), 'utf8');
  const bCcw = fs.readFileSync(path.join(graphicsDir, 'feedback-loop-b-ccw.svg'), 'utf8');
  assert.match(rCw, /A21 21 0 1 1 51\.7 39\.2/);
  assert.match(bCw, /A21 21 0 1 1 51\.7 39\.2/);
  assert.match(rCcw, /A21 21 0 1 0 12\.3 39\.2/);
  assert.match(bCcw, /A21 21 0 1 0 12\.3 39\.2/);
  assert.match(toolbar, /(?:fill|stroke)="black"/);
  assert.doesNotMatch(toolbar, /(?:fill|stroke)="red"/);
  assert.match(rCw, /(?:fill|stroke)="red"/);
  assert.match(rCcw, /(?:fill|stroke)="red"/);
  assert.match(bCw, /(?:fill|stroke)="blue"/);
  assert.match(bCcw, /(?:fill|stroke)="blue"/);
});

test('Feedback Loop primitives are ignored by the native simulation compiler', () => {
  const engine = require(path.join('..', 'OpenSystemDynamics', 'src', 'systemika-engine.js'));
  const feedbackLoop = {
    id: 'loop-1',
    value: { nodeName: 'FeedbackLoop' },
    source: null,
    target: null,
    getAttribute(key) {
      return ({ name: 'Feedback Loop', LoopType: 'reinforcing-clockwise', Label: 'R1' })[key];
    }
  };
  const stock = {
    id: 'stock-1',
    value: { nodeName: 'Stock' },
    source: null,
    target: null,
    getAttribute(key) {
      return ({ name: 'Stock', InitialValue: '10', NonNegative: 'false' })[key];
    }
  };

  const previous = {
    primitives: global.primitives,
    getSetting: global.getSetting,
    getName: global.getName,
    orig: global.orig
  };
  global.primitives = () => [stock, feedbackLoop];
  global.getSetting = () => ({
    getAttribute(key) {
      return ({ TimeStart: '0', TimeLength: '1', TimeStep: '1', SolutionAlgorithm: 'RK1', TimePause: '1' })[key];
    }
  });
  global.getName = item => item.getAttribute('name');
  global.orig = item => item;

  try {
    const compiled = engine.compileCurrentModel();
    assert.equal(compiled.stocks.length, 1);
    assert.equal(compiled.variables.length, 0);
    assert.equal(compiled.flows.length, 0);
    assert.equal(compiled.converters.length, 0);
    assert.equal(compiled.stocks[0].name, 'Stock');
  } finally {
    Object.assign(global, previous);
  }
});
