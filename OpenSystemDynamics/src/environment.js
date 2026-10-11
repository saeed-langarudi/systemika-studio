/*

This file may distributed and/or modified under the
terms of the Affero General Public License (http://www.gnu.org/licenses/agpl-3.0.html).

*/

// This file controls the things that depend on which environment the
// software is running in. There are two supported environments:
// 1. Web
// 2. Electron (https://electronjs.org)
//
// The things that depend on the environment are things such as file handling
// and window closing. The decision of which environment to use is at the
// bottom of this file.

const appName = "Systemika";
const webAppName = "Systemika Studio";

class BaseFileManager {
  constructor() {
    this._fileName = "";
    // Name this model has in browser storage, or null if it is not stored there.
    this.storedModelName = null;
    this.lastSaved = null;
    this.softwareName = appName;
  }
  // True where the environment cannot properly write files, so models live in
  // browser storage by default and files are only used for import/export.
  // Where this is false, Save and Open keep working on real files and browser
  // storage is offered as a secondary place to keep models.
  usesBrowserStorage() {
    return false;
  }
  // This is executed when the document is ready
  ready() {
    // Override this
    this.updateTitle();
  }
  newModel() {
    (typeof sessionStorage !== "undefined" ? sessionStorage : localStorage).removeItem("reloadPending");
    this._fileName = "";
    this.storedModelName = null;
    this.updateTitle();
    applicationReload();
  }
  newModelOld() {
    History.clearUndoHistory();
    newModel();
    // Store an empty state as first state
    History.storeUndoState();
    // There is no last state is it could not be unsaved
    History.setUnsavedChanges(false);
    this.fileName = null;
    this.lastSaved = null;
    this.updateTitle();
    // Optional handler for when saving is finished
    this.finishedSaveHandler = null;
    RunResults.resetSimulation();
  }
  saveModelAs() {
    let fileData = createModelFileData();
    // Only exportFile is implementation specific (differs per environment)
    this.exportFile(fileData, Settings.fileExtension, (filePath) => {
      this.fileName = filePath;
      markModelSaved(fileData);
      this.updateSaveTime();
      this.updateTitle();
      if (this.finishedSaveHandler) {
        this.finishedSaveHandler();
      }
    });
  }
  // Writing the model out to a file. Where Save already means "to a file" this
  // is the same operation, so the menu only offers it separately when browser
  // storage has taken over Save.
  exportModel() {
    this.saveModelAs();
  }
  // Reading a model in from a file, without it becoming the save target.
  // openFile is provided by the Systemika model API.
  async importModel() {
    openFile({
      read: "text",
      multiple: false,
      accept: Settings.fileExtension,
      onCompleted: (model) => {
        this.fileName = model.name;
        // Imported from a file, so there is no browser-storage entry behind it
        // yet and a following Save has to ask for a name.
        this.storedModelName = null;
        do_global_log("web load file call  back");
        History.forceCustomUndoState(model.contents);
        this.updateTitle();
        preserveRestart();
      },
    });
  }
  hasSaveAs() {
    return false;
  }
  hasRecentFiles() {
    return false;
  }
  // Whether this environment can grant Systemika read/write access to the
  // directory containing the current model. Desktop does not use this hook;
  // the modern web file manager overrides it for project-local Runs storage.
  supportsProjectRunStorage() {
    return false;
  }
  // Use SHA-256 where available. A length+hash fallback keeps older test
  // environments functional; the browser normally takes the SHA-256 path.
  async fingerprintContents(contents) {
    const text = String(contents);
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return text.length + ':' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }
    let a = 2166136261, b = 2166136261;
    for (let i = 0; i < text.length; i++) {
      a = Math.imul(a ^ text.charCodeAt(i), 16777619);
      b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
    }
    return text.length + ':' + (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16);
  }

  // Standard file inputs do not expose a FileSystemHandle. Reattach to an
  // already authorized folder only if the on-disk model has the exact same
  // contents as the selected file; matching filenames alone is unsafe.
  async findMatchingKnownFolder(fileName, fingerprint) {
    if (!fileName || !fingerprint) return null;
    let saved = [];
    try { saved = await idbKeyval.get(this.knownProjectFoldersKey) || []; } catch (_) {}
    const candidates = [this.projectDirectoryHandle, ...(Array.isArray(saved) ? saved : [])];
    let match = null;
    for (const directory of candidates) {
      if (!directory || typeof directory.queryPermission !== 'function') continue;
      try {
        if (await directory.queryPermission({ mode: 'readwrite' }) !== 'granted') continue;
        const handle = await directory.getFileHandle(fileName, { create: false });
        const file = await handle.getFile();
        if (await this.fingerprintContents(await file.text()) !== fingerprint) continue;
        if (match && !await this.sameEntry(match.directory, directory)) return null; // ambiguous copies
        match = { directory, handle };
      } catch (_) { /* Unrelated, moved, or revoked folder. */ }
    }
    return match;
  }

  // Previously approved folders can be matched to a selected file without
  // prompting. A file picker alone never provides access to its parent folder.
  async reconnectKnownFolder(fileHandle) {
    if (!fileHandle) return null;
    const saved = await idbKeyval.get(this.knownProjectFoldersKey).catch(() => []);
    const candidates = [this.projectDirectoryHandle, ...(Array.isArray(saved) ? saved : [])];
    for (const directory of candidates) {
      if (!directory || typeof directory.queryPermission !== 'function') continue;
      try {
        if (await directory.queryPermission({ mode: 'readwrite' }) !== 'granted') continue;
        const candidate = await directory.getFileHandle(fileHandle.name, { create: false });
        if (await this.sameEntry(candidate, fileHandle)) {
          this.projectDirectoryHandle = directory;
          await idbKeyval.set(this.projectDirectoryStorageKey, directory);
          return directory;
        }
      } catch (_) { /* Moved, revoked, or unrelated directory; skip it. */ }
    }
    return null;
  }

  async rememberProjectFolder(directoryHandle) {
    const saved = await idbKeyval.get(this.knownProjectFoldersKey).catch(() => []);
    const known = Array.isArray(saved) ? saved : [];
    const unique = [];
    for (const handle of [directoryHandle, ...known]) {
      if (!handle) continue;
      let duplicate = false;
      for (const previous of unique) {
        if (await this.sameEntry(handle, previous)) { duplicate = true; break; }
      }
      if (!duplicate) unique.push(handle);
      if (unique.length >= 20) break;
    }
    await idbKeyval.set(this.knownProjectFoldersKey, unique);
    this.projectDirectoryHandle = directoryHandle;
    await idbKeyval.set(this.projectDirectoryStorageKey, directoryHandle);
  }

  async ensureRunStorageAccess({ promptForDirectory = false } = {}) {
    return null;
  }
  getRunStorageDirectoryHandle() {
    return null;
  }
  saveModel() {
    // Override this
  }
  async loadModel() {
    // Override this
  }
  async init() {
    // Override this
  }
  async clean() {
    // Override this
  }
  setTitle(newTitleRaw) {
    // None breaking space
    const nbsp = String.fromCharCode(160);
    // string.replace does not work with char(160) for some reason, so we had to make our own
    let newTitle = "";
    for (var i = 0; i < newTitleRaw.length; i++) {
      let tchar = newTitleRaw.charAt(i);
      if (tchar == " ") {
        newTitle = newTitle + nbsp;
      } else {
        newTitle = newTitle + tchar;
      }
    }
    if (window !== window.top) {
      // In iFrame
      setParentTitle(newTitle);
    } else {
      // Not in iFrame
      document.title = newTitle;
    }
  }
  loadModelData(modelData) {
    History.clearUndoHistory();
    loadModelFromXml(modelData);
    // Store an empty state as first state
    History.storeUndoState();
    RunResults.resetSimulation();
  }
  updateSaveTime() {
    this.lastSaved = new Date().toLocaleTimeString();
  }
  updateModelNameDisplay() {
    if (typeof document === "undefined" || typeof document.getElementById !== "function") return;
    const display = document.getElementById("current-model-name");
    if (!display) return;
    let name = this.fileName || this.storedModelName || "";
    if (name) name = String(name).split(/[\\/]/).pop();
    display.textContent = name || "Untitled model";
    display.title = name || "Untitled model";
    const versionLabel = document.getElementById("systemika-version-label");
    if (versionLabel && typeof systemika !== "undefined" && systemika.version) {
      versionLabel.textContent = `v${systemika.version}`;
      versionLabel.title = `Systemika Studio ${systemika.version}`;
    }
  }
  updateTitle() {
    this.updateModelNameDisplay();
    let title = this.softwareName;
    const nbsp = String.fromCharCode(160);
    if (this.fileName != "") {
      title += "   |   " + this.fileName;
      if (this.lastSaved) {
        title += "   (last saved: " + this.lastSaved + ")";
      }
    }
    this.setTitle(title);
  }
  set fileName(newFileName) {
    if (newFileName == null) {
      newFileName = "";
    }
    if (this._fileName !== newFileName && typeof window !== "undefined" && window.systemikaSimulationData) {
      // Saved runs are project-local. Never reuse a cached run from another
      // model merely because it has the same label (for example "Base").
      window.systemikaSimulationData.clearCache();
    }
    this._fileName = newFileName;
    this.updateModelNameDisplay();
  }
  get fileName() {
    return this._fileName;
  }
  // A reasonable filename to suggest for this model, without its extension —
  // whatever it's currently known as, falling back to a generic name.
  defaultExportBaseName() {
    if (this.storedModelName) {
      return this.storedModelName;
    }
    if (this.fileName) {
      let baseName = this.fileName.split(/[\\/]/).pop();
      return baseName.replace(new RegExp(Settings.fileExtension + "$", "i"), "");
    }
    return "model";
  }
  appendFileExtension(filename, extension) {
    var extension_position = filename.length - extension.length;
    var current_extension = filename.substring(
      extension_position,
      filename.length
    );
    if (current_extension.toLowerCase() != extension.toLowerCase()) {
      filename += extension;
    }
    return filename;
  }
  /** @param {File} file */
  async loadFromFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const contents = event.target.result;
      this.fileName = file.name;
      // Dropped in from disk, so it has no browser-storage entry behind it yet.
      this.storedModelName = null;
      console.log("load event.target", event.target);

      do_global_log("web load file call  back");
      var fileData = contents;
      History.forceCustomUndoState(fileData);
      this.updateTitle();
      preserveRestart();
    }
    reader.onerror = (error) => {
      console.error(`Error reading file ${file.name}`, error);
    }
    reader.readAsText(file);
  }
}

