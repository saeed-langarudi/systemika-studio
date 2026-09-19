# Systemika Native Simulation Engine

Systemika now contains an independently written native simulation kernel at:

`OpenSystemDynamics/src/systemika-engine.js`

Version: **0.8.5**

## Purpose

The engine is intentionally much smaller than the general-purpose Insight Maker simulation engine. It is designed around the teaching-oriented subset required by Systemika.

As of **0.8.5**, Systemika's **Run** and **Advance** workflows use the native engine by default. The equation editor help and autocomplete expose only functions supported by the native engine. The legacy Insight Maker numerical simulation engine, formula parser, random/statistical support, scheduler, and simulation resources have been removed from startup and from the source package. The previously identified Insight Maker-derived editor/model support files have also been replaced by Systemika-owned layers.




## Strict unit checker in 0.9.0

Unit checking is deliberately separate from numerical simulation. `OpenSystemDynamics/src/systemika-units.js` parses unit expressions and equation ASTs, then produces a diagnostic report. It never converts or corrects units and never blocks Run/Advance. Unit symbols are literal and case-sensitive; only algebraic rearrangement is normalized. See `SYSTEMIKA_UNITS.md`.

The numerical engine remains version **0.8.5** in this milestone because its integration/evaluation semantics are unchanged. The full application regression suite after adding the unit checker is **204/204 passing**.


## Signed Flow semantics in 1.0.0

Systemika treats Flow rates as signed quantities. The numerical engine applies the equation result exactly as evaluated: positive and negative Flow values are both valid, and no lower or upper bound is imposed by the software. For a stock-to-stock Flow, a negative value reverses the effective transfer direction while preserving the usual stock-balance equations.

The legacy `.ssd` attribute `OnlyPositive` is retained only for file-format compatibility. New Systemika Flows store it as `false`; loaded files that contain `OnlyPositive="true"` are normalized to `false`, and the native engine does not use that attribute to clamp results. Stock `NonNegative` behavior is separate and remains supported.

## Multiline equations

The native tokenizer treats line breaks as ordinary whitespace. The Equation Editor therefore supports multiline formulas directly; this is especially useful for formatting nested `IfThenElse(...)` expressions. No continuation/escape character is required. Enter inserts a line break, Tab moves to the next properties field, and Ctrl+Enter (Windows/Linux) or Cmd+Enter (macOS) applies the equation.

## Programming and statistical functions in 0.8.x

### Stateful programming functions

- `Smooth(input, smooth time, order, initial value)` — N-stage exponential smoothing. `order` is a compile-time integer from 1 to 100. The specified smooth time is divided equally across the stages.
- `Delay(input, delay time, order, initial value)` — N-stage exponential distributed delay using the same hidden-state integration approach. The specified delay time is the total mean delay across the stages.
- `Lag(input, lag time, initial value)` — fixed time lag / pure time shift. At time `t`, it returns the input from `t - lag time`; the initial value is used before enough history exists.

The hidden states used by `Smooth` and `Delay` are integrated alongside Stocks by Euler or RK4, so flows and auxiliaries see the appropriate intermediate values during RK4 evaluation. `Lag` does not use an exponential hidden state; it records input history and reads the value at `t - lag time`. All smooth/delay/lag time arguments must remain greater than zero during simulation.

### Statistical functions

- `RandomUniform(minimum, maximum[, seed])`
- `RandomNormal(mean, standard deviation[, seed])`
- `RandomTriangular(minimum, maximum, mode[, seed])`
- `RandomGamma(shape, scale[, seed])`
- `RandomBeta(alpha, beta[, seed])`

Every random-function call site has an independent stream. A call with an explicit final `seed` derives its stream from that seed; a call without a seed derives its stream from the fresh run seed. One underlying draw is used for the entire integration step, including all RK4 intermediate evaluations. The JavaScript engine API can still supply a run-level `randomSeed` for controlled testing; normal UI runs generate a fresh run seed. The run seed is exposed as `results.randomSeed` and stored in completed-run metadata.

Full automated suite after this milestone: **185/185 passing**.

## Stability and validation milestone in 0.7.0

- Added 15 permanent `.ssd` validation fixtures with automated expected numerical results.
- Added explicit division/modulo-by-zero errors.
- Added a two-million-step safety limit to catch accidental tiny time steps before a long synchronous run can freeze the editor.
- Hardened model loading and saving, including missing-setting repair and protection against incomplete Links and broken Ghost references during save.
- Full automated suite: **169/169 passing**.

## Editor geometry fix in 0.5.1

- Corrected connector endpoint event semantics introduced during the 0.5 model-API replacement.
- Endpoint coordinate writes no longer notify position subscribers while a Link or Flow is being assembled.
- Whole-connector movement emits one position update after both endpoints have been stored.
- Removed an obsolete connection-position debugging alert that could stack dialogs and freeze interaction during Link creation.
- Full automated suite: **154/154 passing**.

## Model/API independence milestone in 0.5.0

- Replaced inherited `insightmaker/Utilities.js` with the independently written `systemika-model-utils.js`.
- Replaced the Systemika-used portion of inherited `insightmaker/API/API.js` with the independently written `systemika-model-api.js`.
- Removed both inherited files from the source package and startup path rather than recreating their unsupported general-purpose features.
- Added canonical API handling for **Auxiliary**, **Constant**, and **Lookup** while retaining legacy `Variable`/`Converter` XML tags only at the `.ssd` storage boundary.
- Kept model creation/deletion, entity queries, Link endpoints, geometry, simulation settings, Lookup data, and file helpers inside the smaller Systemika-owned model layer.
- Added behavioral regression tests for canonical entity creation/querying, Link endpoint storage, Lookup mapping, and simulation settings.
- Replaced `mxShim.js`, `Sanitize.js`, and `Updater.js` with the Systemika-owned model graph/loading layer. The `src/insightmaker/` directory is no longer present.
- Full automated suite: **152/152 passing**.

