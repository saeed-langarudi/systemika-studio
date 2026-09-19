# Systemika Strict Unit Consistency Checker

Milestone: **0.9.0**

Systemika checks unit consistency for teaching and model review. It deliberately does **not** choose units, convert units, infer synonyms, suggest replacements, or repair a model.

> **Design principle:** Systemika reports unit inconsistencies; the modeler remains responsible for choosing and writing units correctly.

## How to use it

Click **Check Units → Report** in the run-control area. Systemika opens a read-only report with two sections:

- **Unit inconsistencies** — cases Systemika can demonstrate are dimensionally inconsistent.
- **Could not verify** — cases where information is missing or an expression cannot be checked completely.

Unit checking never changes the model and never blocks a simulation.

## Strict symbol matching

Unit symbols are literal and case-sensitive.

- `USD` is different from `$`.
- `Person` is different from `People`.
- `Year` is different from `year`.
- `Month` is different from `Year`.

Systemika has no unit synonym table and performs no conversions.

Mathematical rearrangement is still recognized. For example:

- `Person/Year`
- `Person*Year^-1`

represent the same algebraic unit.

`USD/(Person*Year)` and `USD/Person/Year` are likewise equivalent.

## Unit syntax

Supported unit expressions use:

- unit symbols such as `Person`, `USD`, `$`, `kg`, `m`
- multiplication: `*`
- division: `/`
- numeric powers: `^`
- parentheses
- `1` or `Unitless` for dimensionless quantities

Examples:

- `Person`
- `Person/Year`
- `1/Year`
- `USD/Person`
- `kg/m^3`
- `USD/(Person*Year)`

Implicit multiplication is not accepted: write `Person*Hour`, not `Person Hour`.

Numeric conversion factors are not accepted in unit declarations. For example, `1000*USD` is invalid. Systemika does not use a conversion database.

## Core equation rules

### Addition and subtraction

Operands must have the same unit.

`Person + Person` is valid.

`Person + USD` is invalid.

### Multiplication and division

Units are multiplied and divided algebraically.

`Person * 1/Year = Person/Year`

`USD / Person = USD/Person`

### Comparisons

Compared values must have compatible units. The comparison result is Unitless.

### Powers

The exponent must be Unitless. A dimensioned base may only be raised to a numeric constant power.

### Numeric constants

A pure numeric definition can carry the declared unit of its entity. This allows constants such as:

- `Birth Rate = 0.1`, declared as `1/Year`
- `Initial Population = 100`, declared as `Person`

Numeric literals embedded in a larger expression act as scalar values and do not trigger unit conversion or synonym matching.

## Stocks and Flows

If the model time unit is `Year` and a Stock is declared as `Person`, a connected Flow must be declared as `Person/Year`.

Systemika compares the Flow's declared unit directly with:

`Stock unit / Model time unit`

It does not convert `Person/Month` into `Person/Year`.

## Function rules

### IfThenElse

The true and false result branches must have compatible units. The condition must be Unitless/logical.

### Smooth and Delay

- output unit = input unit
- initial value must match the input unit
- smooth/delay time must use the exact model time unit
- order must be Unitless

### Lag

- output unit = input unit
- initial value must match the input unit
- lag time must use the exact model time unit

### Mathematical functions

- `Abs`, `Floor`, `Ceiling`, and `Round` preserve the input unit.
- `Min` and `Max` require compatible argument units and preserve that unit.
- `Sqrt` takes the square root of the unit powers.
- `Exp`, logarithms, trigonometric functions, and inverse trigonometric functions require Unitless input and return Unitless output.
- `Sign` returns Unitless.

### Statistical functions

- `RandomUniform(min, max, seed?)`: min and max must have compatible units; output has that unit.
- `RandomNormal(mean, standard deviation, seed?)`: mean and standard deviation must have compatible units; output has that unit.
- `RandomTriangular(min, max, mode, seed?)`: min, max, and mode must have compatible units; output has that unit.
- `RandomGamma(shape, scale, seed?)`: shape is Unitless; output has the scale unit.
- `RandomBeta(alpha, beta, seed?)`: alpha and beta are Unitless; output is Unitless.
- all explicit seeds are Unitless.

## Lookups

A Lookup's declared unit is used as its output unit when the Lookup is referenced elsewhere. Systemika currently does not attach a separate unit declaration to the Lookup's X-axis table values, so it does not attempt to verify that axis independently.

## Report meaning

**Unit inconsistency** means Systemika has enough information to demonstrate a mismatch.

**Could not verify** means the checker lacks necessary information, for example:

- a missing declared unit
- a missing model time unit
- an invalid upstream unit declaration
- a blank or unparsable definition

“Could not verify” is never treated as “correct.”

## What Systemika deliberately does not do

Systemika does not:

- convert units
- infer equivalent symbols
- suggest units
- select units automatically
- repair unit declarations
- treat currencies or naming variants as aliases
- change simulation equations based on units

This behavior is deliberate and supports Systemika's pedagogical goal of making unit consistency the modeler's responsibility.
