'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const editor = fs.readFileSync(path.resolve(__dirname, '../OpenSystemDynamics/src/editor.js'), 'utf8');
const begin = editor.indexOf('\topenRangeDialog(id) {', editor.indexOf('class PlotVariableSelectorComponent'));
const end = editor.indexOf('\n\tstyleControlsHtml(id)', begin);
assert.ok(begin >= 0 && end > begin, 'Plot Range dialog method can be isolated');
const methodSource = editor.slice(begin, end);

function makeDialog({ auto = false, min = '2', max = '9' } = {}) {
  const state = { auto, min, max, warning: '', disabled: false, removed: false, applyCalls: 0, listUpdates: 0 };
  const fields = {
    '.range-auto': {
      prop(name) { assert.equal(name, 'checked'); return state.auto; },
    },
    '.range-min': { val() { return state.min; } },
    '.range-max': { val() { return state.max; } },
    '.systemika-range-warning': { text(message) { state.warning = message; } },
    '.systemika-range-fields input': { prop(name, value) { assert.equal(name, 'disabled'); state.disabled = value; } },
  };
  const host = {
    appendTo() { return this; },
    find(selector) { assert.ok(fields[selector], `known selector ${selector}`); return fields[selector]; },
    on(event, selector, callback) {
      assert.equal(event, 'keydown.systemikaRangeSubmit');
      assert.equal(selector, 'input');
      state.keyHandler = callback;
      return this;
    },
    dialog(options) {
      if (options === 'destroy') { state.destroyed = true; return this; }
      state.dialogOptions = options;
      return this;
    },
    remove() { state.removed = true; return this; },
  };
  fields['.range-auto'].change = (cb) => { state.sync = cb; return fields['.range-auto']; };
  const ctx = {
    $: (markup) => { assert.match(markup, /systemika-variable-range-dialog/); return host; },
    document: { body: {} },
    findID: () => ({ id: 'var1' }),
    getName: () => 'TestVariable',
    htmlEscape: (x) => String(x),
  };
  const openRangeDialog = vm.runInNewContext(`({${methodSource}\n}).openRangeDialog`, ctx);
  const component = {
    ranges: {},
    updateSelectedList() { state.listUpdates++; },
    parent: { requestLiveApply(delay) { assert.equal(delay, 0); state.applyCalls++; } },
  };
  openRangeDialog.call(component, 'var1');
  const pressEnter = (key = 'Enter', which = 13, isComposing = false) => {
    const e = {
      key, which, isComposing,
      preventDefault() { state.prevented = true; },
      stopPropagation() { state.stopped = true; },
    };
    state.keyHandler(e);
    return e;
  };
  return { state, component, pressEnter };
}

test('Enter in plot range inputs applies the new minimum and maximum then closes', () => {
  const { state, component, pressEnter } = makeDialog({ min: '1.5', max: '8.25' });
  pressEnter();
  assert.equal(component.ranges.var1.auto, false);
  assert.equal(component.ranges.var1.min, 1.5);
  assert.equal(component.ranges.var1.max, 8.25);
  assert.equal(state.listUpdates, 1);
  assert.equal(state.applyCalls, 1);
  assert.equal(state.destroyed, true);
  assert.equal(state.removed, true);
  assert.equal(state.prevented, true);
  assert.equal(state.stopped, true);
});

test('Enter retains the Range dialog and existing warning for invalid limits', () => {
  const { state, component, pressEnter } = makeDialog({ min: '9', max: '2' });
  pressEnter();
  assert.match(state.warning, /Maximum must be greater than minimum/);
  assert.equal(state.removed, false);
  assert.equal(state.applyCalls, 0);
  assert.equal(component.ranges.var1, undefined);
});

test('Enter accepts automatic range and Apply button uses the same save path', () => {
  const { state, component, pressEnter } = makeDialog({ auto: true, min: '9', max: '2' });
  pressEnter();
  assert.equal(component.ranges.var1.auto, true);
  assert.equal(state.applyCalls, 1);
  const manual = makeDialog();
  manual.state.dialogOptions.buttons.Apply();
  assert.equal(manual.component.ranges.var1.min, 2);
  assert.equal(manual.state.applyCalls, 1);
  assert.equal(manual.state.removed, true);
});

test('range dialog does not apply on other keys or while composing text', () => {
  const { state, pressEnter } = makeDialog();
  pressEnter('Tab', 9);
  pressEnter('Enter', 13, true);
  assert.equal(state.applyCalls, 0);
  assert.equal(state.removed, false);
});
