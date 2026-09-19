/*

This file may distributed and/or modified under the
terms of the Affero General Public License (http://www.gnu.org/licenses/agpl-3.0.html).

*/

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard, ClipboardItem, nativeImage } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const systemikaRunStore = require("./systemika-run-package");

// Keep the npm package identifier lowercase (systemika), but expose the
// correctly capitalized product name to Electron and desktop environments.
app.setName("Systemika Studio");

// Paths are relative to this file so the same code works both run from the
// repo root in development ("electron .") and from the copy the packaging build assembles
// under distribute/output — both keep electron/ as a sibling of start.html
// and app-icons/.
const appRoot = path.join(__dirname, "..");
const entryPoint = path.join(appRoot, "start.html");
const iconPath = path.join(appRoot, "app-icons", "systemika.png");
const fileExtension = ".ssd";

let mainWindow;
// A file path the app was launched with (double-clicked, "Open with…", or a
// CLI argument), captured before the window exists so it isn't lost.
let pendingOpenFilePath = readFilePathFromArgv(process.argv);

// Only one window: a second launch (e.g. double-clicking another .ssd file)
// hands its file path to this instance instead of opening a second window.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
	app.quit();
} else {
	app.on("second-instance", (event, argv) => {
		let filePath = readFilePathFromArgv(argv);
		if (filePath) {
			sendOpenFile(filePath);
		}
		if (mainWindow) {
			if (mainWindow.isMinimized()) {
				mainWindow.restore();
			}
			mainWindow.focus();
		}
	});

	// macOS delivers a file-association launch as this event, separately from
	// argv, and can fire before the app is ready.
	app.on("open-file", (event, filePath) => {
		event.preventDefault();
		if (mainWindow) {
			sendOpenFile(filePath);
		} else {
			pendingOpenFilePath = filePath;
		}
	});

	app.whenReady().then(() => {
		// The app has its own in-page menu bar (the "File"/"View"/… buttons in
		// index.html); Electron's default native menu would just duplicate it.
		Menu.setApplicationMenu(null);
		createWindow();
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			app.quit();
		}
	});

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
}

function readFilePathFromArgv(argv) {
	// argv[0] is the electron binary and, in development, argv[1] is "."
	// (the app path); a real launch file is whatever is left after those.
	let args = app.isPackaged ? argv.slice(1) : argv.slice(2);
	let filePath = args.find((arg) => arg.toLowerCase().endsWith(fileExtension));
	return filePath || null;
}

function sendOpenFile(filePath) {
	mainWindow.webContents.send("app:open-file", filePath);
}

function createWindow() {
	let readyToClose = false;

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		icon: iconPath,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			// The actual editor (environment.js, editor.js) runs inside
			// MultiSimulationAnalyser's #SimulationIFrame, not the top-level page —
			// without this the preload script only reaches the outer frame, so
			// window.electronAPI is undefined where detectEnvironment() checks for
			// it and the app silently falls back to browser-storage behavior.
			nodeIntegrationInSubFrames: true,
		},
	});

	mainWindow.maximize();
	mainWindow.setMenuBarVisibility(false);
	mainWindow.setTitle(`Systemika ${app.getVersion()}`);
	// The Output panel uses window.open() when detached. Electron maps that to a
	// real BrowserWindow, so the detached panel can be moved to another monitor.
	// Keep that popup independent of the main window rather than constraining it
	// as an in-window overlay or modal child.
	mainWindow.webContents.setWindowOpenHandler(({ frameName }) => {
		if (frameName === "SystemikaOutputWindow") {
			return {
				action: "allow",
				overrideBrowserWindowOptions: {
					width: 760,
					height: 760,
					minWidth: 360,
					minHeight: 300,
					resizable: true,
					parent: null,
				}
			};
		}
		return { action: "allow" };
	});
	mainWindow.loadFile(entryPoint);

	mainWindow.webContents.on("did-finish-load", () => {
		if (pendingOpenFilePath) {
			sendOpenFile(pendingOpenFilePath);
			pendingOpenFilePath = null;
		}
	});

	// Unsaved changes are checked in the renderer (History.unsavedChanges), so
	// closing has to round-trip through it rather than happen here directly.
	// The listener for this lives in environment.js, which runs inside
	// #SimulationIFrame (OpenSystemDynamics), not the top-level document — so
	// this has to be targeted at that sub-frame explicitly. webContents.send()
	// only reaches the main frame and the message would otherwise be dropped,
	// leaving the window unable to close.
	mainWindow.on("close", (event) => {
		if (readyToClose) {
			return;
		}
		event.preventDefault();
		let targetFrame = mainWindow.webContents.mainFrame.framesInSubtree.find(
			(frame) => frame.url.includes("OpenSystemDynamics")
		);
		if (targetFrame) {
			targetFrame.send("window:try-close");
		} else {
			// Sub-frame not loaded yet, so nothing is tracking unsaved changes.
			readyToClose = true;
			mainWindow.close();
		}
	});

	mainWindow.confirmClose = () => {
		readyToClose = true;
		// Renderer consent has already been obtained. destroy() bypasses the
		// intercepted close event entirely, so "No" (discard changes) cannot
		// fall back into another close round-trip or get stranded on Linux.
		if (!mainWindow.isDestroyed()) mainWindow.destroy();
	};
}

