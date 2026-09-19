# Systemika persistent simulation runs

## Revision 10 interaction controls

- A newly started Advance run is created as a named live in-memory run before display selection changes. This prevents selector refresh from pruning the new label and makes the Advance run automatically appear in plots/tables immediately.
- The user-facing **Reset** toolbar button has been removed. The completion control is now named **Advance to End**.
- Simulation Settings includes **Time Step (DT)** and **Advance By**. New models use DT 0.25; Advance By defaults to 1 time unit and accepts integers >= 1.
- Each press of **Advance** runs forward by the configured Advance By interval rather than one integration timestep. During an active Advance run, Advance By can be changed in Simulation Settings and the new value applies to the next Advance click.
- Plot contents are HTML overlays above SVG borders; revision 10 explicitly scales/repositions those overlays with the canvas zoom factor so plots zoom as a single visual object.

## Revision 9 interaction controls

- The multi-run toggle now uses one fixed label, **Select / Deselect All**, with a stable width so plot/table property dialogs do not resize when toggled.
- Starting Advance snapshots the run selection of every existing plot and table before the new Advance run is auto-selected.
- Reset restores that exact pre-Advance selection state, discards only the unfinished Advance trajectory, and refreshes outputs from the remaining saved runs.
- Displays created during Advance lose only the discarded transient run on Reset; any other saved runs selected in those displays remain selected.

## Revision 8 interaction controls

- The toolbar folder icon opens the in-app **Manage Runs** dialog instead of the operating-system file manager. Runs can be renamed, deleted individually, or removed together with **Delete All**.
- **Advance to End** completes a paused Advance simulation; **Clear Outputs** clears plot/table rendering only.
- While Advance is paused, Systemika can hot-recompile edited model formulations while preserving the current stock state and compatible stateful-function history. State-dependent Flow/Auxiliary equations therefore take effect on the remaining trajectory.
- New Stocks/Auxiliaries/Constants/Flows can be added during the paused Advance run and are incorporated by the same live recompile path. Deletion is deliberately guarded: after confirmation, Systemika first advances the current stepped run to its configured end and only then applies the deletion.
- Reset during Advance removes only the unfinished current run from outputs; previously selected saved runs remain displayed. Deleted runs are automatically deselected.
- Time Plot, XY Plot, Histogram, and Table provide a **Select All / Deselect All** run toggle.


Systemika now stores every completed **normal user-initiated model run** independently of plots and tables.

## User behavior

- The toolbar contains **Run Name**, defaulting to `Base`. Pressing **Enter**, **Ctrl/Cmd+1**, or **Ctrl/Cmd+R** while the cursor remains in this field runs/pauses the model; ordinary text entry does not activate single-letter editor shortcuts.
- Starting a run creates a `Runs` directory beside the saved `.ssd` model.
- A completed run is written as `Runs/<Run Name>.sysrun`.
- Reusing an existing Run Name prompts before the simulation starts. Systemika uses its in-app Yes/No dialog first for cross-platform reliability (including Linux); the Electron-native message box is retained only as a fallback.
- The folder button beside **Run Name** opens Systemika's in-app **Manage Runs** panel for rename, individual delete, and **Delete All** operations. Typing a run name inside Manage Runs is isolated from canvas/tool shortcuts.
- Legacy TimePlot objects loaded from older models use a single **Run data** selector.
- The current Systemika **Time Plot**, **XY Plot**, **Histogram**, and **Table** contain named-run checklists and can combine two or more saved runs. Newly completed runs are selected automatically.
- The run-data panels provide **Refresh** and **Manage Runs** controls. Multi-run panels also provide **Select All / Deselect All**.
- If the model has never been saved, the normal Save As dialog is shown before the first persistent run.
- Optimizer, parameter-estimation, sensitivity and other internal simulation-engine calls are not automatically persisted.

## `.sysrun` format

A `.sysrun` is a standard ZIP-compatible archive containing:

- `data.csv` — Time plus all Stock, Flow, Variable/Constant and Converter values captured by the normal simulation run.
- `metadata.json` — run label, creation time, application/version, model filename, simulation settings and primitive definitions/attributes.