function isFirefoxBrowser() {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator && window.navigator.userAgent
    ? String(window.navigator.userAgent)
    : "";
  return /Firefox\/|FxiOS\//i.test(userAgent);
}

function isSafariBrowser() {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator && window.navigator.userAgent
    ? String(window.navigator.userAgent)
    : "";
  // Safari and iOS Safari identify with Safari/ while Chromium-family browsers
  // and Firefox iOS add their own product token. Keep Firefox classified by the
  // dedicated check above so the shared compatibility notice covers both.
  return /Safari\//i.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS)\//i.test(userAgent);
}

function isLimitedProjectBrowser() {
  return isFirefoxBrowser() || isSafariBrowser();
}

class WebFileManagerBasic extends BaseFileManager {
  constructor(storageLimitationReason) {
    super();
    this.storageLimitationReason = storageLimitationReason || "PICKER_API_UNAVAILABLE";
    // Be explicit about the fact that this fallback does not have writable
    // access to the user's project directory. Previously the UI looked like
    // ordinary file mode even though Save actually wrote to browser storage.
    this.softwareName = webAppName;
    this._storageModeNoticeShown = false;
  }
  // Keep the web browser tab concise. File/storage state is shown inside the UI.
  updateTitle() {
    this.updateModelNameDisplay();
    if (typeof window !== "undefined" && window !== window.top) setParentTitle(webAppName);
    else if (typeof document !== "undefined") document.title = webAppName;
  }
  isBrowserLimitedMode() {
    return isLimitedProjectBrowser();
  }
  // Retained as a compatibility alias for older call sites/tests.
  isFirefoxLimitedMode() {
    return this.isBrowserLimitedMode();
  }
  shouldSuppressRunManagerUnavailableAlert() {
    return this.isBrowserLimitedMode();
  }
  download(fileName, data) {
    // Create Blob and attach it to ObjectURL
    var blob = new Blob([data], { type: "octet/stream" }),
      url = window.URL.createObjectURL(blob);

    // Create download link and click it
    var a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // The setTimeout is a fix to make it work in Firefox
    // Without it, the objectURL is removed before the click-event is triggered
    // And the download does not work
    setTimeout(function () {
      window.URL.revokeObjectURL(url);
      a.remove();
    }, 1);
  }
  // This environment can only hand the user a download, never write back to a
  // file they opened, so models are kept in browser storage instead and files
  // are reached through Import and Export.
  usesBrowserStorage() {
    return true;
  }
  hasSaveAs() {
    return true;
  }
  getProjectStorageUnavailableShortMessage() {
    switch (this.storageLimitationReason) {
      case "FILE_IFRAME_CONTEXT":
        return "Local file:// launch is in limited storage mode. Start Systemika Studio through http://localhost to use saved Runs.";
      case "CROSS_ORIGIN_IFRAME":
        return "The editor is cross-origin to its host page, so project-folder storage is blocked by the browser.";
      case "INSECURE_CONTEXT":
        return "Project-folder storage requires HTTPS or http://localhost.";
      default:
        return this.isBrowserLimitedMode()
          ? "Firefox and Safari have limited Systemika Studio file access. Use Chrome or Edge for full file and run management."
          : "This browser does not support Systemika's writable project-folder mode; only the current in-memory run is available.";
    }
  }
  getProjectStorageUnavailableMessage() {
    let guidance;
    switch (this.storageLimitationReason) {
      case "FILE_IFRAME_CONTEXT":
        guidance =
          "Systemika is running from local file:// pages inside its editor iframe. Chromium blocks native file/directory pickers in that context. " +
          "Start the WebApp through the included local web-server launcher (http://localhost) or deploy it over HTTPS.";
        break;
      case "CROSS_ORIGIN_IFRAME":
        guidance =
          "Systemika is embedded in a page from a different origin. Chromium blocks native file/directory pickers in cross-origin subframes. " +
          "Serve the Systemika wrapper and OpenSystemDynamics editor from the same origin, or open Systemika as a first-party page.";
        break;
      case "INSECURE_CONTEXT":
        guidance =
          "The File System Access API requires a secure browser context. Run Systemika on HTTPS or http://localhost.";
        break;
      default:
        guidance =
          "This browser does not provide the local file/directory picker APIs Systemika needs for desktop-compatible project storage. " +
          "Use a current Chromium-based browser for full .ssd + Runs/*.sysrun support.";
        break;
    }
    return (
      "Full project-file mode is unavailable in this browser/session. " +
      "The model can still be kept in browser storage, but persistent project-local simulation runs cannot be managed here.\n\n" +
      guidance
    );
  }
  explainStorageMode() {
    // Firefox users receive one compatibility warning when Systemika first
    // starts. Avoid repeating the same platform limitation on Save/Save As or
    // when they explore run-management controls.
    if (this.isBrowserLimitedMode()) return;
    if (this._storageModeNoticeShown) return;
    this._storageModeNoticeShown = true;
    const message = this.getProjectStorageUnavailableMessage();
    if (typeof xAlert === "function") xAlert(message.replace(/\n/g, "<br/>"));
    else if (typeof window !== "undefined" && typeof window.alert === "function") window.alert(message);
  }
  saveModel() {
    this.explainStorageMode();
    saveModelToBrowser();
  }
  saveModelAs() {
    this.explainStorageMode();
    browserModelsDialog.showForSaveAs();
  }
  async loadModel() {
    browserModelsDialog.show();
  }
  exportModel() {
    let fileData = createModelFileData();

    this.exportFile(fileData, Settings.fileExtension, () => {
      this.updateSaveTime();
      this.updateTitle();
      if (this.finishedSaveHandler) {
        this.finishedSaveHandler();
      }
    });
  }
  // There is no File System Access API here (that's why this file manager was
  // chosen), so a real native picker isn't available — the closest thing is
  // the browser's own download flow, which opens a native save dialog when
  // the browser is set to ask where to save each file. Either way this beats
  // a prompt() box, which never offered a location picker to begin with.
  exportFile(dataToSave, fileExtension, onSuccess) {
    if (onSuccess == undefined) {
      // On success is optoinal, so if it was not set we set it to an empty function
      onSuccess = () => { };
    }

    const exportFileName = this.appendFileExtension(this.defaultExportBaseName(), fileExtension);
    this.download(exportFileName, dataToSave);
    onSuccess(exportFileName);
  }
}

