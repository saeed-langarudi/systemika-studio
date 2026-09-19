# Systemika Studio packaging tools

This directory contains the release packaging configuration for Systemika Studio.

For most users, use the platform-specific builders in the source-package root:

- Windows: `BUILD_WINDOWS_INSTALLER.bat`
- macOS: `BUILD_MACOS_INSTALLER.command`
- Linux: `BUILD_LINUX_APPIMAGE.sh`

## Packaging-toolchain design

The release packaging project intentionally keeps its npm build surface small:

- `electron-builder` **26.16.1** is the only npm packaging dependency.
- Electron itself is pinned separately to **44.3.0** in the electron-builder configuration.
- `build.js` uses only Node.js built-in modules to stage the desktop and web payloads.
- Gulp, `gulp-useref`, `gulp-rename`, and the obsolete inherited OpenSystemDynamics Gulp packaging helper are not used by the public release build.
- `npmRebuild` is disabled because the packaged Systemika application has no native npm modules to rebuild.

This separation matters: npm packages in this directory are **build tools**, not dependencies shipped as Systemika application code.

## Manual Electron packaging

Requires Node.js 22.12 or newer. From this directory:

```sh
npm install --no-audit --no-fund
npm run dist:win-installer
npm run dist:mac
npm run dist:linux
```

Outputs are written under `output/dist-electron/`.

`npm run build` itself requires no third-party Node modules. It assembles the unbundled desktop payload under `output/app/` and the web payload under `output/web/<Systemika-version>/`.

Maintainers who want to inspect npm advisories for the packaging toolchain after installing it can run:

```sh
npm run audit:build
```

Some upstream deprecation notices may still originate inside electron-builder's own transitive build dependencies. They are not application runtime dependencies. Do not use `npm audit fix --force` on the release tree without re-running the complete Systemika regression and installer verification suite.

The public application version is taken from `OpenSystemDynamics/src/version.js` (`systemika.version`). The historical StochSD version in that file is retained only for lineage/compatibility information.

Linux AppImages are built with Electron Builder's `toolsets.appimage` set to `1.0.3`, avoiding a legacy FUSE2 runtime dependency.