CSV is compressed inside the package, reducing disk usage while retaining an open, portable underlying representation. The format is versioned through `metadata.json -> formatVersion`.

## Architecture

- `electron/systemika-run-package.js` implements package creation, loading, filename sanitation, overwrite protection and atomic replacement.
- `electron/main.js` exposes run filesystem operations through Electron IPC.
- `electron/preload.js` exposes run operations as `window.electronAPI.runs`, alongside the already-established model file bridge. A legacy `window.systemikaRuns` alias remains for compatibility.
- `OpenSystemDynamics/src/systemika-run-data-manager.js` is the renderer-side data abstraction for current/persisted runs.
- `OpenSystemDynamics/src/systemika-run-manager.js` coordinates the toolbar, pre-run overwrite check and post-run persistence.
- `RunResults` remains the live simulation buffer. On completion it is mirrored to the central data manager, and the existing plot/table result getters read from that manager for post-run visualization/reporting.

## Tests

From the repository root:

```sh
node --test tests/systemika-runs.test.js
```


## 2026.09.08 integration correction

The editor is hosted in `MultiSimulationAnalyser/SimulationIFrame`. Run storage now uses the established `electronAPI` bridge rather than a separate iframe-sensitive bridge object. The Run Name control remains visible in browser mode, but the toolbar visibly reports `Runs not saved`; clicking the folder control explains that project-local run storage requires Systemika Desktop.


## 2026.09.08 revision 2

Time Plot no longer depends on receiving a future run-finished event to populate the current run. If it is created after a successful simulation, it immediately reads the completed current dataset. Its run source is a list (`RunNames`). Each selected run is loaded independently through `SimulationDataManager`, then passed through the existing `DataGenerations` plotting structure. XY Plot and Histogram now use the same `RunNames` selection model. XY Plot builds one XY/scatter series per selected run; Histogram overlays one distribution per selected run using shared bin edges.

Desktop overwrite confirmation no longer calls `window.confirm()` from the nested editor frame. `electron/main.js` owns the message box and returns the result asynchronously through `electronAPI.runs.confirmOverwrite()`.

## 2026.09.09 revision 3

- Run selectors show actual run labels only; the internal live/current source is no longer displayed as `Current / latest (...)`.
- Legacy Compare Plot generation-management controls were removed; the multi-run display is now exposed simply as **Time Plot**.
- Advance snapshots partial results before display refresh, so plots and tables update after each step.
- Tables, XY Plot, and Histogram use the same multi-run checklist as Time Plot. Multi-run tables are aligned by Time and place each run in a separate side-by-side variable column group; CSV exports use run-specific columns.


## 2026.09.09 revision 4

- Every newly completed normal run is automatically selected before plot/table subscribers refresh. Legacy single-run displays switch to the new run; Time Plot, XY Plot, Histogram, and Table append it to their existing selected-run set.
- Time Plot, XY Plot, Histogram, and Table created after a completed run initialize from that actual named run.
- Multi-run Table output is now side-by-side: a shared Time column followed by one group of selected variables for each run. Runs with different time grids are aligned using the union of observed time points, with blank cells where a run has no observation at that time.
- Multi-run table exports use explicit columns such as `Population [Base]`, `Infected [Base]`, `Population [Run 1]`, and `Infected [Run 1]`.


## 2026.09.09 revision 5

- Multi-run Table columns are grouped by variable first and run second. This makes scenario comparison the primary reading direction: each variable has adjacent columns for Base, Run 1, Run 2, etc. CSV exports follow the same order.
- Advance mode keeps outputs interactive while paused and supports live formulation changes/additions through hot recompilation. Destructive deletions remain guarded and finish the active stepped run before the deletion is applied.


## 2026.09.10 revision 8

- Linux overwrite confirmation now prefers the in-app Yes/No dialog to avoid unresponsive native modal buttons on some desktop/window-manager combinations.
- Time Plot, XY Plot, Histogram, and Table share a Select All / Deselect All toggle.
- Advance live edits are handled by a paused-model hot-recompile path rather than the earlier constant-only `setValue()` restriction, allowing state-dependent formulations and newly added entities to affect subsequent steps.
- Advance Reset removes only the transient run. Other selected saved runs stay visible; if the transient run was overwriting an existing saved label, the prior saved run is restored.
- Run deletion immediately removes the deleted label from all display selections. Missing run files are also pruned on selector refresh.


