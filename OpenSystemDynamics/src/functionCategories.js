/**
 * Function help shown in the Systemika equation editor.
 *
 * IMPORTANT: This list deliberately mirrors the native Systemika simulation
 * engine. Do not add a function here unless systemika-engine.js evaluates it.
 */
var functionCategories = [
  {
    name: "Mathematical Functions",
    functions: [
      { name: "Absolute Value", replacement: "Abs(##Value$$)", description: "Returns the absolute value of a number.", example: { definition: "Abs(-23)", result: "23" } },
      { name: "Minimum", replacement: "Min(##Values$$)", description: "Returns the smallest of one or more numbers.", example: { definition: "Min(2, 4, -1, 3)", result: "-1" } },
      { name: "Maximum", replacement: "Max(##Values$$)", description: "Returns the largest of one or more numbers.", example: { definition: "Max(2, 4, -1)", result: "4" } },
      { name: "Square Root", replacement: "Sqrt(##Value$$)", description: "Returns the square root of a number.", example: { definition: "Sqrt(9)", result: "3" } },
      { name: "Exponential", replacement: "Exp(##Value$$)", description: "Returns e raised to the specified power.", example: { definition: "Exp(1)", result: "e" } },
      { name: "Natural Logarithm", replacement: "Ln(##Value$$)", description: "Returns the natural logarithm of a number.", example: { definition: "Ln(e^2)", result: "2" } },
      { name: "Base-10 Logarithm", replacement: "Log(##Value$$)", description: "Returns the base-10 logarithm of a number.", example: { definition: "Log(1000)", result: "3" } },
      { name: "Sine", replacement: "Sin(##Angle$$)", description: "Returns the sine of an angle in radians.", example: { definition: "Sin(pi/2)", result: "1" } },
      { name: "Cosine", replacement: "Cos(##Angle$$)", description: "Returns the cosine of an angle in radians.", example: { definition: "Cos(pi)", result: "-1" } },
      { name: "Tangent", replacement: "Tan(##Angle$$)", description: "Returns the tangent of an angle in radians.", example: { definition: "Tan(pi/4)", result: "1" } },
      { name: "Arc Sine", replacement: "ArcSin(##Value$$)", description: "Returns the inverse sine in radians." },
      { name: "Arc Cosine", replacement: "ArcCos(##Value$$)", description: "Returns the inverse cosine in radians." },
      { name: "Arc Tangent", replacement: "ArcTan(##Value$$)", description: "Returns the inverse tangent in radians." },
      { name: "Round", replacement: "Round(##Value$$)", description: "Rounds a number to the nearest integer.", example: { definition: "Round(3.6)", result: "4" } },
      { name: "Ceiling", replacement: "Ceiling(##Value$$)", description: "Rounds a number upward to the nearest integer.", example: { definition: "Ceiling(3.2)", result: "4" } },
      { name: "Floor", replacement: "Floor(##Value$$)", description: "Rounds a number downward to the nearest integer.", example: { definition: "Floor(3.8)", result: "3" } },
      { name: "Sign", replacement: "Sign(##Value$$)", description: "Returns -1 for a negative value, 0 for zero, and 1 for a positive value." },
      { name: "Remainder", replacement: "##Value One$$ mod ##Value Two$$", description: "Returns the remainder after division.", example: { definition: "13 mod 5", result: "3" } },
      { name: "pi", replacement: "pi", description: "The mathematical constant π." },
      { name: "e", replacement: "e", description: "Euler's number." },
      { name: "epsilon", replacement: "eps", description: "Machine epsilon for JavaScript numbers." }
    ]
  },
  {
    name: "Programming Functions",
    functions: [
      {
        name: "IfThenElse",
        replacement: "IfThenElse(##Condition$$, ##Value if True$$, ##Value if False$$)",
        description: "Returns the second argument when the condition is true and the third argument when it is false.",
        example: { definition: "IfThenElse(Population > 100, 1, 0)", result: "1 or 0" }
      },
      {
        name: "Smooth",
        replacement: "Smooth(##Input$$, ##Smooth Time$$, ##Order$$, ##Initial Value$$)",
        description: "Applies an exponential smooth. Order must be an integer from 1 to 100. Higher orders create a progressively sharper distributed response while preserving the specified total smooth time.",
        example: { definition: "Smooth(Demand, 4, 2, 0)" }
      },
      {
        name: "Delay",
        replacement: "Delay(##Input$$, ##Delay Time$$, ##Order$$, ##Initial Value$$)",
        description: "Applies an N-stage exponential delay. Order must be an integer from 1 to 100; Delay Time is the total mean delay across all stages.",
        example: { definition: "Delay(Orders, 6, 3, 0)" }
      },
      {
        name: "Lag",
        replacement: "Lag(##Input$$, ##Lag Time$$, ##Initial Value$$)",
        description: "Returns the input shifted backward by a fixed lag time: at time t, Lag returns the input value from t - lag time. The Initial Value is used before sufficient input history exists.",
        example: { definition: "Lag(Target, 2, 0)" }
      }
    ]
  },
  {
    name: "Statistical Functions",
    functions: [
      { name: "Random Uniform", syntax: "RandomUniform(Minimum, Maximum, Seed?)", replacement: "RandomUniform(##Minimum$$, ##Maximum$$)", description: "Generates a uniform random value between the supplied bounds. Optional third argument: Seed. With a seed, the sequence is reproducible; without one, each model run uses fresh randomness." },
      { name: "Random Normal", syntax: "RandomNormal(Mean, Standard Deviation, Seed?)", replacement: "RandomNormal(##Mean$$, ##Standard Deviation$$)", description: "Generates a normally distributed random value. Optional third argument: Seed. With a seed, the sequence is reproducible; without one, each model run uses fresh randomness." },
      { name: "Random Triangular", syntax: "RandomTriangular(Minimum, Maximum, Mode, Seed?)", replacement: "RandomTriangular(##Minimum$$, ##Maximum$$, ##Mode$$)", description: "Generates a triangularly distributed random value. Optional fourth argument: Seed. With a seed, the sequence is reproducible; without one, each model run uses fresh randomness." },
      { name: "Random Gamma", syntax: "RandomGamma(Shape, Scale, Seed?)", replacement: "RandomGamma(##Shape$$, ##Scale$$)", description: "Generates a gamma-distributed random value using positive shape and scale parameters. Optional third argument: Seed." },
      { name: "Random Beta", syntax: "RandomBeta(Alpha, Beta, Seed?)", replacement: "RandomBeta(##Alpha$$, ##Beta$$)", description: "Generates a beta-distributed random value between 0 and 1 using positive alpha and beta parameters. Optional third argument: Seed." }
    ]
  },
  {
    name: "Simulation Time",
    functions: [
      { name: "Current Time", replacement: "T()", description: "The current simulation time." },
      { name: "Time Step", replacement: "DT()", description: "The simulation time step." },
      { name: "Time Start", replacement: "TS()", description: "The simulation start time." },
      { name: "Time Length", replacement: "TL()", description: "The total simulation length." },
      { name: "Time End", replacement: "TE()", description: "The simulation end time." }
    ]
  }
];

/**
 * Reports whether an equation contains one of Systemika's stochastic functions.
 * This is used by the editor and run manager to mark stochastic model output.
 */
function hasRandomFunction(definition) {
  return /\bRandom(?:Uniform|Normal|Triangular|Gamma|Beta)\s*\(/i.test(String(definition == null ? "" : definition));
}
