'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics/src/editor.js'), 'utf8');
const batchStart = editor.indexOf('// Selection changes can touch hundreds of elements.');
const batchEnd = editor.indexOf('\nfunction timeAxisLabel()', batchStart);
const selectorStart = editor.indexOf('class RectSelector {');
const selectorEnd = editor.indexOf('\nfunction tool_deletePrimitive', selectorStart);
assert.ok(batchStart >= 0 && batchEnd > batchStart && selectorStart >= 0 && selectorEnd > selectorStart);
function setup(count = 180) {
 const ctx = {
  object_array: {}, connection_array: {}, refreshCount: 0,
  SVG: { svgElement: { classList: { toggle() {} } }, rect() { return { setAttribute() {} }; }, append(_parent, el) { return el; } },
  get_selected_root_objects() { return Object.fromEntries(Object.entries(ctx.object_array).filter(([id, obj]) => !id.includes('.') && obj.selected)); },
  updateFindGhostsButtonState() { ctx.refreshCount++; },
  get_parent_id(id) { return String(id).split('.')[0]; },
  get_object(id) { return ctx.object_array[id] || ctx.connection_array[id]; },
  unselect_all() { for (const obj of Object.values(ctx.object_array)) obj.unselect(); for (const obj of Object.values(ctx.connection_array)) obj.unselect(); },
  CoordRect: class { setVisible(visible) { this.visible = visible; } update() {} xmin() { return Math.min(this.x1,this.x2); } ymin() { return Math.min(this.y1,this.y2); } width() { return Math.abs(this.x2-this.x1); } height() { return Math.abs(this.y2-this.y1); } }
 };
 vm.createContext(ctx);
 vm.runInContext(editor.slice(batchStart, batchEnd)+'\n'+editor.slice(selectorStart,selectorEnd),ctx);
 const RectSelector=vm.runInContext('RectSelector',ctx); RectSelector.init(); ctx.mutations=0;
 for(let i=0;i<count;i++) { let id=String(i); ctx.object_array[id]={id,pos:[i*10+10,10],selected:false,select(){this.selected=true;ctx.mutations++;ctx.refreshSelectionStacking();},unselect(){this.selected=false;ctx.mutations++;ctx.refreshSelectionStacking();}}; }
 return {ctx, RectSelector};
}
test('marquee only mutates changes rather than reselecting the whole model on every movement',()=>{
 const {ctx,RectSelector}=setup();
 RectSelector.start(0,0); ctx.mutations=0;ctx.refreshCount=0;
 RectSelector.move(500,20);
 const initial=ctx.mutations;
 assert.equal(Object.values(ctx.object_array).filter(x=>x.selected).length,50);
 assert.equal(ctx.refreshCount,1);
 for(let i=0;i<60;i++)RectSelector.move(500,20);
 assert.equal(ctx.mutations,initial);
 assert.equal(ctx.refreshCount,1);
 RectSelector.move(250,20);
 assert.equal(Object.values(ctx.object_array).filter(x=>x.selected).length,25);
 assert.equal(ctx.mutations-initial,25);
 RectSelector.move(750,20);
 assert.equal(Object.values(ctx.object_array).filter(x=>x.selected).length,75);
 assert.equal(ctx.mutations-initial,75);
 RectSelector.stop();
 assert.equal(RectSelector.coordRect.visible,false);
 assert.equal(Object.values(ctx.object_array).filter(x=>x.selected).length,75);
});
test('marquee keeps link-parent selection consistent with handle selection',()=>{
 const {ctx,RectSelector}=setup(2);
 const parent=ctx.object_array['0'];
 const anchor={id:'0.start_anchor',pos:[90,90],selected:false,select(){this.selected=true;ctx.mutations++;ctx.refreshSelectionStacking();},unselect(){this.selected=false;ctx.mutations++;ctx.refreshSelectionStacking();}};
 ctx.object_array[anchor.id]=anchor;
 RectSelector.start(80,80);RectSelector.move(100,100);
 assert.equal(anchor.selected,true);assert.equal(parent.selected,true);
 const before=ctx.mutations;
 RectSelector.move(95,95);assert.equal(ctx.mutations,before);
 RectSelector.move(85,85);
 assert.equal(anchor.selected,false);assert.equal(parent.selected,false);
 RectSelector.stop();
});
