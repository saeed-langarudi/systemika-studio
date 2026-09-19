'use strict';

/*
 * Browser filesystem implementation of Systemika's persistent run store.
 *
 * The desktop application stores each run as Runs/<name>.sysrun beside the
 * current .ssd model. Modern browsers cannot infer a file's parent directory
 * from a FileSystemFileHandle, so WebFileManagerModern asks the user once for
 * the model's project directory and remembers that directory handle in
 * IndexedDB. This module then uses the exact same relative Runs/ layout.
 *
 * A .sysrun file is a standard ZIP archive containing:
 *   - data.csv
 *   - metadata.json
 *
 * Browser-created archives use ZIP's STORE method (no compression). The
 * desktop reader already supports STORE as well as DEFLATE. This reader also
 * supports desktop-created DEFLATE packages through DecompressionStream.
 */
(function attachSystemikaBrowserRunStore(root) {
  const RUNS_DIR_NAME = 'Runs';
  const RUN_EXTENSION = '.sysrun';
  const FORMAT_VERSION = 1;
  const MAX_RUN_FILENAME_LENGTH = 120;
  const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder('utf-8');

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

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
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

  function writeU16(view, offset, value) { view.setUint16(offset, value, true); }
  function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

  function concatBytes(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  function toBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return textEncoder.encode(String(value));
  }

  // Produces a standards-compliant ZIP using method 0 (STORE). Keeping browser
  // writes uncompressed avoids an extra dependency while preserving full
  // interoperability with electron/systemika-run-package.js.
  async function makeZip(entries) {
    const { dosTime, dosDate } = dosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const rawEntry of entries) {
      const nameBytes = textEncoder.encode(rawEntry.name);
      const dataBytes = toBytes(rawEntry.data);
      const checksum = crc32(dataBytes);

      const local = new Uint8Array(30);
      const localView = new DataView(local.buffer);
      writeU32(localView, 0, 0x04034b50);
      writeU16(localView, 4, 20);
      writeU16(localView, 6, 0x0800); // UTF-8 names
      writeU16(localView, 8, 0);      // STORE
      writeU16(localView, 10, dosTime);
      writeU16(localView, 12, dosDate);
      writeU32(localView, 14, checksum);
      writeU32(localView, 18, dataBytes.length);
      writeU32(localView, 22, dataBytes.length);
      writeU16(localView, 26, nameBytes.length);
      writeU16(localView, 28, 0);
      localParts.push(local, nameBytes, dataBytes);

      const central = new Uint8Array(46);
      const centralView = new DataView(central.buffer);
      writeU32(centralView, 0, 0x02014b50);
      writeU16(centralView, 4, 20);
      writeU16(centralView, 6, 20);
      writeU16(centralView, 8, 0x0800);
      writeU16(centralView, 10, 0);
      writeU16(centralView, 12, dosTime);
      writeU16(centralView, 14, dosDate);
      writeU32(centralView, 16, checksum);
      writeU32(centralView, 20, dataBytes.length);
      writeU32(centralView, 24, dataBytes.length);
      writeU16(centralView, 28, nameBytes.length);
      writeU16(centralView, 30, 0);
      writeU16(centralView, 32, 0);
      writeU16(centralView, 34, 0);
      writeU16(centralView, 36, 0);
      writeU32(centralView, 38, 0);
      writeU32(centralView, 42, offset);
      centralParts.push(central, nameBytes);

      offset += local.length + nameBytes.length + dataBytes.length;
    }

    const centralDirectory = concatBytes(centralParts);
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    writeU32(eocdView, 0, 0x06054b50);
    writeU16(eocdView, 4, 0);
    writeU16(eocdView, 6, 0);
    writeU16(eocdView, 8, entries.length);
    writeU16(eocdView, 10, entries.length);
    writeU32(eocdView, 12, centralDirectory.length);
    writeU32(eocdView, 16, offset);
    writeU16(eocdView, 20, 0);
    return concatBytes([...localParts, centralDirectory, eocd]);
  }

  function assertRange(bytes, offset, length, message) {
    if (offset < 0 || length < 0 || offset + length > bytes.length) {
      throw new Error(message || 'Invalid .sysrun package: ZIP entry is out of range.');
    }
  }

  function readU16(view, offset) { return view.getUint16(offset, true); }
  function readU32(view, offset) { return view.getUint32(offset, true); }

  function findEndOfCentralDirectory(bytes) {
    if (bytes.length < 22) throw new Error('Invalid .sysrun package: ZIP is too small.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const min = Math.max(0, bytes.length - 22 - 0xffff);
    for (let i = bytes.length - 22; i >= min; i -= 1) {
      if (readU32(view, i) === 0x06054b50) return i;
    }
    throw new Error('Invalid .sysrun package: ZIP end record not found.');
  }

  async function inflateRaw(bytes) {
    if (typeof root.DecompressionStream !== 'function') {
      throw new Error('This browser cannot read compressed .sysrun files. DecompressionStream support is required.');
    }
    let stream;
    try {
      stream = new root.DecompressionStream('deflate-raw');
    } catch (error) {
      throw new Error(`This browser cannot read compressed .sysrun files (${error.message || error}).`);
    }
    const output = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(output).arrayBuffer());
  }

  async function readZip(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocdOffset = findEndOfCentralDirectory(bytes);
    const entryCount = readU16(view, eocdOffset + 10);
    const centralOffset = readU32(view, eocdOffset + 16);
    let cursor = centralOffset;
    const files = new Map();

    for (let i = 0; i < entryCount; i += 1) {
      assertRange(bytes, cursor, 46, 'Invalid .sysrun package: corrupt central directory.');
      if (readU32(view, cursor) !== 0x02014b50) {
        throw new Error('Invalid .sysrun package: corrupt central directory.');
      }

      const method = readU16(view, cursor + 10);
      const expectedCrc = readU32(view, cursor + 16);
      const compressedSize = readU32(view, cursor + 20);
      const uncompressedSize = readU32(view, cursor + 24);
      const nameLength = readU16(view, cursor + 28);
      const extraLength = readU16(view, cursor + 30);
      const commentLength = readU16(view, cursor + 32);
      const localOffset = readU32(view, cursor + 42);
      assertRange(bytes, cursor + 46, nameLength + extraLength + commentLength, 'Invalid .sysrun package: corrupt central entry.');
      const name = textDecoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));

      assertRange(bytes, localOffset, 30, `Invalid .sysrun package: corrupt local entry for ${name}.`);
      if (readU32(view, localOffset) !== 0x04034b50) {
        throw new Error(`Invalid .sysrun package: corrupt local entry for ${name}.`);
      }
      const localNameLength = readU16(view, localOffset + 26);
      const localExtraLength = readU16(view, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      assertRange(bytes, dataStart, compressedSize, `Invalid .sysrun package: truncated data for ${name}.`);
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);

      let data;
      if (method === 0) data = compressed;
      else if (method === 8) data = await inflateRaw(compressed);
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

  function notFound(error) {
    return Boolean(error && (error.name === 'NotFoundError' || error.code === 'ENOENT'));
  }

  function currentFileManager() {
    try {
      if (typeof fileManager !== 'undefined') return fileManager;
    } catch (_) {}
    return root.fileManager || null;
  }

  let rawDeflateSupport;
  function supportsRawDeflate() {
    if (rawDeflateSupport !== undefined) return rawDeflateSupport;
    if (typeof root.DecompressionStream !== 'function') return (rawDeflateSupport = false);
    try {
      // Full desktop/web interoperability requires reading the DEFLATE method
      // used by electron/systemika-run-package.js.
      new root.DecompressionStream('deflate-raw');
      rawDeflateSupport = true;
    } catch (_) {
      rawDeflateSupport = false;
    }
    return rawDeflateSupport;
  }

  function isSupported() {
    const manager = currentFileManager();
    // Filesystem persistence itself does not depend on DEFLATE support. New
    // browser-created packages use the ZIP STORE method, so save/list/rename/
    // duplicate/delete must remain available even if an older browser cannot
    // decompress a desktop-created package. A clear error is raised only when
    // such a compressed package is actually loaded.
    return Boolean(manager
      && typeof manager.supportsProjectRunStorage === 'function'
      && manager.supportsProjectRunStorage());
  }

  function isReady() {
    const manager = currentFileManager();
    return Boolean(isSupported()
      && manager
      && manager.fileName
      && typeof manager.getRunStorageDirectoryHandle === 'function'
      && manager.getRunStorageDirectoryHandle());
  }

  async function ensureAccess() {
    const manager = currentFileManager();
    if (!manager || typeof manager.ensureRunStorageAccess !== 'function' || !isSupported()) {
      const error = new Error('Project-local run storage is unavailable in this browser.');
      error.code = 'RUN_STORAGE_UNAVAILABLE';
      throw error;
    }
    return manager.ensureRunStorageAccess();
  }

  async function projectDirectory() {
    const manager = currentFileManager();
    const handle = manager && typeof manager.getRunStorageDirectoryHandle === 'function'
      ? manager.getRunStorageDirectoryHandle()
      : null;
    if (!handle) {
      const error = new Error('The model project folder is not connected. Run the model or choose Manage Runs to authorize its folder.');
      error.code = 'PROJECT_DIRECTORY_NOT_CONNECTED';
      throw error;
    }
    return handle;
  }

  async function runsDirectory(create = true) {
    const project = await projectDirectory();
    try {
      return await project.getDirectoryHandle(RUNS_DIR_NAME, { create });
    } catch (error) {
      if (!create && notFound(error)) return null;
      throw error;
    }
  }

  function runFilename(runLabel) {
    return `${sanitizeRunLabel(runLabel).filename}${RUN_EXTENSION}`;
  }

  async function getRunFileHandle(runLabel, create = false) {
    const dir = await runsDirectory(create);
    if (!dir) return null;
    try {
      return await dir.getFileHandle(runFilename(runLabel), { create });
    } catch (error) {
      if (!create && notFound(error)) return null;
      throw error;
    }
  }

  async function runExists(_modelPath, runLabel) {
    return Boolean(await getRunFileHandle(runLabel, false));
  }

  async function writeRunPackage(_modelPath, payload) {
    payload = payload || {};
    if (typeof payload.csv !== 'string') throw new TypeError('csv must be a string.');

    const { label, filename } = sanitizeRunLabel(payload.runLabel || 'Base');
    const name = `${filename}${RUN_EXTENSION}`;
    if (!payload.overwrite && await runExists(_modelPath, label)) {
      const error = new Error(`A simulation run named "${label}" already exists.`);
      error.code = 'RUN_EXISTS';
      error.runName = label;
      error.path = `${RUNS_DIR_NAME}/${name}`;
      throw error;
    }

    const normalizedMetadata = normalizeMetadata(payload.metadata || {}, label);
    const archive = await makeZip([
      { name: 'data.csv', data: payload.csv },
      { name: 'metadata.json', data: `${JSON.stringify(normalizedMetadata, null, 2)}\n` },
    ]);

    const handle = await getRunFileHandle(label, true);
    const writable = await handle.createWritable();
    try {
      await writable.write(archive);
      await writable.close();
    } catch (error) {
      try { await writable.abort(); } catch (_) {}
      throw error;
    }

    return {
      runName: label,
      filename: name,
      path: `${RUNS_DIR_NAME}/${name}`,
      metadata: normalizedMetadata,
      bytes: archive.length,
    };
  }

  async function readRunPackage(_modelPath, runLabel) {
    const handle = await getRunFileHandle(runLabel, false);
    if (!handle) {
      const error = new Error(`Simulation run "${runLabel}" was not found.`);
      error.code = 'ENOENT';
      throw error;
    }
    const file = await handle.getFile();
    const files = await readZip(await file.arrayBuffer());
    const csvBytes = files.get('data.csv');
    const metadataBytes = files.get('metadata.json');
    if (!csvBytes || !metadataBytes) {
      throw new Error('Invalid .sysrun package: data.csv or metadata.json is missing.');
    }

    let metadata;
    try {
      metadata = JSON.parse(textDecoder.decode(metadataBytes));
    } catch (error) {
      throw new Error(`Invalid .sysrun package: metadata.json is not valid JSON (${error.message}).`);
    }

    const requested = sanitizeRunLabel(runLabel);
    const storedName = metadata && metadata.runName ? String(metadata.runName) : requested.label;
    const storedFilename = sanitizeRunLabel(storedName).filename;
    const effectiveRunName = storedFilename === requested.filename ? storedName : requested.label;
    const effectiveMetadata = { ...metadata, runName: effectiveRunName };
    if (effectiveRunName !== storedName) effectiveMetadata.originalRunName = storedName;

    return {
      path: `${RUNS_DIR_NAME}/${runFilename(runLabel)}`,
      csv: textDecoder.decode(csvBytes),
      metadata: effectiveMetadata,
    };
  }

  async function listRuns(_modelPath) {
    const dir = await runsDirectory(true);
    const result = [];
    for await (const [name, handle] of dir.entries()) {
      if (!handle || handle.kind !== 'file' || !name.toLowerCase().endsWith(RUN_EXTENSION)) continue;
      const file = await handle.getFile();
      result.push({
        filename: name,
        runName: name.slice(0, -RUN_EXTENSION.length),
        modified: new Date(file.lastModified).toISOString(),
        bytes: file.size,
      });
    }
    result.sort((a, b) => String(b.modified).localeCompare(String(a.modified)));
    return result;
  }

  async function duplicateRun(modelPath, sourceLabel, targetLabel) {
    const source = await readRunPackage(modelPath, sourceLabel);
    return writeRunPackage(modelPath, {
      runLabel: targetLabel,
      csv: source.csv,
      metadata: {
        ...(source.metadata || {}),
        runName: String(targetLabel || 'Copy'),
        duplicatedFrom: String(sourceLabel || ''),
        created: new Date().toISOString(),
      },
      overwrite: false,
    });
  }

  async function renameRun(modelPath, sourceLabel, targetLabel) {
    const sourceName = runFilename(sourceLabel);
    const target = sanitizeRunLabel(targetLabel);
    const targetName = `${target.filename}${RUN_EXTENSION}`;
    if (sourceName === targetName) {
      return { runName: target.label, filename: targetName, path: `${RUNS_DIR_NAME}/${targetName}` };
    }
    if (await runExists(modelPath, target.label)) {
      const error = new Error(`A simulation run named "${target.label}" already exists.`);
      error.code = 'RUN_EXISTS';
      throw error;
    }

    const source = await readRunPackage(modelPath, sourceLabel);
    await writeRunPackage(modelPath, {
      runLabel: target.label,
      csv: source.csv,
      metadata: { ...(source.metadata || {}), runName: target.label, renamedFrom: String(sourceLabel || '') },
      overwrite: false,
    });
    const dir = await runsDirectory(false);
    await dir.removeEntry(sourceName);
    return { runName: target.label, filename: targetName, path: `${RUNS_DIR_NAME}/${targetName}` };
  }

  async function deleteRun(_modelPath, runLabel) {
    const dir = await runsDirectory(false);
    const name = runFilename(runLabel);
    if (!dir) return { deleted: false, runName: String(runLabel || ''), path: `${RUNS_DIR_NAME}/${name}` };
    try {
      await dir.removeEntry(name);
      return { deleted: true, runName: String(runLabel || ''), path: `${RUNS_DIR_NAME}/${name}` };
    } catch (error) {
      if (notFound(error)) return { deleted: false, runName: String(runLabel || ''), path: `${RUNS_DIR_NAME}/${name}` };
      throw error;
    }
  }

  async function confirmOverwrite(runLabel) {
    if (typeof root.confirm === 'function') {
      return root.confirm(`A simulation run named "${String(runLabel || 'Base')}" already exists. Overwrite it?`);
    }
    return false;
  }

  const api = {
    isSupported,
    isReady,
    ensureAccess,
    exists: runExists,
    save: writeRunPackage,
    load: readRunPackage,
    list: listRuns,
    rename: renameRun,
    duplicate: duplicateRun,
    delete: deleteRun,
    confirmOverwrite,
  };

  root.systemikaBrowserRuns = api;
  // Expose deterministic archive helpers for the Node regression tests. They
  // are intentionally not used by application code outside this file.
  root.SystemikaBrowserRunStoreInternals = {
    sanitizeRunLabel,
    crc32,
    makeZip,
    readZip,
    normalizeMetadata,
  };
})(window);
