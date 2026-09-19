'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const distPackage = JSON.parse(read('distribute/package.json'));
const builder = JSON.parse(read('distribute/electron-builder.json'));
const portableBuilder = JSON.parse(read('distribute/electron-builder-portable.json'));

test('release packaging has a minimal pinned npm toolchain', () => {
  assert.deepEqual(distPackage.devDependencies, {
    'electron-builder': '26.16.1'
  });
  assert.equal(distPackage.dependencies, undefined);
  assert.equal(distPackage.engines.node, '>=22.12.0');
  assert.equal(distPackage.scripts.build, 'node build.js');
  assert.ok(fs.existsSync(path.join(root, 'distribute', 'build.js')));
  assert.equal(fs.existsSync(path.join(root, 'distribute', 'gulpfile.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'OpenSystemDynamics', 'distribute')), false);
});

test('Electron packaging pins the runtime and skips unnecessary native rebuilds', () => {
  for (const config of [builder, portableBuilder]) {
    assert.equal(config.electronVersion, '44.3.0');
    assert.equal(config.npmRebuild, false);
  }
  assert.equal(builder.toolsets.appimage, '1.0.3');
});

test('platform builders do not run npm automatic audit during ordinary installer builds', () => {
  const linuxBuild = read('BUILD_LINUX_APPIMAGE.sh');
  assert.match(linuxBuild, /npm install --no-audit --no-fund/);
  assert.match(linuxBuild, /Node\.js 22\.12 or newer/);
  const windowsBuild = read('BUILD_WINDOWS_INSTALLER.ps1');
  assert.match(windowsBuild, /install --no-audit --no-fund/);
  assert.match(windowsBuild, /22\.12\.0/);
  assert.match(read('distribute/build.sh'), /npm install --no-audit --no-fund/);
});
