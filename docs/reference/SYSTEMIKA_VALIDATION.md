# Systemika Studio 1.1 Validation Baseline

Date: 2026-09-28

## Purpose

Systemika Studio 1.1 retains the permanent regression baseline established during development and extends it through the final Histogram and release-readiness work. The validation set does not attempt to reproduce every possible system dynamics model; it covers the deliberately focused feature set Systemika currently supports.


## Current release result

Systemika Studio 1.1.6 has **19 permanent validation models** and **414/414 passing automated regression tests**. The milestone notes below are retained as a development history of how that baseline grew.

## Permanent validation models

The `validation-models/` directory contains 19 ordinary `.ssd` files:

1. Constant Inflow
2. Constant Outflow
3. Exponential Growth — Euler
4. Exponential Growth — RK4
5. Exponential Decay
6. Two-Stock Transfer
7. Auxiliary Chain
8. Constant Parameter
9. Linear Lookup
10. IfThenElse
11. Multiple Inflows and Outflows
12. Goal Seeking
13. Discrete Lookup
14. Nonnegative Stock
15. Link Polarity Annotation
16. Smooth, Delay, and fixed-time Lag
17. Statistical Functions
18. Signed Negative Flow
19. Bare Multiline Equation

`validation-models/manifest.js` stores the corresponding numerical specifications and expected values used by the automated tests.

## File robustness checks

Automated tests verify that:

- non-Systemika XML is rejected before editor synchronization;
- malformed model roots are rejected;
- missing simulation settings are repaired from current defaults;
- incomplete Links are not written to `.ssd`;
- a Ghost whose source was deleted does not crash saving;
- all seven canonical entity types preserve their critical save attributes;
- Link polarity, Lookup data, Ghost source, Flow endpoints, and simulation settings are serialized.

## Numerical robustness checks

Automated tests verify analytical or known results for the permanent models, including conservation in ordinary and negative-rate two-stock transfers. Signed Flow rates are explicitly tested: negative values remain negative, reverse the effective transfer direction, and are not clipped by legacy `OnlyPositive` metadata. The engine also provides explicit errors for division/modulo by zero and rejects settings requiring more than 2,000,000 integration steps.

## Automated result

The 0.7 baseline began with 15 fixtures. The 0.8 programming/statistical function extension adds two more fixtures, for **17 permanent validation models** total. Milestone 0.8.2 updated those fixtures for fixed-time `Lag` semantics and optional per-function random seeds. Milestone 0.8.4 adds regression coverage for multiline nested `IfThenElse` equations and the corrected function-help/editor key behavior. Milestone 0.8.5 adds regression coverage that optional random seeds appear in click-to-insert templates as well as hover help. The complete regression suite for 0.8.5 is **185/185 passing**.

## 0.9.0 strict unit-check validation

Milestone 0.9.0 adds 19 dedicated unit-check regression tests. They cover strict/case-sensitive symbols, algebraic equivalence, invalid unit syntax, constants with declared units, arithmetic and powers, Stock–Flow/time consistency, missing-unit reporting, `IfThenElse`, the complete supported mathematical-function family, `Smooth`, `Delay`, `Lag`, all five statistical distributions, seed units, and the read-only Check Units report UI.

No conversion or synonym cases are accepted: tests explicitly verify that `USD != $`, `Person != People`, and `Year != Month`.

The complete regression suite for 0.9.0 is **204/204 passing**. The permanent numerical `.ssd` validation fixture count remains **17**.
## 0.9.1 classroom-usability regression coverage

Milestone 0.9.1 adds focused regression coverage for the actionable Unsaved Changes control, duplicate directed-Link rejection (including copy/paste), selected-entity stacking above plot overlays, Save As and Rotate Name shortcuts, plot defaults, Text Box copy semantics, silent Advance-mode Simulation Settings, and time-unit x-axis labels. The complete automated suite for 0.9.1 is **212/212 passing**.
## 0.9.2 release-readiness cleanup coverage

Milestone 0.9.2 adds regression checks for the Systemika-specific Help menu, removal of obsolete hidden plugin/help material, restored Histogram toolbar access and `H` shortcut, cleaned Preferences terminology, current AGPL/About text, and a third-party notice screen limited to bundled libraries. The complete automated suite for 0.9.2 is **219/219 passing**.


