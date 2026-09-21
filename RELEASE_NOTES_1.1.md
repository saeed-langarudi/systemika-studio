# Systemika Studio 1.1 — Release Notes

Systemika Studio 1.1 (internal package version **1.1.0**) introduces the **Calibration Sandbox**, a manual calibration workspace designed for interactive teaching and model exploration. It adds an interface layer around the existing Systemika simulation engine; it does **not** introduce an optimiser, fitting algorithm, objective function, or automatic calibration routine.

## Calibration Sandbox

- Adds a dedicated **Calibration Sandbox** toolbar tool with no keyboard shortcut.
- Opening the sandbox closes the ordinary Output workspace and opens a separate calibration window while keeping the model canvas available.
- Starts a named calibration run using the existing run-management safeguards, including the overwrite prompt when a run name already exists.
- Provides up to **six fixed-format time plots**. Each plot can select a **Reference Mode** variable and a **Simulated Variable**.
- Reference trajectories use a **purple dashed line** and simulated trajectories use a **teal solid line**. A single universal legend below the sandbox heading explains these styles; individual plots do not carry redundant legends.
- Plot formatting and scaling are automatic, with Time fixed on the x-axis.

## Live parameter controls

- Adds a resizable **Parameter Sliders** panel. Its initial width is 408 px and the divider can be dragged to resize it.
- Model constants can be added as calibration parameters with editable **Minimum**, **Maximum**, and **Increment** values.
- Slider changes are applied directly to the selected model constants and rerun the existing Systemika simulation engine so all sandbox plots refresh from the new trajectory.
- Live slider reruns remain in memory after the initial named run, avoiding run-file disk I/O in the feedback path and using a short 25 ms rerun debounce for responsive interaction.
- Each parameter has **Reset**; the panel also provides **Reset All** and **Save as Default**.
- Reset operations refresh every plot and preserve subsequent live slider operation.
- **Save as Default** writes the current selected parameter values back to the model as their new defaults.

## Persistence and run handling

- Calibration Sandbox state is stored in the associated `.sysrun` metadata so a saved calibration run can restore its six plot selections, selected constants, Minimum/Maximum/Increment settings, current parameter values, reset/default values, and parameter-panel width.
- Run saving snapshots the completed run before asynchronous filesystem work, preventing a later live rerun from invalidating the run object being saved.

## Model-editor refinement

- Copied model entities now receive underscore-number suffixes such as `Variable_1`, `Variable_2`, and `Variable_3`, keeping generated names consistent with Systemika's no-space variable naming convention.

## Verification

- **348/348 automated regression tests pass.**
- The permanent validation set remains **19/19 models**.
