'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'OpenSystemDynamics', 'src');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const entities = fs.readFileSync(path.join(src, 'systemika-entities.js'), 'utf8');
const editor = fs.readFileSync(path.join(src, 'editor.js'), 'utf8');
const preferences = fs.readFileSync(path.join(src, 'preferences.js'), 'utf8');

const oldLocalization = path.join(src, 'insightmaker', 'Localization.js');
const oldVariables = path.join(src, 'insightmaker', 'Variables.js');

test('Systemika owns localization and entity defaults instead of inherited Localization/Variables files', () => {
  assert.match(html, /src="systemika-localization\.js"/);
  assert.match(html, /src="systemika-entities\.js"/);
  assert.doesNotMatch(html, /insightmaker\/Localization\.js/);
  assert.doesNotMatch(html, /insightmaker\/Variables\.js/);
  assert.equal(fs.existsSync(oldLocalization), false);
  assert.equal(fs.existsSync(oldVariables), false);
});

test('canonical Systemika model terminology is declared explicitly', () => {
  for (const term of ['Stock', 'Flow', 'Link', 'Auxiliary', 'Constant', 'Lookup', 'Ghost']) {
    assert.match(entities, new RegExp(`\\b${term}\\b`));
  }
  assert.match(entities, /Auxiliary:\s*"Variable"/);
  assert.match(entities, /Constant:\s*"Variable"/);
  assert.match(entities, /Lookup:\s*"Converter"/);
  assert.match(entities, /name:\s*getText\("New Auxiliary"\)/);
  assert.match(entities, /name:\s*getText\("New Lookup"\)/);
});

test('user-facing editor terminology uses Auxiliary Constant and Lookup rather than Variable Converter or Parameter', () => {
  const documentation = fs.readFileSync(path.join(src, 'systemika-documentation.js'), 'utf8');
  assert.match(documentation, /auxiliary:\s*"Auxiliary"/);
  assert.match(documentation, /constant:\s*"Constant"/);
  assert.match(documentation, /lookup:\s*"Lookup"/);
  assert.match(editor, /"Lookup Help"/);
  assert.match(preferences, /Show Lookup plot preview/);
  assert.doesNotMatch(editor, /Converter Help/);
  assert.doesNotMatch(editor, /Auxiliaries & Parameters/);
  assert.doesNotMatch(preferences, /Show Converter Plot Preview/);
});
