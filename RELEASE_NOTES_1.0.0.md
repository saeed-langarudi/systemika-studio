# Systemika Studio 1.0.0 — First Public Release

**Release date:** 15 September 2026

Systemika Studio 1.0.0 is the first public release of Systemika Studio, an educational System Dynamics modelling and simulation environment designed for teaching and learning stock-and-flow modelling.

## Main modelling and simulation capabilities

- Canonical classroom entities: **Stock, Flow, Link, Auxiliary, Constant, Lookup, and Ghost**.
- **Flow rates are signed and unrestricted**: negative Flow values are valid and reverse the effective transfer direction; Systemika does not impose positive-only Flow bounds.
- Euler and RK4 simulation.
- Bare-name multiline equations and a focused educational function library. New equations use `Population` rather than `[Population]`; legacy bracketed references remain readable.
- Fixed-time `Lag`, exponential `Smooth` and `Delay`, and supported random distributions with optional per-function seeds.
- Strict, report-only dimensional consistency checking: inconsistencies are reported without silently converting, repairing, or reinterpreting units.
- Link polarity annotations and duplicate directed-Link protection.
- Undo/Redo, cut/copy/paste, colour tools, name rotation, canvas navigation, and classroom-oriented keyboard shortcuts.

## Run management and outputs

- Run, Pause, Advance, and Advance to End workflows.
- **Interactive Advance editing:** while paused, formulation changes are hot-recompiled into the active simulation while preserving current stock state and compatible stateful-function history. State-dependent equations and newly added model entities/Flows affect subsequent Advance steps. Deletion remains guarded: after confirmation Systemika finishes the current Advance run to its configured end before deleting model structure.
- Named runs with persistent run storage and multi-run comparison.
- Dedicated right-hand Output workspace for **Equations, Table, Time Plot, XY Plot, and Histogram**. The workspace is closed by default so the modeling canvas opens at full width; invoking an output tool/shortcut opens the requested view. Pressing the keyboard shortcut for the currently visible output toggles the panel closed; pressing it again restores that same view. Equations occupy the full panel; Plot/Table outputs show the output above a resizable settings pane. Output navigation is through the toolbar/keyboard shortcuts only. When open, the panel defaults to 25% width, can be hidden with **×** without deleting outputs, and can be detached into a true operating-system window that can move across displays, then **Attached** back. Closing the detached window hides the workspace; the next output command reopens it docked.
- **Paged Figures:** Time Plot, comparison Time Plot, XY Plot, and Histogram Figures can contain multiple pages. Page navigation and matching **+ / −** page controls are available directly at the bottom-right of the Figure; the redundant Figure Pages properties panel has been removed. The − control becomes visibly dim when the last remaining page cannot be deleted. Each page keeps its own variables, run selections, axes, labels, and plot settings while the Figure keeps one shared position and size on the canvas. Time/Compare Plot pages store line dash and width per plotted entity; all entities share the same solid/2px default. XY plots use a fixed thick line width, and Plot Period is automatic rather than user-configurable. Existing `.ssd` Figures open as a one-page Figure automatically.
- **Graph export and clearer legends:** Time Plot, comparison Time Plot, XY Plot, and Histogram property dialogs export transparent-background SVG or high-resolution 3× PNG through a native SVG reconstruction path that avoids tainted-canvas failures and adds transparent edge padding so legends are not clipped. A selected Figure can also be copied as a transparent PNG to the system clipboard with the toolbar **Copy** button or Ctrl/Cmd+C. The toolbar **Cut** button and Ctrl/Cmd+X copy the Figure image to the system clipboard before removing it from the model, enabling direct paste into Word, PowerPoint, and similar applications. Figure page controls/page numbers are omitted from exports. Plot legends have a visible blank gap from the plotting area and reproduce each series dash style/width. XY **Show Number** repeats each run/series number along the curve according to rendered curve length and uses the same number in the legend. Figure page navigation and Settings are aligned to the bottom-right.
- Comparative Histogram output with common bins and translucent overlays. Histogram scaling is fixed to standard bin counts; the obsolete Histogram/PDF scaling selector has been removed.
- Single-run Histograms use light gray bars with black borders and no point markers.
- **Per-variable Table decimals:** Table Properties no longer expose the global Precision/Decimal controls. The Added Model Entities table includes an editable **Decimal** column so every displayed variable can use its own decimal-place setting; legacy Table decimal metadata supplies the initial fallback for older models.
- **Sticky Table headings:** the Time/variable heading remains visible while scrolling long Tables. Single-run and multi-run Tables use a dedicated internal scroll region, with the Selected Variable(s) summary fixed above it.