class WebFileManagerModern extends BaseFileManager {
  constructor() {
    super();
    this.softwareName = webAppName;
    this.fileHandle = undefined;
    this.projectDirectoryHandle = undefined;
    const storage = typeof sessionStorage !== "undefined" ? sessionStorage : localStorage;
    let sessionId = storage.getItem("systemika.windowSessionId");
    if (!sessionId) {
      sessionId = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      storage.setItem("systemika.windowSessionId", sessionId);
    }
    this.fileHandleStorageKey = `fileHandle:${sessionId}`;
    this.projectDirectoryStorageKey = `systemikaProjectDirectoryHandle:${sessionId}`;
    this.knownProjectFoldersKey = 'systemika.authorizedProjectFolders.v1';
    // A normal HTML file input gives us the file, not a writable OS handle.
    // Remember a fingerprint across the editor reload so explicit folder
    // connection can verify the original file, not just its common filename.
    this.openedModelFingerprintKey = 'systemika.openedModelFingerprint.v1';
    this.openedModelFingerprint = storage.getItem(this.openedModelFingerprintKey) || null;
  }

  // Keep the web browser tab concise. File/storage state is shown inside the UI.
  updateTitle() {
    this.updateModelNameDisplay();
    if (typeof window !== "undefined" && window !== window.top) setParentTitle(webAppName);
    else if (typeof document !== "undefined") document.title = webAppName;
  }

  async init() {
    this.fileHandle = await idbKeyval.get(this.fileHandleStorageKey);
    this.projectDirectoryHandle = await idbKeyval.get(this.projectDirectoryStorageKey);
  }

