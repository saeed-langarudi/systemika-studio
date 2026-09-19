'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const editor = fs.readFileSync(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');

test('Advance snapshots partial run data before notifying displays', () => {
  const start = editor.indexOf('static stepSimulation()');
  const end = editor.indexOf('static setProgressStatus', start);
  const body = editor.slice(start, end);
  const pauseCapture = body.indexOf('SystemikaRunManager.captureLiveRun()');
  const pauseNotify = body.indexOf('this.triggerRunFinished()', pauseCapture);
  assert.ok(pauseCapture >= 0, 'Advance must capture live run data');
  assert.ok(pauseNotify > pauseCapture, 'Advance must notify displays after capturing live data');
  assert.match(body, /onPause:[\s\S]*captureLiveRun\(\)[\s\S]*triggerRunFinished\(\)/);
});
