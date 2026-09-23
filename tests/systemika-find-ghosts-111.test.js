const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');

const html = fs.readFileSync('OpenSystemDynamics/src/index.html', 'utf8');
const editor = fs.readFileSync('OpenSystemDynamics/src/editor.js', 'utf8');

function sha256(path) { return crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'); }

test('Find Ghosts is beside Find, uses Ctrl+G, and starts disabled', () => {
  assert.match(html, /id="btn_find_variable"[\s\S]*?id="btn_find_ghosts"/);
  assert.match(html, /id="btn_find_ghosts"[^>]*data-title="Find Ghosts \(Ctrl\+G\)"[^>]*disabled/);
  assert.match(html, /id="btn_find_ghosts"[\s\S]*?graphics\/find_ghost\.svg/);
});

test('supplied Find, Find Ghosts, and Ghost icons are installed', () => {
  assert.equal(sha256('OpenSystemDynamics/src/graphics/find.png'), 'bb8a6d51ecc7361779d1fbde6caf8ec8d37a86d96b65ecbbcfee33b58119046e');
  assert.equal(sha256('OpenSystemDynamics/src/graphics/find_ghost.svg'), '46357bf31aff30911d0fee80e0c188f3ccd413ada4a7d472db14f487b6fcd4d7');
  assert.equal(sha256('OpenSystemDynamics/src/graphics/ghost.svg'), 'ed438e79ac62e4376ef4f68372117ac9359851fc452afb61e1b3544692a4c86a');
  assert.match(html, /id="btn_find_variable"[\s\S]*?graphics\/find\.png/);
  assert.match(html, /id="btn_ghost"[\s\S]*?graphics\/ghost\.svg/);
});

test('Find Ghosts enablement follows one selected ghostable variable', () => {
  assert.match(editor, /function getSelectedGhostNavigationContext\(\)/);
  assert.match(editor, /selected\.length !== 1/);
  assert.match(editor, /ghostableTypes = \["stock", "variable", "constant", "converter", "flow"\]/);
  assert.match(editor, /button\.disabled = getSelectedGhostNavigationContext\(\) == null/);
  assert.match(editor, /function refreshSelectionStacking\(\)[\s\S]*?updateFindGhostsButtonState\(\)/);
});

test('Find Ghosts cycles original to ghosts and back to original', () => {
  assert.match(editor, /function findNextGhostOfSelection\(\)/);
  assert.match(editor, /findGhostsOfID\(context\.sourceId\)/);
  assert.match(editor, /if \(context\.selectedId === context\.sourceId\)[\s\S]*?nextId = ghostIds\[0\]/);
  assert.match(editor, /ghostIds\[currentIndex \+ 1\][\s\S]*?: context\.sourceId/);
  assert.match(editor, /focusModelEntityById\(nextId\)/);
  assert.match(editor, /has no ghosts\./);
});

test('Ctrl/Cmd+G runs Find Ghosts and shortcut help documents it', () => {
  assert.match(editor, /commandModifier[\s\S]*?toLowerCase\(\) === "g"[\s\S]*?findNextGhostOfSelection\(\)/);
  assert.match(editor, /Find next Ghost \/ return to original variable<\/td><td>\$\{modifierKey\}\+G/);
});
