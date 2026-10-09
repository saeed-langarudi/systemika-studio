# Systemika Studio 1.2.0 — UI corrections and acceptance checks

This release candidate retains the file-first Open Model workflow and separate `.ssd` and `Runs/*.sysrun` storage.

## Manual acceptance tests (Chrome and Edge)

1. Open the WebApp over HTTPS or localhost, in Chrome or Edge.
2. Choose **File → Open Model**, select an existing `.ssd` model, and confirm the model opens and the browser stays running. Repeat for another model and a previously opened model.
3. Open **Manage Runs**. The manager must not trigger a folder picker. Previously authorized folders should be reconnected automatically; otherwise the **Connect Model Folder** action is optional.
4. Create or edit a Lookup and type a space in its name. Confirm the warning uses the **same red formatting and “Allowed characters are” message** as Stock/Auxiliary name warnings, and that Apply does not save an invalid name. A name such as `Lookup_1` must be accepted.
5. Select `Criminals` or another entity: confirm the top-left summary shows `Criminals = ...` without square brackets.
6. Open the WebApp in Firefox: confirm the compatibility message wraps and remains within the screen width.

## RC5: safer Chrome Open Model workflow

Opening an existing `.ssd` model now uses the standard HTML file input rather than Chromium's native `showOpenFilePicker()` API, including its former parent-iframe invocation. The old picker may trigger a native-browser failure on some systems; JavaScript tests cannot confirm the exact reason a Chrome process exits.

After opening a model, Systemika will automatically reconnect a previously approved folder **only** when the model filename *and file contents* match the `.ssd` file located there. It will not silently attach a different model with the same filename. If the directory has not been authorized, the model still opens and can be edited; **Manage Runs → Connect Model Folder** remains optional, and saving to the original file requires authorizing its containing directory. Save As continues to use an explicit directory permission flow. Runs remain separate `.sysrun` files.

Because a standard file input does not provide a persistent file handle, newly opened models without an authorized folder are not automatically added to the file-handle-based Recent Files list. This is an intentional browser limitation; it does not prevent opening the model.

### Manual crash acceptance tests (Chrome and Edge)

1. Back up the `.ssd` files. Open the WebApp over HTTPS (or localhost) in Chrome.
2. File → Open Model: choose an existing model. Confirm the model loads and the browser does not close; repeat with a second `.ssd` file.
3. Open an existing model with a previously authorized containing folder, then inspect Manage Runs. Confirm its saved runs appear without choosing another folder.
4. Open a model from an unapproved folder: confirm it still loads and Run Management does **not** open a folder picker. Choose **Connect Model Folder** and select the folder containing that exact `.ssd` file, then verify run access and saving.
5. Select a different `.ssd` file with the *same filename* in another folder and confirm Systemika does not silently associate the wrong run directory.
6. Cancel Open Model: the previously open model must remain unchanged.
7. Save and reopen an edited model; check that normal `.ssd` and `.sysrun` files remain separate. Test SVG exports to ensure RC4 functionality remains intact.

A live interactive Chrome/Edge test is still required; the test environment cannot reliably launch a local Chromium session. If Chrome still closes, capture OS, Chrome version, whether it happens on opening the picker or selecting a file, and whether it happens with a tiny newly created model. `chrome://crashes` may contain a browser crash report (depending on browser configuration).
