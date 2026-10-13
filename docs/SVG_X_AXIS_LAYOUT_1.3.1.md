# Systemika Studio 1.3.1 — SVG X-axis label spacing refinement

## Symptom

A downloaded SVG plot could place an X-axis tick value (for example `50`) almost on top of the X-axis title (for example `Time (Month)`). The overlap was most visible with multi-run plots displaying a legend beneath the graph, or plots with limited bottom padding.

## Cause

The standalone SVG exporter independently calculates positions for tick labels, the axis title, and the legend. It previously positioned the X-axis title using the on-screen jqPlot grid padding, and then pushed the title upward to keep it before the legend. The title could end up just six pixels below the tick-number baseline, which is insufficient for readable text. Also, the tick labels themselves could be pushed toward the plot border in short charts by a canvas-height clamp.

## Correction

In `OpenSystemDynamics/src/editor.js`, the SVG generator now allocates distinct vertical bands for:

1. X-axis tick labels (18 px below the plot border),
2. X-axis title (44 px below the plot border), and
3. Legend (with at least 16 px after the preceding axis content).

If the on-screen chart's bottom padding is insufficient, the exported SVG grows vertically to contain all elements rather than overlapping them. This does **not** change live plots, model data, numerical precision, existing SVG plot clipping, or the legend's content.

## Acceptance checks

1. In Chrome, generate a comparative plot with at least five simulation runs. Export the SVG and check that tick `50` and the X-axis title `Time (Month)` do not overlap.
2. Repeat with a smaller plot panel and a legend containing several entries.
3. Check a plot without a legend and another plot without an X-axis title. No clipping or unwanted blank legend space should appear.
4. Confirm that restricted X/Y ranges still clip curves at the plot boundary, as corrected in the earlier 1.3.1 release.
5. Compare the title and legend positioning in the WebApp and desktop SVG exports.

Automated tests: `node --test tests/systemika-svg-axis-spacing-131.test.js tests/systemika-graph-export-clip-131.test.js`