## Model-layer milestone in 0.4.0

- Replaced inherited `Localization.js` with the independently written `systemika-localization.js`.
- Replaced inherited `Variables.js` with the independently written `systemika-entities.js`.
- Established the canonical Systemika entity vocabulary: **Stock, Flow, Link, Auxiliary, Constant, Lookup, Ghost**.
- Kept legacy `.ssd` tags `Variable` and `Converter` only as internal storage-compatibility identifiers.
- Split the Equation List into separate Auxiliary and Constant sections and renamed Converter UI/help to Lookup.
- Removed unsupported agent/state/action entity templates from the active Systemika entity-definition layer.
- Full automated suite: 142/142 passing.

## Fixed in 0.3.1

- Removed the normal Run startup fallback to the deleted Insight Maker `simulate` controller.
- Reworked the inherited `runModel()`, `simulationRunning()`, and `endRunningSimulation()` compatibility helpers to use the native Systemika engine and `RunResults` state only.
- Added a regression test ensuring normal native Run startup contains no legacy `simulate` dependency.
- Full automated suite: 134/134 passing.

## Implemented in 0.3.0

- Stock, flow, auxiliary/constant, and lookup primitives
- Bare model-entity references such as `Population` (legacy `[Population]` remains accepted on import)
- Euler (RK1) integration
- Classical fourth-order Runge-Kutta (RK4) integration
- Re-evaluation of flows and auxiliaries at every RK4 intermediate stage
- Flow-to-stock topology from the existing Systemika model graph
- Linear and discrete lookup interpolation
- Lookup input from time or another primitive
- `IfThenElse(condition, trueValue, falseValue)` with lazy branch evaluation
- Arithmetic: `+`, `-`, `*`, `/`, `^`, `%`, `mod`
- Comparisons: `=`, `==`, `!=`, `<>`, `<`, `<=`, `>`, `>=`
- Logic: `and`, `or`, `not`, `&&`, `||`, `!`
- Constants: `pi`, `e`, `eps`
- Time functions: `T()`, `TS()`, `DT()`, `TL()`, `TE()`
- Basic math: `Abs`, `Min`, `Max`, `Sqrt`, `Exp`, `Ln`, `Log`, `Sin`, `Cos`, `Tan`, `ArcSin`, `ArcCos`, `ArcTan`, `Floor`, `Ceiling`, `Round`, `Sign`
- Stateful programming functions: `Smooth`, `Delay`; history-based fixed lag: `Lag`
- Statistical functions: `RandomUniform`, `RandomNormal`, `RandomTriangular`, `RandomGamma`, `RandomBeta`
- Reproducible per-run random seeds with RK4-stable stochastic call semantics
- Stock non-negative flag support. Flow rates are always signed and unrestricted; negative Flow values are never clamped and reverse the effective transfer direction.
- Result compatibility helpers: `times`, `periods`, `value(primitive)`, `resume()`, `terminate()`, `completed()`, `setValue()`
- Pause/resume controller for Run/Advance simulations, with browser callbacks deferred between chunks so the UI remains responsive
- Interactive parameter override for state-independent auxiliary/constant and flow equations
- Detection of unknown model entity references and circular equation dependencies

## Deliberately not implemented

The native engine does not implement agents, states/transitions, conveyors, vectors, macros, user-defined functions, events/actions, optimization, or dimensional unit checking/conversion. Systemika supports both the N-stage exponential distributed `Delay` documented above and the history-based fixed time shift provided by `Lag`; the supported statistical distributions are intentionally limited to the five listed functions.

Units remain model metadata at this stage.

## Browser API

When Systemika is open, the module is available as `window.SystemikaEngine`.

Compile the current editor model without running it:

```js
const model = SystemikaEngine.compileCurrentModel();
```

Run the current editor model using the native engine:

```js
SystemikaEngine.runCurrentModel({
  onSuccess(results) {
    console.log(results.times);
  }
});
```

Run a plain JavaScript model specification:

```js
const results = SystemikaEngine.simulate({
  timeStart: 0,
  timeLength: 10,
  dt: 0.1,
  method: "RK4",
  stocks: [
    { id: "s", name: "Population", initial: "100" }
  ],
  flows: [
    { id: "f", name: "Growth", equation: "0.1 * Population", targetId: "s" }
  ]
});
```

## Migration status and next steps

Completed:

1. Native parser/evaluator and Euler/RK4 numerical kernel.
2. Browser adapter for the existing Systemika primitive/model structure.
3. Native Run and Advance backend integration.
4. Native-only equation-editor function help and autocomplete.
5. Automated numerical and UI regression coverage.
6. Removed the legacy Insight Maker simulation-engine directory and its startup script tags.
7. Removed dormant StochSD macro/random-function hooks from the Systemika editor.
8. Redirected the legacy global `runModel()` compatibility entry point to the native Systemika engine.

Next:

1. Maintain the Systemika-owned model graph/loading layer and expand compatibility only when a real `.ssd` file requires it.
2. Keep the supported equation language deliberately small and add functions only when Systemika teaching needs justify them.
3. Expand analytical numerical tests as new modeling behavior is introduced.
4. Review third-party licensing again after the remaining inherited editor/model code reaches zero.

## Numerical semantics

For a stock `S`, Systemika computes:

`dS/dt = sum(inflows) - sum(outflows)`

Euler uses the derivative at the beginning of the step. RK4 evaluates the complete model—including auxiliaries, lookups, and flows—at each intermediate stock state.

Lookup values outside the defined X range use the nearest endpoint Y value. Linear lookup mode interpolates between points. Discrete mode uses the most recent point at or below the input.
