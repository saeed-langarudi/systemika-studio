'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics/src/editor.js'), 'utf8');
const batch = editor.slice(editor.indexOf('// Selection changes can touch hundreds of elements.'), editor.indexOf('\nfunction timeAxisLabel()'));
const selection = editor.slice(editor.indexOf('// Normal clicks should touch only selected visuals,'), editor.indexOf('\nfunction rotate_name(', editor.indexOf('// Normal clicks should touch only selected visuals,')));

function fixture() {
  const ctx = {
    object_array: {}, connection_array: {}, scans: 0, calls: [],
    SVG: { svgElement: { classList: { toggle() {} } } },
    get_parent_id(id) { return String(id).split('.')[0]; },
    get_selected_root_objects() { ctx.scans++; return Object.fromEntries(Object.entries(ctx.connection_array).filter(([,v]) => v.selected)); },
    updateFindGhostsButtonState() {},
    document: {getElementById() {return null;}},
  };
  function anchor(id, selected = true) {
    const item = {id, selected, visible: true,
      isSelected() {return this.selected;},
      unselect() {ctx.calls.push(`anchor:${id}`);this.selected = false;},
    };
    ctx.object_array[id] = item;
    return item;
  }
  function link(id, selected = false) {
    const item = {id, selected, handlesVisible: true, isSelected() {return this.selected;},
      unselect() {
        ctx.calls.push(`link:${id}`);
        this.selected = false;
        // Simulate the parent LinkVisual's cleanup: it hides real SVG handles
        // only once every selected child has been released.
        if (!Object.entries(ctx.object_array).some(([key, a]) => key.startsWith(`${id}.`) && a.selected)) this.handlesVisible = false;
      },
    };
    ctx.connection_array[id] = item;
    return item;
  }
  vm.createContext(ctx);
  vm.runInContext(batch + '\n' + selection, ctx);
  return {ctx, anchor, link};
}

test('loading a model forcibly hides handles on links whose selected flag is false', () => {
  const {ctx, anchor, link} = fixture();
  // This is how a saved Link can look after the graphic constructors run:
  // the link parent is not selected, yet its anchors and SVG handles are visible.
  const parent = link('10', false);
  const a = anchor('10.start_anchor');
  const b = anchor('10.b1_anchor');
  ctx.unselect_all(true);
  assert.equal(parent.handlesVisible, false);
  assert.equal(parent.selected, false);
  assert.equal(a.selected, false);
  assert.equal(b.selected, false);
  assert.ok(ctx.calls.indexOf('link:10') > ctx.calls.indexOf('anchor:10.b1_anchor'));
  assert.equal(ctx.scans, 1);
});

test('ordinary blank click clears a stale selected handle and its unselected parent', () => {
  const {ctx, anchor, link} = fixture();
  const parent = link('17', false);
  anchor('17.end_anchor');
  ctx.unselect_all();
  assert.equal(parent.handlesVisible, false);
  assert.equal(ctx.calls.includes('link:17'), true);
  ctx.calls.length = 0;
  ctx.unselect_all();
  assert.deepEqual(ctx.calls, []); // Optimization retained for repeated empty clicks.
});

test('normal selection clearing still skips completely untouched links', () => {
  const {ctx, link, anchor} = fixture();
  const a = link('18', true);
  const b = link('19', false);
  b.handlesVisible = false;
  const node = anchor('18.start_anchor');
  ctx.unselect_all();
  assert.equal(a.selected, false);
  assert.equal(a.handlesVisible, false);
  assert.equal(node.selected, false);
  assert.equal(b.handlesVisible, false);
  assert.deepEqual(ctx.calls, ['anchor:18.start_anchor', 'link:18']);
});

test('model synchronization includes one-time forced visual-selection reset', () => {
  const source = editor.slice(editor.indexOf('function syncAllVisuals() {'), editor.indexOf('\nfunction findFreeName(', editor.indexOf('function syncAllVisuals() {')));
  assert.match(source, /update_all_objects\(\);\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*unselect_all\(true\)/);
});