## 0.9.4 comparative-Histogram regression coverage

Milestone 0.9.4 adds regression checks that Histogram uses the shared **Runs to compare** selector, stores `RunNames`, uses one common set of bin boundaries across all selected runs, draws overlapping distributions with translucent fills and outlines, and participates in the shared run rename/delete/new-run lifecycle. Milestone 0.9.5 additionally verifies current-run fallback and suppresses jqPlot point markers on Histogram bars. Milestone 0.9.6 removed single-run alpha processing, but the one-run chart could still fail because the comparative renderer also introduced jqPlot `fillAndStroke` settings. Milestone 0.9.7 reproduces that jqPlot 1.0.8 draw-time failure directly and restores the proven pre-comparison `step + fill` renderer for exactly one run, with `showMarker: false`. The comparative `fillAndStroke`/transparent renderer is now used only for two or more runs. The complete automated suite for 0.9.7 is **229/229 passing**.

Milestone 0.9.8 reproduces the remaining one-run failure in a real browser: jqPlot 1.0.8 aborts after drawing only the title/frame when a hidden legend is still assigned `outsideGrid` placement. Histogram now requests outside-grid placement only for actual multi-run comparisons. A dedicated regression prevents this configuration from returning. The complete automated suite for 0.9.8 is **230/230 passing**.

Milestone 0.9.9 adds a visual-regression source check for the single-run Histogram style: light gray fill, black bin borders, no markers, and no reintroduction of jqPlot one-series `fillAndStroke`. The comparative renderer is unchanged. The complete automated suite for 0.9.9 is **231/231 passing**.


## 1.0.0 final-release regression coverage

The final pre-release pass adds regression coverage for the **Hide/Unhide Question Marks (Q)** display toggle. Tests verify both the toolbar/shortcut wiring and the display-only behavior: missing-definition markers may be hidden, while definition checking and simulation safeguards remain active. A final Flow-semantics correction removes the inherited positive-only Flow clamp, normalizes legacy `OnlyPositive="true"` files to unrestricted flows, and adds a permanent negative-flow fixture. The complete first-public-release suite reached **259/259 passing** before the final documentation/graph-export refinement pass.


## Paged Figures and Model Documentation

The first-public-release regression suite now also covers paged plot persistence, legacy one-page migration, independent page configurations, duplicate/delete behavior, cross-page removal of deleted model entities, per-entity plot line styles, and the requested documentation equation forms. Documentation tests verify variable-type/name/computation sorting, TXT/CSV/LaTeX serialization, the explicit stock Initial Condition field, and persistent per-entity comments. Equation-editor tests cover bare-name references, legacy bracket compatibility, Name-first focus, Tab navigation, safe multiline storage, and nested multiline `IfThenElse` expressions. The pre-dock suite reached **289/289 passing** with **19 permanent validation models**. The dedicated Output-workspace and keyboard-isolation pass was subsequently refined with Equations-toolbar navigation, compact equation metadata/count placement, Print-menu removal, Escape-to-close dialogs, a 25%-width dock, fixed Table-variable visibility, and true external-window detach/Attach behavior. The previous baseline was **299/299 passing**. The additional checks cover Equations-panel naming and export behavior, Comment persistence/export, transparent SVG/PNG graph export wiring, 3× PNG rasterization with padded legend bounds, system-clipboard figure copying, dash-aware legend samples, visible legend spacing, adaptive repeated XY Show Number labels, bottom-right plot page navigation with matching +/− controls and dedicated Settings access, dynamic processing/hourglass symbols for Auxiliaries using Smooth/Delay/Lag, and clean/dirty-state handling so harmless clicks after opening a model do not trigger Unsaved Changes. The current baseline additionally verifies fixed count-based Histogram scaling, per-model-entity Table decimal settings, user-controlled run display ordering, Run Name capitalization, and dedicated plot/table Settings controls, plus the split Output workspace, true detachable external-window mode, compact scrollable run/variable selectors, Number Box creation-tool removal, Equations (E) navigation, Print-menu removal, Escape-to-close dialogs, and text-field keyboard isolation.


### Bare/multiline equation fixture

`19-bare-multiline-equation.ssd` permanently verifies the canonical bare-name equation syntax and that physical line breaks inside nested functions are treated as ordinary whitespace without any continuation character.

