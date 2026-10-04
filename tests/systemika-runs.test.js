'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const runStore = require('../electron/systemika-run-package');

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'systemika-runs-'));
  const modelPath = path.join(dir, 'Model.ssd');
  await fs.writeFile(modelPath, '<model/>', 'utf8');
  return { dir, modelPath };
}

test('creates Runs beside the model and round-trips a .sysrun', async () => {
  const { modelPath } = await fixture();
  const csv = 'Time,Population,Rate\r\n0,1000,0.02\r\n1,1020,0.02\r\n';
  const saved = await runStore.writeRunPackage({
    modelPath,
    runLabel: 'Base',
    csv,
    metadata: { simulation: { timeStep: 1 } },
  });

  assert.equal(path.basename(path.dirname(saved.path)), 'Runs');
  assert.equal(path.basename(saved.path), 'Base.sysrun');

  const loaded = await runStore.readRunPackage({ modelPath, runLabel: 'Base' });
  assert.equal(loaded.csv, csv);
  assert.equal(loaded.metadata.application, 'Systemika');
  assert.equal(loaded.metadata.formatVersion, 1);
  assert.equal(loaded.metadata.runName, 'Base');
});

test('requires explicit overwrite for an existing label', async () => {
  const { modelPath } = await fixture();
  await runStore.writeRunPackage({ modelPath, runLabel: 'Base', csv: 'Time,X\r\n0,1\r\n' });
  await assert.rejects(
    runStore.writeRunPackage({ modelPath, runLabel: 'Base', csv: 'Time,X\r\n0,2\r\n' }),
    (error) => error.code === 'RUN_EXISTS'
  );

  await runStore.writeRunPackage({
    modelPath,
    runLabel: 'Base',
    csv: 'Time,X\r\n0,2\r\n',
    overwrite: true,
  });
  const loaded = await runStore.readRunPackage({ modelPath, runLabel: 'Base' });
  assert.match(loaded.csv, /0,2/);
});

test('sanitizes filenames while preserving the human label in metadata', async () => {
  const { modelPath } = await fixture();
  const saved = await runStore.writeRunPackage({
    modelPath,
    runLabel: 'Policy: High/Low',
    csv: 'Time,X\r\n0,1\r\n',
  });
  assert.equal(saved.filename, 'Policy_ High_Low.sysrun');
  assert.equal(saved.metadata.runName, 'Policy: High/Low');
});

test('recognizes an externally renamed run by its new filename', async () => {
  const { dir, modelPath } = await fixture();
  await runStore.writeRunPackage({ modelPath, runLabel: 'Base', csv: 'Time,X\r\n0,1\r\n' });
  await fs.rename(
    path.join(dir, 'Runs', 'Base.sysrun'),
    path.join(dir, 'Runs', 'Baseline.sysrun')
  );
  const loaded = await runStore.readRunPackage({ modelPath, runLabel: 'Baseline' });
  assert.equal(loaded.metadata.runName, 'Baseline');
  assert.equal(loaded.metadata.originalRunName, 'Base');
});


test('metadata patches use a lightweight sidecar and merge on load without rewriting the sysrun archive', async () => {
  const { dir, modelPath } = await fixture();
  await runStore.writeRunPackage({ modelPath, runLabel: 'Calibration', csv: 'Time,X\r\n0,1\r\n' });
  const runPath = path.join(dir, 'Runs', 'Calibration.sysrun');
  const before = await fs.stat(runPath);
  const beforeBytes = await fs.readFile(runPath);

  const saved = await runStore.updateRunMetadata({
    modelPath,
    runLabel: 'Calibration',
    patch: { calibrationSandbox: { version: 1, panelWidth: 444 } },
  });

  assert.match(path.basename(saved.path), /Calibration\.sysrun\.metadata\.json$/);
  const after = await fs.stat(runPath);
  const afterBytes = await fs.readFile(runPath);
  assert.equal(after.size, before.size);
  assert.deepEqual(afterBytes, beforeBytes);

  const loaded = await runStore.readRunPackage({ modelPath, runLabel: 'Calibration' });
  assert.equal(loaded.metadata.calibrationSandbox.panelWidth, 444);

  await runStore.writeRunPackage({ modelPath, runLabel: 'Calibration', csv: 'Time,X\r\n0,2\r\n', overwrite: true });
  await assert.rejects(fs.access(saved.path), error => error && error.code === 'ENOENT');
});
