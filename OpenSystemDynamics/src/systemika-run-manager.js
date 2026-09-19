'use strict';

/* Coordinates the normal user Run action with persistent .sysrun storage. */
(function attachSystemikaRunManager(root) {
  let preparing = false;
  let saving = false;

  function getRunName() {
    const input = document.getElementById('systemika-run-name');
    const value = input ? input.value.trim() : '';
    return value || 'Base';
  }

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

  function persistenceAvailable() {
    return Boolean(getRunsAPI());
  }

  async function ensurePersistenceReady() {
    const api = getRunsAPI();
    if (!api) return false;
    if (typeof api.ensureAccess !== 'function') return true;
    try {
      await api.ensureAccess();
      return true;
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      throw error;
    }
  }

  async function ensureSavedModel() {
    if (!persistenceAvailable()) return true;
    if (typeof fileManager !== 'undefined' && fileManager.fileName) return true;

    // An unsaved model has no directory in which a Runs folder can live. Use
    // the ordinary model Save As dialog and continue automatically if saved.
    const savedPath = await fileManager.saveModelAs();
    return Boolean(savedPath || fileManager.fileName);
  }

  async function prepareUserRun() {
    if (preparing || saving) return { proceed: false, busy: true };
    preparing = true;
    try {
      const runName = getRunName();
      if (!persistenceAvailable()) {
        const electron = typeof root.isRunningElectron === 'function' ? root.isRunningElectron() : false;
        if (electron) {
          root.alert('Systemika cannot access the Runs storage bridge. The simulation was not started because its output could not be saved.');
          return { proceed: false, persistenceError: true };
        }
        // Browser mode has no automatic project-local filesystem access. Keep
        // the historic transient simulation behavior there.
        return { proceed: true, persist: false, runName, overwrite: false };
      }

      if (!await ensureSavedModel()) return { proceed: false, cancelled: true };
      if (!await ensurePersistenceReady()) return { proceed: false, cancelled: true };

      const exists = await root.systemikaSimulationData.runExists(runName);
      if (!exists) return { proceed: true, persist: true, runName, overwrite: false };

      // Prefer Systemika's in-app dialog. On some Linux window managers an
      // Electron-native modal attached to the nested editor window is visible
      // but does not receive pointer events. The jQuery UI dialog lives in the
      // editor DOM and is reliable across Linux/Windows/macOS.
      let overwrite;
      if (typeof root.yesNoAlert === 'function') {
        overwrite = await new Promise((resolve) => {
          const safeName = String(runName)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          root.yesNoAlert(
            `A simulation run named <b>${safeName}</b> already exists.<br/><br/>Overwrite the existing run file?`,
            (answer) => resolve(answer === 'yes')
          );
        });
      } else {
        const api = getRunsAPI();
        if (!api || typeof api.confirmOverwrite !== 'function') {
          throw new Error('Systemika could not open a responsive overwrite confirmation dialog.');
        }
        overwrite = await api.confirmOverwrite(runName);
      }
      return { proceed: Boolean(overwrite), persist: Boolean(overwrite), runName, overwrite: Boolean(overwrite) };
    } finally {
      preparing = false;
    }
  }

  function primitiveMetadata() {
    if (typeof getPrimitiveList !== 'function') return [];
    return getPrimitiveList().map((primitive) => {
      const attributes = {};
      if (primitive.value && primitive.value.attributes) {
        for (const attr of Array.from(primitive.value.attributes)) attributes[attr.name] = attr.value;
      }
      return {
        id: Number(primitive.id),
        name: primitive.getAttribute('name'),
        type: typeof getTypeNew === 'function' ? getTypeNew(primitive) : primitive.value.nodeName,
        units: primitive.getAttribute('Units') || '',
        attributes,
      };
    });
  }

  function buildMetadata() {
    const setting = typeof primitives === 'function' ? primitives('Setting')[0] : null;
    return {
      created: new Date().toISOString(),
      model: {
        file: typeof fileManager !== 'undefined' && fileManager.fileName
          ? fileManager.fileName.split(/[\\/]/).pop()
          : '',
        hadUnsavedChanges: typeof History !== 'undefined' ? Boolean(History.unsavedChanges) : false,
      },
      simulation: {
        startTime: typeof getTimeStart === 'function' ? getTimeStart() : null,
        timeLength: typeof getTimeLength === 'function' ? getTimeLength() : null,
        endTime: (typeof getTimeStart === 'function' && typeof getTimeLength === 'function')
          ? getTimeStart() + getTimeLength()
          : null,
        timeStep: typeof getTimeStep === 'function' ? getTimeStep() : null,
        advanceBy: typeof getAdvanceBy === 'function' ? getAdvanceBy() : 1,
        timeUnits: typeof getTimeUnits === 'function' ? getTimeUnits() : '',
        integrationMethod: typeof getAlgorithm === 'function'
          ? (getAlgorithm() === 'RK1' ? 'Euler' : getAlgorithm())
          : null,
        solutionAlgorithm: typeof getAlgorithm === 'function' ? getAlgorithm() : null,
        ignoreUnits: typeof RunResults !== 'undefined' ? Boolean(RunResults.ignoreUnits) : false,
        stochastic: typeof RunResults !== 'undefined' ? Boolean(RunResults.lastSimulationStochastic) : false,
        randomSeed: typeof RunResults !== 'undefined' ? RunResults.lastSimulationRandomSeed : null,
        settings: setting && setting.value && setting.value.attributes
          ? Object.fromEntries(Array.from(setting.value.attributes).map((attr) => [attr.name, attr.value]))
          : {},
      },
      primitives: primitiveMetadata(),
    };
  }

  function captureLiveRun(runName, allowEmpty = false) {
    if (typeof RunResults === 'undefined' || !Array.isArray(RunResults.results)) return null;
    if (!RunResults.results.length && !allowEmpty) return null;
    const metadata = buildMetadata();
    metadata.simulation = {
      ...(metadata.simulation || {}),
      partial: !Boolean(RunResults.simulationDone),
      currentTime: RunResults.results.length
        ? RunResults.results[RunResults.results.length - 1][0]
        : (typeof getTimeStart === 'function' ? getTimeStart() : null),
    };
    return root.systemikaSimulationData.setCurrentRun({
      runName: String(runName || getRunName() || 'Base'),
      columns: RunResults.varnameList,
      ids: RunResults.varIdList,
      rows: RunResults.results,
      metadata,
    });
  }

  function captureCompletedRun(decision) {
    if (!decision || !decision.proceed || typeof RunResults === 'undefined') return null;
    const captured = root.systemikaSimulationData.setCurrentRun({
      runName: decision.runName,
      columns: RunResults.varnameList,
      ids: RunResults.varIdList,
      rows: RunResults.results,
      metadata: buildMetadata(),
    });

    // Make the new run immediately active in every display before RunResults
    // notifies its plot/table subscribers. Ordinary plots switch to the new run;
    // Compare Plot and Table append it to their existing comparison selection.
    if (root.SystemikaDisplayRuns && typeof root.SystemikaDisplayRuns.selectNewRun === 'function') {
      root.SystemikaDisplayRuns.selectNewRun(decision.runName);
    }
    return captured;
  }

  async function commitUserRun(decision) {
    if (!decision || !decision.proceed) return null;
    captureCompletedRun(decision);
    if (!decision.persist) return null;

    saving = true;
    updateBusyUi();
    try {
      return await root.systemikaSimulationData.saveCurrentRun(decision.overwrite);
    } finally {
      saving = false;
      updateBusyUi();
    }
  }

  function suppressUnavailablePersistenceAlert() {
    return typeof root.fileManager !== 'undefined' &&
      root.fileManager &&
      typeof root.fileManager.shouldSuppressRunManagerUnavailableAlert === 'function' &&
      root.fileManager.shouldSuppressRunManagerUnavailableAlert();
  }

  function explainUnavailablePersistence() {
    if (suppressUnavailablePersistenceAlert()) return;
    let message;
    if (typeof root.fileManager !== 'undefined' &&
        root.fileManager &&
        typeof root.fileManager.getProjectStorageUnavailableMessage === 'function') {
      message = root.fileManager.getProjectStorageUnavailableMessage();
    } else {
      message =
        'Persistent Run management requires writable access to the model project folder. ' +
        'This browser/session is currently using Systemika browser-storage mode, so only the current in-memory run is available.';
    }
    if (typeof root.xAlert === 'function') root.xAlert(message.replace(/\n/g, '<br/>'));
    else root.alert(message);
  }

  async function openRunsFolder() {
    if (!persistenceAvailable()) {
      explainUnavailablePersistence();
      return;
    }
    if (!await ensureSavedModel()) return;
    if (!await ensurePersistenceReady()) return;
    if (typeof root.openSystemikaRunsManager === 'function') {
      root.openSystemikaRunsManager();
      return;
    }
    throw new Error('The Systemika Runs manager is not available.');
  }

  function updateBusyUi() {
    const input = document.getElementById('systemika-run-name');
    const folderButton = document.getElementById('btn_open_runs_folder');
    if (input) input.disabled = saving;
    if (folderButton) folderButton.disabled = saving;
  }

  function initControls() {
    const controls = document.getElementById('systemika-run-controls');
    const input = document.getElementById('systemika-run-name');
    const folderButton = document.getElementById('btn_open_runs_folder');

    // Keep the run-name field visible in every environment so the toolbar does
    // not silently change shape when a desktop bridge is temporarily absent.
    // Local folder access is available in Electron and in web browsers that
    // expose the required File System Access picker APIs.
    const persistent = persistenceAvailable();
    if (controls) {
      controls.style.display = '';
      controls.dataset.persistence = persistent ? 'available' : 'unavailable';
    }
    if (folderButton) {
      const firefoxLimited = !persistent && suppressUnavailablePersistenceAlert();
      // Firefox cannot provide the writable project-directory API needed for
      // persistent runs. Its persistent status-bar notice already explains this, so
      // keep Manage Runs disabled there instead of showing repeat error dialogs.
      // Other fallback modes remain clickable so configuration problems can
      // still explain themselves (for example a cross-origin Chromium launch).
      folderButton.disabled = firefoxLimited;
      folderButton.title = persistent
        ? 'Manage Runs'
        : firefoxLimited
          ? 'Manage Runs requires a Chromium-based browser'
          : 'Manage Runs (local persistent storage unavailable)';
    }

    if (input) {
      input.value = input.value.trim() || 'Base';
      // Typing a run label must never activate editor creation shortcuts.  Run
      // commands are the intentional exception: Enter, Ctrl/Cmd+1 and
      // Ctrl/Cmd+R start/pause the model even while this field has focus.
      input.addEventListener('keydown', (event) => {
        const key = String(event.key || '').toLowerCase();
        const runShortcut = (event.ctrlKey || event.metaKey) && (key === '1' || key === 'r');
        if (event.key === 'Enter' || runShortcut) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof root.systemikaRunModel === 'function') {
            root.systemikaRunModel();
          } else {
            const runButton = document.getElementById('btn_run');
            if (runButton) runButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, which: 1 }));
          }
          return;
        }
        event.stopPropagation();
      });
      input.addEventListener('keyup', (event) => event.stopPropagation());
      input.addEventListener('keypress', (event) => event.stopPropagation());
    }

    if (folderButton) {
      folderButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await openRunsFolder();
        } catch (error) {
          console.error(error);
          root.alert(`Unable to open the Runs manager.\n\n${error.message || error}`);
        }
      });
    }
  }

  function isBusy() { return preparing || saving; }

  root.SystemikaRunManager = {
    getRunName,
    initControls,
    prepareUserRun,
    captureLiveRun,
    captureCompletedRun,
    commitUserRun,
    openRunsFolder,
    isBusy,
  };
})(window);
