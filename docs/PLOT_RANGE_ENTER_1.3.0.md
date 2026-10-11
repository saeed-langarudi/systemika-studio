# Plot Range dialog — Enter to apply (1.3.0 RC7)

In the Range dialog for an individual plot variable, pressing **Enter** while focused in a Minimum or Maximum field (or the Automatic range checkbox) now performs the existing **Apply** action: save the settings, update the plot, and close the dialog.

Invalid manually entered limits keep the dialog open with the existing warning. **Cancel** continues to dismiss without saving.

This update does not change model data, simulation results, or the format of saved plot settings.

Regression coverage: `tests/systemika-plot-range-enter-130.test.js`.