  async clean() {
    await idbKeyval.del(this.fileHandleStorageKey);
    await idbKeyval.del(this.projectDirectoryStorageKey);
    this.fileHandle = undefined;
    this.projectDirectoryHandle = undefined;
    this.openedModelFingerprint = null;
    const storage = typeof sessionStorage !== 'undefined' ? sessionStorage : localStorage;
    storage.removeItem(this.openedModelFingerprintKey);
  }

  supportsProjectRunStorage() {
    return typeof window.showDirectoryPicker === "function";
  }

  getRunStorageDirectoryHandle() {
    return this.projectDirectoryHandle || null;
  }

  async sameEntry(a, b) {
    if (!a || !b || typeof a.isSameEntry !== "function") return false;
    try {
      return await a.isSameEntry(b);
    } catch (_) {
      return false;
    }
  }

  async clearProjectDirectoryHandle() {
    this.projectDirectoryHandle = undefined;
    await idbKeyval.del(this.projectDirectoryStorageKey);
  }

  async setFileHandle(fileHandle) {
    const sameFile = await this.sameEntry(this.fileHandle, fileHandle);
    this.fileHandle = fileHandle;
    await idbKeyval.set(this.fileHandleStorageKey, this.fileHandle);
    if (fileHandle) {
      this.openedModelFingerprint = null;
      const storage = typeof sessionStorage !== 'undefined' ? sessionStorage : localStorage;
      storage.removeItem(this.openedModelFingerprintKey);
    }
    if (!sameFile) await this.clearProjectDirectoryHandle();
  }

  async directoryContainsCurrentModel(directoryHandle) {
    if (!directoryHandle || !this.fileHandle) return false;
    try {
      const candidate = await directoryHandle.getFileHandle(this.fileHandle.name, { create: false });
      return await candidate.isSameEntry(this.fileHandle);
    } catch (_) {
      return false;
    }
  }

  // Previously approved folders can be matched to a selected file without
  // prompting. A file picker alone never provides access to its parent folder.
  async reconnectKnownFolder(fileHandle) {
    if (!fileHandle) return null;
    const saved = await idbKeyval.get(this.knownProjectFoldersKey).catch(() => []);
    const candidates = [this.projectDirectoryHandle, ...(Array.isArray(saved) ? saved : [])];
    for (const directory of candidates) {
      if (!directory || typeof directory.queryPermission !== 'function') continue;
      try {
        if (await directory.queryPermission({ mode: 'readwrite' }) !== 'granted') continue;
        const candidate = await directory.getFileHandle(fileHandle.name, { create: false });
        if (await this.sameEntry(candidate, fileHandle)) {
          this.projectDirectoryHandle = directory;
          await idbKeyval.set(this.projectDirectoryStorageKey, directory);
          return directory;
        }
      } catch (_) { /* Moved, revoked, or unrelated directory; skip it. */ }
    }
    return null;
  }

  async rememberProjectFolder(directoryHandle) {
    const saved = await idbKeyval.get(this.knownProjectFoldersKey).catch(() => []);
    const known = Array.isArray(saved) ? saved : [];
    const unique = [];
    for (const handle of [directoryHandle, ...known]) {
      if (!handle) continue;
      let duplicate = false;
      for (const previous of unique) {
        if (await this.sameEntry(handle, previous)) { duplicate = true; break; }
      }
      if (!duplicate) unique.push(handle);
      if (unique.length >= 20) break;
    }
    await idbKeyval.set(this.knownProjectFoldersKey, unique);
    this.projectDirectoryHandle = directoryHandle;
    await idbKeyval.set(this.projectDirectoryStorageKey, directoryHandle);
  }

  async ensureRunStorageAccess({ promptForDirectory = false } = {}) {
    if (!this.supportsProjectRunStorage()) {
      const error = new Error("This browser cannot grant Systemika access to a local project folder.");
      error.code = "RUN_STORAGE_UNAVAILABLE";
      throw error;
    }
    if (!this.fileHandle && !(this.fileName && this.openedModelFingerprint)) {
      const error = new Error("Save or open the model as a local .ssd file before managing persistent simulation runs.");
      error.code = "MODEL_NOT_SAVED";
      throw error;
    }

    // No permission prompts from Open Model, Run, or Manage Runs.
    // Only the explicit Connect Model Folder button opens a folder picker.
    if (!promptForDirectory) {
      const known = this.fileHandle
        ? await this.reconnectKnownFolder(this.fileHandle)
        : await this.findMatchingKnownFolder(this.fileName, this.openedModelFingerprint);
      if (known) {
        if (!this.fileHandle) {
          await this.setFileHandle(known.handle);
          this.projectDirectoryHandle = known.directory;
          await idbKeyval.set(this.projectDirectoryStorageKey, known.directory);
          return known.directory;
        }
        return known;
      }
      await this.clearProjectDirectoryHandle();
      const error = new Error('Saved runs are not connected. Open Manage Runs and choose Connect Model Folder to authorize the folder containing this .ssd file.');
      error.code = 'PROJECT_DIRECTORY_NOT_CONNECTED';
      throw error;
    }

    // Explicit button click: call the native picker before any IndexedDB or
    // permission awaits can consume the browser's transient user activation.
    // Browsers do not reveal a file's parent directory automatically.
    let directoryHandle;
    try {
      directoryHandle = await window.showDirectoryPicker({
        id: "systemika-project-directory",
        mode: "readwrite",
        startIn: this.fileHandle || "documents",
      });
    } catch (error) {
      if (error && (error.name === "SecurityError" || error.name === "NotAllowedError")) {
        const wrapped = new Error("The browser could not open a local project folder. Select a normal folder on your computer containing the .ssd file, not the localhost website. If the browser blocks folder access, cancel and continue editing; Systemika will not keep reopening the picker.");
        wrapped.code = "PROJECT_DIRECTORY_USER_ACTIVATION_REQUIRED";
        throw wrapped;
      }
      throw error;
    }
    const allowed = await this.verifyPermission(directoryHandle, true);
    if (!allowed) {
      const error = new Error("Systemika needs read/write permission to the model's project folder in order to manage Runs.");
      error.code = "PROJECT_DIRECTORY_PERMISSION_DENIED";
      throw error;
    }
    let recoveredHandle = null;
    if (this.fileHandle) {
      if (!await this.directoryContainsCurrentModel(directoryHandle)) {
        // The user may deliberately switch to another folder containing a
        // copy of the same model. A filename match alone is insufficient:
        // check the actual saved bytes before switching the working file.
        try {
          const candidate = await directoryHandle.getFileHandle(this.fileHandle.name, { create: false });
          const [previousFile, candidateFile] = await Promise.all([
            this.fileHandle.getFile(), candidate.getFile(),
          ]);
          if (await this.fingerprintContents(await previousFile.text()) ===
              await this.fingerprintContents(await candidateFile.text())) {
            recoveredHandle = candidate;
          }
        } catch (_) { /* Missing or inaccessible model; reject below. */ }
        if (!recoveredHandle) {
          const error = new Error(`The selected folder must contain the same saved model (${this.fileHandle.name}). Select its containing folder, not the Runs subfolder. Other models cannot share this connection.`);
          error.code = "WRONG_PROJECT_DIRECTORY";
          throw error;
        }
      }
    } else {
      try {
        recoveredHandle = await directoryHandle.getFileHandle(this.fileName, { create: false });
        const file = await recoveredHandle.getFile();
        const fingerprint = await this.fingerprintContents(await file.text());
        if (fingerprint !== this.openedModelFingerprint) recoveredHandle = null;
      } catch (_) { recoveredHandle = null; }
      if (!recoveredHandle) {
        const error = new Error(`Select the folder containing the exact model file you opened (${this.fileName}). A different model with the same name will not be connected.`);
        error.code = "WRONG_PROJECT_DIRECTORY";
        throw error;
      }
      await this.setFileHandle(recoveredHandle);
    }

    // A successfully matched copy becomes the working model's save target;
    // do not leave a valid run folder paired with a different model file.
    if (this.fileHandle && recoveredHandle && this.fileHandle !== recoveredHandle) {
      await this.setFileHandle(recoveredHandle);
    }

    await this.rememberProjectFolder(directoryHandle);
    return directoryHandle;
  }