## Revision 14 display refinements

XY Plot uses the original single-series rendering configuration when one run is selected and the comparison renderer for multiple runs. Multi-run table headers are painted as one sticky block to avoid Chromium sticky-border artifacts.

## 2026.09.11 WebApp project-local run storage

On browsers that expose the File System Access picker APIs required for writable
project-directory access, the WebApp now uses the same project layout as the
desktop application:

```text
Project/
  Model.ssd
  Runs/
    Base.sysrun
    Scenario 1.sysrun
```

- **Save As** first selects the Systemika project directory, then creates the
  `.ssd` file inside that directory. The selected directory handle is retained
  for run persistence, so the first simulation does not need a second folder
  discovery step.
- `RunResults` / `SimulationDataManager` still keep the current and recently
  loaded run data in memory for fast plots and tables. The `.sysrun` package on
  the local filesystem is the authoritative persistent copy.
- The WebApp run backend supports save, list, load, rename, duplicate, and
  delete through the same renderer-side contract used by Electron.
- Browser-created `.sysrun` files are standard ZIP packages and are readable by
  the desktop package implementation. The browser reader also accepts the
  DEFLATE-compressed packages produced by the desktop application when the
  browser provides `DecompressionStream("deflate-raw")`.
- Browsers without writable project-directory picker support remain in
  **Browser Storage Mode**. The UI identifies that mode explicitly; the model
  can still be kept in browser storage, but project-local persistent Runs are
  unavailable because the browser cannot grant Systemika permission to create
  and update the sibling `Runs/` directory.


## 2026.09.11 WebApp launch-context correction

Full WebApp project storage requires two separate conditions:

1. a browser that exposes the File System Access picker APIs used by Systemika; and
2. a first-party/same-origin browser context for the editor iframe.

Opening the source tree directly through `file://` does not satisfy the second condition in Chromium. Modern browsers treat local files as opaque origins, while Chromium rejects native file/directory pickers in a frame that is cross-origin to the main frame. Systemika now detects this condition before invoking a picker and enters an explicit limited Browser Storage Mode instead of surfacing the browser `SecurityError`.

For source-tree WebApp testing, use `npm run web` or one of the `RUN_SYSTEMIKA_WEB_*` launchers. They serve the complete application from one `http://localhost` origin, so `MultiSimulationAnalyser` and `OpenSystemDynamics` are same-origin and the existing project-directory run backend is available in Chromium. A normal HTTPS deployment has the same same-origin behavior when both parts of Systemika are hosted under the same origin.

Firefox does not currently provide the File System Access picker/permission APIs required to write the user's arbitrary local `.ssd` file and sibling `Runs/` directory. Systemika therefore intentionally does not create a Firefox-only persistent run repository, because that would split desktop/web project data and defeat the shared-project design.

## Firefox and Safari compatibility notice in Systemika Studio

Firefox and Safari remain intentionally limited to Browser Storage Mode because they cannot grant the writable project-directory access required by the shared `.ssd` + `Runs/*.sysrun` design. Systemika Studio shows a persistent compact notice in the status bar in either browser. Run-management controls are disabled there and no longer display repeated unsupported-storage error dialogs. Full persistent project/run functionality requires Chrome, Edge, or another compatible Chromium-based browser.


## 2026.09.13 comparative Histogram

Histogram uses the shared multi-run checklist (`RunNames`) and can overlay two or more selected runs. Every selected run is binned against the same lower bound, upper bound, and number of bars. With automatic bounds enabled, the common range is calculated from the combined values of all selected runs. Each run is drawn with a translucent fill plus an outline and legend label so overlapping distributions remain distinguishable. PDF mode normalizes each run by its own observation count while retaining the same common bins.

## Comparison-list sizing

In output settings, **Runs to compare** and **Display order** are merged into one fixed-height list sized for about three runs. Each run appears once with a selection checkbox and, when selected, its order number and up/down controls. Large run libraries scroll inside the control instead of expanding the output-settings pane.
