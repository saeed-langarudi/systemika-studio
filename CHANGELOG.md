## 2026-09-21 — Systemika Studio 1.1 — Manual Calibration Sandbox
- Added the Calibration Sandbox with six fixed-format comparison plots and live sliders for model constants.
- Added purple dashed Reference and teal solid Simulated trajectories with one universal sandbox legend.
- Added resizable parameter controls with Minimum, Maximum, Increment, Reset, Reset All, and Save as Default.
- Made live calibration reruns transient after the initial named run for faster slider feedback; Reset operations now refresh plots without interrupting later slider changes.
- Persisted Calibration Sandbox configuration and values in associated `.sysrun` metadata.
- Fixed an asynchronous run-save race by snapshotting the completed run before filesystem I/O.
- Changed copied-entity suffixes to underscore form (`Variable_1`, `Variable_2`, …).
- Release verification: 348/348 automated tests passing; 19/19 permanent validation models retained.

## 2026-09-17 — Systemika Studio 1.0.6 — WebApp deployment/cache correction
- Dialog keyboard behavior updated: Enter applies changes; Shift+Enter inserts a line break in multiline fields. Help and shortcut documentation were synchronized.

- Corrected the public WebApp staging pipeline so current UI changes cannot be masked by stale browser-cached generated bundles after an in-place server upgrade.
- Web launch and generated JS/CSS references now use the current Systemika release version as their cache key instead of older hard-coded development identifiers.
- Web staging now includes the root `.htaccess` cache-control policy and a `WEB_BUILD_INFO.txt` deployment marker.
- Added a dynamic release regression that builds the WebApp and verifies current UI code, current-version asset URLs, nested editor launch versioning, and cache-control files.
- Validation baseline: 333/333 automated tests passing; 19/19 permanent validation models retained.

## 2026-09-17 — Systemika Studio 1.0.5 — settings-width and export-row polish

- Normalized legacy table-based setting boxes so their visible outer borders exactly match the Selected Variable(s) box.
- Moved export actions to a dedicated second row beneath the panel title, left-aligned independently of Detach/Attach and Close.
- Retained the 1.0.4 360 px settings width, 378 px default panel width, icon-only detach/attach, SVG/CSV plot exports, and 50/50 output/settings split.

## 2026-09-17 — Systemika Studio 1.0.4 — output-panel geometry refinement

- Fixed every Table/Plot settings wrapper to an exact **360 px** width so Selected Variable(s), run selection, axis controls, labels, and other setting boxes align precisely.
- Set the default/minimum dock width to **378 px**, exactly 105% of the 360 px settings width, and synchronize the default dock width from the mounted settings until the user manually resizes it.
- Changed the default Table/Plot vertical layout to an equal **50/50** split of the available output-body height while retaining the draggable splitter.
- Simplified the detach/attach control to the unlink icon only; its button footprint now matches the adjacent Close control and the tooltip/ARIA label carries the action name.
- Removed **Export PNG** from Plot headers. Plots retain **Export SVG** and **Export CSV**, while high-resolution transparent PNG remains available through Figure copy-to-clipboard.
- Added dedicated regression checks for exact settings geometry, the 105% panel-width relationship, icon-only detach/attach, equal vertical splitting, and the reduced plot-export actions.

## 2026-09-17 — Systemika Studio 1.0.3 — unified output settings, legends, and exports

- Added integrated **Dash** and **Width** controls to XY Plot's Selected Variable(s) workflow; the XY curve uses the Y-variable style.
- Replaced Table's inherited variable-selection UI with the compact **Selected Variable(s)** + **Add Variable** finder while keeping per-variable Decimal settings.
- Standardized Plot/Table settings boxes to a common 360 px maximum width.
- Moved Equations, Table, and Plot export actions into the Output header with one consistent button treatment.
- Added plotted-data **CSV** export for Time Plot, comparative Time Plot, XY Plot, and Histogram; removed Table TSV export.
- Moved plot legends beneath the chart and mirrored that layout in SVG/PNG exports.
- Simplified time-comparison legend labels: one variable shows run names only; multiple variables use `Variable [Run]`, ordered variable first then run. The legacy `Run =` prefix is removed.
- Regression baseline: **326/326 automated tests passing**, with all **19 permanent validation models** retained.

## 2026-09-17 — Systemika Studio 1.0.2 — compact variable selection and page-aware settings

- Replaced the inherited two-list plot variable selector with one compact **Selected Variable(s)** box aligned to the width and visual treatment of **Runs to compare**. The **+ Add Variable** action opens an in-box search/finder only when needed.
- Moved per-variable **Dash** and **Width** controls directly into Time Plot and comparison Time Plot selected-variable rows and removed the separate **Line Style** panel. Existing `LineStyles` storage and solid/2 px defaults remain compatible with saved models.
- Updated XY Plot and Histogram to use the same one-box variable finder while preserving their plot-specific selection rules.
- Fixed plot-page settings synchronization: pending live edits are flushed before page navigation, then the lower settings pane is rebuilt from the active page so selected variables, runs, axes, labels, styles, and other page-specific controls follow the graph page.
- Regression baseline: **319/319 tests passing** with **19/19 permanent validation models**.

## 2026-09-17 — Systemika Studio 1.0.1 — compact comparison-run controls

- Merged **Runs to compare** and **Display order** into one compact scrollable list. Each run now appears once, with its selection checkbox and selected-run order controls in the same row.
- Removed **Numbered Lines**, **Colour from Model Entity**, and **Show Data when hovering** from plot property dialogs while preserving their existing stored behavior and new-plot defaults.
- Regression baseline: **316/316 tests passing** with **19/19 permanent validation models**.

## 2026-09-16 — Sticky Table headings in the Output workspace

- Table output now uses a dedicated internal scrolling region, so the variable/time heading remains visible while rows are scrolled vertically.
- The fix covers both ordinary single-run Tables and two-row multi-run comparison Tables, including detached Output windows.
- The Selected Variable(s) summary remains fixed above the scrolling table instead of competing with the sticky column headings.
- Regression baseline: **314/314 tests passing** with **19/19 permanent validation models**.

## 2026-09-16 — Live output settings and interactive Advance model editing

- Moved **Selected Variable(s)** to the top of every plot/Table settings pane so an empty output immediately presents the primary setup action.
- Removed the docked plot/Table **Apply** footer; output settings now apply live as controls are changed. The settings pane has a clean contained scroll area with no exposed content below a sticky footer.
- Advance now hot-recompiles formulation changes while paused, preserving current stock state and compatible stateful-function history so state-dependent Flow/Auxiliary equations affect the remaining trajectory.
- New model entities and Flows can be added during a paused Advance run; the live Advance model is recompiled and the new entities become available immediately.
- Deleting model entities during Advance remains guarded: after confirmation, Systemika now actually advances the current stepped simulation to its end before applying the deletion.
- Regression baseline: **312/312 tests passing** with **19/19 permanent validation models**.

## 2026-09-16 — Shortcut/help cleanup and About links

- Updated the Keyboard Shortcuts dialog and classroom help to match the current interface, including Equations/Table/plot toggles, Run Name execution keys, canvas navigation, and Escape-to-close.
- Removed the obsolete Ctrl/Cmd+Enter equation shortcut and its help references; Enter inserts line breaks and Apply saves the definition.
- Removed the provenance hyperlinks from the top-right menu bar and moved Systemika, StochSD, and Insight Maker links into About Systemika.
- Updated the Systemika project hyperlink to **https://systemika.no**.
- Regression baseline: **308/308 tests passing** with **19/19 permanent validation models**.

## 2026-09-16 — Startup prompt centering and output shortcut toggles