  hasSaveAs() {
    return true;
  }

  hasRecentFiles() {
    return true;
  }
  async getRecentDisplayList() {
    let recentFiles = await this.getRecentFiles();
    return recentFiles.map((fileHandle) => {
      return fileHandle.name;
    })
  }
  async getRecentFiles() {
    let recentFiles;
    try {
      recentFiles = await idbKeyval.get("recentFiles") ?? []
    } catch {
      recentFiles = [];
    }
    return recentFiles;
  }
  async setRecentFiles(recentFiles) {
    idbKeyval.set("recentFiles", recentFiles);
  }
  async clearRecent() {
    idbKeyval.set("recentFiles", []);
  }

  async removeDuplicatesFromRecent(fileHandle, recentFiles) {
    let newRecentFiles = []
    for (let i in recentFiles) {
      if (!await recentFiles[i].isSameEntry(fileHandle)) {
        newRecentFiles.push(recentFiles[i]);
      }
    }
    return newRecentFiles;
  }

  async addToRecent() {
    let limit = Settings.MaxRecentFiles;

    let recentFiles = await this.getRecentFiles();

    recentFiles = await this.removeDuplicatesFromRecent(this.fileHandle, recentFiles);

    if (recentFiles.length <= limit) {
      recentFiles.splice(limit - 1);
    }
    recentFiles.unshift(this.fileHandle);
    await this.setRecentFiles(recentFiles);
  }
  async loadRecentByIndex(recentFileIndex) {
    const recentFiles = await this.getRecentFiles();
    const fileHandle = recentFiles[recentFileIndex];
    await this.loadFromFileHandle(fileHandle);
  }

  getFilePickerOptions() {
    return {
      suggestedName: "model.ssd",
      types: [
        {
          description: "Systemika Models",
          accept: {
            "application/octet-stream": [".ssd"],
          },
        },
      ],
    };
  }

  async chooseFilename() {
    // Save As doubles as project-folder authorization. A file picker only gives
    // us the selected file handle; browsers deliberately do not reveal its
    // parent directory. Choosing the project directory first means the exact
    // same handle can immediately back Runs/*.sysrun without a second privileged
    // picker operation on the first simulation run.
    const startIn = this.projectDirectoryHandle || "documents";
    const directoryHandle = await window.showDirectoryPicker({
      id: "systemika-project-directory",
      mode: "readwrite",
      startIn,
    });

    const allowed = await this.verifyPermission(directoryHandle, true);
    if (!allowed) {
      const error = new Error("Systemika needs read/write permission to the selected project folder.");
      error.code = "PROJECT_DIRECTORY_PERMISSION_DENIED";
      throw error;
    }

    const suggested = this.appendFileExtension(this.defaultExportBaseName(), Settings.fileExtension);
    let chosenName = window.prompt("Model file name", suggested);
    if (chosenName === null) return false;
    chosenName = String(chosenName).trim();
    if (!chosenName) {
      const error = new Error("Enter a file name for the model.");
      error.code = "INVALID_MODEL_FILENAME";
      throw error;
    }
    if (/[\\/]/.test(chosenName)) {
      const error = new Error("The model file name cannot contain / or \\ characters.");
      error.code = "INVALID_MODEL_FILENAME";
      throw error;
    }
    chosenName = this.appendFileExtension(chosenName, Settings.fileExtension);

    let existingHandle = null;
    try {
      existingHandle = await directoryHandle.getFileHandle(chosenName, { create: false });
    } catch (error) {
      if (!error || error.name !== "NotFoundError") throw error;
    }
    if (existingHandle) {
      const sameAsCurrent = await this.sameEntry(existingHandle, this.fileHandle);
      if (!sameAsCurrent && typeof window.confirm === "function"
          && !window.confirm(`A file named "${chosenName}" already exists in this folder. Replace it?`)) {
        return false;
      }
    }

    const chosenHandle = existingHandle || await directoryHandle.getFileHandle(chosenName, { create: true });
    await this.setFileHandle(chosenHandle);
    await this.rememberProjectFolder(directoryHandle);
    this.fileName = this.fileHandle.name;
    return true;
  }
  async writeToFile(contents) {
    const writable = await this.fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();
  }

  async updateUIAfterSave(savedState) {
    this.updateSaveTime();
    this.updateTitle();
    markModelSaved(savedState);
    if (this.finishedSaveHandler) {
      this.finishedSaveHandler();
    }
  }

