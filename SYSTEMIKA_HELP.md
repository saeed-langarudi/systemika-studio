# Systemika Classroom Help

## Getting started

1. Set the model time unit, start time, simulation length, DT, solver, and Advance increment from **Time Unit**.
2. Build the model using **Stock, Flow, Link, Auxiliary, Constant, Lookup, and Ghost**.
   Auxiliaries that use `Smooth`, `Delay`, or `Lag` are shown with a **processing/hourglass symbol** so stateful delay-processing elements can be recognized directly on the canvas. If those functions are removed, the normal Auxiliary circle returns.
3. Double-click model entities to enter definitions and units. A Link may carry an optional `+` or `−` polarity annotation.
4. Use **Check Units → Report** to review strict unit inconsistencies. The checker never converts, suggests, or repairs units.
5. Use the dedicated **Output panel** on the right. It starts **closed** so the modeling canvas has the full window. Use **Equations (E), Table (T), Time Plot (P), XY Plot (X), or Histogram (H)** in the top toolbar to switch output views. Plot/Table outputs begin with an equal **50/50** split between output and settings; Equations uses the full panel. The vertical canvas/output split and the horizontal output/settings split are draggable. Plot/Table setting boxes are exactly **360 px** wide and the dock defaults to **378 px**, leaving 5% additional panel width for padding. Close it with **×** to return the full width to the modeling canvas; any output toolbar tool/shortcut reopens it. The keyboard shortcuts are also toggles: if the corresponding output is already open, pressing its shortcut again closes the panel. The adjacent unlink icon detaches the panel into a true operating-system window; its tooltip changes to **Attach output panel** while detached. Closing a detached window hides the workspace and the next output command reopens it docked.
6. Use **Run/Pause** for ordinary simulations or **Advance** for stepwise exploration.
7. Save with Save/Save As. The red **Unsaved Changes** indicator is clickable.

Equations may span multiple lines without an escape character. **Enter** applies the changes, **Shift+Enter** inserts a line break, and **Tab** moves to the next property field. Double-clicking a model entity opens its properties with the cursor in **Name** first. The **Comment** field is for documentation only and does not affect simulation behavior.

Flow definitions may evaluate to positive or negative values. Systemika does not impose bounds on Flow rates; a negative stock-to-stock Flow reverses the effective transfer direction.

## Core shortcuts

| Action | Shortcut |
|---|---|
| New model | Ctrl/Cmd+N |
| Open | Ctrl/Cmd+O |
| Save / Save As | Ctrl/Cmd+S / Ctrl/Cmd+Shift+S |
| Undo / Redo | Ctrl/Cmd+Z / Ctrl/Cmd+Y |
| Open equation/properties for selected model variable | Enter |
| Mouse tool | M |
| Cut / Copy / Paste | Ctrl/Cmd+X / Ctrl/Cmd+C / Ctrl/Cmd+V |
| Select all | Ctrl/Cmd+A |
| Delete selection | Delete or Backspace |
| Zoom in / out | Ctrl/Cmd++ / Ctrl/Cmd+- |
| Return canvas to origin | Ctrl/Cmd+Home |
| Scroll canvas left / right | Shift+Page Up / Shift+Page Down |
| Move selection | Arrow keys; Shift+Arrow for larger steps |
| Clear outputs | Ctrl/Cmd+0 |
| Run / Pause | Ctrl/Cmd+1 or Ctrl/Cmd+R |
| Run / Pause from Run Name | Enter, Ctrl/Cmd+1, or Ctrl/Cmd+R |
| Advance / Advance to End | Ctrl/Cmd+2 / Ctrl/Cmd+3 |
| Equations / Table | E / T |
| Time Plot / XY Plot / Histogram | P / X / H |
| Stock / Flow / Auxiliary / Constant | S / F / A / C |
| Link | L |
| Lookup / Ghost | K / G |
| Hide / unhide definition question marks | Q |
| Rotate entity name | R |
| Apply changes in dialog | Enter |
| Insert line break in a multiline dialog field | Shift+Enter |
| Close dialog | Esc |