- Centered the startup **Set Time Unit** prompt against the full modeling canvas width, explicitly ignoring any Output-panel width reservation.
- Output keyboard shortcuts now toggle their own active view: **E**, **T**, **P**, **X**, or **H** closes the Output panel when that corresponding view is already open; pressing the same shortcut again restores that view. A different output shortcut still switches views normally.
- Regression baseline: **305/305 tests passing** with **19/19 permanent validation models**.

## 2026-09-16 — Docked output workspace and keyboard isolation

### Output workspace refinements

- Restored the original Auxiliary toolbar icon and gave the Equations tool its own dedicated icon asset.
- Decoupled Equations from plot/table split sizing so Equations always use the full output-panel height.
- Plot/Table views now default to 40% output and 60% settings while retaining user-resizable split behavior.
- Table selected variables now update the live table immediately and are shown in a persistent Selected Variable(s) summary.
- Regression baseline: **303/303 tests passing** with **19/19 permanent validation models**.
- Added a closeable Output workspace: it starts hidden by default, × restores the modeling canvas to full width without deleting outputs, output toolbar commands/shortcuts reopen the requested view, and closing a detached output window hides it so the next output command reopens docked.

- Refined the resizable right-hand Output workspace: it is closed by default so the modeling canvas opens at full width; output toolbar commands/shortcuts reopen it directly in the requested view. Equations is the full-height view; Plot/Table outputs use the upper output pane plus a resizable lower settings pane.
- Added a dedicated **Equations (E)** toolbar tool immediately before Table and removed the Print menu. Output navigation now uses only the toolbar tools/keyboard shortcuts; the output-selector dropdown and New button were removed.
- Replaced the in-app floating output overlay with a true detachable operating-system window using the supplied unlink icon. Detached outputs can move across monitors; **Attach** returns the live panel to the main workspace. A new **×** control hides the workspace without deleting outputs; closing a detached window also hides it, and the next output command reopens it docked. The right-side panel now defaults to 25% width when open.
- Prevented text entry in Manage Runs and other editable fields from triggering single-key modeling/output tools.
- Added Enter, Ctrl/Cmd+1, and Ctrl/Cmd+R support while focus remains in the toolbar Run Name field.
- Fixed Runs to compare and Display order to scrollable three-row heights and plot variable selectors to about five rows.
- Removed the Number Box creation button and N shortcut while retaining legacy Number Box loading compatibility.
- Added six focused regression checks; the complete suite is **295/295 passing** with **19/19 permanent validation models**.
- Simplified the Equations view: removed redundant heading/Print controls, moved model/date/simulation specifications into a compact top summary, and moved **Total of N model entities** above the equation table.
- Added Escape-to-close behavior for dialogs, including Manage Runs, even while a text field has focus.
- Fixed the docked Table view so selected variables are visibly represented while run data is loading.

## First public release finalization — run ordering and dedicated output settings

- Removed **Duplicate** from the Manage Runs dialog; Rename, Delete, Delete All, and Close remain available.
- Renamed the toolbar label **Run name** to **Run Name**.
- Added a persistent **Display order** list with up/down controls to multi-run comparison panels so users control plot series and legend ordering.
- Renamed plot and Table selectors to **Selected Variable(s)**; Table retains its per-variable Decimal column.
- Replaced plot/table double-click property access with dedicated **⚙ Settings** controls. Plot Settings sits after the page delete control at the bottom-right; Table has a floating Settings control.
- Replaced the plot-page trash-can control with a **−** sign matching the existing **+** control in font and size; the − sign dims when only one page remains.
- Full automated suite: **289/289 passing** with **19/19 permanent validation models**.

## First public release finalization — fixed Histogram scaling and per-variable Table decimals

- Removed **Select Scaling Type** from Histogram Properties; Histograms now always display standard bin counts and no longer expose the PDF scaling mode.
- Removed the Table dialog's global **Precision** and **Decimal** controls.
- Added an editable **Decimal** column to Table **Added Model Entities**, persisted independently for each displayed variable and applied correctly to both single-run and multi-run table columns.
- Older Table models use the stored legacy decimal value as the default until a per-variable setting is saved.
- Added focused regression coverage for fixed Histogram rendering, Table UI/storage, legacy decimal fallback, and multi-run per-variable formatting.
- Full automated suite: **284/284 passing** with **19/19 permanent validation models**.

## First public release finalization — plot-page delete icon and delay-processing Auxiliary symbol

- Replaced the plot-page Delete control artwork with the supplied trash-can SVG.
- When a Figure has only one page, the Delete Page icon is visibly inactive: it is grayscale and reduced to 28% opacity while the button remains disabled.
- Auxiliaries whose definitions contain `Smooth(...)`, `Delay(...)`, or `Lag(...)` now use the supplied processing/hourglass symbol on the model canvas. Removing those functions restores the normal Auxiliary circle automatically; Ghosts follow the source Auxiliary symbol.
- Added regression coverage for the supplied artwork, last-page disabled styling, and dynamic delay-processing symbol switching.
- Full automated suite: **280/280 passing** with **19/19 permanent validation models**.

## First public release finalization — Electron 44 clipboard fix and toolbar Figure copy/cut

- Simplified Figure properties: removed Plot Period and the redundant Figure Pages panel; page deletion is now available from a trash-can control on the Figure itself. XY plots use a fixed thick line width.
- Added **Delete All** to Manage Runs with confirmation and cleanup of plot/table run selections.

- Increased PNG graph export to 3× raster resolution with high-quality smoothing for sharper text, axes, and line work.
- Added transparent export edge padding and explicit legend-bound sizing so the complete legend border is retained rather than clipped at the right edge.
- Selecting one rendered Figure and using **Copy** (toolbar or Ctrl/Cmd+C) writes a high-resolution transparent PNG to the operating-system clipboard while preserving Systemika's internal model-object clipboard for normal Paste/duplication. **Cut** (toolbar or Ctrl/Cmd+X) copies the Figure image first and then removes the Figure from the model.
- Updated the desktop clipboard bridge for Electron 44: the removed `clipboard.writeImage()` helper is replaced by the W3C-style `clipboard.write()` + `ClipboardItem` API, with a browser Clipboard API fallback when available.
- Added regression coverage for raster scaling, export padding, Electron 44 clipboard bridge wiring, and toolbar/keyboard Figure Copy and Cut behavior.
- Full automated suite: **273/273 passing** with **19/19 permanent validation models**.

## First public release finalization — unsaved-changes false-positive fix

- Fixed a dirty-state false positive where opening a model and then clicking/selecting without editing could turn on **Unsaved Changes**.
- Clean loaded models are now canonicalized once after parsing, so harmless XML formatting/order normalization is not mistaken for a model edit.
- Blank-canvas clicks and rectangle-selection starts no longer create undo snapshots.
- Genuine model edits, geometry changes, property changes, Undo/Redo, and Save state tracking remain unchanged.
- Added regression coverage for clean-baseline normalization and blank-canvas interactions.
- Full automated suite: **272/272 passing** with **19/19 permanent validation models**.

## First public release finalization — legend spacing refinement

- Reduced the outside-grid legend gap from 14 px to 11 px (about 20%) so the legend remains visibly separated from the plot grid without sitting unnecessarily far to the right.
- All other plot rendering, XY numbering, page navigation, and export behavior are unchanged.
- Full automated suite: **270/270 passing** with **19/19 permanent validation models**.

## First public release finalization — graph export, XY labels, documentation initials, and function categories

