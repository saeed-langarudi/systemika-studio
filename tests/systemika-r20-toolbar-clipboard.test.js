const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'style', 'editor.css'), 'utf8');

test('creation tools use one left column while editing, output, and run tools stay on top', () => {
  assert.match(html, /class="tool-panel run-tool-panel"[\s\S]*id="btn_mouse"[\s\S]*id="btn_cut"[\s\S]*id="btn_table"[\s\S]*id="runControllerArea"/);
  assert.match(html, /class="workspace-row"[\s\S]*class="model-tool-panel"[\s\S]*id="btn_stock"[\s\S]*id="btn_rotatename"/);
  const topStart = html.indexOf('class="tool-panel run-tool-panel"');
  const workspaceStart = html.indexOf('class="workspace-row"');
  const top = html.slice(topStart, workspaceStart);
  const vertical = html.slice(workspaceStart);
  for (const id of ['btn_mouse','btn_delete','btn_undo','btn_redo','btn_cut','btn_copy','btn_paste','btn_colour','btn_table','btn_compareplot','btn_xyplot']) {
    assert.ok(top.includes(`id="${id}"`), `${id} should be in the top toolbar`);
    assert.ok(!vertical.includes(`id="${id}"`), `${id} should not remain in the vertical toolbar`);
  }
  for (const id of ['btn_stock','btn_flow','btn_link','btn_variable','btn_constant','btn_converter','btn_ghost','btn_rotatename','btn_movevalve','btn_straighten_link','btn_text','btn_rectangle','btn_ellipse','btn_line']) {
    assert.ok(vertical.includes(`id="${id}"`), `${id} should remain in the vertical toolbar`);
  }
  assert.match(css, /\.model-tool-panel\s*\{[\s\S]*flex-direction:\s*column[\s\S]*overflow:\s*visible/);
  assert.match(css, /\.model-tool-panel > \.tool-grouping\s*\{[\s\S]*flex-direction:\s*column/);
  assert.doesNotMatch(css, /grid-template-columns:\s*repeat\(2, var\(--button-size\)\)/);
  assert.match(css, /\.model-tool-panel \[data-title\]:hover::after\s*\{[\s\S]*z-index:\s*1000/);
});

test('Colour is a toolbar palette rather than a top menu', () => {
  assert.doesNotMatch(html, /class="eMenu colorMenu"/);
  assert.doesNotMatch(html, /class="menuButton">Colour</);
  assert.match(html, /id="btn_colour"/);
  assert.match(html, /id="toolbar-colour-picker"/);
  assert.match(editor, /#btn_colour/);
});

test('copy cut paste are exposed in the toolbar and keyboard shortcuts are active', () => {
  assert.match(html, /id="btn_cut"[\s\S]*id="btn_copy"[\s\S]*id="btn_paste"/);
  assert.match(editor, /event\.key\.toLowerCase\(\) == "c"[\s\S]{0,220}copySelectionWithFigureImage\(\)/);
  assert.match(editor, /event\.key\.toLowerCase\(\) == "x"[\s\S]{0,220}cutSelectionWithFigureImage\(\)/);
  assert.match(editor, /event\.key\.toLowerCase\(\) == "v"[\s\S]{0,220}Clipboard\.paste\(\)/);
  assert.match(editor, /\$\("#btn_copy"\)\.click\(function \(\) \{ void copySelectionWithFigureImage\(\); \}\);/);
  assert.match(editor, /\$\("#btn_cut"\)\.click\(function \(\) \{ void cutSelectionWithFigureImage\(\); \}\);/);
  assert.match(editor, /async function copySelectionWithFigureImage\(\)[\s\S]*Clipboard\.copy\(\)[\s\S]*copyGraphVisualToClipboard/);
  assert.match(editor, /async function cutSelectionWithFigureImage\(\)[\s\S]*copyGraphVisualToClipboard[\s\S]*Clipboard\.cut\(\)/);
  assert.match(editor, /candidate = `\$\{base\} \$\{counter\}`/);
  assert.match(editor, /remapFormulaAttributes/);
  assert.match(editor, /remapIdAttributes/);
  assert.match(editor, /\["flow", "link"\]\.includes/);
});


test('output displays precede run controls and removed macro UI does not remain in the release source', () => {
  const outputPos = html.indexOf('class="tool-grouping output-actions"');
  const runPos = html.indexOf('id="runControllerArea"');
  assert.ok(outputPos >= 0 && runPos > outputPos, 'output display tools should be to the left of run controls');
  assert.match(html, /Simulation Settings are intentionally hidden from the menu bar/);
  assert.equal(html.includes('id="btn_macro"'), false);
});

test('custom cut and colour assets and green Run play icon are installed', () => {
  assert.match(html, /id="btn_cut"[\s\S]{0,240}graphics\/cut\.svg/);
  assert.match(html, /id="btn_colour"[\s\S]{0,260}graphics\/colour-pallet\.svg/);
  const cut = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'graphics', 'cut.svg'), 'utf8');
  const colour = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'graphics', 'colour-pallet.svg'), 'utf8');
  const run = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'graphics', 'run.svg'), 'utf8');
  assert.match(cut, /id="scissor"/);
  assert.match(colour, /id="colour-pallet"/);
  assert.match(run, /fill="#2e9d46"/);
});

test('limited-browser status explicitly names Firefox and Safari', () => {
  assert.match(html, /Firefox and Safari are not fully supported: use Chrome or Edge for full file and run management\./);
});


test('clipboard duplicate naming and formula remapping produce coherent copied structures', () => {
  const start = editor.indexOf('class Clipboard {');
  const end = editor.indexOf('\nClipboard.init();', start);
  const source = editor.slice(start, end) + '\nthis.Clipboard = Clipboard;';
  const names = new Set(['capital', 'capital 1']);
  const context = {
    document: { getElementById() { return null; } },
    findName(name) { return names.has(String(name).toLowerCase()) ? { id: 1 } : null; },
    Set, Map, Number, Math,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const reserved = new Set();
  assert.equal(context.Clipboard.freeCopyName('Capital', reserved), 'Capital 2');
  const mapped = context.Clipboard.replaceFormulaNames('[Capital] * [Rate] + 1', new Map([['Capital', 'Capital 2'], ['Rate', 'Rate 1']]));
  assert.equal(mapped, '[Capital 2] * [Rate 1] + 1');
});


test('toolbar Delete uses the selected-object deletion path', () => {
  const start = editor.indexOf('class DeleteTool extends BaseTool');
  const end = editor.indexOf('\nDeleteTool.init();', start);
  assert.ok(start >= 0 && end > start, 'DeleteTool should exist');
  const source = editor.slice(start, end);
  assert.match(source, /delete_selected_objects\(\);/);
  assert.doesNotMatch(source, /this\.items/);
});
