# Systemika Studio 1.3.1 — SVG plot clipping correction

## Symptom

A curve extending beyond a manually limited Y-axis (or X-axis) range was visible outside the plotting border in a downloaded SVG, even though the on-screen jqPlot canvas clipped it correctly.

## Root cause

The standalone SVG exporter in `OpenSystemDynamics/src/editor.js` serialized complete series paths directly into the exported SVG without applying a clip path matching the graph grid. The normal live chart uses a bounded canvas, so this discrepancy was most visible after setting a manual plot range.

## Fix

`buildGraphSvgPayload` now declares an SVG `clipPath` sized to the jqPlot grid and places data paths, filled areas, markers, compare-plot point labels, and XY curve numbers inside a referencing group. The plot border is painted on top. The axes, title, legend and outside-grid annotations remain outside the clip group. Full data are retained, so clipping preserves precise boundary crossings.

## Acceptance checklist

1. In Chrome, create a Time Plot with a series that rises above a manually set Y-axis maximum. Export SVG and open it in a new tab. The curve must end exactly at the top grid border, with no portion visible above it.
2. Repeat with the Y-axis minimum set higher than some observations. Check the bottom edge.
3. Repeat with an XY Plot whose values go outside the X-axis range, including stepped lines and filled plots when available.
4. Export plots with curve numbers and point labels. Content outside the grid must be clipped; axis titles and legends must remain intact.
5. Export a plot without constrained axes and confirm its appearance is otherwise unchanged.

## Test command

`node --test tests/systemika-graph-export-clip-131.test.js`

This fixes the SVG export format only; it does not modify `.ssd`, `.sysrun`, simulation results, or the on-screen plot.
