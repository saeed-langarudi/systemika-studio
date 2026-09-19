'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const version = '1.0.6';

test('web release is rebuilt from current UI source with versioned assets and cache controls', () => {
  const result = spawnSync(process.execPath, ['distribute/build.js'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const web = path.join(root, 'distribute', 'output', 'web', version);
  const read = (rel) => fs.readFileSync(path.join(web, rel), 'utf8');

  assert.ok(fs.existsSync(path.join(web, '.htaccess')));
  assert.match(read('WEB_BUILD_INFO.txt'), /Systemika Studio WebApp 1\.0\.6/);
  assert.match(read('index.html'), /MultiSimulationAnalyser\/index\.html\?v=1\.0\.6/);

  const msaIndex = read('MultiSimulationAnalyser/index.html');
  assert.match(msaIndex, /multisimulationanalyser\.min\.css\?v=1\.0\.6/);
  assert.match(msaIndex, /multisimulationanalyser\.min\.js\?v=1\.0\.6/);
  assert.match(
    read('MultiSimulationAnalyser/multisimulationanalyser.min.js'),
    /OpenSystemDynamics\/src\/index\.html\?v=1\.0\.6/
  );

  const editorIndex = read('OpenSystemDynamics/src/index.html');
  assert.match(editorIndex, /opensystemdynamics\.min\.js\?v=1\.0\.6/);
  assert.match(editorIndex, /opensystemdynamics\.css\?v=1\.0\.6/);

  // The generated WebApp must include the current Output-panel implementation,
  // not a stale prebuilt editor bundle from an older release.
  const editorBundle = read('OpenSystemDynamics/src/opensystemdynamics.min.js');
  const editorCss = read('OpenSystemDynamics/src/opensystemdynamics.css');
  assert.match(editorBundle, /Export plotted data as CSV/);
  assert.match(editorIndex, /id="systemika-output-actions" class="systemika-output-actions"/);
  assert.match(editorCss, /Systemika 1\.0\.5 output-panel geometry/);
  assert.match(editorCss, /--systemika-setting-box-width:\s*360px/);
});