When exactly one rendered Figure is selected, **Copy** (toolbar or Ctrl/Cmd+C) also places a high-resolution transparent PNG of that Figure on the operating-system clipboard, while retaining Systemika's normal internal model-object copy for Paste. **Cut** (toolbar or Ctrl/Cmd+X) copies the same Figure image to the operating-system clipboard before removing the Figure from the model, so it can be pasted directly into Word, PowerPoint, presentation software, or an image editor.

When exactly one Link is selected, **L** opens Link Properties instead of starting a new Link. Output shortcuts **E/T/P/X/H** toggle their corresponding Output view: pressing the shortcut for the currently visible output closes the Output panel; pressing it again reopens that output. Single-letter shortcuts do not fire while typing in fields or dialogs.

## Functions and equations

The live function list in the Equation Editor is generated from the same supported-function catalog used by Systemika help. Systemika model-entity references use bare names such as `Population` or `BirthRate`; square-bracket references such as `[Population]` are accepted only for backward compatibility with older `.ssd` files. See `SYSTEMIKA_FUNCTIONS.md` for the full function reference.

## Unit checking

Systemika uses strict, reporting-only unit checking:

- symbols are literal and case-sensitive (`USD` ≠ `$`, `Person` ≠ `People`);
- algebraically equivalent unit expressions are recognized (`Person/Year = Person*Year^-1`);
- no unit conversion or synonym matching is performed;
- missing information is reported as **Could not verify**;
- `Unitless` is the explicit dimensionless unit.

See `SYSTEMIKA_UNITS.md` for the full specification.



## Table and Histogram display options

Table formatting is set **per displayed model entity**. In Table Properties, the **Added Model Entities** list includes an editable **Decimal** column; enter a non-negative integer to choose the decimal places for that variable independently of the others. The former global Precision/Decimal selector has been removed. Older Tables use their stored legacy decimal value as the initial default for variables that do not yet have a per-entity setting.

Histogram output is always the standard **Histogram** (bin counts). The former **Select Scaling Type** / Probability Density Function option has been removed so Histogram Figures use one consistent classroom representation.

## Output workspace

Systemika keeps model structure and output inspection separate. The modeling canvas remains on the left; equations, plots, and tables are shown in the right-hand **Output panel** when requested. The panel is closed by default. Use the dedicated output toolbar tools (or their shortcuts) to navigate: **E** Equations, **T** Table, **P** Time Plot, **X** XY Plot, and **H** Histogram. There is no separate output-selector dropdown or New button. Plot/Table views place the output above a live settings pane and begin at a **50/50** vertical split; the Equations view occupies the full panel and has no lower settings pane. Every Plot/Table setting box is exactly **360 px** wide, and the default dock is **378 px** wide so the settings determine its starting size. **Selected Variable(s)** appears first in every plot/Table settings pane, and changes take effect immediately without an Apply button. Drag the vertical divider to widen the canvas/output allocation and the horizontal divider to change output/settings heights. Use **×** to hide the Output panel without deleting anything; any output toolbar tool/shortcut reopens it in the requested view. Pressing the shortcut for the currently open output a second time also closes the panel; pressing it again reopens that output. The icon-only unlink button opens the live Output panel in a separate operating-system window that can be moved across displays; its tooltip and accessible label indicate whether the next action is Detach or Attach. Closing the detached window hides the workspace and the next output command reopens it docked.

Output and variable/run selectors use fixed-height scrollable lists so large models and large run libraries do not expand the settings pane indefinitely. The combined **Runs to compare / Display order** list shows about three runs at once. Plot variable selection now uses one compact **Selected Variable(s)** box of the same width: press **+ Add Variable** to open its finder, search for a model variable, and insert it into the selected list.

Typing in Run Name or Manage Runs never triggers single-letter modeling/output shortcuts. In the toolbar **Run Name** field, press **Enter**, **Ctrl/Cmd+1**, or **Ctrl/Cmd+R** to run/pause without first moving focus back to the canvas.

## Paged Figures