  // Export auxiliary files (equations, tables, graphs, etc.) without changing
  // the model's current .ssd file handle.  The modern Web file manager used to
  // omit this method entirely, so calls such as Export Equations silently fell
  // back to an undefined function in the WebApp.
  async exportFile(dataToSave, fileExtension, onSuccess) {
    if (onSuccess == undefined) onSuccess = () => { };
    const extension = String(fileExtension || "").startsWith(".")
      ? String(fileExtension)
      : `.${String(fileExtension || "txt")}`;
    const suggestedName = this.appendFileExtension(this.defaultExportBaseName(), extension);
    const ext = extension.replace(/^\./, "");
    try {
      if (typeof window.showSaveFilePicker === "function") {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{
            description: `${ext.toUpperCase()} file`,
            accept: { "application/octet-stream": [extension] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(dataToSave);
        await writable.close();
        onSuccess(handle.name || suggestedName);
        return handle.name || suggestedName;
      }
    } catch (error) {
      if (error && error.name === "AbortError") return null;
      console.error("Unable to export file with the browser file picker", error);
    }

    // Defensive fallback for Chromium variants where a File System Access
    // method is exposed but not usable in the current embedding context.
    const blob = new Blob([dataToSave], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { window.URL.revokeObjectURL(url); a.remove(); }, 100);
    onSuccess(suggestedName);
    return suggestedName;
  }

  async saveModelAs() {
    let contents = createModelFileData();
    try {
      if (!await this.chooseFilename()) return null;
      await this.writeToFile(contents);
      await this.addToRecent();
      await this.updateUIAfterSave(contents);
      return this.fileName;
    } catch (e) {
      if (e && e.name === "AbortError") return null;
      console.error(e);
      const message = e && e.message ? e.message : String(e);
      if (typeof xAlert === "function") xAlert(`Unable to save the model.<br/><br/>${message}`);
      else if (typeof window !== "undefined" && typeof window.alert === "function") window.alert(`Unable to save the model.\n\n${message}`);
      return null;
    }
  }

  async saveModel() {
    let contents = createModelFileData();
    if (this.fileHandle == undefined) {
      await this.saveModelAs();
      return;
    }
    await this.writeToFile(contents);
    await this.addToRecent();
    await this.updateUIAfterSave(contents);
  }
  // Open Model uses the standard browser file input rather than Chromium's
  // showOpenFilePicker. The latter has caused native-picker crashes for some
  // users, and a file chooser does not require cross-frame API calls.
  // A writable handle is recovered only from a previously approved folder
  // whose actual model contents match, or via explicit Connect Model Folder.
  loadModel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = Settings.fileExtension;
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      try {
        const file = input.files && input.files[0];
        if (file) await this.loadFromSelectedFile(file);
      } catch (error) {
        console.error('Systemika could not open the selected model', error);
        const message = 'Unable to open the selected model. ' +
          (error && error.message ? error.message : String(error));
        if (typeof xAlert === 'function') xAlert(message.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
        else if (typeof window.alert === 'function') window.alert(message);
      } finally {
        input.remove();
      }
    });
    input.addEventListener('cancel', () => input.remove());
    document.body.appendChild(input);
    input.click();
  }

  async loadFromSelectedFile(file) {
    if (!file || !/\.ssd$/i.test(file.name)) {
      throw new Error('Select a Systemika model (.ssd) file.');
    }
    // Read before altering the current model. Do not allow empty or clearly
    // unrelated files to trigger an editor reload.
    const fileData = await file.text();
    if (!fileData || !/<InsightMakerModel(?:\s|>)/i.test(fileData)) {
      throw new Error('The selected file does not contain a valid Systemika model.');
    }
    const fingerprint = await this.fingerprintContents(fileData);
    const match = await this.findMatchingKnownFolder(file.name, fingerprint);
    // Never silently reuse a handle from the previously opened model.
    await this.setFileHandle(null);
    if (match) {
      await this.setFileHandle(match.handle);
      this.projectDirectoryHandle = match.directory;
      await idbKeyval.set(this.projectDirectoryStorageKey, match.directory);
    } else {
      this.openedModelFingerprint = fingerprint;
      const storage = typeof sessionStorage !== 'undefined' ? sessionStorage : localStorage;
      storage.setItem(this.openedModelFingerprintKey, fingerprint);
    }
    this.fileName = file.name;
    this.storedModelName = null;
    this.lastSaved = null;
    History.forceCustomUndoState(fileData);
    this.updateTitle();
    preserveRestart();
  }

  async verifyPermission(fileHandle, withWrite) {
    // Re-asking for permissons needed after page reload.
    // See:
    // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission
    // https://stackoverflow.com/questions/66500836/domexception-the-request-is-not-allowed-by-the-user-agent-or-the-platform-in-th
    const opts = {};
    if (withWrite) {
      opts.mode = 'readwrite';
    }

    // Check if we already have permission, if so, return true.
    if (await fileHandle.queryPermission(opts) === 'granted') {
      return true;
    }

    // Request permission to the file, if the user grants permission, return true.
    if (await fileHandle.requestPermission(opts) === 'granted') {
      return true;
    }

    // The user did not grant permission, return false.
    return false;
  }

  async loadFromFileHandle(fileHandle) {
    const allowedPermission = await this.verifyPermission(fileHandle, false);
    if (!allowedPermission) {
      return;
    }
    // A remembered folder is reconnected only if permission is already granted
    // and it contains exactly this file. Never carry across stale permissions.
    await this.setFileHandle(fileHandle);
    if (!await this.reconnectKnownFolder(fileHandle)) {
      await this.clearProjectDirectoryHandle();
    }
    const file = await fileHandle.getFile();
    const fileData = await file.text();
    this.fileName = file.name;
    await this.addToRecent();
    History.forceCustomUndoState(fileData);
    this.updateTitle();
    preserveRestart();
  }
}

// Talks to electron/main.js through the bridge electron/preload.js exposes —
// no direct Node or Electron access here, since the renderer runs with
// contextIsolation/sandbox on (see electron/main.js's BrowserWindow options).
class ElectronFileManager extends BaseFileManager {
  constructor() {
    super();
    this.softwareName = appName + " Desktop";
  }

