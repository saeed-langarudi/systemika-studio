'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const distPackage = JSON.parse(read('build/package.json'));
const builder = JSON.parse(read('build/electron-builder.json'));
const portableBuilder = JSON.parse(read('build/electron-builder-portable.json'));

test('release packaging has a minimal pinned npm toolchain', () => {
  assert.deepEqual(distPackage.devDependencies, {
    'electron-builder': '26.16.1'
  });
  assert.equal(distPackage.dependencies, undefined);
  assert.equal(distPackage.engines.node, '>=22.12.0');
  assert.equal(distPackage.scripts.build, 'node build.js');
  assert.ok(fs.existsSync(path.join(root, 'build', 'build.js')));
  assert.equal(fs.existsSync(path.join(root, 'build', 'gulpfile.js')), false);
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
  const windowsBuild = read('build/windows-installer.ps1');
  assert.match(windowsBuild, /install --no-audit --no-fund/);
  assert.match(windowsBuild, /22\.12\.0/);
  assert.match(read('build/build.sh'), /npm install --no-audit --no-fund/);
  const webLinux = read('BUILD_WEBAPP_LINUX.sh');
  const webWindows = read('BUILD_WEBAPP_WINDOWS.bat');
  assert.match(webLinux, /node build\/build\.js/);
  assert.match(webWindows, /node build\\build\.js/);
  assert.match(webLinux, /build\/output\/web\/\$VERSION/);
  assert.match(webWindows, /build\\output\\web\\%VER%/);
});