- Added a visible margin between outside-grid legends and the plotting area.
- Changed XY **Show Number** so run/series numbers are rendered directly on the curves and matched in the legend.
- Replaced canvas-capture graph export with native SVG reconstruction; SVG and PNG exports are transparent, avoid tainted-canvas failures, and exclude Figure page-navigation controls/page numbers.
- Extended the **Initial Condition** documentation convention to top-level `Smooth`, `Delay`, and `Lag` definitions by replacing their initial-value argument in the displayed equation with `Entity(t0)` and reporting the actual initialization separately.
- Moved `IfThenElse` into **Programming Functions** and removed the obsolete **Conditional Function** category.
- Added focused regression coverage for the export pipeline, legend spacing, XY curve numbering, stateful-function initial conditions, and function-category organization.
- Full automated suite: **269/269 passing** with **19/19 permanent validation models**.

## First public release finalization — comments, equation output, graph export, and XY numbering

- Standardized stock documentation around an explicit **Initial Condition** field such as `Stock(t0) = 100`; integral equations now retain `Stock(t0)` in the governing equation, matching the differential/difference documentation convention.
- Added a persistent **Comment** field to model-entity definition dialogs and included Comment as the final column in printed/CSV equation documentation and in TXT/LaTeX exports.
- Renamed **Print → Model Documentation...** to **Print → Print Equations...**.
- Added transparent-background **Export SVG** and **Export PNG** controls to Time Plot, comparison Time Plot, XY Plot, and Histogram property dialogs.
- Updated plot legends so line samples reproduce the corresponding series dash pattern and width.
- Replaced XY **Show Markers** with **Show Number**; numbered XY series display matching numbers in the legend, while isolated single-point series remain visible automatically.
- Added focused regression coverage for the documentation schema, comment persistence, graph export controls/transparency, legend dash samples, and XY numbering.
- Full automated suite: **266/266 passing** with **19/19 permanent validation models**.

## First public release finalization — equation/plot/documentation refinements

- Replaced type-wide Time/Compare Plot line styling with per-plotted-entity dash/width settings. Every entity now starts solid at width 2; select an item in **Added Model Entities** to customize it. Styles are page-specific.
- Separated stock initialization from governing equation text with a dedicated documentation field, subsequently finalized as **Initial Condition** (`Stock(t0) = ...`).
- Added **Export LaTeX** (`.tex`) to the equation documentation panel.
- Changed Equation Editor Tab behavior to advance through fields, and double-click now focuses/selects the Name field first.
- Made bare model-entity names the canonical equation syntax. Legacy `[Name]` references are still accepted and identifier-safe legacy references are normalized when models are loaded/saved.
- Fixed multiline-definition validation/storage so nested functions can span lines without an escape character.
- Added permanent validation fixture `19-bare-multiline-equation.ssd` and focused regression coverage for all refinements.
- Full automated suite: **259/259 passing** with **19/19 permanent validation models**.

# Pre-release development history leading to Systemika Studio 1.0.0

## First public release finalization — paged Figures and Model Documentation

- Added multiple named pages to Time Plot, comparison Time Plot, XY Plot, and Histogram Figures. Pages share Figure geometry but keep independent variables, run selections, axes, labels, and plot settings.
- Added compact Figure page navigation plus Add/Duplicate/Delete/rename controls in Figure Properties. Legacy `.ssd` plots automatically become a one-page Figure.
- Replaced the print-only Equation List with a Model Documentation panel supporting integral, differential, and difference stock-equation forms.
- Added documentation sorting by variable type, variable name, and dependency-based computation order.
- Added plain-text equation-list export and CSV equation-table export while retaining print output.
- Added 13 regression checks for page persistence/navigation semantics, documentation forms/sorting/export, and editor integration.
- Full automated suite: **251/251 passing**; permanent validation model set remains **18/18**.

## Final release correction — signed, unrestricted Flow values

- Removed the inherited positive-only Flow clamp from the native Systemika simulation engine.
- New Flows now store the legacy `.ssd` compatibility attribute as `OnlyPositive="false"`.
- Legacy models containing `OnlyPositive="true"` are normalized to unrestricted Flows on load; the engine ignores that legacy flag even when supplied through the programmatic model specification.
- Negative stock-to-stock Flow rates reverse the effective transfer direction naturally and remain subject only to the model equations; Systemika imposes no Flow bounds.
- Removed the obsolete **Restricted** column from the Flow section of model information.
- Added `18-negative-flow.ssd` as a permanent validation fixture and regression tests for negative Flow values and legacy metadata.
- Full automated suite: **251/251 passing**.

## Final release hardening — packaging dependency cleanup
- Pin the Linux AppImage toolset to the modern static runtime (`1.0.3`) to avoid legacy FUSE2 requirements.

- Replaced the Gulp/useref release staging pipeline with a dependency-free Node.js build script.
- Removed the obsolete inherited OpenSystemDynamics Gulp 3 packaging helper.
- Reduced the `distribute` npm project to one pinned build dependency: `electron-builder` 26.16.1.
- Pinned Electron 44.3.0 in the builder configuration and disabled unnecessary native-module rebuilding.
- Changed ordinary installer dependency installation to skip npm's automatic audit headline; maintainers retain an explicit `npm run audit:build` review command.
- Added three packaging-toolchain regression checks; the release suite now passes **236/236** tests.

## Final pre-release change — Question-mark visibility toggle

- Added a vertical-toolbar **Hide/Unhide Question Marks (Q)** control using the supplied hidden-eye icon.
- Added the single-key **Q** shortcut and documented it in built-in and packaged help.
- Hiding the markers is display-only: definition checking, error reporting, and simulation validation are unchanged.
- Added two regression checks; the suite now passes **236/236** tests.

## Systemika 0.9.9 — Single-run Histogram visual polish


- Changed one-run Histogram bars from solid black to a light gray fill (`#d9d9d9`) for a calmer classroom/print presentation.
- Added crisp black borders around each non-empty one-run histogram bin.
- Kept the proven single-run jqPlot `step + fill` renderer unchanged; borders are drawn after rendering rather than re-enabling jqPlot's fragile one-series `fillAndStroke` path.
- Comparative Histograms are unchanged and continue to use translucent colored overlays, outlines, common bins, and the run legend.
- Histogram markers remain disabled.

## Systemika 0.9.8 — Single-run Histogram legend fix

- Reproduced the exact title-and-frame-only single-run Histogram failure in a real browser with jqPlot 1.0.8.
- Root cause: the Histogram configured the legend as hidden (`show: false`) while still requesting `placement: outsideGrid`; jqPlot then attempted to detach a legend element that had never been created and aborted before axes/series drawing.
- `outsideGrid` legend placement is now enabled only when two or more runs are actually being compared.
- Single-run Histograms use a hidden legend with no outside-grid placement and render normally.
- Histogram marker suppression and multi-run translucent overlays are unchanged.

## Systemika 0.9.7 — Single-run Histogram renderer restoration

- Reproduced the one-run Histogram failure directly in jqPlot 1.0.8.
- Restored the proven pre-comparison (0.9.3) `step + fill` renderer whenever exactly one run is displayed.
- Kept `showMarker: false` so the three point markers per bar remain removed.
- Kept the comparative overlay renderer only for two or more selected runs, including translucent fills and the run legend.
- The 0.9.6 one-series `fillAndStroke` configuration was removed because jqPlot 1.0.8 throws an internal draw-time exception with that configuration.
- Automated regression suite: 229/229 passing.

## Systemika 0.9.6 — Single-run Histogram rendering

- Fixed single-run Histogram rendering under jqPlot 1.0.8.
- Single-run histograms retain the model entity colour with a solid fill.
- Transparency is applied only when two or more runs are overlaid for comparison.
- This avoids jqPlot's `fillAlpha` failure on CSS colour keywords such as `black`.
- Histogram point markers remain disabled.
- Automated regression suite: 229/229 passing.

## Systemika 0.9.5 — Histogram reliability

- Fixed single-run histograms so the current run renders even when the comparison selection stores its user-facing run label.
- Removed jqPlot point markers from histogram bars; histogram bars now render without the three distracting marker dots.

