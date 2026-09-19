# Systemika validation models

These models are permanent regression fixtures for Systemika. They are deliberately small enough to inspect by eye and can also be opened in Systemika as ordinary `.ssd` files.

The set covers constant and signed negative flows, exponential growth/decay, stock transfer and conservation, auxiliary/constant evaluation, linear and discrete Lookups, `IfThenElse`, multiple flows, goal seeking, nonnegative stocks, Euler/RK4 behavior, Link polarity annotation, and bare multiline equations.

`manifest.js` contains the corresponding numerical specifications and expected results used by the automated test suite. When engine or file-format behavior changes intentionally, update both the `.ssd` fixture and its manifest entry in the same change.

## 0.8 function-extension fixtures

- `16-programming-functions.ssd` — validates `Smooth`, `Delay`, and `Lag`.
- `17-statistical-functions.ssd` — validates the five supported random distribution functions with a fixed seed.

## 1.0.0 signed-flow fixture

- `18-negative-flow.ssd` — verifies that negative Flow rates are not clamped, reverse the effective stock-to-stock transfer direction, and preserve conservation even when legacy positive-only metadata is present.

## 1.0.0 equation-syntax fixture

- `19-bare-multiline-equation.ssd` — verifies bare model-entity syntax and multiline nested `IfThenElse` equations without an escape character.
