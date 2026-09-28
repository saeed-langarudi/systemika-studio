'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const version = '1.1.4';

test('web release is rebuilt from current UI source with versioned assets and cache controls', () => {
  const result = spawnSync(process.execPath, ['build/build.js'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const web = path.join(root, 'build', 'output', 'web', version);
  const read = (rel) => fs.readFileSync(path.join(web, rel), 'utf8');

  assert.ok(fs.existsSync(path.join(web, '.htaccess')));
  assert.match(read('WEB_BUILD_INFO.txt'), /Systemika Studio WebApp 1\.1\.4/);
  assert.ok(fs.existsSync(path.join(web, 'systemika-update.json')));
  const webManifest = JSON.parse(read('systemika-update.json'));
  assert.equal(webManifest.version, version);
  assert.match(webManifest.buildId, /^[a-f0-9]{12}$/);

  assert.equal(fs.existsSync(path.join(root, 'build', 'output', 'release-metadata')), false);

  const desktopBuildInfo = JSON.parse(fs.readFileSync(path.join(root, 'build', 'output', 'app', 'SYSTEMIKA_BUILD_INFO.json'), 'utf8'));
  assert.equal(desktopBuildInfo.version, version);
  assert.equal(desktopBuildInfo.buildId, webManifest.buildId);
  const launcherIndex = read('index.html');
  assert.match(launcherIndex, /MultiSimulationAnalyser\/index\.html\?v=1\.1\.4&b=[a-f0-9]{12}/);
  assert.match(launcherIndex, /<meta name="systemika-version" content="1\.1\.4">/);
  assert.match(launcherIndex, /<meta name="systemika-build" content="[a-f0-9]{12}">/);

  const msaIndex = read('MultiSimulationAnalyser/index.html');
  assert.match(msaIndex, /multisimulationanalyser\.min\.css\?v=1\.1\.4&b=[a-f0-9]{12}/);
  assert.match(msaIndex, /multisimulationanalyser\.min\.js\?v=1\.1\.4&b=[a-f0-9]{12}/);
  assert.match(
    read('MultiSimulationAnalyser/multisimulationanalyser.min.js'),
    /OpenSystemDynamics\/src\/index\.html\?v=1\.1\.4&b=[a-f0-9]{12}/
  );

  const editorIndex = read('OpenSystemDynamics/src/index.html');
  assert.match(editorIndex, /opensystemdynamics\.min\.js\?v=1\.1\.4&b=[a-f0-9]{12}/);
  assert.match(editorIndex, /opensystemdynamics\.css\?v=1\.1\.4&b=[a-f0-9]{12}/);
  assert.match(editorIndex, /graphics\/link\.svg\?v=1\.1\.4&b=[a-f0-9]{12}/);
  assert.match(editorIndex, /graphics\/find\.svg\?v=1\.1\.4&b=[a-f0-9]{12}/);
  assert.match(editorIndex, /<meta name="systemika-version" content="1\.1\.4">/);
  assert.match(editorIndex, /<meta name="systemika-build" content="[a-f0-9]{12}">/);

  // The generated WebApp must include the current Output-panel implementation,
  // not a stale prebuilt editor bundle from an older release.
  const editorBundle = read('OpenSystemDynamics/src/opensystemdynamics.min.js');
  const editorCss = read('OpenSystemDynamics/src/opensystemdynamics.css');
  assert.match(editorBundle, /Export plotted data as CSV/);
  assert.match(editorIndex, /id="systemika-output-actions" class="systemika-output-actions"/);
  assert.match(editorCss, /Systemika 1\.0\.5 output-panel geometry/);
  assert.match(editorCss, /--systemika-setting-box-width:\s*360px/);
});
