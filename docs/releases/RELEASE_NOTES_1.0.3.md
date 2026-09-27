# Systemika Studio 1.0.3

Release date: 17 September 2026

Systemika Studio 1.0.3 further consolidates plot and table configuration around the Output panel and improves comparative graph presentation and export.

## Changes

- **XY line styling in Selected Variable(s):** XY Plot now exposes dash and line-width controls inside the compact variable selector. Because an XY run is one curve defined by an X/Y pair, the Y-variable row owns the curve style; the X row remains the horizontal-axis assignment.
- **Table uses the compact variable finder:** Table now uses the same **Selected Variable(s)** + **Add Variable** mechanism as plots while retaining a per-variable **Decimal** field.
- **Uniform settings geometry:** Table and Plot settings are wrapped in a shared 360 px maximum-width container so variable selectors, run selectors, axis/label controls, and other settings align consistently.
- **Header-level exports:** Equations, Table, and all Plot outputs use a consistent export action area beside the Output heading. Plot settings no longer contain a separate export box or explanatory export text.
- **Plot CSV export:** Time Plot, comparative Time Plot, XY Plot, and Histogram can export their plotted data directly to CSV. Comparative Time Plot CSV columns follow the same variable-first/run-second ordering used by the legend.
- **Table export simplified:** Table now exports CSV only; the TSV option has been removed.
- **Bottom legends:** Plot legends are placed beneath the plot rather than on the right, reducing unused horizontal space. SVG/PNG exports follow the same bottom-legend layout.
- **Simplified legend labels:** the old `Run =` prefix is removed. With one selected variable, comparative time-plot legends show run names only. With multiple variables, labels use `Variable [Run]` and are ordered variable first, then run (for example, `Population [Base]`, `Population [Policy]`, `Infected [Base]`, `Infected [Policy]`).
- **Integrated style workflow retained:** Time Plot and comparative Time Plot continue to store dash/width per selected variable with no separate Line Style box. Existing `LineStyles` attributes and older saved models remain compatible.
- **Page-aware settings retained:** changing graph pages continues to commit pending edits and rebuild the settings pane from the selected page.

## Validation

- Automated regression tests: **326/326 passing**.
- Permanent validation models: **19/19 covered by the regression suite**.
- `OpenSystemDynamics/src/editor.js` passes the Node syntax check.