  ready() {
    super.ready();
    getElectronAPI().onOpenFile((filePath) => {
      saveChangedAlert(() => {
        this.loadFromFilePath(filePath);
      });
    });
  }
  hasSaveAs() {
    return true;
  }
  hasRecentFiles() {
    return true;
  }
  async getRecentDisplayList() {
    return await this.getRecentFiles();
  }
  async getRecentFiles() {
    let recentFiles = await idbKeyval.get("recentFiles");
    return Array.isArray(recentFiles) ? recentFiles : [];
  }
  async setRecentFiles(recentFiles) {
    await idbKeyval.set("recentFiles", recentFiles);
  }
  async addToRecent(filePath) {
    let limit = Settings.MaxRecentFiles;
    let recentFiles = await this.getRecentFiles();
    let existingIndex = recentFiles.indexOf(filePath);
    if (existingIndex !== -1) {
      recentFiles.splice(existingIndex, 1);
    }
    recentFiles.unshift(filePath);
    if (recentFiles.length > limit) {
      recentFiles.splice(limit);
    }
    await this.setRecentFiles(recentFiles);
  }
  async clearRecent() {
    await this.setRecentFiles([]);
  }
  async loadRecentByIndex(recentFileIndex) {
    let recentFiles = await this.getRecentFiles();
    let filePath = recentFiles[recentFileIndex];
    if (filePath) {
      await this.loadFromFilePath(filePath);
    }
  }

  async writeFile(filePath, fileData) {
    try {
      await getElectronAPI().writeFile(filePath, fileData);
    } catch (error) {
      console.error(error);
      alert("Error in file saving " + getStackTrace());
      throw error;
    }
  }

  saveModel() {
    if (this.fileName == "") {
      this.saveModelAs();
      return;
    }
    this.doSaveModel(this.fileName);
  }
  async doSaveModel(fileName) {
    let fileData = createModelFileData();
    await this.writeFile(fileName, fileData);
    await this.addToRecent(fileName);
    markModelSaved(fileData);
    this.updateSaveTime();
    this.updateTitle();
    if (this.finishedSaveHandler) {
      this.finishedSaveHandler();
    }
  }

  async saveModelAs() {
    let fileData = createModelFileData();
    return await this.exportFile(fileData, Settings.fileExtension, (filePath) => {
      this.fileName = filePath;
      markModelSaved(fileData);
      this.addToRecent(this.fileName);
      this.updateSaveTime();
      this.updateTitle();
      if (this.finishedSaveHandler) {
        this.finishedSaveHandler();
      }
    });
  }

  // A general file export function that can export any kind of file (also
  // used for CSV table exports, not just the model itself).
  async exportFile(dataToSave, fileExtension, onSuccess) {
    if (onSuccess == undefined) {
      onSuccess = () => { };
    }
    let suggestedName = this.appendFileExtension(this.defaultExportBaseName(), fileExtension);
    let filePath = await getElectronAPI().showSaveDialog(suggestedName, fileExtension);
    if (!filePath) {
      return null;
    }
    filePath = this.appendFileExtension(filePath, fileExtension);
    await this.writeFile(filePath, dataToSave);
    onSuccess(filePath);
    return filePath;
  }

  async loadModel() {
    let filePath = await getElectronAPI().showOpenDialog(Settings.fileExtension);
    if (filePath) {
      await this.loadFromFilePath(filePath);
    }
  }
  /** @param {string} filePath */
  async loadFromFilePath(filePath) {
    let fileData = await getElectronAPI().readFile(filePath);
    this.fileName = filePath;
    // Loaded from disk, so it has no browser-storage entry behind it.
    this.storedModelName = null;
    await this.addToRecent(filePath);
    History.forceCustomUndoState(fileData);
    this.updateTitle();
    preserveRestart();
  }
}
class BaseEnvironment {
  getName() {
    return "base";
  }
  constructor() {
    this.reloadingStarted = false;
  }
  ready() {
    // Override this
  }
  keyDown(event) {
    // Override this
  }
  getFileManager() {
    // Override this
  }
  openLink(url) {
    // Returns true or false
    // if returning true, the caller will do e.preventDefault()
    // to not trying to open the link the the browsers default way
    // Default: false
    return false;
  }
  openNewWindow() {
    return false;
  }
}

class WebEnvironment extends BaseEnvironment {
  getName() {
    return "web";
  }

  getProjectFileAccessStatus() {
    if (typeof window === "undefined") {
      return { available: false, reason: "NO_WINDOW" };
    }
    if (isLimitedProjectBrowser()) {
      return { available: false, reason: 'UNSUPPORTED_BROWSER' };
    }
    if (window.isSecureContext === false) {
      return { available: false, reason: "INSECURE_CONTEXT" };
    }
    if (typeof window.showOpenFilePicker !== "function" ||
        typeof window.showDirectoryPicker !== "function") {
      return { available: false, reason: "PICKER_API_UNAVAILABLE" };
    }

    // Chromium explicitly blocks File System Access pickers from a frame that
    // is cross-origin to the top-level page. This commonly happens when the
    // source tree is opened directly through file://: modern browsers treat
    // local files as opaque origins, so MultiSimulationAnalyser and its editor
    // iframe are not a usable first-party context for these pickers.
    if (window.top && window.top !== window) {
      if (typeof location !== "undefined" && location.protocol === "file:") {
        return { available: false, reason: "FILE_IFRAME_CONTEXT" };
      }
      try {
        const topOrigin = window.top.location && window.top.location.origin;
        const ownOrigin = window.location && window.location.origin;
        if (topOrigin && ownOrigin && topOrigin !== ownOrigin) {
          return { available: false, reason: "CROSS_ORIGIN_IFRAME" };
        }
      } catch (_) {
        return { available: false, reason: "CROSS_ORIGIN_IFRAME" };
      }
    }

    return { available: true, reason: null };
  }
  showBrowserCompatibilityStatus() {
    if (typeof document === "undefined") return false;
    const notice = document.getElementById("systemika-browser-compatibility-status");
    if (!notice) return false;
    if (!notice.style) notice.style = {};
    notice.style.display = "flex";
    return true;
  }
  showFirefoxCompatibilityStatus() {
    return this.showBrowserCompatibilityStatus();
  }

