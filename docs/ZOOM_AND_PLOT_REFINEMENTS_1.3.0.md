# 1.3.0 RC3 — Zoom, title and value tooltip refinements

- **View → Zoom to Fit** fits the model contents to the available viewport, with padding. Shortcut: Ctrl+9 / Cmd+9 (if the browser permits intercepting it).
- **View → Zoom 100%** returns to 100% (and preserves the current zoom anchor). Shortcut: Ctrl+0 / Cmd+0.
- **Clear Outputs** continues to work using its toolbar eraser button. Its former Ctrl+0 shortcut has been reassigned to Zoom 100%.
- The model name and software version appear side by side in the editor menu bar.
- jqPlot tooltips near the right edge shift toward the left, within the chart instead of being clipped.

## Acceptance checks
1. Open a model and confirm the title bar shows its model filename and `v1.3.0`.
2. Hover a plotted data point close to the right border. The tooltip must be readable inside the plot.
3. Use View → Zoom to Fit with a small model and a large model. Both should be centered and visible.
4. Use View → Zoom 100%. Verify that Zoom returns to 100%.
5. Check Ctrl+9 and Ctrl+0 in desktop and web contexts. Chrome may reserve Ctrl+9 for switching to the last tab; the menu must remain usable.
6. Confirm Clear Outputs remains accessible by clicking the toolbar eraser icon.