## Systemika 0.9.4 — Comparative histograms

- Added the same **Runs to compare** selector used by other comparison outputs to Histogram properties.
- Histograms from multiple selected runs are overlaid on the same axes with translucent fills, distinct outlines, and run labels.
- All selected runs share one set of lower/upper bounds and bin edges so overlapping bars represent the same value intervals.
- Automatic bounds are derived from the combined data across all selected runs; manual bounds and the selected number of bars apply to every run.
- Histogram run selections now participate in run rename/delete, new-run auto-selection, and Advance selection restore logic.
- Added comparative-Histogram regression coverage; full automated suite: **226/226 passing**.

## Systemika 0.9.3 — provenance and window cleanup

- Restored the compact top-right provenance links: Systemika | Editor lineage: StochSD / InsightMaker.com.
- Expanded About Systemika to acknowledge Insight Maker as part of the historical lineage while clarifying that Systemika uses its own native simulation engine.
- Removed an orphan HTML comment-closing marker that rendered as a stray `-->` at the top-left of the application window.

## Systemika 0.9.2 — Release-readiness help and interface cleanup

- Rebuilt the Help menu around Systemika classroom use: Getting Started, Keyboard Shortcuts, Functions & Equations, Unit Checking, Preferences, About, License, and Third-party Notices.
- Removed obsolete StochSD support/forum links, StochSD/plugin manuals, Full Potential CSS material, and restart/developer-oriented items from the Help menu.
- Removed the hidden `.` shortcut that exposed the legacy Optim/Sensi/StatRes/ParmVar plugin menu.
- Restored the **Histogram (H)** output tool to the top toolbar.
- Rewrote About and License text to reflect the current native engine/model layers and AGPLv3/StochSD provenance without stale `0.6` or “All rights reserved” wording.
- Cleaned Preferences wording so it uses classroom-facing Systemika terminology rather than internal class names.
- Cleaned the Third-party Notices screen to list libraries currently bundled by the application and removed obsolete NW.js/jStat/Springy/ANTLR/Insight-Maker-license entries.
- Aligned jqPlot CSS with the active jqPlot 1.0.8 runtime and removed an obsolete commented 1.0.9 script block.
- Added `SYSTEMIKA_HELP.md` and release-cleanup regression coverage.
- Full automated suite: **219/219 passing**.

## Systemika 0.9.1 — Classroom usability pass

- Made the red **Unsaved Changes** toolbar indicator actionable: clicking it now offers **Save**, **Save As...**, or **Cancel**.
- Prevented duplicate directed Links between the same source and target, including duplicate-Link creation through copy/paste. Reverse-direction Links remain valid because they represent a different causal direction.
- Elevated selected SVG entities and their editing handles above HTML plot overlays so Link handles remain accessible near/over plots.
- Added **Ctrl+Shift+S** (**Cmd+Shift+S** on macOS) for **Save As**, including the shortcut in the tooltip.
- Added **R** for **Rotate Name**, including the shortcut in the tooltip.
- Changed new Time/Compare Plot defaults to **Numbered Lines = on**, **Colour from Model Entity = off**, and **Show Data when hovering = on**.
- Text Box copy/paste now preserves the text exactly instead of applying model-entity unique-name suffixes.
- Removed explanatory warnings/notes from Simulation Settings while an Advance run is active; locked settings remain visibly disabled without pedagogical commentary.
- Time-based plot x-axes now include the model time unit, e.g. **Time (Year)**.
- Added focused usability regression coverage; full automated suite: **212/212 passing**.

## Systemika 0.9.0 — Strict unit consistency reporting

- Added the independently written `systemika-units.js` unit checker.
- Replaced the old `Check Units: Yes/No` toggle with a read-only **Check Units → Report** action.
- Unit symbols are strict and case-sensitive: no conversions, synonyms, equivalence tables, suggestions, or automatic corrections.
- Algebraically equivalent forms are normalized, e.g. `Person/Year` and `Person*Year^-1`.
- Checks declared units against equation dimensions for Stocks, Flows, Auxiliaries, and Constants, and propagates declared Lookup output units into dependent equations.
- Checks connected Flow units against `Stock unit / model time unit`.
- Added unit rules for all native mathematical, conditional, programming, simulation-time, and statistical functions.
- Missing information is reported as **Could not verify**, never silently accepted as correct.
- Unit checking does not change the model and does not block simulation.
- Added `SYSTEMIKA_UNITS.md` with the complete strict-checking specification.
- Added 19 dedicated unit-check regression tests; full automated suite: **204/204 passing**.

## Native engine/editor 0.8.5 — Optional seed in click templates

- Kept statistical function names clean in the Function Help list.
- Kept full random-function signatures, including `[Seed]`, in hover tooltips.
- Updated click-to-insert templates so the optional seed placeholder also appears in the Equation Editor, for example `RandomUniform(Minimum, Maximum, [Seed])`.
- The `[Seed]` segment is a template placeholder: replace it with a numeric seed for reproducibility, or remove the optional argument when no fixed seed is wanted.
- No numerical engine semantics changed from 0.8.4.

## Native engine/editor 0.8.4 — Multiline equations and corrected function help

- Pre-release 0.8.x temporarily placed `IfThenElse` in a dedicated Conditional Function category; the final 1.0.0 interface later consolidates it under Programming Functions.
- Statistical-function hover tooltips now show the complete call syntax, including the optional seed notation such as `RandomUniform(Minimum, Maximum, [Seed])`.
- Autocomplete and the visible function list no longer use full signatures as function names.
- The equation editor now uses Enter to insert a line break. Ctrl+Enter on Windows/Linux and Cmd+Enter on macOS applies the equation.
- Multiline equations require no new syntax: the native parser already treats line breaks as whitespace, so nested `IfThenElse(...)` calls can be formatted across multiple lines.
- Added regression coverage for multiline nested conditionals and the revised editor/help behavior.
- Full automated suite: **185/185 passing**.

## Native engine 0.8.2 — Fixed Lag and optional random seeds

- Redefined `Lag(input, lag time, initial value)` as a fixed time lag / pure time shift: at simulation time `t`, it returns the input from `t - lag time`.
- `Lag` uses the supplied initial value before sufficient history exists and linearly interpolates historical input when the requested lag falls between stored simulation points.
- Added an optional final `seed` argument to `RandomUniform`, `RandomNormal`, `RandomTriangular`, `RandomGamma`, and `RandomBeta`.
- A seeded random-function call is reproducible across model runs; an unseeded call uses a fresh automatically generated run seed.
- Normal UI runs no longer read a legacy model-level `RandomSeed` setting; reproducibility is expressed directly in each random function.
- Updated Function Help, autocomplete, validation fixtures, and engine documentation.

## Native engine 0.8.1 — Startup hardening

- Fixed a startup race where early toolbar initialization could evaluate the `RunResults` class while its lexical binding was still in the JavaScript temporal dead zone.
- Changed the internal blank-editor template to use a valid `SystemikaModel` root, so the strict model loader no longer throws during normal startup.
- Direct `file://` launches now skip Service Worker registration, which is unsupported for file origins, instead of emitting an uncaught startup exception.
- Added browser-level startup smoke testing for both direct `start.html` and local-server/desktop-style launch paths.
- Retained all 0.8.0 programming and statistical functions unchanged.
- Full automated suite: **178/178 passing**.

## Native engine 0.8.0 — Programming and statistical functions

