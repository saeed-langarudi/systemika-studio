'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics/src/editor.js'), 'utf8');
const environment = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics/src/environment.js'), 'utf8');

function extractClass(name, nextClass) {
  const start = source.indexOf(`class ${name} `);
  const end = source.indexOf(`class ${nextClass} `, start);
  assert.ok(start >= 0 && end > start, `class boundaries: ${name}`);
  return source.slice(start, end);
}

function lookupHarness(initialName) {
  const elements = { field: { value: initialName, background: null }, warning: { value: null } };
  function $(element) {
    if (element === elements.field) return {
      val: () => elements.field.value,
      css: (_, value) => { elements.field.background = value; },
    };
    if (element === 'dialog') return {
      find: () => ({ html: (value) => { elements.warning.value = value; } }),
    };
    throw new Error('Unexpected jQuery lookup');
  }
  const sandbox = {
    jqDialog: class {}, $, stripBrackets: v => String(v).replace(/^\[|\]$/g, '').trim(),
    isNameFree: name => name !== 'Taken',
    isValidToolName: name => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name),
    validPrimitiveName: name => !!name && !/[\[\]"'()]/.test(name),
    warningHtml: message => `<span class="warning">${message} </span>`,
  };
  vm.runInNewContext(extractClass('ConverterDialog', 'DebugDialog') + '\nthis.LookupDialog = ConverterDialog;', sandbox);
  const dialog = Object.create(sandbox.LookupDialog.prototype);
  dialog.nameField = { focus() { elements.focused = true; } };
  // jQuery's input representation is independent of the DOM node in this harness.
  dialog.nameField = elements.field;
  dialog.dialogContent = 'dialog';
  dialog.primitive = { id: '3' };
  return { dialog, elements };
}

test('Lookup name validation flags spaces with a visible warning and retains correct names', () => {
  for (const name of ['New Lookup', 'NewLookup ', 'New\tLookup', '3Lookup', 'Taken', '']) {
    const { dialog, elements } = lookupHarness(name);
    assert.equal(dialog.validateLookupName(), false, name);
    assert.equal(elements.field.background, 'pink');
    assert.ok(elements.warning.value, 'warning not shown');
  }
  for (const name of ['Lookup_3', 'NewLookup', '[Lookup_3]']) {
    const { dialog, elements } = lookupHarness(name);
    assert.equal(dialog.validateLookupName(), true, name);
    assert.equal(elements.warning.value, '');
  }
});


test('Lookup name warnings use the same markup and wording as Stock/Auxiliary', () => {
  const cases = [
    ['New Lookup', 'Allowed characters are:', 'A-Z', '0-9'],
    ['NewLookup ', 'Allowed characters are:'],
    ['3Lookup', 'Allowed characters are:'],
    ['Taken', 'Name <b>Taken</b> is taken.'],
    ['', 'Name cannot be empty.'],
    ['Lookup(1)', 'Allowed characters are:'],
  ];
  for (const [name, ...fragments] of cases) {
    const { dialog, elements } = lookupHarness(name);
    assert.equal(dialog.validateLookupName(), false, name);
    assert.match(elements.warning.value, /^<span class="warning">/);
    for (const fragment of fragments) assert.ok(elements.warning.value.includes(fragment), name + ': ' + fragment);
  }
  const { dialog, elements } = lookupHarness('New Lookup');
  assert.equal(dialog.validateLookupName(false), false);
  assert.equal(elements.warning.value, '', 'initial validation is silent');
  elements.field.value = 'Lookup_1';
  assert.equal(dialog.validateLookupName(), true);
  assert.equal(elements.warning.value, '', 'warning is cleared when corrected');
});

test('Lookup Apply refuses to commit definition when name is invalid', () => {
  const { dialog, elements } = lookupHarness('Incorrect Name');
  elements.field.focus = () => { elements.focused = true; };
  dialog.cmValueField = { getValue() { throw Error('Should not read value before name validation'); } };
  assert.equal(dialog.makeApply(), false);
  assert.equal(elements.focused, true);
});

test('Info Bar shows bare model name but retains original equation and units', () => {
  const primitive = { getAttribute: key => key === 'name' ? 'Criminals' : '' };
  const values = [];
  const fakeSelection = { primitive, is_ghost: false, type: 'variable' };
  const sandbox = {
    get_selected_root_objects: () => ({'1': fakeSelection}),
    getValue: () => '0', getUnits: () => 'Unitless',
    DefinitionError: { getMessage: () => '' },
    $: () => ({ find: () => ({ removeClass() {}, addClass() {} }) }),
  };
  // Extract class declaration by brace balance to avoid loading unrelated code.
  let nesting = 0, end = -1;
  const begin = source.indexOf('class InfoBar {');
  for (let i = source.indexOf('{', begin); i < source.length; i++) {
    if (source[i] === '{') nesting++;
    else if (source[i] === '}' && --nesting === 0) { end = i + 1; break; }
  }
  vm.runInNewContext(source.slice(begin, end) + '\nthis.InfoBarTest = InfoBar;', sandbox);
  const InfoBar = sandbox.InfoBarTest;
  InfoBar.infoDefinitionElement = {};
  InfoBar.cmInfoDef = { setValue: value => values.push(value) };
  InfoBar.infoDE = { html() {} };
  InfoBar.update();
  assert.equal(values.at(-1), 'Criminals = 0 | Unit: Unitless');
});

test('Unsupported-browser notice explicitly overrides inherited nowrap and monospace styling', () => {
  assert.match(environment, /message\.style\.cssText\s*=\s*'[^']*white-space:normal/);
  assert.match(environment, /help\.style\.cssText\s*=\s*'[^']*white-space:normal/);
  assert.match(environment, /panel\.style\.cssText\s*=\s*'[^']*overflow-wrap:anywhere/);
});
