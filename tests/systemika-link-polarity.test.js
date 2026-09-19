const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const entities = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-entities.js'), 'utf8');

test('Link entity stores an explicit optional polarity annotation', () => {
  assert.match(entities, /primitiveBank\.link = createTemplate\("Link", \{[\s\S]{0,220}Polarity: ""/);
});

test('double-clicking a Link opens the Link Properties dialog', () => {
  assert.match(editor, /class LinkVisual extends BaseConnection[\s\S]{0,9000}\$\(this\.group\)\.dblclick\(\(event\) => \{[\s\S]{0,220}this\.doubleClick\(\)/);
  assert.match(editor, /class LinkVisual extends BaseConnection[\s\S]{0,9000}doubleClick\(\) \{[\s\S]{0,160}linkPropertiesDialog\.open\(this\.id\)/);
});

test('Link Properties allows unspecified positive or negative polarity and persists it', () => {
  assert.match(editor, /class LinkPropertiesDialog extends jqDialog/);
  assert.match(editor, /<option value="">Unspecified<\/option>/);
  assert.match(editor, /<option value="\+">Positive \(\+\)<\/option>/);
  assert.match(editor, /<option value="-">Negative \(−\)<\/option>/);
  assert.match(editor, /this\.primitive\.setAttribute\("Polarity", polarity\)/);
});

test('Link polarity is rendered near the arrowhead and updates with link geometry', () => {
  assert.match(editor, /this\.polarityLabel = SVG\.text/);
  assert.match(editor, /polarity === "\+" \? "\+" : \(polarity === "-" \? "−" : ""\)/);
  assert.match(editor, /this\.updatePolarityLabel\(\)/);
});
