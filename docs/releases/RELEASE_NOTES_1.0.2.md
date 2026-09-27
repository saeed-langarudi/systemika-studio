# Systemika Studio 1.0.2

Release date: 17 September 2026

Systemika Studio 1.0.2 refines plot configuration around a smaller, page-aware settings workflow.

## Changes

- **One Selected Variable(s) box:** plot panels no longer show the inherited two-list StochSD variable selector. A compact selector, matched to the width and visual treatment of **Runs to compare**, shows the current variables in one list. Press **+ Add Variable** to open an in-box finder, search the model, and insert variables.
- **Line styling integrated with variables:** Time Plot and comparison Time Plot rows now contain their own **Dash** and **Width** drop-down menus. The separate **Line Style** panel has been removed. Existing `LineStyles` storage, solid/2 px defaults, saved-model compatibility, and per-page line-style persistence are retained. Time Plot axis assignment is also kept directly in each variable row.
- **XY and Histogram selector refresh:** XY Plot and Histogram use the same compact one-box variable finder while retaining plot-specific semantics (X/Y assignment for XY; one-variable limit for Histogram). XY line width remains fixed because XY series represent run curves rather than independent variable lines.
- **Page-aware settings:** when a graph page is changed, added, or deleted, pending live edits are committed first and the settings pane is rebuilt from the newly active page. Selected variables, runs, axes, labels, styles, and other page-specific controls therefore follow the visible graph page.

## Validation

- Automated regression tests: **319/319 passing**.
- Permanent validation models: **19/19 covered by the regression suite**.