The latest output-workspace refinement restores the original Auxiliary toolbar icon, uses a separate Equations icon, fully resets plot/table split sizing when Equations are shown, defaults plot/table layouts to a 40% output / 60% settings split, and makes Table variable selection update the displayed Table immediately. The previous baseline was **301/301 passing** with **19/19 permanent validation models**. The latest workspace-close refinement adds a close control, starts Systemika with the Output workspace hidden, preserves outputs while hidden, reopens the requested view through toolbar commands/shortcuts, and hides detached output windows cleanly when they are closed. The subsequent startup/shortcut refinement centers the Time Unit prompt against the full modeling canvas and makes E/T/P/X/H toggle their corresponding active output closed/open. The previous baseline was **305/305 passing** with **19/19 permanent validation models**. The shortcut/help cleanup synchronizes the Keyboard Shortcuts dialog with the active key handlers, removes the obsolete Ctrl/Cmd+Enter equation binding/guidance, moves provenance links from the menu bar into About Systemika, and updates the Systemika project URL to https://systemika.no. The latest live-settings/Advance pass moves Selected Variable(s) to the top of plot/Table settings, removes docked Apply controls in favor of immediate updates, cleans the settings scroll treatment, hot-recompiles paused Advance formulation changes/additions while preserving current stock state, and ensures confirmed deletion actually advances the stepped run to completion before deleting. The sticky-Table-heading refinement gives the docked Table its own scroll viewport so single-run and multi-run headings stay visible while rows scroll. The current baseline is **314/314 passing** with **19/19 permanent validation models**.


## Version 1.0.3 interface regression additions

The 1.0.3 suite adds focused checks for the shared compact Table/Plot variable selector, integrated XY dash/width controls, uniform settings-box geometry, Output-header export actions, bottom plot legends, simplified variable/run legend labels, removal of Table TSV export, and plotted-data CSV export. It also dynamically verifies variable-first/run-second CSV ordering for comparative Time Plots. Page-navigation coverage from 1.0.2 remains in place. Current baseline: **326/326 automated tests passing** with **19/19 permanent validation models**.


## Version 1.0.6 output-panel polish regression additions

The 1.0.6 suite added dedicated checks that legacy table-based setting controls collapse their default table spacing so the visible border fills the same 360 px wrapper as Selected Variable(s), and that export actions occupy a dedicated second header row aligned to the left while the title and panel controls remain on the first row. Historical 1.0.6 baseline: **333/333 automated tests passing** with **19/19 permanent validation models**.

## Version 1.0.4 output-panel geometry regression additions

The 1.0.4 suite adds dedicated checks that every Table/Plot settings wrapper is exactly 360 px wide; the default dock is 378 px (105% of that width) and is synchronized from the mounted settings until manually resized; detach/attach is icon-only with the same button footprint as Close; Plot headers omit PNG export while retaining SVG and CSV; and Table/Plot output and settings start with equal flex shares for a true 50/50 split of the available body height. Current baseline: **330/330 automated tests passing** with **19/19 permanent validation models**.


## Version 1.0.6 WebApp release regression

The 1.0.6 suite added a release-build regression that executes the WebApp staging builder and verifies that the upload-ready bundle contains the current Output-panel implementation, current-version cache keys on the launcher and generated JS/CSS bundles, the current nested editor URL, `.htaccess` cache controls, and `WEB_BUILD_INFO.txt`. Historical 1.0.6 baseline: **333/333 automated tests passing** with **19/19 permanent validation models**.

## Dialog Enter / Shift+Enter keyboard regression

The current dialog keyboard convention uses **Enter** to apply changes and **Shift+Enter** to insert a line break in multiline fields. The dialog-level handler applies this consistently even inside CodeMirror, while leaving Enter available to select an active autocomplete suggestion. Help and shortcut documentation are synchronized with the behavior. Current baseline: **336/336 automated tests passing** with **19/19 permanent validation models**.


### Keyboard and selection refinement
Enter now applies the Time Unit dialog and opens the equation/properties editor for one selected model variable when used on the canvas. M selects the Mouse tool. Undo/Redo and Mouse tooltips show their shortcuts. Attached Flow endpoint anchors use staged selection: a first click in a Stock selects the Stock; select the Flow first (for example via its valve) before selecting an attached endpoint for detaching or repositioning.


## Version 1.1 Calibration Sandbox regression additions

