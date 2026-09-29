# Running and building Systemika Studio 1.1.6

Systemika Studio requires Node.js 22.12 or newer for the supported source/build workflows.

## Run directly from the source tree

Desktop development runtime:

```sh
npm install --no-audit --no-fund
npm start
```

Convenience launchers are available at the source root:

- Windows: `RUN_SYSTEMIKA_WINDOWS.bat`
- macOS: `RUN_SYSTEMIKA_MACOS.command`
- Linux: `./RUN_SYSTEMIKA_LINUX.sh`

For browser/WebApp source-tree testing, use `npm run web` or the corresponding `RUN_SYSTEMIKA_WEB_*` launcher. Do not open `start.html` directly with `file://`; browser security rules can interfere with project-folder and saved-run access.

## Build the upload-ready WebApp

Windows and Linux intentionally use the same canonical builder and the same output layout.

### Windows

Double-click:

```text
BUILD_WEBAPP_WINDOWS.bat
```

### Linux

From the source root:

```sh
chmod +x BUILD_WEBAPP_LINUX.sh
./BUILD_WEBAPP_LINUX.sh
```

Both wrappers invoke `build/build.js` and write the upload-ready release to:

```text
build/output/web/1.1.6/
```

Upload the **contents** of that folder to the server directory serving Systemika Studio. Replace the previous WebApp as one complete set rather than selectively merging old and new files.

The WebApp builder uses only Node.js built-in modules; `npm install` is not required for a WebApp build. It fingerprints all local application assets, writes `.htaccess`, generates `systemika-update.json`/`update.json` in the WebApp root, and writes `WEB_BUILD_INFO.txt`. Upload the complete contents of `build/output/web/1.1.6/` to `https://systemika.no/studio/app/`. The desktop updater reads the manifest from that exact deployed WebApp root and can fall back to the analyser/editor HTML there, so there is no separate update-metadata publishing step.

## Run verification

From the source root:

```sh
npm test
```

Current baseline: **393 automated tests** plus **19 permanent validation models**.

## Build desktop installers

Windows:

```text
BUILD_WINDOWS_INSTALLER.bat
```

macOS:

```text
BUILD_MACOS_INSTALLER.command
```

Linux AppImage:

```sh
chmod +x BUILD_LINUX_APPIMAGE.sh
./BUILD_LINUX_APPIMAGE.sh
```

To register the built Linux AppImage in the current user's application menu:

```sh
chmod +x INSTALL_LINUX_LAUNCHER.sh
./INSTALL_LINUX_LAUNCHER.sh
```

Do not use `sudo` for the Linux launcher installer.

Platform details are documented in `docs/guides/WINDOWS_INSTALLER.md`, `docs/guides/MACOS_INSTALLER_GUIDE.md`, and `docs/guides/LINUX_INSTALLATION_GUIDE.md`.

## Manual packaging project

Maintainers can work directly from the canonical build project:

```sh
cd build
npm install --no-audit --no-fund
npm run dist:win-installer
npm run dist:mac
npm run dist:linux
```

Generated artifacts go under `build/output/` and are intentionally excluded from the source archive/repository.

## Version ownership

The public version is currently **1.1.6**. Corrective source changes do not automatically increment the version. Change the release number only when the release owner explicitly requests a new version, and keep `package.json`, `build/package.json`, `OpenSystemDynamics/src/version.js`, and the release update metadata synchronized when that happens.
