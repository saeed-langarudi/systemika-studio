# Systemika Studio source layout

The source tree is organized so application code, build infrastructure, documentation, platform helpers, tests, and generated output have clear locations.

| Path | Purpose |
| --- | --- |
| `OpenSystemDynamics/` | Main model editor, simulation UI, and Systemika-specific modeling logic. |
| `MultiSimulationAnalyser/` | Analysis/output application used by Systemika Studio. |
| `electron/` | Electron desktop integration and secure preload bridge. |
| `app-icons/` | Product icons used by web and desktop packages. |
| `build/` | Canonical cross-platform staging and desktop packaging project. Generated artifacts appear under `build/output/`. |
| `platform/` | Platform-specific launcher source and Linux desktop-integration helpers. |
| `docs/guides/` | Build, installation, and distribution instructions. |
| `docs/reference/` | Engine, functions, units, validation, provenance, and other technical references. |
| `docs/releases/` | Historical release notes. |
| `tests/` | Automated Node.js regression suite. |
| `validation-models/` | Permanent `.ssd` numerical/behavioral validation fixtures. |

## Root-level files

The source root intentionally keeps only the main application entry points, licenses, package metadata, and convenient one-command build/run/install launchers. In particular, `INSTALL_LINUX_LAUNCHER.sh` is the user-facing Linux launcher installer; it delegates to `platform/linux/install-launcher.sh`. Platform implementation details belong under `build/` or `platform/`; documentation belongs under `docs/`.

## Build output

`build/output/` is generated and should not be included in source releases. Rebuild it from the source tree when a WebApp or desktop installer is needed.
