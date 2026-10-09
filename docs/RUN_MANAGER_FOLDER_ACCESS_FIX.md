# Run Manager folder access correction

- The shared `Runs/` folder and independent `.sysrun` files remain unchanged.
- Manage Runs does not request folder authorization automatically; when project access has not yet been granted, it displays guidance and permits explicit recovery.
- The recovery action is labeled **Reconnect Model Folder** and requests the directory containing the open `.ssd` file, not the `Runs/` subfolder.
- On selecting a valid project directory, the existing directory binding is reused. The invalid `refreshRunIndex()` invocation was removed; listing the runs reads the directory directly.
- Important browser limitation: the File System Access API does not expose a single file handle's parent directory. A model opened through the file picker cannot automatically grant access to sibling `Runs` files. A model saved through Systemika's project-directory flow can retain that access. Desktop access is not subject to this restriction.
