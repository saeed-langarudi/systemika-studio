# Systemika Studio 1.2.0 — File-first opening and run-folder access

**Open Model** uses the normal `.ssd` file picker. The application opens the selected model even when it has no permission to access the adjacent `Runs/` directory. Models and run files remain independent.

If the student previously authorized the model's containing folder, Systemika matches the saved directory handle to the selected file using `isSameEntry`, verifies read/write permission without prompting, and reconnects the folder automatically. Authorized folder handles are retained in browser IndexedDB for supported Chromium browsers. Moving a model, revoking permission, or clearing browser storage may require reconnecting it.

When no directory permission is available, the Manage Runs dialog presents an explicit **Connect Model Folder** action. This selects the folder *containing the currently open `.ssd` file*, not the `Runs/` folder. No folder picker opens automatically when opening a model or Manage Runs. Browsers cannot automatically identify the parent folder of a file selected from the OS picker. Chromium may suggest the model location when opening the directory picker, but that behavior is not guaranteed.

Running a simulation without connected folder access is possible after explicitly acknowledging that no `.sysrun` will be saved. Saved run comparisons and portable ZIP export require a connected folder. Folder association is verified against the exact selected model handle; choosing an unrelated directory is rejected without modifying existing model data.

**Browser compatibility:** Chrome and Edge webapp builds with File System Access APIs are supported. Firefox and Safari are intentionally not supported and receive a blocking compatibility screen. The desktop application is unaffected. A browser lacking the required APIs or a secure first-party context is also blocked from the webapp workspace.

This is a candidate release. Automated tests verify file-first opening, folder matching, permission-free opening, and explicit recovery. Validate in real Chrome and Edge before distributing to students.