- Added stateful programming functions: `Smooth(input, smooth time, order, initial value)`, `Delay(input, delay time, order, initial value)`, and `Lag(input, lag time, initial value)`.
- `Smooth` and `Delay` use N-stage exponential pipelines integrated by the same Euler/RK4 solver as model Stocks; `Lag` is first-order.
- Added statistical functions: `RandomUniform`, `RandomNormal`, `RandomTriangular`, `RandomGamma`, and `RandomBeta`.
- Random call sites draw once per integration step and hold the underlying random variate constant across RK4 intermediate stages.
- Added engine-level random seeds. Supplying `randomSeed` reproduces a stochastic run exactly; automatically generated seeds are returned in results and stored in run metadata.
- Added parameter validation for smoothing/delay times, orders, and statistical distribution parameters.
- Updated function help, autocomplete, and stochastic-function detection in the equation editor.
- Added analytical/reproducibility regression coverage for all new function families.
- Full automated suite: **175/175 passing**.

## Native engine/editor 0.7.0 — Stability and validation

- Added 15 permanent `.ssd` validation models covering constant flows, exponential growth/decay, stock transfer, auxiliary/constant evaluation, linear/discrete Lookups, `IfThenElse`, multiple flows, goal seeking, nonnegative stocks, Euler/RK4 behavior, and Link polarity.
- Added automated numerical expectations for the permanent validation models.
- Added explicit `Division by zero` and `Modulo by zero` engine errors.
- Added a two-million-integration-step guard to prevent accidental simulation settings from freezing the UI.
- Added a clear error when simulation settings are unavailable.
- Hardened `.ssd` loading to reject non-Systemika XML and malformed/multiple model roots before editor synchronization.
- Missing simulation settings in otherwise valid models are repaired from current Systemika defaults during normalization.
- Hardened saving so incomplete Links are never persisted and a Ghost with a missing source cannot crash the save operation.
- Removed the save writer's dependency on a fully initialized visual object for Flow/Link semantics.
- Added save-integrity tests covering all seven canonical model entities and critical attributes such as Link polarity, Lookup data, Ghost source, Flow endpoints, and simulation settings.
- Full automated suite: **169/169 passing**.

## Native engine/editor 0.6.0

- Replaced the remaining `mxShim.js` compatibility layer with independently written `systemika-model-graph.js`.
- Removed unused inherited `Sanitize.js` and `Updater.js`; neither had active callers in Systemika.
- Added Systemika-owned XML loading, node subscriptions, model cloning, Link/Flow endpoint reconstruction, and limited legacy `.ssd` normalization.
- Removed the `OpenSystemDynamics/src/insightmaker/` directory entirely.
- Renamed the active model writer class to `SystemikaModelDocument`; the historical `InsightMakerModel` XML outer tag is retained only for `.ssd` compatibility.
- Added 0.6-specific graph/loading and source-audit regression tests.
- Added `SYSTEMIKA_SOURCE_AUDIT.md`.

## Native engine/editor 0.5.1

- Fixed a 0.5.0 Link-creation freeze caused by the new model API emitting position-change events while connector endpoints were still being constructed.
- Restored the established connector geometry semantics: `setSourcePosition()` and `setTargetPosition()` are silent low-level writes; moving a completed connector with `setPosition()` emits exactly one position update.
- Removed the obsolete `Position got updated` debugging alert from the connection visual.
- Restored size writes to their previous non-notifying behavior to avoid unintended editor callbacks during geometry setup.
- Added regression coverage for premature connector position events and the blocking debug alert.
- Full automated suite: **154/154 passing**.

## Native engine/editor 0.5.0

- Replaced inherited `insightmaker/Utilities.js` with the independently written `systemika-model-utils.js`.
- Replaced the Systemika-used portion of inherited `insightmaker/API/API.js` with the independently written `systemika-model-api.js`.
- Deleted both inherited files and removed their startup imports.
- Added canonical model-layer aliases for Auxiliary, Constant, and Lookup while preserving legacy `Variable` and `Converter` tags only for `.ssd` file compatibility.
- Deliberately did not recreate unsupported legacy API features for agents, states/actions, folders, sliders, and other non-Systemika entities.
- Added behavioral regression coverage for canonical entity creation/querying, Link endpoint storage, Lookup mapping, and simulation settings.
- Reduced the remaining Insight Maker-derived editor/model files from five to three (`mxShim.js`, `Sanitize.js`, `Updater.js`), about 755 lines total.
- Full automated suite: **152/152 passing**.

## Native engine/editor 0.4.2

- Updated both source/portable and packaged desktop builds to Electron 44.3.0, pinned to the exact same runtime version.
- Linux source launcher now detects and replaces a stale Electron runtime instead of silently reusing an older installed copy.
- Linux source launcher installs runtime dependencies without npm audit/funding noise; dependency security is handled by the pinned supported runtime rather than `npm audit fix --force`.
- Restored Link Properties with explicit polarity choices: Unspecified, Positive (+), and Negative (−).
- Double-clicking a Link opens Link Properties.
- Pressing L while exactly one Link is selected opens Link Properties; otherwise L continues to start Link creation.
- Link polarity is stored on the Link and displayed beside its arrowhead.
- Added Electron-runtime and Link-polarity regression coverage.

## Native engine/editor 0.4.1

- Fixed Lookup link attachment after the editor migration.
- Restored a Systemika-owned directed-link helper used by Lookup attachment and equation references.
- Enforced the Lookup rule of at most one incoming Link while allowing outgoing Links.
- Lookup Source now follows its incoming Link only and falls back to Time when disconnected.
- Incomplete Links released on empty canvas are explicitly deleted, preventing hanging links and Undo/Delete corruption.

## Systemika native engine / independence milestone 0.4.0

### Changed
- Replaced inherited `insightmaker/Localization.js` with `systemika-localization.js`.
- Replaced inherited `insightmaker/Variables.js` with `systemika-entities.js`.
- Reduced the remaining Insight Maker-derived editor/model files from seven to five.
- Established canonical Systemika model terminology: Stock, Flow, Link, Auxiliary, Constant, Lookup, Ghost.
- Kept `Variable` and `Converter` only as legacy `.ssd` storage tags for backward compatibility.
- Changed Lookup help/preferences and generic model-selection language to use Systemika terminology.
- Split Equation List output into separate Auxiliaries, Constants, and Lookups sections.
- Removed agent/state/action templates from the active Systemika entity definition layer.
- Added terminology/independence regression coverage. Full automated suite: 137/137 passing.

## Systemika native engine 0.3.1

### Fixed
- Fixed normal simulation startup after removal of the legacy Insight Maker engine. `RunResults.stopSimulation()` no longer falls back to the deleted `simulate` controller.
- Replaced residual simulation lifecycle compatibility helpers with native `SystemikaEngine` / `RunResults` equivalents.
- Removed all active references to the legacy `simulate` global from the Systemika editor/API startup path.
- Added regression coverage for this failure. Full automated suite: 134/134 passing.

## Systemika native engine 0.3.0

### Changed
- Removed the legacy Insight Maker numerical simulation engine, formula parser, scheduler, random/statistical libraries, and simulation resources from the source package and startup path.
- The legacy global `runModel()` entry point now routes to the native Systemika engine for compatibility.
- Removed dormant StochSD macro and random-function hooks from the active Systemika editor.
- Equation-list output no longer inspects stochastic seed macros.

# Unreleased — Native engine integration preview

- Added the independently written Systemika native simulation engine (`OpenSystemDynamics/src/systemika-engine.js`).
- Added Euler (RK1) and RK4 integration for stocks and flows, including full intermediate-stage re-evaluation for RK4.
- Added a compact expression parser/evaluator with primitive references, basic mathematics, comparisons, logic, time functions, and `IfThenElse`.
- Added linear/discrete lookup support, dependency/cycle validation, pause/resume results compatibility, and state-independent interactive parameter changes.
- Switched Systemika **Run** and **Advance** workflows to `SystemikaEngine.runCurrentModel()`.
- Added asynchronous browser chunk callbacks so Run/Pause and Advance remain responsive while the native engine is active.
- Replaced the Insight Maker-oriented equation-editor function help and autocomplete with the deliberately restricted native Systemika function set.
- Unsupported functions such as random distributions, delays/smoothing, Pulse/Step/Ramp, historical/statistical functions, StopIf, macros, and user-defined functions are no longer offered by the equation editor.
- Added `SYSTEMIKA_ENGINE.md` and expanded native-engine regression tests. Full automated suite: 131/131 passing.
- Insight Maker simulation files remain temporarily in the source tree because inherited editor/model infrastructure still depends on parts of that code; removing those remaining dependencies is a separate migration stage.

