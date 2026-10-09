# Systemika Studio 1.2.0 — File-first webapp release candidate

**Open Model** uses a familiar `.ssd` file picker in Chrome and Edge. The webapp loads a selected model without requesting folder access. If the browser still grants read/write permission to a previously authorized containing folder, Systemika verifies the selected file against that folder and reconnects the separate `Runs/` directory automatically.

**Manage Runs** never automatically asks for a directory. When run files are not connected, **Connect Model Folder** explicitly requests access to the folder *containing* the `.ssd` model. Students must not select or create the `Runs/` directory. The browser cannot derive a file's containing directory from the file picker; first-time authorization is therefore an explicit user operation. Files and run results remain separate. If a simulation is started before connecting its folder, Systemika asks whether to run without saving a `.sysrun` output.

Firefox, Safari, and sessions without the required browser file APIs receive a blocking compatibility screen. Desktop apps are unchanged. The 1.1.10 model identifier, recovery features, and portable export remain present.

Automated tests cover the file-first workflow, remembered permissions, missing permission, wrong-folder validation, browser compatibility and existing run storage. Real Chrome and Edge acceptance tests are required prior to final release.

## Table SVG export (1.2.0 corrective release)

Table Output panels now provide **Export SVG** beside **Export CSV**, matching the existing Plot header controls. SVG generation uses the complete rendered table rather than a cropped screenshot, and includes all rows, time units, displayed decimal precision, and multi-run grouped headings. CSV remains the preferred machine-readable output.
