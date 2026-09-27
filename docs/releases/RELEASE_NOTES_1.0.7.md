# Systemika Studio 1.0.7 — Superseded Calibration Sandbox development notes

- Adds a **Calibration Sandbox** toolbar tool using the supplied equalizer icon.
- Opening the sandbox closes the ordinary Output workspace, prepares a named simulation run using the existing overwrite safeguards, and opens a separate calibration window alongside the model canvas.
- Provides six fixed-format time plots. Each plot independently selects a dashed **Reference Mode** series and a solid **Simulated Variable** series.
- Adds a **Parameter Sliders** panel for model constants with editable minimum, maximum and increment values, per-parameter Reset, Reset All, and Save as Default.
- Slider changes are applied to the existing model constants and immediately re-run the existing Systemika simulation engine; all six plots refresh from the resulting trajectory. No optimiser, fitting algorithm, objective function, or other new computational calibration routine is introduced.

## Calibration Sandbox refinement
- Parameter panel starts 20% wider (408 px instead of 340 px) and can be resized by dragging its divider.
- Slider-driven reruns are transient after the initial named run, keeping filesystem persistence out of the live feedback path and improving responsiveness.
- Reset and Reset All trigger plot refreshes and no longer interrupt subsequent slider-driven simulation.
- Run saving now snapshots the completed run before asynchronous disk I/O, fixing the intermittent `Cannot read properties of null (reading 'runName')` warning when a new live rerun begins while the previous run file is still being saved.

## Calibration Sandbox persistence and visual refinement
- Saves sandbox configuration in the associated `.sysrun` package metadata and restores it when reopening the calibration run.
- Uses a universal legend below the sandbox title: purple dashed Reference and teal solid Simulated.
- Copy/paste-generated entity names now use underscore-number suffixes such as `Variable_1`.
