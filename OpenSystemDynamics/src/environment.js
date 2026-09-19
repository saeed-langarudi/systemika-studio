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
    localStorage.removeItem("reloadPending");
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
  async ensureRunStorageAccess() {
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
  updateTitle() {
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
  }

  // Keep the web browser tab concise. File/storage state is shown inside the UI.
  updateTitle() {
    if (typeof window !== "undefined" && window !== window.top) setParentTitle(webAppName);
    else if (typeof document !== "undefined") document.title = webAppName;
  }

  async init() {
    this.fileHandle = await idbKeyval.get('fileHandle');
    this.projectDirectoryHandle = await idbKeyval.get('systemikaProjectDirectoryHandle');
  }

  async clean() {
    await idbKeyval.del('fileHandle');
    await idbKeyval.del('systemikaProjectDirectoryHandle');
    this.fileHandle = undefined;
    this.projectDirectoryHandle = undefined;
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
    await idbKeyval.del('systemikaProjectDirectoryHandle');
  }

  async setFileHandle(fileHandle) {
    const sameFile = await this.sameEntry(this.fileHandle, fileHandle);
    this.fileHandle = fileHandle;
    await idbKeyval.set('fileHandle', this.fileHandle);
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

  async ensureRunStorageAccess() {
    if (!this.supportsProjectRunStorage()) {
      const error = new Error("This browser cannot grant Systemika access to a local project folder.");
      error.code = "RUN_STORAGE_UNAVAILABLE";
      throw error;
    }
    if (!this.fileHandle) {
      const error = new Error("Save or open the model as a local .ssd file before managing persistent simulation runs.");
      error.code = "MODEL_NOT_SAVED";
      throw error;
    }

    if (this.projectDirectoryHandle) {
      const allowed = await this.verifyPermission(this.projectDirectoryHandle, true);
      if (allowed && await this.directoryContainsCurrentModel(this.projectDirectoryHandle)) {
        return this.projectDirectoryHandle;
      }
      await this.clearProjectDirectoryHandle();
    }

    // Browsers deliberately do not expose a selected file's parent directory.
    // Ask the user to authorize the model's project folder; startIn points the
    // picker at the model handle so supported browsers open in the right place.
    let directoryHandle;
    try {
      directoryHandle = await window.showDirectoryPicker({
        id: "systemika-project-directory",
        mode: "readwrite",
        startIn: this.fileHandle,
      });
    } catch (error) {
      if (error && error.name === "NotAllowedError") {
        const wrapped = new Error("The browser requires a fresh click before it can authorize the project folder. Click Run or Manage Runs again, then select the folder containing the current .ssd model.");
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
    if (!await this.directoryContainsCurrentModel(directoryHandle)) {
      const error = new Error(`The selected folder does not contain the currently open model (${this.fileHandle.name}). Select that model's containing folder.`);
      error.code = "WRONG_PROJECT_DIRECTORY";
      throw error;
    }

    this.projectDirectoryHandle = directoryHandle;
    await idbKeyval.set('systemikaProjectDirectoryHandle', directoryHandle);
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
            "text/stochsd": [".ssd"],
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
    const startIn = this.projectDirectoryHandle || this.fileHandle || "documents";
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
    this.projectDirectoryHandle = directoryHandle;
    await idbKeyval.set('systemikaProjectDirectoryHandle', directoryHandle);
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
  async loadModel() {
    const options = this.getFilePickerOptions();
    const [tmpFileHandle] = await window.showOpenFilePicker(options);
    await this.loadFromFileHandle(tmpFileHandle);
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
    await this.setFileHandle(fileHandle);
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
}

class WebEnvironment extends BaseEnvironment {
  getName() {
    return "web";
  }

  getProjectFileAccessStatus() {
    if (typeof window === "undefined") {
      return { available: false, reason: "NO_WINDOW" };
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

  ready() {
    if (typeof document !== "undefined") {
      const aboutButton = document.getElementById("btn_about");
      if (aboutButton) aboutButton.textContent = "About Systemika Studio";
    }
    if (isLimitedProjectBrowser()) {
      // Firefox and Safari remain in limited project-storage mode. Keep the
      // guidance permanently visible in the normal status bar instead of using
      // a modal or floating notice.
      this.showBrowserCompatibilityStatus();
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