Time Plot, comparison Time Plot, XY Plot, and Histogram Figures support multiple pages. Use the compact controls at the bottom-right of a Figure: **‹ / ›** to move between pages, **+** to add a page, and **−** to delete the current page. The + and − controls use the same font and size. The last remaining page cannot be deleted; the − control is dimmed to make its inactive state clear. Page management is intentionally kept on the Figure itself rather than duplicated in the live settings pane.

Each page keeps its own selected model entities, run selections, axis settings, labels, and other plot options. When you turn plot pages, the lower settings pane is rebuilt immediately from that page so the controls always correspond to the visible graph. Time Plot and comparison Time Plot pages also keep independent **per-entity line styles**. All newly added plotted entities default to a solid line of width 2; each applicable row in **Selected Variable(s)** includes **Dash** and **Width** controls, so there is no separate Line Style panel. XY Plot uses the same integrated selector: the Y-variable row controls the XY curve dash and width while the X row identifies the horizontal-axis variable. Plot Period is automatic and no longer exposed as a Figure property. Figure position and size are shared across all pages. Existing models without page data are treated as a one-page Figure.

Graph exports are available from the Output-panel header and provide **Export SVG** and **Export CSV** controls. Direct PNG export is omitted because Figure copy already places a high-resolution transparent PNG on the system clipboard for pasting into documents and presentations. SVG exports use a transparent background and omit Figure page-navigation controls/page numbers. Plot legends are separated from the plotting area by a visible blank margin and reproduce each series dash pattern and line width. In XY plots, **Show Number** repeats the run/series number along each curve; the number of labels adapts to the rendered curve length, and the same number is used in the legend. Figure page navigation is positioned at the bottom-right corner.

## Equations

Choose the **Equations (E)** toolbar tool to open the equation documentation panel in the Output workspace. The panel can present stock equations in three equivalent teaching forms:

- **Integral equations** — stock state written as `Stock(t) = Stock(t0) +` the integral of net flow;
- **Differential equations** — stock derivative equals inflows minus outflows;
- **Difference equations** — the standard DT stock-update equation.

For stocks, all three equation forms use a dedicated **Initial Condition** field such as `Stock(t0) = 100`. Integral equations reference `Stock(t0)` directly rather than substituting the bare initial value. Top-level `Smooth`, `Delay`, and `Lag` definitions are documented the same way: their initial-value argument is represented by `Entity(t0)` in the Equation column and the actual initialization appears in **Initial Condition**. This keeps the formats consistent and keeps CSV rows single-line and readable.

Equations can be sorted by **Variable type** (Stock, Flow, Auxiliary, Constant, Lookup), **Variable name**, or **Order of computation**. Computation order treats stock state values as available at the beginning of a simulation step and then orders algebraic equations by their dependencies.

The selected equation view can be printed, exported as a plain-text list of equations (`.txt`), exported as a CSV table containing order, type, name, equation, initial condition, units, and comment, or exported as a standalone LaTeX (`.tex`) document. The **Comment** field from each model entity is included as the last documentation column. When the model uses RK4, the difference-equation view is a structural teaching representation; RK4 still evaluates rates at intermediate points internally.


### Plot and Table settings

Plot and Table settings are always visible in the lower part of the active Output workspace. **Selected Variable(s)** is the first control so a newly created empty output immediately shows where to begin. Plot panels use a compact **+ Add Variable** finder inside that single selector box, and Time Plot variable rows include their dash/width controls directly. There is no Apply button: changes to variables, runs, axes, line styles, decimals, and other output options are applied live as they are edited.

In multi-run output settings, **Runs to compare** and **Display order** share one compact list. Each run appears once: use its checkbox to include it, and use the order number plus up/down controls on selected rows to set drawing and legend order. The order is saved with the output.

### Advance editing

Advance is designed for interactive experimentation. While an Advance run is paused, formulation changes—including state-dependent Flow and Auxiliary equations—are hot-recompiled into the active simulation while current stock state is preserved. New model entities and Flows can also be added and incorporated into the remaining trajectory.

Deletion is treated more cautiously because it removes compiled model structure. If a user requests deletion during Advance, Systemika asks for confirmation; on approval it actually runs the current Advance simulation to its configured end, then applies the deletion.