// Registered once at module scope (not inside createWindow) so a second
// window — e.g. after all windows closed and the dock icon reopened one on
// macOS — doesn't add a duplicate listener.
ipcMain.handle("window:confirm-close", async () => {
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.confirmClose();
	}
	return true;
});

ipcMain.handle("dialog:save", async (event, defaultPath, extension) => {
	let ext = (extension || fileExtension).replace(/^\./, "");
	let result = await dialog.showSaveDialog(mainWindow, {
		defaultPath,
		filters: [
			{ name: ext === "ssd" ? "Systemika Models" : ext.toUpperCase() + " Files", extensions: [ext] },
			{ name: "All Files", extensions: ["*"] },
		],
	});
	return result.canceled ? null : result.filePath;
});

ipcMain.handle("dialog:open", async (event, extension) => {
	let result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openFile"],
		filters: [
			{ name: "Systemika Models", extensions: [(extension || fileExtension).replace(/^\./, "")] },
			{ name: "All Files", extensions: ["*"] },
		],
	});
	return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("file:read", async (event, filePath) => {
	return fs.readFile(filePath, "utf8");
});

ipcMain.handle("file:write", async (event, filePath, contents) => {
	await fs.writeFile(filePath, contents, "utf8");
});

ipcMain.handle("file:write-base64", async (event, filePath, base64Contents) => {
	await fs.writeFile(filePath, Buffer.from(String(base64Contents || ""), "base64"));
});

ipcMain.handle("clipboard:write-png", async (event, base64Contents) => {
	const buffer = Buffer.from(String(base64Contents || ""), "base64");
	const image = nativeImage.createFromBuffer(buffer);
	if (image.isEmpty()) throw new Error("Unable to create a clipboard image from the rendered figure.");

	// Electron 44 removed the legacy image-specific clipboard helper. The main
	// process now uses the W3C-style clipboard.write()/ClipboardItem API.
	// Re-encoding through nativeImage also validates that the renderer supplied
	// a real PNG before anything is written to the operating-system clipboard.
	const pngBuffer = image.toPNG();
	await clipboard.write([
		new ClipboardItem({
			"image/png": new Blob([pngBuffer], { type: "image/png" }),
		}),
	]);
	return true;
});

ipcMain.handle("shell:open-external", async (event, url) => {
	await shell.openExternal(url);
});


// Persistent Systemika simulation runs. The renderer supplies the currently
// saved model path for each request, so run files are always stored beside the
// model that produced them and the main process does not maintain a second,
// potentially stale copy of model-file state.
ipcMain.handle("systemika:runs:exists", async (event, modelPath, runLabel) => {
	await systemikaRunStore.ensureRunsDirectory(modelPath);
	return systemikaRunStore.runExists(modelPath, runLabel);
});

ipcMain.handle("systemika:runs:save", async (event, modelPath, payload) => {
	const resolvedModelPath = systemikaRunStore.assertSavedModelPath(modelPath);
	const metadata = {
		...(payload.metadata || {}),
		software: {
			application: "Systemika",
			version: app.getVersion(),
			...((payload.metadata && payload.metadata.software) || {}),
		},
		model: {
			...((payload.metadata && payload.metadata.model) || {}),
			file: path.basename(resolvedModelPath),
		},
	};
	return systemikaRunStore.writeRunPackage({
		modelPath: resolvedModelPath,
		runLabel: payload.runLabel,
		csv: payload.csv,
		metadata,
		overwrite: Boolean(payload.overwrite),
	});
});

ipcMain.handle("systemika:runs:load", async (event, modelPath, runLabel) => {
	return systemikaRunStore.readRunPackage({ modelPath, runLabel });
});

ipcMain.handle("systemika:runs:list", async (event, modelPath) => {
	return systemikaRunStore.listRuns(modelPath);
});

ipcMain.handle("systemika:runs:rename", async (event, modelPath, sourceLabel, targetLabel) => {
	return systemikaRunStore.renameRun(modelPath, sourceLabel, targetLabel);
});

ipcMain.handle("systemika:runs:duplicate", async (event, modelPath, sourceLabel, targetLabel) => {
	return systemikaRunStore.duplicateRun(modelPath, sourceLabel, targetLabel);
});

ipcMain.handle("systemika:runs:delete", async (event, modelPath, runLabel) => {
	return systemikaRunStore.deleteRun(modelPath, runLabel);
});

ipcMain.handle("systemika:runs:open-folder", async (event, modelPath) => {
	const dir = await systemikaRunStore.ensureRunsDirectory(modelPath);
	const errorText = await shell.openPath(dir);
	if (errorText) throw new Error(errorText);
	return dir;
});

// Use an Electron-owned asynchronous message box rather than window.confirm()
// inside the nested model-editor frame. Native JS confirm dialogs in a nested
// frame can become visually present but unable to receive pointer input on
// some Electron/platform combinations.
ipcMain.handle("systemika:runs:confirm-overwrite", async (event, runLabel) => {
	const label = String(runLabel || "Base");
	const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
	const result = await dialog.showMessageBox(owner, {
		type: "question",
		title: "Overwrite simulation run?",
		message: `A simulation run named "${label}" already exists.`,
		detail: "Do you want to overwrite the existing run file?",
		buttons: ["Overwrite", "Cancel"],
		defaultId: 1,
		cancelId: 1,
		noLink: true,
	});
	return result.response === 0;
});