  showUnsupportedBrowserScreen() {
    if (typeof document === 'undefined') return false;
    let hostDocument = document;
    try {
      if (window.top && window.top !== window && window.top.document && window.top.document.body) {
        hostDocument = window.top.document;
      }
    } catch (_) { /* Cross-origin embedding: use the editor document. */ }
    if (!hostDocument.body || typeof hostDocument.createElement !== 'function') return false;
    if (hostDocument.getElementById('systemika-unsupported-browser-screen')) return true;
    const screen = hostDocument.createElement('div');
    screen.id = 'systemika-unsupported-browser-screen';
    screen.setAttribute('role', 'alertdialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-label', 'Unsupported web browser');
    screen.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#f5f6f8;display:flex;justify-content:center;align-items:center;padding:24px;box-sizing:border-box';
    const panel = hostDocument.createElement('div');
    panel.style.cssText = 'background:#fff;color:#20242b;padding:32px;border-radius:12px;max-width:560px;min-width:0;width:100%;box-sizing:border-box;box-shadow:0 8px 30px #0002;font:16px/1.5 system-ui,sans-serif;white-space:normal;overflow-wrap:anywhere;word-break:normal';
    const heading = hostDocument.createElement('h1');
    heading.textContent = 'Browser not supported';
    heading.style.cssText = 'display:block;font:700 24px/1.3 system-ui,sans-serif;margin:0 0 16px;white-space:normal;overflow-wrap:anywhere';
    const message = hostDocument.createElement('p');
    message.textContent = 'Systemika Studio WebApp requires Google Chrome or Microsoft Edge with local file access enabled. Open this page in a supported browser, or use Systemika Studio Desktop.';
    message.style.cssText = 'display:block;max-width:100%;margin:0 0 12px;white-space:normal;overflow-wrap:anywhere;word-break:normal;font:400 16px/1.5 system-ui,sans-serif';
    const help = hostDocument.createElement('p');
    help.textContent = 'Your models and simulation runs have not been changed.';
    help.style.cssText = 'display:block;max-width:100%;margin:0;color:#555;white-space:normal;overflow-wrap:anywhere;font:400 14px/1.5 system-ui,sans-serif';
    panel.append(heading, message, help);
    screen.appendChild(panel);
    hostDocument.body.appendChild(screen);
    return true;
  }

  ready() {
    if (typeof document !== "undefined") {
      const aboutButton = document.getElementById("btn_about");
      if (aboutButton) aboutButton.textContent = "About Systemika Studio";
    }
    if (isLimitedProjectBrowser() || !this.getProjectFileAccessStatus().available) {
      this.showUnsupportedBrowserScreen();
    }
    return null;
    /*
    window.onbeforeunload = (e) => {
      if (this.reloadingStarted) {
        // We never want to complain if we have initialized a reload
        // We only want to complain when the user is closing the page
        return null;
      }
      if (History.unsavedChanges) {
        return 'You have unsaved changes. Are you sure you want to quit?';
      } else {
        return null;
      }
    };
    */
  }
  openNewWindow() {
    try {
      const host = window.top || window;
      const url = host.location.href;
      // window.open() normally clones the opener's sessionStorage into the new
      // browsing context.  Open about:blank first so we can deliberately clear
      // that copied model/history state before loading another Systemika editor.
      const opened = host.open("about:blank", "_blank");
      if (opened) {
        try { opened.sessionStorage.clear(); } catch (_) {}
        opened.location.replace(url);
        try { opened.focus(); } catch (_) {}
        return true;
      }
    } catch (error) {
      console.error(error);
    }
    if (typeof xAlert === "function") {
      xAlert("Systemika could not open another model window. Allow pop-up windows for this site and try again.");
    }
    return false;
  }

  getFileManager() {
    const status = this.getProjectFileAccessStatus();
    if (status.available) {
      return new WebFileManagerModern();
    }

    // Do not pretend that API presence is enough. A picker exposed inside a
    // cross-origin iframe will still throw SecurityError. The fallback manager
    // carries the concrete reason so the UI can tell the user how to get full
    // project-file mode rather than failing only after Save/Manage Runs.
    return new WebFileManagerBasic(status.reason);
  }
}

class ElectronEnvironment extends BaseEnvironment {
  getName() {
    return "electron";
  }
  ready() {
    // electron/main.js intercepts the window's close button and asks here
    // first, so unsaved changes can be checked before the app actually quits.
    getElectronAPI().onTryToClose(() => {
      quitQuestion();
    });
  }
  getFileManager() {
    return new ElectronFileManager();
  }
  openNewWindow() {
    const api = getElectronAPI();
    if (api && typeof api.openNewWindow === "function") {
      api.openNewWindow();
      return true;
    }
    return false;
  }
  closeWindow() {
    // Tells main.js it's safe to actually close the window now — see the
    // matching "window:confirm-close" handler in electron/main.js.
    getElectronAPI().confirmClose();
  }
  openLink(url) {
    // Returns true or false
    // if returning true, the caller will do e.preventDefault()
    // to not trying to open the link the the browsers default way
    // Default: false
    getElectronAPI().openExternal(url);
    // Return true, because we dont want it to Also open it the default way
    return true;
  }
}

// contextIsolation is on (see electron/main.js), so there is no Node/Electron
// global in the renderer. The editor normally runs inside MultiSimulationAnalyser's
// iframe. Electron usually injects the preload into subframes, but relying on that
// alone is fragile. Resolve the bridge from this frame first and then from the
// same-origin parent/top frame, where preload injection is guaranteed.
function getElectronAPI() {
  if (typeof window.electronAPI !== "undefined") return window.electronAPI;
  try {
    if (window.parent && window.parent !== window && typeof window.parent.electronAPI !== "undefined") {
      return window.parent.electronAPI;
    }
  } catch (_) {}
  try {
    if (window.top && typeof window.top.electronAPI !== "undefined") return window.top.electronAPI;
  } catch (_) {}
  return null;
}

function isRunningElectron() {
  const api = getElectronAPI();
  return Boolean(api && api.isElectron === true);
}

function detectEnvironment() {
  if (isRunningElectron()) {
    return new ElectronEnvironment();
  } else {
    return new WebEnvironment();
  }
}

// Set global variable for environment and fileManager
var environment = detectEnvironment();
var fileManager = environment.getFileManager();

// Uncomment for debugging
// alert("Running in environment " + environment.getName())
