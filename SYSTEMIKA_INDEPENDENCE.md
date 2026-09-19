# Systemika Independence Roadmap

## Current status — Systemika Studio 1.0.6

Systemika now uses independently written code for the numerical engine and the active model/editor infrastructure that had been identified as Insight Maker-derived in the migration roadmap. The `OpenSystemDynamics/src/insightmaker/` directory has been removed.

The native engine is `OpenSystemDynamics/src/systemika-engine.js` (internal engine version 0.8.5). Run and Advance both use it.

The active Systemika-owned layers are:

1. `systemika-engine.js` — equation evaluation and Euler/RK4 simulation.
2. `systemika-localization.js` — localization/text helper.
3. `systemika-entities.js` — entity templates/defaults.
4. `systemika-model-utils.js` — model queries and graph utilities.
5. `systemika-model-api.js` — Systemika model API.
6. `systemika-model-graph.js` — XML loading, in-memory graph nodes, cloning, connector reconstruction, and limited old-file normalization.

The previously identified inherited files `Localization.js`, `Variables.js`, `Utilities.js`, `API/API.js`, `mxShim.js`, `Sanitize.js`, and `Updater.js` are absent from the source package. The legacy Insight Maker numerical engine and its parser/scheduler/resources are also absent.

## Canonical Systemika model terminology

Systemika uses exactly these model-entity names:

- Stock
- Flow
- Link
- Auxiliary
- Constant
- Lookup
- Ghost

For backward `.ssd` compatibility, Auxiliaries and Constants are still stored as `Variable` XML nodes and Lookups as `Converter` XML nodes. The historical outer XML tag `InsightMakerModel` is also retained when saving. These are file-format compatibility identifiers, not user-facing Systemika terminology or runtime dependencies.

Systemika Studio 1.0.6 does not add new Insight Maker runtime dependencies. The independent Systemika engine/model layers and permanent validation fixtures remain the release baseline.

## 0.6.0 replacement

- Replaced `mxShim.js` with `systemika-model-graph.js`.
- Removed the unused inherited `Sanitize.js` and `Updater.js` startup paths.
- Added a small Systemika-owned normalization step for the old model forms Systemika intends to keep reading:
  - old `Parameter` nodes are converted to `Variable`/Auxiliary storage;
  - old Lookup `Inputs`/`Outputs` pairs are converted to `Data`;
  - missing current Systemika setting defaults are populated.
- Link/Flow source and target endpoints are reconstructed from `.ssd` `mxCell` metadata by Systemika code.
- Model cloning and attribute subscriptions are handled by `SystemikaNode`. A temporary `SimpleNode` alias remains internally so older editor code can be migrated without changing behavior.

## Source audit

The 0.6.0 technical audit found:

- no `OpenSystemDynamics/src/insightmaker/` directory;
- no active JavaScript file containing the `Insight Maker Public License` header;
- no startup `<script>` reference to `insightmaker/`;
- no active use of `mxShim.js`, `Sanitize.js`, or `Updater.js`;
- remaining `Insight Maker` text references are historical attribution, comments explaining removed functionality, the third-party-license record, or the legacy `.ssd` outer XML tag.

A detailed audit is in `SYSTEMIKA_SOURCE_AUDIT.md`. This is a technical source audit, not legal advice. The StochSD/Systemika codebase and bundled third-party libraries still have their own licenses, which remain documented separately.

## Scope principle

Systemika does not aim to reproduce Insight Maker. It is an educational stock-and-flow modeller built around Stocks, Flows, Links, Auxiliaries, Constants, Lookups, and Ghosts, plus teaching-oriented displays, Euler/RK4 integration, basic mathematics, and `IfThenElse`. New capabilities should be added only when there is a clear teaching requirement.
