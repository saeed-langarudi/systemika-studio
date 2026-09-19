'use strict';

/*
 * Persistent Systemika simulation runs.
 *
 * Each .sysrun file is a standard ZIP archive containing:
 *   - data.csv
 *   - metadata.json
 *
 * The implementation deliberately uses only Node.js built-ins so the desktop
 * application does not gain another runtime dependency.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const deflateRaw = promisify(zlib.deflateRaw);
const inflateRaw = promisify(zlib.inflateRaw);

const RUNS_DIR_NAME = 'Runs';
const RUN_EXTENSION = '.sysrun';
const FORMAT_VERSION = 1;
const MAX_RUN_FILENAME_LENGTH = 120;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function sanitizeRunLabel(input) {
  let label = String(input == null ? '' : input).trim();
  if (!label) label = 'Base';

  label = label.replace(/[\u0000-\u001f\u007f]/g, '');
  let filename = label.replace(/[<>:"/\\|?*]/g, '_');
  filename = filename.replace(/[. ]+$/g, '').trim();
  if (!filename) filename = 'Base';
  if (WINDOWS_RESERVED.test(filename)) filename = `_${filename}`;

  if (filename.length > MAX_RUN_FILENAME_LENGTH) {
    filename = filename.slice(0, MAX_RUN_FILENAME_LENGTH).replace(/[. ]+$/g, '');
  }

  return { label, filename };
}

function assertSavedModelPath(modelPath) {
  if (!modelPath || typeof modelPath !== 'string') {
    const error = new Error('The model must be saved before a simulation run can be stored.');
    error.code = 'MODEL_NOT_SAVED';
    throw error;
  }
  return path.resolve(modelPath);
}

function runsDirectoryForModel(modelPath) {
  return path.join(path.dirname(assertSavedModelPath(modelPath)), RUNS_DIR_NAME);
}

function runPathForModel(modelPath, runLabel) {
  const { filename } = sanitizeRunLabel(runLabel);
  return path.join(runsDirectoryForModel(modelPath), `${filename}${RUN_EXTENSION}`);
}

async function ensureRunsDirectory(modelPath) {
  const dir = runsDirectoryForModel(modelPath);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function runExists(modelPath, runLabel) {
  const filePath = runPathForModel(modelPath, runLabel);
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
  const year = Math.max(1980, date.getFullYear());
  const dosTime = ((date.getHours() & 0x1f) << 11)
    | ((date.getMinutes() & 0x3f) << 5)
    | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9)
    | (((date.getMonth() + 1) & 0x0f) << 5)
    | (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

async function makeZip(entries) {
  const now = new Date();
  const { dosTime, dosDate } = dosDateTime(now);
  const prepared = await Promise.all(entries.map(async (entry) => {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const compressed = await deflateRaw(dataBuffer, { level: 9 });
    return { nameBuffer, dataBuffer, compressed, crc: crc32(dataBuffer) };
  }));

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of prepared) {
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(entry.crc, 14);
    local.writeUInt32LE(entry.compressed.length, 18);
    local.writeUInt32LE(entry.dataBuffer.length, 22);
    local.writeUInt16LE(entry.nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, entry.nameBuffer, entry.compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(entry.compressed.length, 20);
    central.writeUInt32LE(entry.dataBuffer.length, 24);
    central.writeUInt16LE(entry.nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, entry.nameBuffer);

    offset += local.length + entry.nameBuffer.length + entry.compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('Invalid .sysrun package: ZIP end record not found.');
}

async function readZip(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  let cursor = centralOffset;
  const files = new Map();

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Invalid .sysrun package: corrupt central directory.');
    }

    const method = buffer.readUInt16LE(cursor + 10);
    const expectedCrc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.slice(cursor + 46, cursor + 46 + nameLength).toString('utf8');

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Invalid .sysrun package: corrupt local entry for ${name}.`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);

    let data;
    if (method === 8) data = await inflateRaw(compressed);
    else if (method === 0) data = compressed;
    else throw new Error(`Unsupported compression method ${method} in .sysrun package.`);

    if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) {
      throw new Error(`Invalid .sysrun package: checksum failed for ${name}.`);
    }
    files.set(name, data);

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

function normalizeMetadata(metadata, label) {
  return {
    ...(metadata || {}),
    formatVersion: FORMAT_VERSION,
    application: 'Systemika',
    runName: label,
    created: (metadata && metadata.created) || new Date().toISOString(),
  };
}

async function atomicReplace(targetPath, data, overwrite) {
  const dir = path.dirname(targetPath);
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tempPath = path.join(dir, `.${path.basename(targetPath)}.${token}.tmp`);
  const backupPath = path.join(dir, `.${path.basename(targetPath)}.${token}.bak`);
  let backedUp = false;

  await fsp.writeFile(tempPath, data, { flag: 'wx' });
  try {
    if (overwrite) {
      try {
        await fsp.rename(targetPath, backupPath);
        backedUp = true;
      } catch (error) {
        if (!error || error.code !== 'ENOENT') throw error;
      }
    }

    await fsp.rename(tempPath, targetPath);
    if (backedUp) await fsp.unlink(backupPath).catch(() => {});
  } catch (error) {
    await fsp.unlink(tempPath).catch(() => {});
    if (backedUp) await fsp.rename(backupPath, targetPath).catch(() => {});
    throw error;
  }
}

async function writeRunPackage({ modelPath, runLabel = 'Base', csv, metadata = {}, overwrite = false }) {
  if (typeof csv !== 'string') throw new TypeError('csv must be a string.');

  const { label, filename } = sanitizeRunLabel(runLabel);
  await ensureRunsDirectory(modelPath);
  const targetPath = path.join(runsDirectoryForModel(modelPath), `${filename}${RUN_EXTENSION}`);

  if (!overwrite && await runExists(modelPath, label)) {
    const error = new Error(`A simulation run named "${label}" already exists.`);
    error.code = 'RUN_EXISTS';
    error.runName = label;
    error.path = targetPath;
    throw error;
  }

  const normalizedMetadata = normalizeMetadata(metadata, label);
  const archive = await makeZip([
    { name: 'data.csv', data: csv },
    { name: 'metadata.json', data: `${JSON.stringify(normalizedMetadata, null, 2)}\n` },
  ]);

  await atomicReplace(targetPath, archive, overwrite);

  return {
    runName: label,
    filename: `${filename}${RUN_EXTENSION}`,
    path: targetPath,
    metadata: normalizedMetadata,
    bytes: archive.length,
  };
}

async function readRunPackage({ modelPath, runLabel }) {
  const filePath = runPathForModel(modelPath, runLabel);
  const files = await readZip(await fsp.readFile(filePath));
  const csvBuffer = files.get('data.csv');
  const metadataBuffer = files.get('metadata.json');
  if (!csvBuffer || !metadataBuffer) {
    throw new Error('Invalid .sysrun package: data.csv or metadata.json is missing.');
  }

  let metadata;
  try {
    metadata = JSON.parse(metadataBuffer.toString('utf8'));
  } catch (error) {
    throw new Error(`Invalid .sysrun package: metadata.json is not valid JSON (${error.message}).`);
  }

  const requested = sanitizeRunLabel(runLabel);
  const storedName = metadata && metadata.runName ? String(metadata.runName) : requested.label;
  const storedFilename = sanitizeRunLabel(storedName).filename;
  const effectiveRunName = storedFilename === requested.filename ? storedName : requested.label;
  const effectiveMetadata = { ...metadata, runName: effectiveRunName };
  if (effectiveRunName !== storedName) effectiveMetadata.originalRunName = storedName;

  return { path: filePath, csv: csvBuffer.toString('utf8'), metadata: effectiveMetadata };
}

async function listRuns(modelPath) {
  const dir = await ensureRunsDirectory(modelPath);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(RUN_EXTENSION)) continue;
    const filePath = path.join(dir, entry.name);
    const stat = await fsp.stat(filePath);
    result.push({
      filename: entry.name,
      runName: entry.name.slice(0, -RUN_EXTENSION.length),
      modified: stat.mtime.toISOString(),
      bytes: stat.size,
    });
  }

  result.sort((a, b) => String(b.modified).localeCompare(String(a.modified)));
  return result;
}

async function duplicateRun(modelPath, sourceLabel, targetLabel) {
  const source = await readRunPackage({ modelPath, runLabel: sourceLabel });
  const metadata = {
    ...(source.metadata || {}),
    runName: String(targetLabel || 'Copy'),
    duplicatedFrom: String(sourceLabel || ''),
    created: new Date().toISOString(),
  };
  return writeRunPackage({
    modelPath,
    runLabel: targetLabel,
    csv: source.csv,
    metadata,
    overwrite: false,
  });
}

async function renameRun(modelPath, sourceLabel, targetLabel) {
  const sourcePath = runPathForModel(modelPath, sourceLabel);
  const target = sanitizeRunLabel(targetLabel);
  const targetPath = runPathForModel(modelPath, target.label);

  if (path.resolve(sourcePath) === path.resolve(targetPath)) {
    return { runName: target.label, filename: path.basename(targetPath), path: targetPath };
  }
  if (await runExists(modelPath, target.label)) {
    const error = new Error(`A simulation run named "${target.label}" already exists.`);
    error.code = 'RUN_EXISTS';
    throw error;
  }

  const source = await readRunPackage({ modelPath, runLabel: sourceLabel });
  await writeRunPackage({
    modelPath,
    runLabel: target.label,
    csv: source.csv,
    metadata: { ...(source.metadata || {}), runName: target.label, renamedFrom: String(sourceLabel || '') },
    overwrite: false,
  });
  await fsp.unlink(sourcePath);
  return { runName: target.label, filename: path.basename(targetPath), path: targetPath };
}

async function deleteRun(modelPath, runLabel) {
  const filePath = runPathForModel(modelPath, runLabel);
  try {
    await fsp.unlink(filePath);
    return { deleted: true, runName: String(runLabel || ''), path: filePath };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { deleted: false, runName: String(runLabel || ''), path: filePath };
    throw error;
  }
}

module.exports = {
  RUNS_DIR_NAME,
  RUN_EXTENSION,
  FORMAT_VERSION,
  sanitizeRunLabel,
  assertSavedModelPath,
  runsDirectoryForModel,
  runPathForModel,
  ensureRunsDirectory,
  runExists,
  writeRunPackage,
  readRunPackage,
  listRuns,
  duplicateRun,
  renameRun,
  deleteRun,
  _internal: { crc32, makeZip, readZip },
};
