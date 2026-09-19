const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const launcher = fs.readFileSync(path.join(__dirname, '..', 'desktop-launcher', 'windows', 'main.go'), 'utf8');

test('Windows launcher repairs installation and shortcuts before reusing an existing session', () => {
  const findPos = launcher.indexOf('existingURL := findExisting()');
  const installPos = launcher.indexOf('ensureInstalled(existingURL != "")');
  const reusePos = launcher.indexOf('if existingURL != ""');
  assert.ok(findPos >= 0, 'existing-session probe should be present');
  assert.ok(installPos > findPos, 'installation should follow the probe');
  assert.ok(reusePos > installPos, 'existing-session reuse must happen only after installation/shortcut repair');
});

test('Windows launcher verifies both shortcuts after creation', () => {
  assert.match(launcher, /desktopShortcut := strings\.TrimSpace/);
  assert.match(launcher, /startShortcut := strings\.TrimSpace/);
  assert.match(launcher, /os\.Stat\(shortcut\)/);
  assert.match(launcher, /shortcut was not created at/);
});


test('Windows embedded server avoids FileServer index redirect loops', () => {
  assert.doesNotMatch(launcher, /http\.FileServer\(/);
  assert.match(launcher, /func serveEmbeddedFile/);
  assert.match(launcher, /fs\.ReadFile\(appFS, clean\)/);
  assert.match(launcher, /http\.ServeContent/);
});

test('desktop analyser sends launcher heartbeat', () => {
  const analyser = fs.readFileSync(path.join(__dirname, '..', 'MultiSimulationAnalyser', 'index.html'), 'utf8');
  assert.match(analyser, /\/__systemika_ping/);
  assert.match(analyser, /setInterval\(ping, 30000\)/);
});


test('Windows installed launcher filename is versioned so a locked older release cannot block updates', () => {
  assert.match(launcher, /Systemika Studio "\+version\+"\.exe/);
  assert.match(launcher, /Systemika Studio\.lnk/);
});