- **Run-management refinements:** the toolbar label is **Run Name**; Manage Runs no longer exposes Duplicate, while Rename, Delete, Delete All, and Close remain available. Typing in Manage Runs no longer leaks single-key toolbar shortcuts. Enter, Ctrl/Cmd+1, and Ctrl/Cmd+R run/pause directly from the Run Name field. Multi-run plot settings provide a saved **Display order** list with up/down controls so users determine the series/legend order.
- **Output workspace and compact controls:** graph/table settings live directly below the active output in the right-hand Output panel instead of relying on double-click. **Selected Variable(s)** is shown first and all settings apply immediately without an Apply button. Equations uses the full panel without an empty settings area. The output-selector dropdown and New button are removed; toolbar tools/shortcuts are the sole navigation. Runs-to-compare and Display-order lists are fixed-height/scrollable at about three runs, and variable lists at about five variables. Variable-selection tables are labeled **Selected Variable(s)**.

## Classroom interface refinements

- The startup **Set Time Unit** prompt is centered against the full modeling canvas with the Output workspace closed, matching the default startup layout.

- **Equations panel:** choose integral, differential, or difference stock-equation form; sort equations by variable type, variable name, or computation order; or export as plain text, CSV, or LaTeX. Stock rows use a dedicated Initial Condition field such as `Stock(t0) = 100`, while integral equations retain `Stock(t0)` in the equation. Top-level `Smooth`, `Delay`, and `Lag` definitions document their initial-value argument using the same `Entity(t0)`/Initial Condition convention. Model-entity Comments are included as the last documentation column.

- Equation Editor usability: double-click starts in the Name field; Tab advances through Name → Definition → Unit rather than inserting indentation; physical line breaks are valid expression whitespace, including nested `IfThenElse` functions.
- Systemika-specific Help, Keyboard Shortcuts, Functions & Equations, Unit Checking, Preferences, About, License, and Third-party Notices.
- Keyboard shortcut help is synchronized with the current interface; obsolete Ctrl/Cmd+Enter equation guidance is removed. Systemika, StochSD, and Insight Maker links live in About Systemika rather than the menu bar, with the Systemika project site at **https://systemika.no**.
- **Hide/Unhide Question Marks (Q)** toolbar control and keyboard shortcut for missing-definition markers. This is display-only; definition checking and simulation safeguards remain active.
- Focused interface that hides unsupported or advanced legacy features from normal classroom workflows, including removal of the Number Box creation tool while preserving legacy-file compatibility.
- Equation-table usability refinements: compact model/simulation metadata at the top, **Total of N model entities** above the table, no Print button/menu, and a dedicated **Equations (E)** output tool using the variable icon.
- Dialogs close with **Esc**, including Manage Runs.

## Desktop and source distribution

- Windows installer builder for a per-user Systemika Studio installation.
- Universal macOS builder producing one application for both Apple Silicon (`arm64`) and Intel (`x86_64`) Macs, plus DMG/ZIP outputs and SHA-256 checksums.
- Linux AppImage build and launcher-installation helpers.
- Linux AppImages use Electron Builder's static AppImage runtime (`1.0.3`), avoiding a legacy FUSE2/`libfuse.so.2` runtime requirement on modern distributions.
- Source-tree WebApp workflow for development and classroom testing.
- Hardened/minimized Electron packaging toolchain: Electron Builder 26.16.1 is the only npm packaging dependency; the former Gulp/useref staging layer and obsolete inherited Gulp 3 packaging helper were removed. Electron 44.3.0 is pinned explicitly and unnecessary native-module rebuilding is disabled.

For full browser project-folder and persistent run-management support, Chrome, Microsoft Edge, or Chromium is recommended.

## Verification baseline

The public 1.0.0 source release contains:

- **314/314 passing automated regression tests** recorded in `VERIFICATION.txt` (`npm test`);
- **19 permanent `.ssd` validation models** under `validation-models/`;
- regression coverage for numerical simulation, unit checking, file handling, run management, output comparison, paged Figures, Equations forms/sorting/comments/exports, graph SVG/PNG export and styled legends, Histograms, signed/unbounded Flow behavior, toolbar shortcuts, question-mark visibility, desktop launchers, and release-cleanup behavior.

See `VERIFICATION.txt` and `SYSTEMIKA_VALIDATION.md` for details.

## License and provenance

Systemika Studio contains original Systemika code and code derived from StochSD. It is distributed under the **GNU Affero General Public License v3 (AGPLv3)**. See `LICENSE.txt`, `COPYRIGHT.txt`, and `third-party-licenses.md`.

The active Systemika simulation engine and model infrastructure described in the source audit are independently written for Systemika. Historical identifiers and references are retained where required for attribution and `.ssd` file compatibility.

- Refined the split Output workspace: restored the Auxiliary icon, separated the Equations icon, isolated Equations from plot/table resizing, set plot/table defaults to 40% output / 60% settings, and made Table selected-variable changes render immediately.
