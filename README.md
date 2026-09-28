# Systemika Studio 1.1

Systemika Studio is educational System Dynamics software designed for learning and teaching stock-and-flow modelling. Its classroom interface uses the canonical model entities **Stock, Flow, Link, Auxiliary, Constant, Lookup, and Ghost**.

## Release status

Version **1.1** (package version **1.1.5**) is the current Systemika Studio release. It introduces the manual Calibration Sandbox while retaining the existing Systemika simulation engine. The source package includes the desktop/web interfaces, platform build helpers, 19 permanent validation models, and an automated regression suite.

The 1.0.0 release includes the finalized comparative Histogram implementation. Histogram output is always count-based (the obsolete PDF/scaling selector has been removed). A single-run Histogram uses light gray bars with black borders and no point markers; multiple selected runs use common bins and translucent overlays with an external run legend. It also includes the **Hide/Unhide Question Marks (Q)** display toggle for missing-definition markers.

## Main capabilities

- Euler and RK4 simulation.
- Bare-name, multiline equations and a focused educational function library. Legacy `[Name]` references remain readable, but new equations use `Name` directly.
- Fixed-time `Lag`, exponential `Smooth` and `Delay`, and supported random distributions with optional per-function seeds.
- Strict, report-only dimensional consistency checking. Systemika reports inconsistencies but does not silently convert, repair, or reinterpret units.
- Run, Pause, Advance, Advance to End, named runs, and multi-run comparison outputs. Paused Advance runs support hot-recompiled formulation changes and model additions while preserving current stock state; deletion is guarded and, when confirmed, finishes the active Advance trajectory before removing structure.
- A dedicated, resizable **Output panel** can occupy the right side of the workspace while the modeling canvas stays on the left. The panel is **closed by default** so the modeling canvas opens at full width; choosing any output toolbar tool or shortcut reopens it directly in that view. The Equations, Table, Time Plot, XY Plot, and Histogram toolbar buttons (and their keyboard shortcuts) are the only navigation controls for switching output views. Plot/Table outputs default to an equal **50/50 vertical split** between the output and its settings, while Equations uses the full panel without an empty lower pane. Plot/Table setting boxes are fixed to an exact **360 px** visible width and the dock defaults to **378 px**—5% wider—so the settings determine the panel width with balanced padding. The dock can still be resized wider manually. The icon-only detach/attach button uses its tooltip for explanation and matches the Close button footprint. Export actions occupy a dedicated left-aligned second row beneath the panel title/control row. Closing a detached window hides the workspace; the next output command reopens it docked. Tables provide a per-model-entity **Decimal** field so each displayed variable can use its own decimal-place setting. Plot outputs support multiple pages, a compact one-box **Selected Variable(s)** finder, per-variable dash/width controls directly in the selected-variable rows where applicable, named-run comparison/order controls, page-specific settings that follow the active plot page, transparent SVG export, plot-data CSV export, bottom legends, clipboard image copying, integrated XY dash/width styling, and repeated run numbers on XY curves. Table variable selection uses the same compact finder and Table export is CSV-only.
- **Calibration Sandbox** for manual calibration: up to six fixed-format Reference/Simulated time plots, live sliders for model constants, per-parameter and global reset controls, Save as Default, resizable parameter controls, and `.sysrun` persistence of sandbox configuration. The sandbox uses the existing simulation engine and adds no automatic fitting/optimisation computation.
- Link polarity annotations, Ghosts, Lookups, Undo/Redo, copy/paste, and classroom-oriented keyboard shortcuts. Selected Flows expose easy-to-grab endpoint/elbow handles: attached endpoints can be dragged away from Stocks, each Shift press while dragging an endpoint adds another elbow, right-clicking a pipe also adds an elbow handle, and right-clicking or Delete/Backspace removes an elbow without deleting the Flow.
- Equations panel with integral/differential/difference stock equations, sorting by type/name/computation order, and TXT/CSV/LaTeX export. Stock rows use a dedicated Initial Condition column (for example, `Stock(t0) = 100`); top-level Smooth/Delay/Lag definitions use the same documentation convention for their initial-value argument; model-entity comments appear as the final documentation column.
- Automatic startup update checking plus **Help → Check for Updates...**. The WebApp refetches its own deployed editor page, while desktop builds use the stable release metadata beside the public downloads.
- Systemika-specific Help, keyboard-shortcut, functions, units, preferences, licensing, and third-party notices.

## Source layout

The source package separates application code from build infrastructure and documentation:

- `OpenSystemDynamics/` and `MultiSimulationAnalyser/` contain the application code.
- `build/` contains the canonical WebApp/desktop staging and packaging tools; generated artifacts go under `build/output/`.
- `platform/` contains platform-specific launcher and desktop-integration helpers.
- `docs/` contains build guides, technical references, and historical release notes.
- `tests/` and `validation-models/` contain automated and permanent validation coverage.

See `docs/SOURCE_LAYOUT.md` for the complete map.

## Verification

From the source root, run:

```sh
npm test
```

