# Systemika Studio 1.1 Source Independence Audit

Date: 2026-09-15

## Scope

This audit checks the Systemika source package for the Insight Maker-derived files and runtime dependencies identified during the migration project. It is a technical audit of this source tree, not a legal opinion about the provenance of every historical line in StochSD.

## Results

### Removed inherited components

The following previously identified inherited files/components are absent:

- Insight Maker numerical simulation engine and equation-parser stack
- `Localization.js`
- `Variables.js`
- `Utilities.js`
- `API/API.js`
- `mxShim.js`
- `Sanitize.js`
- `Updater.js`

The directory `OpenSystemDynamics/src/insightmaker/` no longer exists.

### Systemika replacements

- `systemika-engine.js`
- `systemika-localization.js`
- `systemika-entities.js`
- `systemika-model-utils.js`
- `systemika-model-api.js`
- `systemika-model-graph.js`
- `systemika-plot-pages.js`
- `systemika-documentation.js`

### License-header scan

The active JavaScript source contains no `Insight Maker Public License` header. The Insight Maker license text remains in the third-party/provenance documentation for transparency.

### Remaining textual references

A small number of references to Insight Maker remain intentionally:

- About/License/third-party-license text describing historical StochSD lineage.
- Comments noting that the old simulation engine was removed.
- The historical `.ssd` XML outer tag `InsightMakerModel`, retained so existing files and tooling remain compatible.
- Legacy storage tags `Variable` and `Converter`, used internally for `.ssd` compatibility while the UI uses Auxiliary, Constant, and Lookup.

These references are not runtime calls to Insight Maker code.

## Compatibility boundary

Systemika Studio 1.1 intentionally supports a limited old-file normalization layer rather than the full historical Insight Maker updater. It converts the old forms that are relevant to Systemika's current entity set. Very old files relying on unsupported Insight Maker features (agents, states, transitions, actions, folders, macros, stochastic functions, etc.) are not a compatibility target.

## Verification

Automated tests cover:

- graph/document reconstruction from `.ssd`-style XML;
- Link endpoint reconstruction;
- model cloning and unique IDs;
- old `Parameter` normalization;
- old Lookup table normalization;
- absence of the inherited source directory and startup references;
- paged Figure persistence and backward-compatible one-page migration;
- documentation equation forms, sorting, and TXT/CSV serialization;
- the existing numerical, editor, Link, Lookup, Undo/Redo, run-management, and platform regressions.
## Release build-toolchain cleanup

The public 1.0.0 packaging path was also audited for obsolete build dependencies. The active `build/` project now uses a dependency-free Node staging script and one pinned npm packaging dependency (`electron-builder` 26.16.1). The former root packaging Gulp/useref stack and the inherited `OpenSystemDynamics/distribute/` Gulp 3 helper are absent. Electron is pinned to 44.3.0 in the builder configuration, and native npm rebuilding is disabled because the packaged application has no native npm modules.

See `BUILD_TOOLCHAIN_SECURITY.md` for the build-only dependency boundary and maintenance guidance.

