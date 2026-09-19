const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const analyser = fs.readFileSync(path.join(root, 'MultiSimulationAnalyser/index.html'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-engine.js'), 'utf8');

test('blank editor model uses a loader-compatible Systemika model root', () => {
  assert.match(editor, /var blankGraphTemplate = `<SystemikaModel>\s*<root>/);
  assert.match(editor, /<\/root>\s*<\/SystemikaModel>`;\s*loadXML\(blankGraphTemplate\);/);
});

test('early toolbar initialization does not access RunResults while its class binding is in TDZ', () => {
  assert.match(editor, /let runResultsReady = false;/);
  assert.match(editor, /try \{\s*runResultsReady = typeof RunResults !== "undefined";/);
  assert.match(editor, /if \(runResultsReady && RunResults\.isAdvanceActive\(\)/);
});

test('file protocol startup skips unsupported Service Worker registration and 0.8 functions remain enabled', () => {
  assert.match(analyser, /window\.location\.protocol === "http:" \|\| window\.location\.protocol === "https:"/);
  assert.match(engine, /version: "0\.8\.5"/);
  for (const name of ['smooth','delay','lag','randomuniform','randomnormal','randomtriangular','randomgamma','randombeta']) {
    assert.match(engine.toLowerCase(), new RegExp(name));
  }
});
