const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');

test('Advance to End exposes Ctrl+3 and completed simulations force progress to 100%', () => {
  assert.match(html, /id="btn_finish"[^>]+data-title="Advance to End \(Ctrl\+3\)"/);
  assert.match(editor, /if \(event\.key == "3"\)[\s\S]{0,160}FinishTool\.enterTool\(\)/);
  assert.match(editor, /let progress = this\.simulationDone \? 1 : clampValue\(this\.getRunProgressFraction\(\), 0, 1\)/);
  assert.match(editor, /let currentProgress = this\.simulationDone \? this\.getRunProgressMax\(\) : this\.getRunProgress\(\)/);
});

test('toolbar creates only the multi-run Time Plot and reuses the legacy Time Plot icon', () => {
  assert.doesNotMatch(html, /id="btn_timeplot"/);
  assert.match(html, /id="btn_compareplot"[^>]+data-title="Time Plot \(P\)"[\s\S]{0,120}graphics\/timeplot\.svg/);
  assert.match(editor, /this\.setTitle\("Time Plot Properties"\)/);
  assert.match(editor, /empty-plot-header">Time Plot</);
  // Legacy TimePlot support remains in source for old .ssd models.
  assert.match(editor, /class TimePlotVisual extends PlotVisual/);
  assert.match(editor, /"timeplot": TimePlotTool/);
});

test('modeling toolbar order and names match Systemika shortcuts', () => {
  const ids = ['btn_stock','btn_flow','btn_link','btn_variable','btn_constant','btn_converter','btn_ghost'];
  const positions = ids.map(id => html.indexOf(`id="${id}"`));
  for (const pos of positions) assert.ok(pos >= 0);
  for (let i = 1; i < positions.length; i++) assert.ok(positions[i] > positions[i-1], `${ids[i]} should follow ${ids[i-1]}`);
  assert.match(html, /data-title="Stock \(S\)"/);
  assert.match(html, /data-title="Flow \(F\)"/);
  assert.match(html, /data-title="Link \(L\)"/);
  assert.match(html, /data-title="Auxiliary \(A\)"/);
  assert.match(html, /data-title="Constant \(C\)"/);
  assert.match(html, /data-title="Lookup \(K\)"/);
  assert.match(html, /data-title="Ghost \(G\)"/);
});

test('single-key shortcuts map to modeling and output tools, with L opening a selected Link', () => {
  for (const pair of [
    ['s','stock'],['f','flow'],['a','variable'],['c','constant'],['k','converter'],['g','ghost'],
    ['p','compareplot'],['t','table'],['x','xyplot'],['h','histoplot']
  ]) {
    assert.match(editor, new RegExp(`${pair[0]}: "${pair[1]}"`));
  }
  assert.match(editor, /if \(key === "l"\)[\s\S]{0,500}selectedRoots\.length === 1 && selectedRoots\[0\]\.type === "link"[\s\S]{0,220}selectedRoots\[0\]\.doubleClick\(\)[\s\S]{0,220}ToolBox\.setTool\("link"\)/);
  assert.match(html, /data-title="Table \(T\)"/);
  assert.match(html, /data-title="XY Plot \(X\)"/);
  assert.doesNotMatch(editor, /n: "numberbox"/);
  assert.doesNotMatch(html, /id="btn_numberbox"/);
  assert.match(html, /data-title="Histogram \(H\)"/);
});
