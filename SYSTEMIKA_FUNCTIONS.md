# Systemika Native Engine Function Reference

Engine milestone: **0.8.5**

## Equation editor formatting

Systemika equations may span multiple lines. Line breaks are treated as whitespace by the native equation parser, so they can be used to make nested expressions easier to read without changing their meaning.

For example:

```text
IfThenElse(
  Inventory < MinimumInventory,
  IfThenElse(
    Backlog > 0,
    EmergencyOrder,
    NormalOrder
  ),
  0
)
```

In the Equation Editor, **Enter** inserts a new line. **Ctrl+Enter** applies the equation on Windows/Linux; **Cmd+Enter** applies it on macOS.

The function list continues to show short function names. For statistical functions, hover over the function to see the full syntax with the optional seed, for example `RandomUniform(Minimum, Maximum, Seed?)`. The syntax marks the seed as optional with `?`. Clicking a statistical function inserts the required arguments only; add a numeric seed as the final argument when reproducibility is wanted.

## Programming functions

### IfThenElse(condition, value if true, value if false)

Returns the second argument when `condition` is true and the third argument otherwise. Conditions may use comparisons and logical expressions, and `IfThenElse` calls may be nested or formatted across multiple lines.

Example:

`IfThenElse(Inventory < MinimumInventory, EmergencyOrder, NormalOrder)`

### Smooth(input, smooth time, order, initial value)

N-stage exponential smoothing. `order` must be a constant integer from 1 to 100. The total smooth time is divided equally among the stages. The initial output at the simulation start is `initial value`.

Example:

`Smooth(Demand, 4, 2, 0)`

### Delay(input, delay time, order, initial value)

N-stage exponential distributed delay. `order` must be a constant integer from 1 to 100. The specified delay time is the total mean delay across all stages. The initial output at the simulation start is `initial value`.

Example:

`Delay(Orders, 6, 3, 0)`

This is an exponential/distributed delay, not a pure fixed transport delay.

### Lag(input, lag time, initial value)

Fixed time lag (pure time shift). At simulation time `t`, the function returns the input value from `t - lag time`. The lag time must be greater than zero. If `t - lag time` is earlier than the simulation start, Systemika returns `initial value`.

When the requested historical time falls between two stored simulation points, Systemika linearly interpolates the recorded input history. If the lag aligns with stored time points, the earlier input value is reproduced exactly.

Example:

`Lag(Demand, 2, 0)`

This meaning of *lag* is the time-shift sense used in time-series analysis, mathematics, economics, and signal processing; Systemika documents it explicitly to distinguish it from first-order exponential smoothing.

## Statistical functions

Every statistical function accepts an optional final `seed` argument. If the seed is supplied, that function call produces the same stochastic sequence on repeated model runs. If the seed is omitted, Systemika uses a newly generated run seed, so the results differ from run to run. Seeds must be constant numeric expressions.

### RandomUniform(minimum, maximum[, seed])

Uniform random value between the supplied bounds. `maximum` must be greater than or equal to `minimum`.

### RandomNormal(mean, standard deviation[, seed])

Normal random value with the supplied mean and standard deviation. Standard deviation must be non-negative.

### RandomTriangular(minimum, maximum, mode[, seed])

Triangular random value. `maximum` must be greater than `minimum`, and `mode` must lie between them.

### RandomGamma(shape, scale[, seed])

Gamma random value using positive shape and scale parameters.

### RandomBeta(alpha, beta[, seed])

Beta random value in the interval from 0 to 1. Both parameters must be positive.

## Random-number behavior

Each random-function occurrence in an equation is treated as an independent call site. If the call has an explicit seed, Systemika derives that call's random stream from the supplied seed. If the call omits the seed, Systemika derives it from a fresh run seed. The same underlying random draw is reused across the four RK4 intermediate evaluations in a single integration step. This prevents RK4 from unintentionally sampling several independent shocks inside one model time step.

The automatically generated run seed is available as `results.randomSeed` and is stored in completed-run metadata. The JavaScript engine API can still supply a run-level `randomSeed` for controlled testing, but normal Systemika UI runs use fresh run randomness unless a function itself specifies a seed.

## Numerical integration

`Smooth` and `Delay` introduce internal continuous states that are integrated by the selected Systemika solver along with ordinary Stocks. `Lag` instead maintains a history of its input and reads the value at the requested earlier time; it is a fixed delay rather than an exponential state.

## Unit checking for functions

Systemika 0.9.0 adds strict unit rules for the functions documented here. `Smooth`, `Delay`, and `Lag` preserve the input unit and require their time argument to match the model time unit exactly. `IfThenElse` requires compatible result branches. Statistical functions validate parameter-unit relationships and require explicit seeds to be Unitless. Mathematical functions follow dimensional algebra as documented in `SYSTEMIKA_UNITS.md`. No unit conversion or synonym matching is performed.
