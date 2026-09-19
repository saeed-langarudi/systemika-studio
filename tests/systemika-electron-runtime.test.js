const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const distPackage = JSON.parse(fs.readFileSync(path.join(root, 'distribute', 'package.json'), 'utf8'));
const builderConfig = JSON.parse(fs.readFileSync(path.join(root, 'distribute', 'electron-builder.json'), 'utf8'));
const linuxLauncher = fs.readFileSync(path.join(root, 'run-systemika-linux.sh'), 'utf8');

test('portable source runtime and packaged builds use the same exact Electron 44.3.0 runtime', () => {
  assert.equal(rootPackage.devDependencies.electron, '44.3.0');
  assert.equal(builderConfig.electronVersion, '44.3.0');
  assert.equal(distPackage.devDependencies.electron, undefined);
});

test('Linux source launcher replaces a stale Electron runtime instead of silently reusing it', () => {
  assert.match(linuxLauncher, /REQUIRED_ELECTRON_VERSION=.*devDependencies\.electron/);
  assert.match(linuxLauncher, /INSTALLED_ELECTRON_VERSION/);
  assert.match(linuxLauncher, /"\$INSTALLED_ELECTRON_VERSION" != "\$REQUIRED_ELECTRON_VERSION"/);
  assert.match(linuxLauncher, /npm install --no-audit --no-fund/);
});


test('Electron 44 clipboard bridge uses ClipboardItem instead of removed writeImage helper', () => {
  const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
  assert.match(main, /clipboard, ClipboardItem, nativeImage/);
  assert.match(main, /await clipboard\.write\(\[/);
  assert.match(main, /new ClipboardItem\(/);
  assert.match(main, /"image\/png": new Blob/);
  assert.doesNotMatch(main, /clipboard\.writeImage\(/);
});