# Internal desktop packaging milestone — September 2026

- Added the Linux AppImage launcher installer (`INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh`) and launcher template (`Systemika-Studio.desktop`) to the source root.
- Added `LINUX_INSTALLATION_GUIDE.md`, a beginner-friendly walkthrough for building the AppImage, installing the Applications-menu/Desktop launcher, updating, uninstalling, and troubleshooting.
- Fixed an infinite localhost redirect loop in the Windows desktop launcher when serving nested `index.html` pages.
- The embedded web server now serves resolved files directly instead of delegating nested index routes to Go `http.FileServer`.
- Added Windows launcher route regression coverage for the main wrapper, analyser, and model editor entry points.
- Added the desktop browser heartbeat so the private localhost server can shut down after the application window is closed.

# Internal Windows packaging milestone — September 2026

- Fixed Windows first-run shortcut installation when an existing Systemika Studio session is already active.
- Added post-creation verification for Desktop and Start Menu shortcuts.

# Systemika 2026.09.11 — Interface revision 22

- Moved Number Box, Table, Time Plot, and XY Plot to the left of the simulation/run controls in the top toolbar.
- Commented out the Simulation Settings and Macros menu entries without removing their underlying source code, so they can be restored later.
- Replaced the Cut and Colour toolbar artwork with the user-supplied SVG icons.
- Replaced the Run artwork with a compact green play icon; Pause behavior and artwork remain unchanged while a simulation is active.

# Systemika 2026.09.11 — Interface revision 21

- Restored Select, Delete, Undo, Redo, Cut, Copy, Paste, and Colour to the horizontal top toolbar.
- Moved Number Box, Table, Time Plot, and XY Plot to the top toolbar immediately after the simulation/run controls.
- Simplified the left model toolbar to a single column containing only model-construction and diagram-editing tools.
- Fixed vertical-toolbar tooltips so they render above the modeling canvas instead of being clipped beneath it.

# Systemika 2026.09.11 — Interface revision 20

- Split the toolbar: model-building/editing/display tools now use a compact two-column vertical toolbar on the left; simulation/run controls remain in the horizontal bar at the top.
- Removed the Colour menu and added a Colour palette tool to the vertical toolbar.
- Added internal model Cut/Copy/Paste controls and Ctrl/Cmd+X/C/V shortcuts. Copied primitives receive unique names such as `Capital 1`, and formulas/ID references within copied structures are remapped to the duplicated primitives.
- Firefox and Safari now share the permanent status-bar guidance: “Firefox and Safari are not fully supported: use Chrome or Edge for full file and run management.”
- Updated Safari limited-mode handling to suppress repeated unsupported run-management alerts, matching Firefox.
- Corrected three stale tooltip assertions; the complete automated test suite is green.

# Systemika 2026.09.11 — Firefox release polish
- Firefox compatibility guidance now lives permanently in the status bar below the toolbar: “Firefox: use Chrome, Edge, or Chromium for full file and run management.”
- Web branding is normalized to **Systemika Studio** (title case) throughout. The browser tab title is always exactly **Systemika Studio**, with no storage-mode, filename, or save-time suffix.

- Repeated Firefox limitation/error dialogs are suppressed. Save/Save As no longer repeats the same compatibility explanation while the persistent status-bar notice is visible.
- **Manage Runs** controls are disabled in Firefox and use a nonintrusive tooltip instead of opening unsupported-storage error dialogs.
- Chromium project-file and persistent `Runs/*.sysrun` behavior is unchanged.

# Systemika 2026.09.11 — WebApp project-storage correction

- Corrected Chromium WebApp capability detection so a `file://` editor iframe no longer attempts a forbidden native file/directory picker and throws `Cross origin sub frames aren't allowed to show a file picker`.
- Added a dependency-free localhost WebApp launcher (`npm run web` and platform scripts). Serving the wrapper and OpenSystemDynamics editor from one localhost origin enables the existing project-directory `.ssd` + `Runs/*.sysrun` backend in supported Chromium browsers.
- Browser Storage Mode now records the concrete reason full project storage is unavailable and gives context-specific guidance.
- Firefox remains deliberately limited to browser model storage/current in-memory run data because it does not expose the required writable local-directory picker API; Systemika does not create a separate Firefox-only persistent run repository.

# Systemika 2026.09.11 — Revision 19

- Unsaved-change state is now derived from the exact last-saved model XML snapshot. Undoing all edits back to that snapshot removes the red **Unsaved Changes** indicator; redoing away from it restores the indicator.
- The saved-history baseline is preserved across Systemika's internal reload/restart cycle and fresh models receive an explicit clean baseline.
- Successful saves record the exact XML that was written, avoiding false clean/dirty states around asynchronous file writes.
- Choosing **No** in the close-with-unsaved-changes prompt now reliably discards changes and closes the Electron window. The renderer uses acknowledged IPC and the main process destroys the already-approved window rather than re-entering the intercepted close loop.

# Systemika 2026.09.10 — Clear Outputs icon revision 18

- Replaced the Clear Outputs toolbar artwork with the user-supplied eraser icon.
- Changed the tooltip to **Clear Outputs** and assigned **Ctrl+0** (Command+0 on macOS) to the Clear Outputs action.
- Removed the Ctrl+0 shortcut label from Reset Zoom to avoid a shortcut conflict; Reset Zoom remains available from the Zoom menu.

# Systemika 2026.09.10 — Interface revision 17

- Simulation Settings now opens with a **single click** on the simulation progress/status control. The previous double-click-only behavior has been removed.
- The existing Simulation Settings menu/button remains a normal single-click action.

# Systemika 2026.09.10 — Branding revision 16

- Replaced the legacy StochSD application artwork with the supplied Systemika logo across Electron, Windows, Linux, macOS, browser favicons, About dialogs, and Multi-Simulation Analyser/PWA assets.
- Renamed active icon assets from `stochsd.*` to `systemika.*` and updated packaging/build references accordingly.
- Added `productName: "Systemika"` while retaining the lowercase npm package identifier `systemika`.
- Electron now explicitly calls `app.setName("Systemika")`, preventing Linux/desktop shells from exposing the application name as lowercase `systemika`.

# Systemika 2026.09.10 — Canvas navigation revision 15

- Added **Shift+Page Up** / **Shift+Page Down** horizontal canvas scrolling by approximately one visible page.
- Added **Ctrl+Home** (Command+Home on macOS) to return the model workspace to the top-left corner by resetting both horizontal and vertical scroll positions.
- Canvas zoom now uses the current selected model entity (or the centroid of multiple selected entities) as the zoom focal point. Ctrl+wheel remains pointer-centred when nothing is selected.
- Toolbar/menu zoom and Ctrl+/Command +/-/0 use the same selection-centred behavior.

# Systemika 2026.09.10 — XY, table paint, and wheel zoom revision 14

- Restored the original explicit single-series jqPlot configuration when exactly one XY run is selected, while retaining the multi-run comparison path for two or more runs.
- Multi-run table headers now use one sticky `thead` paint layer instead of two independently sticky rows, eliminating separator offsets and stray border fragments while scrolling.
- Added Ctrl + mouse-wheel/trackpad scrolling to zoom the model canvas around the pointer. Ordinary wheel scrolling remains unchanged when Ctrl is not held.

