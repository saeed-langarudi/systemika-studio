const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'OpenSystemDynamics', 'src');
const editor = fs.readFileSync(path.join(src, 'editor.js'), 'utf8');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(src, 'style', 'editor.css'), 'utf8');
const entities = fs.readFileSync(path.join(src, 'systemika-entities.js'), 'utf8');

test('Unsaved Changes control opens explicit Save / Save As choice', () => {
  assert.match(html, /<button id="unsaved_changes"[^>]*data-title="Save unsaved changes"/);
  assert.match(editor, /class UnsavedSaveChoiceDialog extends jqDialog/);
  assert.match(editor, /"Save": \(\) => \{[^}]*fileManager\.saveModel\(\)/s);
  assert.match(editor, /"Save As\.\.\.": \(\) => \{[^}]*fileManager\.saveModelAs\(\)/s);
  assert.match(editor, /\$\("#unsaved_changes"\)\.click\([\s\S]*showUnsavedSaveChoice\(\)/);
});

test('duplicate directed Links are rejected at either endpoint', () => {
  assert.match(editor, /function directedLinkExists\(sourceId, targetId, ignoreLinkId = null\)/);
  assert.match(editor, /isAcceptableStartAttach\(attachVisual\)[\s\S]{0,400}directedLinkExists\(attachVisual\.id, end\.id, this\.id\)/);
  assert.match(editor, /isAcceptableEndAttach\(attachVisual\)[\s\S]{0,1200}directedLinkExists\(start\.id, attachVisual\.id, this\.id\)/);
  assert.match(editor, /attached = parentConnection\.setEndAttach\(attach_to\) !== false/);
  assert.match(editor, /directedLinkExists\(source\.id, target\.id, clone\.id\)[\s\S]{0,180}removePrimitive\(clone\)/);
});

test('selected SVG entities and handles are elevated over HTML plot overlays', () => {
  assert.match(editor, /function refreshSelectionStacking\(\)/);
  assert.match(editor, /classList\.toggle\("selection-on-top", selected\.length > 0\)/);
  assert.match(css, /#svgplane\.selection-on-top[\s\S]{0,180}z-index:\s*101/);
  assert.match(css, /#svgplane\.selection-on-top g\.layer\.plot \.element[\s\S]{0,120}fill:\s*none !important/);
});

test('Save As has Ctrl+Shift+S and Rotate Name has R', () => {
  assert.match(html, /id="btn_save_as"[^>]*data-title="Save As \(Ctrl\+Shift\+S\)"[\s\S]{0,100}Ctrl Shift S/);
  assert.match(editor, /event\.key\.toLowerCase\(\) == "s"[\s\S]{0,180}event\.shiftKey[\s\S]{0,120}#btn_save_as/);
  assert.match(html, /id="btn_rotatename"[^>]*data-title="Rotate Name \(R\)"/);
  assert.match(editor, /r:\s*"rotatename"/);
});

test('new time plots default to numbered lines, neutral colours, and hover data', () => {
  const matches = [...entities.matchAll(/HasNumberedLines:\s*true,\s*\n\s*ColorFromPrimitive:\s*false,\s*\n\s*ShowHighlighter:\s*true,/g)];
  assert.ok(matches.length >= 2, 'TimePlot and ComparePlot should share the requested defaults');
});

test('copying TextArea preserves the text instead of generating a unique name', () => {
  assert.match(editor, /type:\s*getType\(primitive\) \|\| ""/);
  assert.match(editor, /isStaticText[\s\S]{0,220}\? item\.name/);
  assert.match(editor, /if \(!isStaticText\) nameMap\.set/);
});

test('Advance-mode Simulation Settings silently lock compiled options', () => {
  assert.match(editor, /if \(this\.advanceMode\) \{[\s\S]{0,500}start_field\.prop\("disabled", true\)[\s\S]{0,300}method_select\.prop\("disabled", true\)/);
  assert.doesNotMatch(editor, /Advance is active\. You may change/);
  assert.match(editor, /checkValidTimeSettings\(\) \{[\s\S]{0,500}if \(this\.advanceMode\)[\s\S]{0,400}this\.warning_div\.html\(""\)/);
});

test('time-based plot x axes include the model time unit', () => {
  assert.match(editor, /function timeAxisLabel\(\)[\s\S]{0,250}`Time \(\$\{unit\}\)`/);
  const count = (editor.match(/label:\s*timeAxisLabel\(\)/g) || []).length;
  assert.ok(count >= 2, 'TimePlot and ComparePlot should use the unit-aware label');
});
