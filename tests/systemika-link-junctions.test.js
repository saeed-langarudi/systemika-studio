const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const geom = require('../OpenSystemDynamics/src/systemika-link-junctions.js');
const editor = fs.readFileSync(path.join(root,'OpenSystemDynamics/src/editor.js'),'utf8');
const html = fs.readFileSync(path.join(root,'OpenSystemDynamics/src/index.html'),'utf8');

test('junction geometry parses defensively and keeps stable IDs', () => {
  const data = geom.parse('[{"id":"1","x":12,"y":30},{"id":"2","x":0,"y":-5}]');
  assert.deepEqual(geom.parse(geom.serialize(data)), data);
  assert.equal(geom.parse('not JSON').length, 0);
  assert.equal(geom.parse('[{"id":"1","x":2,"y":3},{"id":"1","x":4,"y":6}]').length,1);
  assert.equal(geom.parse('[{"id":"no","x":2,"y":3}]').length,0);
});
test('new junctions begin at the Bezier midpoint and routing passes through them', () => {
  assert.deepEqual(geom.midpoint([0,0],[10,0],[20,0],[30,0]),[15,0]);
  const pathData = geom.path([[0,0],[15,8],[30,0]]);
  assert.match(pathData, /^M0,0 C/);
  assert.match(pathData, /15,8 C/);
  assert.match(pathData, /30,0$/);
});
test('junction fields are persistent per-Link metadata and branching preserves primitive endpoints', () => {
  assert.match(editor,/setAttribute\("SystemikaJunctions"/);
  assert.match(editor,/getLinkBranchOrigin\(this\.primitive\)/);
  assert.match(editor,/setAttribute\("SystemikaJunctionParent"/);
  assert.match(editor,/setAttribute\("SystemikaJunctionId"/);
  assert.match(editor,/this\.current_connection\.setStartAttach\(junctionSource\.source\)/);
  assert.match(editor,/this\.current_connection\.setStartAttach\(junctionSource\.source\)/);
});
test('fork junctions persist on deselection and all junctions show with Link tool', () => {
  assert.match(editor, /refreshJunctionVisibility\(\)/);
  assert.match(editor, /this\.selected \|\| drawing \|\| branched/);
  assert.match(editor, /currentTool === LinkTool/);
  assert.match(editor, /connection\.refreshJunctionVisibility\(\)/);
  assert.match(editor, /\.\.\.this\.junctionAnchors/);
});
test('dialog exposes a junction count and guards removing attached branches', () => {
  assert.match(editor,/Number of junctions:/);
  assert.match(editor,/link-junction-minus/);
  assert.match(editor,/link-junction-plus/);
  assert.match(editor,/A junction with an attached branch cannot be removed/);
});
test('shortcut M moves valve, N straightens link, and both tooltips display keys', () => {
  assert.match(editor,/m: "movevalve"/);
  assert.match(editor,/n: "straightenlink"/);
  assert.match(html,/data-title="Move Valve \(M\)"/);
  assert.match(html,/data-title="Straighten Link \(N\)"/);
  assert.match(html,/data-title="Mouse \(Esc\)"/);
});

test('routing preserves independently movable endpoint Bézier handles', () => {
  let d = geom.path([[0,0],[20,20],[60,0]], [5,20], [55,-30]);
  assert.match(d, /^M0,0 C5,20 /);
  assert.match(d, /55,-30 60,0$/);
  assert.notEqual(geom.path([[0,0],[20,20],[60,0]], [5,20], [55,-30]),
                  geom.path([[0,0],[20,20],[60,0]], [0,0], [60,0]));
  assert.match(editor, /SystemikaLinkJunctions\.path\(waypoints, this\.b1_anchor\.getPos\(\), this\.b2_anchor\.getPos\(\)\)/);
  assert.doesNotMatch(editor, /this\.junctionAnchors\.length && \(anchor === this\.b1_anchor/);
});
test('saved Bézier curvature is restored before junctions are loaded', () => {
  const loader = editor.slice(editor.indexOf('case "Link":', editor.indexOf('function syncVisual(')), editor.indexOf('break;', editor.indexOf('case "Link":', editor.indexOf('function syncVisual('))));
  assert.ok(loader.indexOf('connection.setHandle1Pos(') < loader.indexOf('connection.loadJunctions()'));
  assert.ok(loader.indexOf('connection.setHandle2Pos(') < loader.indexOf('connection.loadJunctions()'));
  const source = LinkSourcePath(editor);
  assert.doesNotMatch(source, /this\.update\(\)/);
});
function LinkSourcePath(src) {
  return src.slice(src.indexOf('\tloadJunctions() {'), src.indexOf('\tpersistJunctions() {'));
}
test('shortcut L shows junctions; Shift+L enters drawing even with a selected link', () => {
  assert.match(editor, /if \(!event\.shiftKey && selectedRoots\.length === 1 && selectedRoots\[0\]\.type === "link"\)/);
  assert.match(editor, /if \(link\.type !== "link" \|\| !link\.getStartAttach\(\)/);
  assert.match(editor, /link\.isInformationLink\(\) && !informationLinksVisible/);
});