# Systemika 2026.09.10 — XY, Ghost search, and table header revision 13

- Fixed XY Plot with a single selected run. XY rendering now falls back to the run's actual rows if Plot Period/time-metadata filtering yields no points, filters invalid numeric points, and makes an isolated single point visible even when markers are otherwise disabled.
- Added a live search box to the Ghost source chooser. The list filters by primitive name or type and shows the number of matching items.
- Fixed multi-run Table sticky headers while scrolling. Variable-name and run-name header rows now use separate sticky offsets, and the rowspan Time header matches the combined two-row height so early time values are no longer obscured.

# Systemika 2026.09.10 — Interaction and XY comparison revision 12

- Replaced the Ghost tool's native prompt/error path with an in-app source chooser. With no preselected primitive, users place the Ghost first and then choose any ghostable Stock, Flow, Auxiliary, Constant, or Lookup from a list.
- Routed ordinary main-editor and Multi-Simulation Analyser `alert()` calls through in-app jQuery UI dialogs to avoid non-responsive Linux browser/native alerts.
- Replaced the analyser model-name prompt and Print page-count prompt with in-app input dialogs. Removed the run-manager's browser `confirm()` fallback.
- Simulation Settings can now be opened during an active Advance run. Start Time, Length, DT, and Method remain locked, while Advance By remains editable.
- Advance now uses stable one-time-unit internal checkpoints and computes each user Advance target from the current Advance By value, so changing Advance By affects the next click without restarting the active run.
- XY Plot now supports multi-run comparison using the same Runs to compare checklist as Time Plot and Table. Each selected run contributes its own XY/scatter series and legend entry.
- Run-selection rename/delete/auto-selection handling now treats XY Plot as a multi-run display.
- Legacy synchronous model-scripting `Prompt()`/`Confirm()` functions remain unchanged because converting those APIs to asynchronous dialogs would change model-expression semantics.

# Systemika 2026.09.10 — Interface revision 11

- Added **Ctrl+3** for **Advance to End**.
- Completed simulations now force the green progress indicator and displayed current time to the simulation end, including completion via Advance to End.
- Removed the legacy Time Plot creation button from the toolbar. Existing legacy TimePlot primitives remain supported when loading older models.
- Renamed the multi-run Compare Simulations Plot in the UI to **Time Plot** and reused the original Time Plot icon; shortcut **P** creates this multi-run Time Plot.
- Added output shortcuts: **T** Table, **X** XY Plot, **N** Number Box, **H** Histogram.
- Renamed/reordered modeling toolbar tools to: Stock (S), Flow (F), Link (L), Auxiliary (A), Constant (C), Lookup (K), Ghost (G). Internal legacy primitive types remain unchanged for model compatibility.
- New Constant and Lookup primitives use `Constant` and `Lookup` as their default generated names.
- Added regression coverage for toolbar order, shortcuts, legacy TimePlot compatibility, and completion progress.

# Systemika 2026.09.10 — Run management revision 10

- Removed the user-facing **Reset** toolbar control and its Ctrl+3 shortcut to simplify the Advance workflow.
- Renamed **Advance to End / Finish** to **Advance to End**; the `>>|` icon and completion behavior are retained.
- Fixed Advance auto-selection regression by creating the named in-memory live run before notifying run-selector UI. Newly started Advance runs therefore remain selected in plots and tables from the first step.
- Plot HTML overlays now scale and reposition with canvas zoom, so axes, labels, legends, and plot series zoom together with the SVG plot border and the rest of the canvas.
- Simulation Settings now labels the integration step **Time Step (DT)**.
- New models default to **DT = 0.25**. Existing saved models retain their saved DT.
- Added **Advance By**, a per-model integer setting >= 1 with default value 1 time unit. Advance uses this interval instead of DT to determine how far each button press runs the model.
- Added regression coverage for the toolbar simplification, Advance auto-selection ordering, Advance By validation/defaults, and plot-content zoom scaling.

# Systemika 2026.09.10 — Run management revision 9

- Multi-run Select/Deselect control now uses the fixed label **Select / Deselect All** with stable width, preventing properties-dialog resizing.
- Advance now snapshots all plot/table run selections before auto-selecting the stepped run.
- Reset restores the exact pre-Advance selections and refreshes saved-run output instead of leaving ordinary plots with an empty current-run source.
- Displays created during Advance remove only the discarded transient run on Reset while preserving any other selected saved runs.
- Added regression coverage for selection snapshot/restore and stable run-toggle sizing.

# Systemika 2026.09.10 — Run management revision 8

- Linux overwrite confirmation now prefers Systemika's in-app Yes/No dialog; Electron native message-box confirmation is retained only as a fallback.
- Added a **Select All / Deselect All** toggle to the shared multi-run selector used by Compare Plot and Table.
- Advance live value editing now delegates safety validation to the simulation engine's paused `setValue()` API instead of requiring `isConstant=true`, fixing valid parameter edits in legacy/imported models.
- Reset during Advance now discards only the unfinished current trajectory and refreshes remaining selected runs instead of clearing every plot/table.
- If an Advance run was overwriting an existing saved label, Reset restores the prior saved package.
- Deleted/missing runs are immediately removed from Compare Plot/Table selections, and run selectors refresh on run rename/duplicate/delete events.

# Systemika 2026.09.09 — Run management revision 7

- Added a **Clear outputs** toolbar button immediately left of Run. It clears the rendered contents of all plots and tables without deleting display objects or saved run files.
- Added **Advance to End / Finish** immediately right of Reset with a `>>|` icon. It resumes the active Advance simulation to completion and refreshes all output devices at completion.
- Reset now immediately discards the partial Advance trajectory and clears all plot/table output instead of redisplaying stale partial data.
- Advance runs now use the same run preparation/overwrite path as normal runs and are persisted when they reach the end (including through Finish); Reset discards an unfinished Advance run.
- Existing parameter/constant values can now be changed while Advance is paused. Changes are propagated through the simulation engine's supported paused-run `setValue` API and take effect in subsequent simulation progress.
- Structural model changes remain guarded during an active Advance run because the engine compiles model topology/state at run start and cannot safely hot-recompile stocks, flows, links, or state-dependent equations without losing internal state.
- Replaced the external Runs-folder Explorer/Finder workflow with an in-app **Manage Runs** dialog supporting Rename, Duplicate, Delete, and Close. Closing the dialog refreshes all plots and tables.
- Added Electron IPC and package-layer operations for safe run rename, duplicate, and delete.

# Systemika 2026.09.09 — Run management revision 6

- Starting a new **Advance** run now automatically selects that run in the same way as an ordinary Run.
- Existing Time Plot, XY Plot and Histogram displays switch to the stepped run label immediately; Compare Plot and Table append the stepped run to their selected run list.
- Newly created plots/tables during a stepped run now default to the stepped run label rather than remaining on an older saved run.

# Systemika 2026.09.09 — Run management revision 5

- Multi-run Table layout is now variable-first, run-second. For example: `Population [Base]`, `Population [Run 1]`, `Infected [Base]`, `Infected [Run 1]`. The on-screen two-row header groups run columns beneath each variable, and CSV/TSV exports use the same ordering.
- Paused **Advance** simulations no longer place a blocking HTML overlay over plots and tables. A model-edit shield now sits below the result-display layer, allowing users to scroll tables, inspect plots, open display properties, change run/variable display selections, and create result displays while the simulation is paused.
- Model-edit anchors are disabled during Advance so model geometry cannot be changed around the edit shield.
- State-changing toolbar tools, Run, Reset, simulation time settings, and unit-checking settings now request termination of the paused Advance simulation before proceeding.
- Added regression coverage for variable-first table layout and Advance exploration/guard behavior.

