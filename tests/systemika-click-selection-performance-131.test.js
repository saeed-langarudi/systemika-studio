'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics/src/editor.js'), 'utf8');

function cut(startMarker, endMarker) {
  const start = editor.indexOf(startMarker);
  const end = editor.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${startMarker} / ${endMarker}`);
  return editor.slice(start, end);
}

const batch = cut('// Selection changes can touch hundreds of elements.', '\nfunction timeAxisLabel()');
const clicked = cut('function primitive_mousedown(node_id, event, new_primitive)', '\n// only updates diagrams');
const clear = cut('// Normal clicks should touch only selected visuals,', '\nfunction rotate_name(');

function makeSelectionHarness(num = 300) {
  const ctx = {
    object_array: {}, connection_array: {}, scans: 0, selectCalls: 0, unselectCalls: 0,
    mouse: { left: 1, clickedOnObject: false },
    SVG: { svgElement: { classList: { toggle() {} } } },
    get_selected_root_objects() { ctx.scans++; return Object.fromEntries(
      Object.entries(ctx.object_array).concat(Object.entries(ctx.connection_array))
        .filter(([id, visual]) => !id.includes('.') && visual.selected)
    ); },
    get_only_selected_anchor_id() { return null; },
    updateFindGhostsButtonState() {},
    get_object(id) { return ctx.object_array[id] || ctx.connection_array[id]; },
    get_parent_id(id) { return String(id).split('.')[0]; },
    document: { getElementById() { return null; } },
  };
  for (let i=0; i<num; i++) {
    const id = String(i);
    ctx.object_array[id] = {
      id, type: 'variable', selected: false,
      isSelected() { return this.selected; },
      select() { ctx.selectCalls++; this.selected = true; ctx.refreshSelectionStacking(); },
      unselect() { ctx.unselectCalls++; this.selected = false; ctx.refreshSelectionStacking(); },
    };
  }
  vm.createContext(ctx);
  vm.runInContext(batch + '\n' + clicked + '\n' + clear, ctx);
  return ctx;
}
function mouseDown(ctx, id, shiftKey = false) {
  ctx.primitive_mousedown(String(id), { which: 1, shiftKey, stopPropagation() {} });
}

test('individual clicks select one object without clearing the entire model', () => {
  const ctx = makeSelectionHarness(400);
  mouseDown(ctx, 10);
  assert.equal(ctx.selectCalls, 1);
  assert.equal(ctx.unselectCalls, 0);
  // Only one global status update per click (not one per object).
  assert.equal(ctx.scans, 1); // one selection scan
  ctx.scans = 0;
  mouseDown(ctx, 11);
  assert.equal(ctx.selectCalls, 2);
  assert.equal(ctx.unselectCalls, 1);
  assert.deepEqual(Object.keys(ctx.get_selected_root_objects()), ['11']);
  assert.ok(ctx.scans < 6);
});

test('shift clicks still toggle independently; clearing skips unselected SVG objects', () => {
  const ctx = makeSelectionHarness(400);
  mouseDown(ctx, 10);
  mouseDown(ctx, 11, true);
  assert.equal(ctx.selectCalls, 2);
  assert.equal(ctx.unselectCalls, 0);
  mouseDown(ctx, 10, true);
  assert.equal(ctx.unselectCalls, 1);
  assert.equal(ctx.object_array['11'].isSelected(), true);
  ctx.unselect_all();
  assert.equal(ctx.unselectCalls, 2);
  ctx.unselect_all();
  assert.equal(ctx.unselectCalls, 2);
});

test('unselect_all_but retains selected parent while clearing a selected child handle', () => {
  const ctx = makeSelectionHarness(80);
  const child = { id:'12.b1_anchor', selected:true, isSelected() {return this.selected;},
    select() {this.selected=true;ctx.selectCalls++;ctx.refreshSelectionStacking();},
    unselect() {this.selected=false;ctx.unselectCalls++;ctx.refreshSelectionStacking();} };
  ctx.object_array[child.id] = child;
  ctx.object_array['12'].selected = true;
  ctx.unselect_all_but('12');
  assert.equal(ctx.object_array['12'].isSelected(), true);
  assert.equal(child.isSelected(), false);
  assert.equal(ctx.unselectCalls, 1);
});

const mouseUpSource = cut('function mouseUpHandler(event) {','\nfunction find_elements_under(');
test('mouse-up avoids expensive Undo serialization for clicks but preserves it for drag and edit', () => {
  const ctx = {
    mouse: { left:1, middle:2, isLeftDown:true, modelDragOccurred:false, modelChangeDuringMouseTool:false },
    MouseTool: function MouseTool(){},
    ToolBox: {},
    do_global_log() {},
    mousePosition() { return {x:20,y:30}; },
    InfoBar: {update(){}},
    History: { count:0, storeUndoState(){this.count++;} },
    MousePan: {end(){}},
  };
  ctx.currentTool = ctx.MouseTool;
  ctx.currentTool.leftMouseUp=()=>{};
  vm.createContext(ctx);
  vm.runInContext(mouseUpSource, ctx);
  function release(drag, edit, otherTool=false) {
    ctx.mouse.isLeftDown=true;
    ctx.mouse.modelDragOccurred=drag;
    ctx.mouse.modelChangeDuringMouseTool=edit;
    ctx.currentTool=otherTool?{leftMouseUp(){}}:ctx.MouseTool;
    ctx.mouseUpHandler({which:1, shiftKey:false});
  }
  release(false,false);
  assert.equal(ctx.History.count,0);
  release(true,false);
  assert.equal(ctx.History.count,1);
  release(false,true);
  assert.equal(ctx.History.count,2);
  release(false,false,true);
  assert.equal(ctx.History.count,3);
});
