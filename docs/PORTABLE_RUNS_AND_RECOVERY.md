# Portable runs and recovery (1.1.10 source refinement)

Systemika keeps `.ssd` model files separate from `Runs/*.sysrun` and related metadata sidecars. No automatic per-model run directories are introduced.

- **Manage Runs:** Opens even if the browser has not yet authorized the project folder; if a status error appears, click **Locate Runs Folder**.
- **Locate Runs Folder:** In Chrome or Edge, select the *local folder containing your opened `.ssd` file* (not `http://localhost`). Canceling leaves the model usable. The folder is remembered after a successful choice. Desktop installations already know the model path, so no browser permission is necessary.
- **Export Model with Runs:** Creates a ZIP containing the existing `.ssd` and separate `Runs/*.sysrun` files and their `.metadata.json` sidecars. Unzip to a normal directory to transfer the project. Files remain accessible for independent analysis.
- **Model identifier:** New saves include `SystemikaModelId` in the Setting element; new runs record it in `metadata.json` under `model.id`. A Save As copy retains this identifier to preserve simulation lineage. Legacy runs lacking an ID remain readable. A run with an explicitly different model ID will not be loaded into the current model.

**Important:** As the layout retains a shared `Runs/` folder, archived runs may include runs produced by other `.ssd` files in that folder. The export intentionally preserves the existing shared folder instead of silently guessing ownership and dropping files. Run name collisions across models are therefore still a limitation of the existing storage layout.

Browser folder access depends on Chromium's File System Access API and user permission. Systemika cannot silently recover a folder that was moved outside the application.