The current release baseline is recorded in `docs/reference/VERIFICATION.txt` and `docs/reference/SYSTEMIKA_VALIDATION.md`, together with **19 permanent `.ssd` validation models** under `validation-models/`.

Flow rates are signed quantities in Systemika Studio. Negative flow values are permitted and reverse the effective transfer direction; Systemika does not clamp or otherwise bound Flow values.


See `docs/reference/VERIFICATION.txt` for the release verification summary.

## Running from source

Requires Node.js.

```sh
npm install --no-audit --no-fund
npm start
```

Convenience launchers are included for Windows, macOS, and Linux. See `docs/guides/BUILD_AND_RUN.md`.

For source-tree WebApp testing, use `npm run web` or the corresponding `RUN_SYSTEMIKA_WEB_*` launcher rather than opening `start.html` directly with `file://`.

For public web deployment, run `BUILD_WEBAPP_WINDOWS.bat` on Windows or `./BUILD_WEBAPP_LINUX.sh` on Linux and upload the **contents** of `build/output/web/1.1.5/`. The web build gives every local WebApp resource—including SVG/PNG toolbar assets—a content-derived build fingerprint in addition to the release version. It embeds `systemika-version` and `systemika-build` metadata in every generated HTML entry point, generates WebApp metadata, and includes `.htaccess` no-store rules plus `WEB_BUILD_INFO.txt`.

The deployed WebApp root is `https://systemika.no/studio/app/`. The build places `systemika-update.json` and `update.json` directly in the generated WebApp root, so uploading the complete contents of `build/output/web/1.1.5/` publishes the update metadata automatically. Desktop update checks use `https://systemika.no/studio/app/systemika-update.json` and fall back to the exact deployed analyser/editor HTML if the manifest is unavailable. No separate metadata upload to `/download/` is required. Detailed probe failures are logged for diagnostics but are not repeated in the user-facing alert.

## Building installers

- **Windows:** double-click `BUILD_WINDOWS_INSTALLER.bat`. See `docs/guides/WINDOWS_INSTALLER.md`.
- **macOS:** double-click `BUILD_MACOS_INSTALLER.command` on a Mac after installing the two documented build prerequisites. See `docs/guides/MACOS_INSTALLER_GUIDE.md`.
- **Linux:** use `BUILD_LINUX_APPIMAGE.sh`, then the root-level `INSTALL_LINUX_LAUNCHER.sh`. See `docs/guides/LINUX_INSTALLATION_GUIDE.md`.

The macOS builder creates a Universal application for both Apple Silicon and Intel Macs and packages it in a `.dmg` disk image. The Electron/Linux packaging layer uses a deliberately minimal build toolchain: a dependency-free Node staging script plus pinned Electron Builder 26.16.1. The Linux AppImage uses Electron Builder's static AppImage runtime (`1.0.3`) so public Linux builds do not depend on legacy FUSE2/`libfuse.so.2`.

## Reference documentation

- `docs/reference/SYSTEMIKA_HELP.md` — classroom help/reference summary
- `docs/reference/SYSTEMIKA_ENGINE.md` — simulation-engine behavior
- `docs/reference/SYSTEMIKA_FUNCTIONS.md` — supported function reference
- `docs/reference/SYSTEMIKA_UNITS.md` — strict unit-checking specification
- `docs/reference/SYSTEMIKA_RUNS.md` — run-management behavior
- `docs/reference/SYSTEMIKA_VALIDATION.md` — validation models and regression baseline
- `docs/reference/SYSTEMIKA_INDEPENDENCE.md` — Systemika code-independence summary
- `docs/reference/SYSTEMIKA_SOURCE_AUDIT.md` — source audit
- `docs/guides/BUILD_TOOLCHAIN_SECURITY.md` — release build-dependency/security notes
- `CHANGELOG.md` — development history

## Browser note

For full browser-based project-folder and saved-run management, use a current Chromium-based browser such as Google Chrome, Microsoft Edge, or Chromium. Firefox and Safari can run Systemika but fall back to limited browser storage because they do not expose the directory-access APIs used by Systemika's shared `.ssd` + `Runs/*.sysrun` project layout.

## License and provenance

Systemika Studio contains original Systemika code and code derived from StochSD. It is distributed under the **GNU Affero General Public License v3 (AGPLv3)**. See `LICENSE.txt`, `COPYRIGHT.txt`, and `third-party-licenses.md`.

Systemika Studio was developed from the open-source StochSD codebase. The current simulation engine and model infrastructure replaced during the Systemika independence work are independently written for Systemika. Historical `.ssd` storage identifiers are retained where needed for file compatibility.

## WebApp build shortcuts

Windows and Linux use the same canonical builder and the same output directory:

- Windows: `BUILD_WEBAPP_WINDOWS.bat`
- Linux: `./BUILD_WEBAPP_LINUX.sh`

Both invoke `build/build.js` and write the upload-ready WebApp to `build/output/web/1.1.5/`. No `npm install` is required for the WebApp build.
