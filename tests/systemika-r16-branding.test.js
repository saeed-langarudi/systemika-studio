'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Systemika exposes a capitalized user-facing product name while keeping the npm id lowercase', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.name, 'systemika');
  assert.equal(pkg.productName, 'Systemika Studio');
  assert.match(read('electron/main.js'), /app\.setName\(["']Systemika Studio["']\)/);
});

test('desktop packagers use the Systemika logo assets', () => {
  const builder = read('distribute/electron-builder.json');
  assert.match(builder, /systemika\.ico/);
  assert.match(builder, /systemika\.icns/);
  assert.match(builder, /systemika\.png/);
  assert.doesNotMatch(builder, /stochsd\.(ico|icns|png)/);
});

test('renderer favicons and About artwork use the Systemika logo', () => {
  const editorIndex = read('OpenSystemDynamics/src/index.html');
  const editor = read('OpenSystemDynamics/src/editor.js');
  const analyser = read('MultiSimulationAnalyser/index.html');
  assert.match(editorIndex, /app-icons\/systemika\.png/);
  assert.match(editor, /graphics\/systemika_high\.png/);
  assert.match(analyser, /app-icons\/systemika\.png/);
});

test('required cross-platform Systemika icon assets exist', () => {
  for (const rel of [
    'app-icons/systemika.svg',
    'app-icons/systemika.png',
    'app-icons/systemika-small.png',
    'app-icons/systemika.ico',
    'app-icons/systemika.icns',
    'OpenSystemDynamics/src/graphics/systemika_high.png',
    'MultiSimulationAnalyser/systemika-128.png',
    'MultiSimulationAnalyser/systemika-256.png'
  ]) {
    assert.ok(fs.statSync(path.join(root, rel)).size > 0, `${rel} should exist and be non-empty`);
  }
});