The 1.1 suite adds regression coverage for Calibration Sandbox launch and layout, plot variable selection, live constant controls, reset behavior, responsive transient reruns, `.sysrun` sandbox persistence, universal Reference/Simulated styling, and underscore-number naming for copied entities. Current release baseline: **348/348 automated tests passing** with **19/19 permanent validation models**.

## Version 1.1.3 corrective regression coverage

The 1.1.3 suite adds focused regression coverage for detached-window plot rendering, the jqPlot hidden-legend failure that broke single-run Histograms, preservation of the reliable one-series Histogram rendering path, translation of persisted Link Bezier handles and Flow bend points during copy/paste, and copied-equation reference remapping. Final 1.1.3 baseline: **398/398 automated tests passing** with **19/19 permanent validation models**.

## Version 1.1.4 Flow-editing regression coverage

The 1.1.4 suite adds focused coverage for enlarged Flow endpoint/elbow hit targets, a dedicated edit layer that keeps selected Flow handles above Stocks while preserving Stock labels as the final SVG layer, immediate detach-on-drag for both Flow endpoints, right-click elbow insertion/removal on completed Flows, Delete/Backspace removal of selected elbow handles without deleting the Flow, Shift-to-elbow endpoint editing, multiline Lookup input, Rectangle resizing, and synchronized Getting Started guidance. Final 1.1.4 baseline: **405/405 automated tests passing** with **19/19 permanent validation models**.

## Version 1.1.5 repeated-Shift Flow elbow regression coverage

The 1.1.5 suite adds focused coverage for re-arming Shift-to-elbow creation on key release, so repeated Shift presses during one continuous drag of either Flow endpoint can create an unrestricted number of elbows without requiring an intervening mousemove. The same 1.1.5 release includes a dedicated background annotation layer for Text Boxes and geometry shapes. A corrective regression now also verifies explicit double-click routing: if an annotation receives the browser event at a position occupied by a Stock, Auxiliary, Constant, Lookup, or Flow, Systemika routes the action to the model entity before the annotation dialog can open. This avoids relying on SVG paint order alone. Current release baseline: **412/412 automated tests passing** with **19/19 permanent validation models**.

## Version 1.1.2 corrective regression coverage

The 1.1.2 release fixes three classroom-facing regressions found after 1.1.2 deployment: all local WebApp assets now receive release/build cache fingerprints (including Link/Find SVGs), Auxiliary label backgrounds are clipped clear of the circular outline, and raw whitespace in model-entity names is rejected immediately before trimming. The release also uses a network-only immediately activated service worker so a legacy worker cannot remain in control after an upgrade. Current release baseline: **393/393 automated tests passing** with **19/19 permanent validation models**.

## Version 1.1.2 refinement regression additions

The 1.1.2 suite adds focused coverage for startup/manual update checking and generated WebApp update metadata, immediate name-validation feedback, Calibration Sandbox Save-as-Default saved/dirty state, Auxiliary label backgrounds, model-wide exact Lookup rename propagation, and the supplied Link/Find SVG assets. Current release baseline: **393/393 automated tests passing** with **19/19 permanent validation models**.



### 1.1.2 update-check resilience

The 1.1.2 maintenance suite verifies that WebApp update checks refetch the editor page that is actually running instead of guessing a server directory, and that desktop builds use the confirmed canonical WebApp root `https://systemika.no/studio/app/`. The desktop checker starts with the generated root manifest and can fall back to the exact deployed analyser/editor HTML. Detailed failed probes are retained only in diagnostics; the visible alert remains concise. Generated WebApp HTML and packaged desktop staging share the same content-derived build ID so a corrected 1.1.2 build can be distinguished without changing the semantic version.


## Version 1.1.6 calibration alert visibility regression coverage

The 1.1.6 suite verifies that Systemika alert dialogs are routed into a dedicated modal overlay inside the Calibration Sandbox whenever that separate window is open. The overlay uses the highest practical CSS stacking level, focuses the sandbox window, supports OK/Enter/Escape dismissal, preserves alert close callbacks, and queues multiple alerts instead of replacing them. This ensures simulation errors such as Division by zero remain visible above the calibration interface rather than being hidden between the editor and sandbox windows. Current release baseline: **414/414 automated tests passing** with **19/19 permanent validation models**.
