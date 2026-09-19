'use strict';

/*
 * Renderer-side run data manager. Plot/table code can consume this object
 * without knowing whether the current run came directly from the simulator or
 * from a persisted .sysrun package.
 */
(function attachSystemikaRunDataManager(root) {
  function getRunsAPI() {
    // Use the same Electron bridge as ordinary model Save/Open first. That
    // bridge is already proven to work from the nested editor iframe.
    try {
      if (typeof root.getElectronAPI === 'function') {
        const electron = root.getElectronAPI();
        if (electron && electron.runs) return electron.runs;
      }
    } catch (_) {}
    try {
      if (root.electronAPI && root.electronAPI.runs) return root.electronAPI.runs;
    } catch (_) {}
    try {
      if (root.parent && root.parent !== root && root.parent.electronAPI && root.parent.electronAPI.runs) {
        return root.parent.electronAPI.runs;
      }
    } catch (_) {}
    try {
      if (root.top && root.top.electronAPI && root.top.electronAPI.runs) return root.top.electronAPI.runs;
    } catch (_) {}

    // Modern web builds use the same run-store contract against the local
    // project directory selected through the File System Access API.
    try {
      if (root.systemikaBrowserRuns && (!root.systemikaBrowserRuns.isSupported || root.systemikaBrowserRuns.isSupported())) {
        return root.systemikaBrowserRuns;
      }
    } catch (_) {}
    try {
      if (root.parent && root.parent !== root && root.parent.systemikaBrowserRuns
          && (!root.parent.systemikaBrowserRuns.isSupported || root.parent.systemikaBrowserRuns.isSupported())) {
        return root.parent.systemikaBrowserRuns;
      }
    } catch (_) {}
    try {
      if (root.top && root.top.systemikaBrowserRuns
          && (!root.top.systemikaBrowserRuns.isSupported || root.top.systemikaBrowserRuns.isSupported())) {
        return root.top.systemikaBrowserRuns;
      }
    } catch (_) {}

    // Backward compatibility with the first Systemika prototype.
    if (root.systemikaRuns) return root.systemikaRuns;
    try {
      if (root.parent && root.parent !== root && root.parent.systemikaRuns) return root.parent.systemikaRuns;
    } catch (_) {}
    try {
      if (root.top && root.top.systemikaRuns) return root.top.systemikaRuns;
    } catch (_) {}
    return null;
  }
  function csvEscape(value) {
    if (value == null) return '';
    let text;
    if (typeof value === 'object') {
      try { text = JSON.stringify(value); }
      catch (_) { text = String(value); }
    } else {
      text = String(value);
    }
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (c === '"') {
          quoted = false;
        } else {
          field += c;
        }
      } else if (c === '"') {
        quoted = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }

    if (field.length || row.length) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
    }
    return rows;
  }

  function inferCell(text) {
    if (text === '') return null;
    const n = Number(text);
    if (Number.isFinite(n)) return n;
    if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
      try { return JSON.parse(text); } catch (_) { /* keep as text */ }
    }
    return text;
  }

  class SimulationDataManager {
    constructor() {
      this.currentRun = null;
      this.runCache = new Map();
      this.loadingRuns = new Map();
    }

    modelPath() {
      return typeof fileManager !== 'undefined' && fileManager.fileName ? fileManager.fileName : '';
    }

    persistenceAvailable() {
      const api = getRunsAPI();
      if (!api || !this.modelPath()) return false;
      return typeof api.isReady === 'function' ? Boolean(api.isReady()) : true;
    }

    normalizeRun(run) {
      if (!run || !Array.isArray(run.columns) || !Array.isArray(run.rows)) {
        throw new TypeError('A run must contain columns[] and rows[].');
      }
      const columnCount = run.columns.length;
      for (const row of run.rows) {
        if (!Array.isArray(row) || row.length !== columnCount) {
          throw new Error('Each simulation row must have the same number of values as columns.');
        }
      }
      return {
        runName: String(run.runName || 'Base'),
        columns: run.columns.slice(),
        ids: Array.isArray(run.ids) ? run.ids.map(Number) : [],
        rows: run.rows.map((row) => row.slice()),
        metadata: { ...(run.metadata || {}) },
      };
    }

    setCurrentRun(run) {
      const normalized = this.normalizeRun(run);
      this.currentRun = normalized;
      this.runCache.set(normalized.runName, normalized);
      return normalized;
    }

    cacheRun(run) {
      const normalized = this.normalizeRun(run);
      this.runCache.set(normalized.runName, normalized);
      return normalized;
    }

    clear() {
      // Clear only the transient "current simulation" pointer. Saved runs that
      // have already been loaded remain cached so multiple displays can keep
      // showing different saved runs without rereading the package each time.
      this.currentRun = null;
    }

    discardCurrentRun() {
      const current = this.currentRun;
      if (current && this.runCache.get(current.runName) === current) this.runCache.delete(current.runName);
      this.currentRun = null;
    }

    clearCache() {
      this.currentRun = null;
      this.runCache.clear();
      this.loadingRuns.clear();
    }

    getCurrentRun() { return this.currentRun; }

    getRun(runName) {
      if (!runName) return this.currentRun;
      return this.runCache.get(String(runName)) || null;
    }

    hasRun(runName) {
      return Boolean(this.getRun(runName));
    }

    getAvailableVariables(runName) {
      const run = this.getRun(runName);
      return run ? run.columns.slice() : [];
    }

    getSeries(variableName, runName) {
      const run = this.getRun(runName);
      if (!run) return null;
      const index = run.columns.indexOf(variableName);
      if (index < 0) return null;
      return run.rows.map((row) => row[index]);
    }

    getXYSeries(variableName, timeVariable, runName) {
      const run = this.getRun(runName);
      if (!run) return null;
      const x = this.getSeries(timeVariable || run.columns[0], runName);
      const y = this.getSeries(variableName, runName);
      if (!x || !y) return null;
      return x.map((value, index) => [value, y[index]]);
    }

    getSelectiveIdResults(varIdList, runName) {
      const run = this.getRun(runName);
      if (!run || !Array.isArray(run.ids) || !run.ids.length) return null;
      const wantedIds = varIdList.map(Number);
      const indexes = [0];
      for (const id of wantedIds) indexes.push(run.ids.indexOf(id));
      return run.rows.map((row) => indexes.map((index) => index === -1 ? null : row[index]));
    }

    getRunTimeStep(runName) {
      const run = this.getRun(runName);
      const value = run && run.metadata && run.metadata.simulation ? run.metadata.simulation.timeStep : null;
      return value == null ? null : Number(value);
    }

    getRunTimeStart(runName) {
      const run = this.getRun(runName);
      const value = run && run.metadata && run.metadata.simulation ? run.metadata.simulation.startTime : null;
      return value == null ? null : Number(value);
    }

    getRunTimeLength(runName) {
      const run = this.getRun(runName);
      const value = run && run.metadata && run.metadata.simulation ? run.metadata.simulation.timeLength : null;
      return value == null ? null : Number(value);
    }

    getRunTimeUnits(runName) {
      const run = this.getRun(runName);
      const value = run && run.metadata && run.metadata.simulation ? run.metadata.simulation.timeUnits : null;
      return value == null ? null : String(value);
    }

    asTable(runName) {
      const run = this.getRun(runName);
      if (!run) return null;
      return {
        columns: run.columns.slice(),
        rows: run.rows.map((row) => row.slice()),
      };
    }

    toCsv(run) {
      const source = run || this.currentRun;
      if (!source) throw new Error('There is no current simulation run.');
      const lines = [source.columns.map(csvEscape).join(',')];
      for (const row of source.rows) lines.push(row.map(csvEscape).join(','));
      return `${lines.join('\r\n')}\r\n`;
    }

    parseStoredRun(csv, metadata) {
      const rawRows = parseCsv(csv);
      if (!rawRows.length) throw new Error('Run CSV is empty.');
      const columns = rawRows[0];
      const rows = rawRows.slice(1)
        .filter((row) => row.some((cell) => cell !== ''))
        .map((row) => columns.map((_, i) => inferCell(row[i] == null ? '' : row[i])));
      return this.normalizeRun({
        runName: metadata && metadata.runName ? metadata.runName : 'Base',
        columns,
        ids: metadata && metadata.data && Array.isArray(metadata.data.columnIds)
          ? metadata.data.columnIds
          : [],
        rows,
        metadata: metadata || {},
      });
    }

    fromCsv(csv, metadata, makeCurrent = true) {
      const run = this.parseStoredRun(csv, metadata);
      this.runCache.set(run.runName, run);
      if (makeCurrent) this.currentRun = run;
      return run;
    }

    async runExists(runName) {
      const api = getRunsAPI();
      if (!api) throw new Error('Run persistence is unavailable in this environment.');
      return api.exists(this.modelPath(), runName);
    }

    async saveCurrentRun(overwrite) {
      if (!this.currentRun) throw new Error('There is no current simulation run to save.');
      const api = getRunsAPI();
      if (!api) throw new Error('Run persistence is unavailable in this environment.');
      const saved = await api.save(this.modelPath(), {
        runLabel: this.currentRun.runName,
        csv: this.toCsv(this.currentRun),
        metadata: {
          ...this.currentRun.metadata,
          data: {
            ...((this.currentRun.metadata && this.currentRun.metadata.data) || {}),
            columns: this.currentRun.columns.slice(),
            columnIds: this.currentRun.ids.slice(),
          },
        },
        overwrite: Boolean(overwrite),
      });
      // Keep the canonical disk label in cache after sanitization/overwrite.
      this.runCache.set(this.currentRun.runName, this.currentRun);
      return saved;
    }

    async loadRun(runName, makeCurrent = true) {
      const name = String(runName || 'Base');
      const cached = this.runCache.get(name);
      if (cached) {
        if (makeCurrent) this.currentRun = cached;
        return cached;
      }
      const api = getRunsAPI();
      if (!api) throw new Error('Run persistence is unavailable in this environment.');
      const stored = await api.load(this.modelPath(), name);
      return this.fromCsv(stored.csv, stored.metadata, makeCurrent);
    }

    async ensureRunLoaded(runName) {
      const name = String(runName || '');
      if (!name) return this.currentRun;
      const cached = this.runCache.get(name);
      if (cached) return cached;
      if (this.loadingRuns.has(name)) return this.loadingRuns.get(name);
      const promise = this.loadRun(name, false)
        .finally(() => this.loadingRuns.delete(name));
      this.loadingRuns.set(name, promise);
      return promise;
    }

    async listRuns() {
      const api = getRunsAPI();
      if (!api) throw new Error('Run persistence is unavailable in this environment.');
      return api.list(this.modelPath());
    }

    async renameRun(sourceLabel, targetLabel) {
      const api = getRunsAPI();
      if (!api || typeof api.rename !== 'function') throw new Error('Run rename is unavailable in this environment.');
      const result = await api.rename(this.modelPath(), sourceLabel, targetLabel);
      const source = String(sourceLabel || '');
      const target = String((result && result.runName) || targetLabel || '');
      const cached = this.runCache.get(source);
      if (cached) {
        this.runCache.delete(source);
        cached.runName = target;
        cached.metadata = { ...(cached.metadata || {}), runName: target };
        this.runCache.set(target, cached);
        if (this.currentRun === cached) this.currentRun = cached;
      }
      return result;
    }

    async duplicateRun(sourceLabel, targetLabel) {
      const api = getRunsAPI();
      if (!api || typeof api.duplicate !== 'function') throw new Error('Run duplication is unavailable in this environment.');
      const result = await api.duplicate(this.modelPath(), sourceLabel, targetLabel);
      this.runCache.delete(String(targetLabel || ''));
      return result;
    }

    async deleteRun(runLabel) {
      const api = getRunsAPI();
      if (!api || typeof api.delete !== 'function') throw new Error('Run deletion is unavailable in this environment.');
      const result = await api.delete(this.modelPath(), runLabel);
      const name = String(runLabel || '');
      const cached = this.runCache.get(name);
      this.runCache.delete(name);
      if (this.currentRun && (this.currentRun === cached || this.currentRun.runName === name)) this.currentRun = null;
      return result;
    }
  }

  root.SystemikaSimulationDataManager = SimulationDataManager;
  root.systemikaSimulationData = root.systemikaSimulationData || new SimulationDataManager();
})(window);