# Systemika 2026.09.09 — Run management revision 4

- Newly completed runs are automatically selected in existing plots and tables before display refresh. Time Plot, XY Plot and Histogram switch to the new run; Compare Plot and Table preserve their current selections and append the new run.
- Compare Plot and Table created after a completed run initialize their multi-run selection from that named run instead of relying on an unnamed live sentinel.
- Multi-run Table display changed from vertically stacked run blocks to a side-by-side comparison layout: Time is shared, and each run gets its own variable column group.
- When compared runs use different time grids, the table uses the union of time points and leaves unmatched cells blank rather than interpolating or misaligning rows.
- Multi-run CSV/TSV exports now use explicit run-specific columns such as `Population [Base]` and `Population [Run 1]`.
- Added regression tests for automatic new-run selection, side-by-side time alignment, and multi-run export layout.

# Systemika 2026.09.09 — Run management revision 3

- Simplified run lists: the live/current run is shown by its actual label (for example `Base`) and is deduplicated against the saved `.sysrun` entry. The user-facing `Current / latest (...)` item has been removed.
- Removed the legacy Compare Plot generations/results management panel from the right side of Compare Plot properties.
- Fixed **Advance** so every step snapshots partial simulation data into the central run store and refreshes plots and tables immediately. Partial stepping data is not written to disk.
- Compare Plot continues to support any number of selected named runs.
- Table properties now use the same multi-run checklist as Compare Plot. Selecting multiple runs adds a `Run` column and stacks the datasets for reporting; CSV/TSV export includes the `Run` column.
- Added regression tests for named-run deduplication, legacy panel removal, Advance refresh, multi-run tables, and partial-run capture.

# Systemika 2026.09.08 — Run management revision 2

- Fixed Compare Plot created after a completed simulation: Current/latest now populates immediately instead of waiting for another run event.
- Replaced nested-frame `window.confirm()` overwrite handling with an asynchronous Electron `dialog.showMessageBox`, eliminating the unresponsive Yes/No dialog path.
- Compare Plot now supports selecting any number of run sources simultaneously, including Current/latest plus multiple saved `.sysrun` files.
- Compare Plot stores its selected run list in `RunNames` and labels plotted series with the source run name.
- Automatic time-axis bounds span all selected comparison runs, including runs with different simulation periods.
- Added behavioral tests for multi-run generations and regression tests for post-run Compare Plot initialization and Electron overwrite confirmation.

# Systemika 2026.09.08

- Added persistent normal simulation runs in a model-local `Runs/` directory.
- Added toolbar **Run name** (default `Base`) and **Open Runs folder** control.
- Added compressed `.sysrun` packages containing `data.csv` and `metadata.json`.
- Added pre-run overwrite confirmation and atomic replacement.
- Added renderer `SimulationDataManager` and routed post-run plot/table getters through it.
- Internal optimizer/parameter-estimation/sensitivity simulations are not persisted.
- Corrected Electron iframe bridge resolution so run/file APIs can be obtained from the parent/top frame when preload is not injected into the editor iframe.
- Corrected run persistence to use the established `electronAPI.runs` bridge used by the desktop model file workflow.
- Added per-display saved-run selection to Time Plot, Compare Plot, XY Plot, Histogram and Table properties.
- Added run-source Refresh/Open Folder controls and model-specific run caching.
- Browser-mode launches now visibly report that persistent Runs storage is unavailable instead of silently behaving like persistence succeeded.

# Changelog

All notable changes to StochSD will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the versioning of StochSD is based on the date of release (YYYY.MM.DD).

## [Unreleased]

### Added
- Panning with middle mouse button.
- Double clicking progress-bar opens simulation settings.
- Added SVG layers, to primitives are added to specific layers and not in the creating order.
- Color matching for primitive selectors in table and plot dialogs, ensuring the primitive icon and name have the same color.
- Text color in definitions dynamically changes to match primitive colors.
- Drag-and-drop functionality for SSD files.
- Code highlighting using CodeMirror in ConverterDialog.
- Converter plot preview in ConverterDialog.
- Support for pasting two columns from a spreadsheet application into ConverterDialog.

### Changed
- StochSD Desktop now runs on Electron instead of NW.js.

### Fixed
- UI cleanup and style update for menu and tool-buttons.
- Fix bug where you can't use names "alpha" and "omega".


## 2022.04.15

### Added
- Code-highlighting and autocomplete suggestions to MacroDialog with CodeMirror.
- PreferenceDialog
  - Force TimeUnit preferences
  - Show Experimental Function Helper
- Link to official StochSD forum inside StochSD.
- Better support for PWA StochSD

## Fixed
- Ghosted Converter Bugs
- Recent Files fixes for nwjs-environment (desktop version).

## 2022.01.02

### Added
- Generations list in Dialog ComparePlot, with editable labels.
- Autocomplete to DefinitionDialog, suggests functions and linked primitives (`Ctrl`+`Space` to show).
- CHANGELOG.
- Progressive Web App with Chromium based browsers.
- **Show/hide-option** data in plots when hovering.
- **Help-button** in ConverterDialog, TextAreaDialog and MacroDialog.
- **Hide-frame-option** in Numberbox.
- Icons in tool-menu (Optim, Sensi, StatRes and ParmVar).

## Removed
- KeepResults Option in ComparePlot, (simulations are always kept and results appear in editable table).

### Changed
- Function-libraries visible to user, edited and reorganized.
- StopIf function returns 1 on stop and otherwise 0.
- Resizing of svgplane is done with css and js (for performance).
- Update plots more sparingly when resizing them (for performance).
- Custom tick-setter for TimePlots, ComparePlots and XyPlot. (To remove weird numbers like 0.333...)
- Histogram no longer include maximum value by default, by setting a max-limit slightly higher than max.
- `Enter` -> Apply and `Shift`+`Enter`-> New Line, consistent across all text inputs.
- Progressbar changes width to accommodate simulation info.
- HelpButton is no longer focusable for easier navigation with *tab* and *shift+tab*.

### Fixed 
- ComparePlot bugs.
- MacroDialog-bug (dialog smaller each time it opened).
- Number formatting bugs.
- TextArea now interprets `<` and `>` characters correctly and not as HTML.
- Fix-function bugs.
- Bug for RK4 and function `StopIf` sometimes resulted in NumberBoxes not showing a value at the end of a simulation.
- Minor bugs.

### Depricated 
- Function RandBoolean, replaced with RandBernoulli.

## 2021.01.03
### Added
- Converter error messages.
- Clearer error messages for unmatched brackets.
- Values `pi`, `eps` and `e`.
- Code highlighting to definition.
- Clear Recent List button in file-menu.
- Zooming works with `Ctrl`+`Numpad+`/`Numpad-`.
- Stock/Flow/Constant/Auxiliary icons in primitive selectors.
- StopIf function.
- `Ctrl`+`R` to run simulation.
- More purely visual primitives (Line, Arrow, Elipse).
- Holding `Ctrl` while placing TwoPointer freezes angle to 90 or 45 degrees.

### Changed
- Flow arrow UI-behaviour improved.
- Progressbar color is set according green/orange, depending on done/running.
- Plots are look more consistent when empty.
- More attributes are saved to file for plots.

### Fixed
- Many minor bugs.



[Unreleased]: https://github.com/stochsd/stochsd


### Keyboard and selection refinement
Enter now applies the Time Unit dialog and opens the equation/properties editor for one selected model variable when used on the canvas. M selects the Mouse tool. Undo/Redo and Mouse tooltips show their shortcuts. Attached Flow endpoint anchors use staged selection: a first click in a Stock selects the Stock; select the Flow first (for example via its valve) before selecting an attached endpoint for detaching or repositioning.
