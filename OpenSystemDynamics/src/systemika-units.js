/*
 * Systemika strict unit consistency checker
 *
 * Copyright (c) 2026 Systemika contributors.
 *
 * Design principle: Systemika reports unit inconsistencies. It never chooses,
 * converts, substitutes, aliases, or corrects units for the modeler.
 */
(function (root, factory) {
  let engine = root && root.SystemikaEngine ? root.SystemikaEngine : null;
  if (!engine && typeof module === "object" && module.exports) {
    try { engine = require("./systemika-engine.js"); } catch (_error) { engine = null; }
  }
  const api = factory(engine);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SystemikaUnits = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (SystemikaEngine) {
  "use strict";

  const EPS = 1e-12;
  const DIMENSIONLESS_NAMES = new Set(["Unitless"]);

  class UnitCheckError extends Error {
    constructor(message, position, expression) {
      super(message);
      this.name = "SystemikaUnitCheckError";
      this.position = position == null ? null : position;
      this.expression = expression == null ? null : String(expression);
    }
  }

  function cleanExponent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new UnitCheckError("Unit exponent must be a finite number.");
    if (Math.abs(n) < EPS) return 0;
    const nearestInteger = Math.round(n);
    if (Math.abs(n - nearestInteger) < EPS) return nearestInteger;
    return n;
  }

  function makeUnit(entries) {
    const powers = new Map();
    if (entries) {
      for (const [symbol, rawExponent] of entries) {
        const exponent = cleanExponent(rawExponent);
        if (exponent === 0) continue;
        powers.set(String(symbol), exponent);
      }
    }
    return { powers };
  }

  function cloneUnit(unit) {
    return makeUnit(unit && unit.powers ? unit.powers.entries() : []);
  }

  function dimensionlessUnit() { return makeUnit(); }
  function isDimensionless(unit) { return Boolean(unit && unit.powers && unit.powers.size === 0); }

  function combineUnits(left, right, direction) {
    const out = cloneUnit(left);
    for (const [symbol, exponent] of right.powers.entries()) {
      const next = cleanExponent((out.powers.get(symbol) || 0) + direction * exponent);
      if (next === 0) out.powers.delete(symbol);
      else out.powers.set(symbol, next);
    }
    return out;
  }

  function multiplyUnits(left, right) { return combineUnits(left, right, 1); }
  function divideUnits(left, right) { return combineUnits(left, right, -1); }

  function powerUnit(unit, exponent) {
    const out = makeUnit();
    for (const [symbol, value] of unit.powers.entries()) {
      const next = cleanExponent(value * exponent);
      if (next !== 0) out.powers.set(symbol, next);
    }
    return out;
  }

  function unitsEqual(left, right) {
    if (!left || !right || left.powers.size !== right.powers.size) return false;
    for (const [symbol, exponent] of left.powers.entries()) {
      if (!right.powers.has(symbol)) return false;
      if (Math.abs(exponent - right.powers.get(symbol)) >= EPS) return false;
    }
    return true;
  }

  function formatExponent(exponent) {
    const n = cleanExponent(exponent);
    return Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(12)));
  }

  function formatFactor(symbol, exponent) {
    const abs = Math.abs(exponent);
    return Math.abs(abs - 1) < EPS ? symbol : `${symbol}^${formatExponent(abs)}`;
  }

  function formatUnit(unit) {
    if (!unit || isDimensionless(unit)) return "Unitless";
    const positive = [];
    const negative = [];
    [...unit.powers.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([symbol, exponent]) => {
      if (exponent > 0) positive.push(formatFactor(symbol, exponent));
      else negative.push(formatFactor(symbol, exponent));
    });
    const numerator = positive.length ? positive.join("*") : "1";
    if (!negative.length) return numerator;
    const denominator = negative.length === 1 ? negative[0] : `(${negative.join("*")})`;
    return `${numerator}/${denominator}`;
  }

  class UnitTokenizer {
    constructor(expression) {
      this.expression = String(expression == null ? "" : expression);
      this.index = 0;
      this.current = null;
      this.next();
    }
    fail(message, position) {
      throw new UnitCheckError(message, position == null ? this.index : position, this.expression);
    }
    skipWhitespace() {
      while (this.index < this.expression.length && /\s/.test(this.expression[this.index])) this.index++;
    }
    next() {
      this.skipWhitespace();
      const start = this.index;
      if (start >= this.expression.length) return (this.current = { type: "eof", position: start });
      const ch = this.expression[this.index];
      if ("*/^()".includes(ch)) {
        this.index++;
        return (this.current = { type: ch, value: ch, position: start });
      }
      const rest = this.expression.slice(this.index);
      const number = rest.match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number) {
        this.index += number[0].length;
        return (this.current = { type: "number", value: Number(number[0]), raw: number[0], position: start });
      }
      let end = this.index;
      while (end < this.expression.length && !/[\s*\/^()]/.test(this.expression[end])) end++;
      if (end === this.index) this.fail(`Unexpected character '${ch}' in unit expression.`, start);
      const symbol = this.expression.slice(this.index, end);
      this.index = end;
      return (this.current = { type: "symbol", value: symbol, position: start });
    }
  }

  class UnitParser {
    constructor(expression) {
      this.expression = String(expression == null ? "" : expression).trim();
      this.tokens = new UnitTokenizer(this.expression);
    }
    parse() {
      if (!this.expression) throw new UnitCheckError("Unit is not specified.", 0, this.expression);
      if (DIMENSIONLESS_NAMES.has(this.expression) || this.expression === "1") return dimensionlessUnit();
      const value = this.parseProduct();
      if (this.tokens.current.type !== "eof") {
        this.tokens.fail("Expected '*' or '/' between unit symbols.", this.tokens.current.position);
      }
      return value;
    }
    parseProduct() {
      let value = this.parsePower();
      while (this.tokens.current.type === "*" || this.tokens.current.type === "/") {
        const op = this.tokens.current.type;
        this.tokens.next();
        const right = this.parsePower();
        value = op === "*" ? multiplyUnits(value, right) : divideUnits(value, right);
      }
      return value;
    }
    parsePower() {
      let value = this.parsePrimary();
      if (this.tokens.current.type === "^") {
        const pos = this.tokens.current.position;
        this.tokens.next();
        if (this.tokens.current.type !== "number") this.tokens.fail("Unit exponent must be a numeric constant.", pos);
        const exponent = this.tokens.current.value;
        this.tokens.next();
        value = powerUnit(value, exponent);
      }
      return value;
    }
    parsePrimary() {
      const token = this.tokens.current;
      if (token.type === "number") {
        if (token.value !== 1) this.tokens.fail("Only the number 1 may appear as a unit factor; Systemika does not apply unit conversion factors.", token.position);
        this.tokens.next();
        return dimensionlessUnit();
      }
      if (token.type === "symbol") {
        this.tokens.next();
        if (DIMENSIONLESS_NAMES.has(token.value)) return dimensionlessUnit();
        return makeUnit([[token.value, 1]]);
      }
      if (token.type === "(") {
        this.tokens.next();
        const value = this.parseProduct();
        if (this.tokens.current.type !== ")") this.tokens.fail("Expected ')' in unit expression.", this.tokens.current.position);
        this.tokens.next();
        return value;
      }
      this.tokens.fail("Expected a unit symbol or parenthesized unit expression.", token.position);
    }
  }

  function parseUnit(expression) { return new UnitParser(expression).parse(); }

  function resultUnit(unit) { return { kind: "unit", unit }; }
  function wildcard() { return { kind: "wildcard" }; }
  function booleanResult() { return { kind: "boolean" }; }
  function unknown(reason) { return { kind: "unknown", reason: reason || "Unit could not be determined." }; }

  function resultDescription(result) {
    if (!result) return "unknown";
    if (result.kind === "unit") return formatUnit(result.unit);
    if (result.kind === "boolean") return "Unitless";
    if (result.kind === "wildcard") return "numeric constant (takes context unit)";
    return "unknown";
  }

  function asComparableUnit(result) {
    if (result && result.kind === "boolean") return resultUnit(dimensionlessUnit());
    return result;
  }

  function addIssue(context, severity, code, message, extra) {
    const owner = context.owner || {};
    const issue = Object.assign({
      severity,
      code,
      entityId: owner.id == null ? null : String(owner.id),
      entityName: owner.name || "Model",
      entityType: owner.canonicalType || owner.type || "Model",
      declaredUnit: owner.declaredUnits == null ? "" : String(owner.declaredUnits),
      message
    }, extra || {});
    const key = [issue.severity, issue.code, issue.entityId, issue.message].join("|");
    if (!context.issueKeys.has(key)) {
      context.issueKeys.add(key);
      context.issues.push(issue);
    }
  }

  function compatibleOrIssue(leftRaw, rightRaw, context, label) {
    const left = asComparableUnit(leftRaw);
    const right = asComparableUnit(rightRaw);
    if (!left || !right) return unknown(`${label}: unit unavailable.`);
    if (left.kind === "unknown") return left;
    if (right.kind === "unknown") return right;
    if (left.kind === "wildcard") return right;
    if (right.kind === "wildcard") return left;
    if (left.kind !== "unit" || right.kind !== "unit") return unknown(`${label}: unit unavailable.`);
    if (!unitsEqual(left.unit, right.unit)) {
      addIssue(context, "error", "incompatible-expression-units",
        `${label} uses incompatible units: ${formatUnit(left.unit)} and ${formatUnit(right.unit)}.`);
      return unknown(`${label}: incompatible units.`);
    }
    return left;
  }

  function requireDimensionless(resultRaw, context, label) {
    const result = asComparableUnit(resultRaw);
    if (!result) return unknown(`${label}: unit unavailable.`);
    if (result.kind === "unknown") return result;
    if (result.kind === "wildcard") return resultUnit(dimensionlessUnit());
    if (result.kind === "unit" && isDimensionless(result.unit)) return result;
    if (result.kind === "unit") {
      addIssue(context, "error", "expected-unitless", `${label} must be Unitless, but is ${formatUnit(result.unit)}.`);
      return unknown(`${label}: expected Unitless.`);
    }
    return unknown(`${label}: unit unavailable.`);
  }

  function requireTimeUnit(resultRaw, context, label) {
    const result = asComparableUnit(resultRaw);
    if (result && result.kind === "wildcard") {
      if (context.timeUnit) return resultUnit(context.timeUnit);
      return unknown("Model time unit is not specified.");
    }
    if (!context.timeUnit) return unknown("Model time unit is not specified.");
    if (!result || result.kind === "unknown") return result || unknown(`${label}: unit unavailable.`);
    if (result.kind === "unit" && unitsEqual(result.unit, context.timeUnit)) return result;
    if (result.kind === "unit") {
      addIssue(context, "error", "expected-time-unit",
        `${label} must use the model time unit ${formatUnit(context.timeUnit)}, but is ${formatUnit(result.unit)}.`);
      return unknown(`${label}: wrong time unit.`);
    }
    return unknown(`${label}: unit unavailable.`);
  }

  function numericConstantValue(ast) {
    if (!ast) return null;
    if (ast.type === "number") return ast.value;
    if (ast.type === "unary" && ["+", "-"].includes(ast.op)) {
      const value = numericConstantValue(ast.value);
      if (value == null) return null;
      return ast.op === "-" ? -value : value;
    }
    if (ast.type === "binary" && ["+", "-", "*", "/", "^", "%", "mod"].includes(ast.op)) {
      const left = numericConstantValue(ast.left);
      const right = numericConstantValue(ast.right);
      if (left == null || right == null) return null;
      if ((ast.op === "/" || ast.op === "%" || ast.op === "mod") && right === 0) return null;
      switch (ast.op) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return left / right;
        case "^": return Math.pow(left, right);
        case "%": case "mod": return left % right;
      }
    }
    return null;
  }

  const SAME_UNIT_FUNCTIONS = new Set(["abs", "floor", "ceiling", "ceil", "round"]);
  const DIMENSIONLESS_INPUT_FUNCTIONS = new Set([
    "exp", "ln", "log", "log10", "sin", "cos", "tan", "arcsin", "arccos", "arctan", "asin", "acos", "atan"
  ]);

  function inferAst(ast, context) {
    if (!ast) return unknown("Expression is empty.");
    switch (ast.type) {
      case "number": return wildcard();
      case "reference": {
        const target = context.referenceUnits.get(String(ast.name).trim().toLowerCase());
        if (!target) return unknown(`Referenced model entity '[${ast.name}]' was not found.`);
        if (target.error) return unknown(`Referenced model entity '${target.name}' has an invalid unit.`);
        if (!target.unit) return unknown(`Referenced model entity '${target.name}' has no declared unit.`);
        return resultUnit(target.unit);
      }
      case "identifier": {
        const key = String(ast.name || "").trim().toLowerCase();
        if (["pi", "e", "eps", "epsilon"].includes(key)) return resultUnit(dimensionlessUnit());
        if (["true", "false"].includes(key)) return booleanResult();
        if (["time", "t", "dt"].includes(key)) return context.timeUnit ? resultUnit(context.timeUnit) : unknown("Model time unit is not specified.");
        addIssue(context, "unknown", "unknown-identifier", `Unit checking does not recognize identifier '${ast.name}'.`);
        return unknown(`Unknown identifier '${ast.name}'.`);
      }
      case "unary": {
        const value = inferAst(ast.value, context);
        if (ast.op === "+" || ast.op === "-") return value;
        if (ast.op === "!" || ast.op === "not") {
          requireDimensionless(value, context, "Logical NOT operand");
          return booleanResult();
        }
        return unknown(`Unsupported unary operator '${ast.op}'.`);
      }
      case "binary": {
        if (["and", "&&", "or", "||"].includes(ast.op)) {
          requireDimensionless(inferAst(ast.left, context), context, `Left operand of '${ast.op}'`);
          requireDimensionless(inferAst(ast.right, context), context, `Right operand of '${ast.op}'`);
          return booleanResult();
        }
        const left = inferAst(ast.left, context);
        const right = inferAst(ast.right, context);
        if (["+", "-"].includes(ast.op)) return compatibleOrIssue(left, right, context, `Operator '${ast.op}'`);
        if (["=", "==", "!=", "<>", "<", "<=", ">", ">="].includes(ast.op)) {
          compatibleOrIssue(left, right, context, `Comparison '${ast.op}'`);
          return booleanResult();
        }
        if (ast.op === "*" || ast.op === "/") {
          if (left.kind === "unknown") return left;
          if (right.kind === "unknown") return right;
          if (left.kind === "wildcard" && right.kind === "wildcard") return wildcard();
          if (left.kind === "wildcard") {
            if (right.kind !== "unit") return unknown("Unit unavailable.");
            return ast.op === "*" ? right : resultUnit(powerUnit(right.unit, -1));
          }
          if (right.kind === "wildcard") return left;
          const l = asComparableUnit(left), r = asComparableUnit(right);
          if (l.kind !== "unit" || r.kind !== "unit") return unknown("Unit unavailable.");
          return resultUnit(ast.op === "*" ? multiplyUnits(l.unit, r.unit) : divideUnits(l.unit, r.unit));
        }
        if (ast.op === "%" || ast.op === "mod") return compatibleOrIssue(left, right, context, "Modulo operands");
        if (ast.op === "^") {
          requireDimensionless(right, context, "Exponent");
          if (left.kind === "unknown") return left;
          if (left.kind === "wildcard") return wildcard();
          const l = asComparableUnit(left);
          if (l.kind !== "unit") return unknown("Power base unit unavailable.");
          if (isDimensionless(l.unit)) return resultUnit(dimensionlessUnit());
          const exponent = numericConstantValue(ast.right);
          if (exponent == null || !Number.isFinite(exponent)) {
            addIssue(context, "error", "nonconstant-unit-exponent", "A dimensioned quantity may only be raised to a numeric constant power.");
            return unknown("Dimensioned power has nonconstant exponent.");
          }
          return resultUnit(powerUnit(l.unit, exponent));
        }
        return unknown(`Unsupported operator '${ast.op}'.`);
      }
      case "call": return inferCall(ast, context);
      default: return unknown(`Unknown expression node '${ast.type}'.`);
    }
  }

  function inferCall(ast, context) {
    const name = String(ast.name || "");
    const key = name.trim().toLowerCase();
    const args = ast.args || [];
    if (key === "ifthenelse") {
      if (args.length !== 3) return unknown("IfThenElse() requires three arguments.");
      requireDimensionless(inferAst(args[0], context), context, "IfThenElse condition");
      return compatibleOrIssue(inferAst(args[1], context), inferAst(args[2], context), context, "IfThenElse result branches");
    }
    if (["t", "time", "dt", "ts", "timestart", "tl", "timelength", "te", "timeend"].includes(key)) {
      return context.timeUnit ? resultUnit(context.timeUnit) : unknown("Model time unit is not specified.");
    }
    if (SAME_UNIT_FUNCTIONS.has(key)) {
      if (!args.length) return unknown(`${name}() is missing its argument.`);
      return inferAst(args[0], context);
    }
    if (key === "min" || key === "max") {
      if (!args.length) return unknown(`${name}() is missing its arguments.`);
      let result = inferAst(args[0], context);
      for (let i = 1; i < args.length; i++) result = compatibleOrIssue(result, inferAst(args[i], context), context, `${name}() arguments`);
      return result;
    }
    if (key === "sqrt") {
      if (!args.length) return unknown("Sqrt() is missing its argument.");
      const value = inferAst(args[0], context);
      if (value.kind === "unknown" || value.kind === "wildcard") return value;
      const comparable = asComparableUnit(value);
      return comparable.kind === "unit" ? resultUnit(powerUnit(comparable.unit, 0.5)) : unknown("Sqrt() unit unavailable.");
    }
    if (DIMENSIONLESS_INPUT_FUNCTIONS.has(key)) {
      if (!args.length) return unknown(`${name}() is missing its argument.`);
      requireDimensionless(inferAst(args[0], context), context, `${name}() argument`);
      return resultUnit(dimensionlessUnit());
    }
    if (key === "sign") {
      if (!args.length) return unknown("Sign() is missing its argument.");
      inferAst(args[0], context);
      return resultUnit(dimensionlessUnit());
    }
    if (key === "smooth" || key === "delay") {
      if (args.length !== 4) return unknown(`${name}() requires four arguments.`);
      const input = inferAst(args[0], context);
      requireTimeUnit(inferAst(args[1], context), context, `${name} time`);
      requireDimensionless(inferAst(args[2], context), context, `${name} order`);
      return compatibleOrIssue(input, inferAst(args[3], context), context, `${name} input and initial value`);
    }
    if (key === "lag") {
      if (args.length !== 3) return unknown("Lag() requires three arguments.");
      const input = inferAst(args[0], context);
      requireTimeUnit(inferAst(args[1], context), context, "Lag time");
      return compatibleOrIssue(input, inferAst(args[2], context), context, "Lag input and initial value");
    }
    if (key === "randomuniform") {
      if (args.length < 2 || args.length > 3) return unknown("RandomUniform() requires two arguments plus optional seed.");
      const result = compatibleOrIssue(inferAst(args[0], context), inferAst(args[1], context), context, "RandomUniform minimum and maximum");
      if (args[2]) requireDimensionless(inferAst(args[2], context), context, "RandomUniform seed");
      return result;
    }
    if (key === "randomnormal") {
      if (args.length < 2 || args.length > 3) return unknown("RandomNormal() requires two arguments plus optional seed.");
      const result = compatibleOrIssue(inferAst(args[0], context), inferAst(args[1], context), context, "RandomNormal mean and standard deviation");
      if (args[2]) requireDimensionless(inferAst(args[2], context), context, "RandomNormal seed");
      return result;
    }
    if (key === "randomtriangular") {
      if (args.length < 3 || args.length > 4) return unknown("RandomTriangular() requires three arguments plus optional seed.");
      let result = compatibleOrIssue(inferAst(args[0], context), inferAst(args[1], context), context, "RandomTriangular minimum and maximum");
      result = compatibleOrIssue(result, inferAst(args[2], context), context, "RandomTriangular mode");
      if (args[3]) requireDimensionless(inferAst(args[3], context), context, "RandomTriangular seed");
      return result;
    }
    if (key === "randomgamma") {
      if (args.length < 2 || args.length > 3) return unknown("RandomGamma() requires two arguments plus optional seed.");
      requireDimensionless(inferAst(args[0], context), context, "RandomGamma shape");
      const result = inferAst(args[1], context);
      if (args[2]) requireDimensionless(inferAst(args[2], context), context, "RandomGamma seed");
      return result;
    }
    if (key === "randombeta") {
      if (args.length < 2 || args.length > 3) return unknown("RandomBeta() requires two arguments plus optional seed.");
      requireDimensionless(inferAst(args[0], context), context, "RandomBeta alpha");
      requireDimensionless(inferAst(args[1], context), context, "RandomBeta beta");
      if (args[2]) requireDimensionless(inferAst(args[2], context), context, "RandomBeta seed");
      return resultUnit(dimensionlessUnit());
    }
    addIssue(context, "unknown", "unsupported-function-units", `Unit checking does not yet define a rule for function '${name}'.`);
    return unknown(`No unit rule for ${name}().`);
  }

  function canonicalType(item) {
    if (item.canonicalType) return item.canonicalType;
    if (item.type === "Variable") return item.isConstant ? "Constant" : "Auxiliary";
    if (item.type === "Converter") return "Lookup";
    return item.type || "Entity";
  }

  function expressionFor(item) {
    if (item.type === "Stock") return item.initial == null ? "" : String(item.initial);
    if (item.type === "Flow" || item.type === "Variable") return item.equation == null ? "" : String(item.equation);
    return null;
  }

  function checkModel(spec) {
    spec = spec || {};
    const issues = [];
    const issueKeys = new Set();
    const items = (spec.items || []).map(item => Object.assign({}, item));
    const referenceUnits = new Map();
    let timeUnit = null;
    let timeUnitError = null;
    const timeUnitsText = String(spec.timeUnits == null ? "" : spec.timeUnits).trim();
    if (!timeUnitsText) {
      issues.push({ severity: "unknown", code: "missing-time-unit", entityId: null, entityName: "Model", entityType: "Model", declaredUnit: "", message: "Model time unit is not specified." });
      issueKeys.add("unknown|missing-time-unit|null|Model time unit is not specified.");
    } else {
      try { timeUnit = parseUnit(timeUnitsText); }
      catch (error) {
        timeUnitError = error;
        issues.push({ severity: "error", code: "invalid-time-unit", entityId: null, entityName: "Model", entityType: "Model", declaredUnit: timeUnitsText, message: `Invalid model time unit '${timeUnitsText}': ${error.message}` });
      }
    }

    for (const item of items) {
      item.canonicalType = canonicalType(item);
      item.declaredUnits = String(item.units == null ? "" : item.units).trim();
      if (!item.declaredUnits) {
        item.parsedUnit = null;
        referenceUnits.set(String(item.name || "").trim().toLowerCase(), { name: item.name, unit: null, error: null });
        issues.push({ severity: "unknown", code: "missing-declared-unit", entityId: String(item.id), entityName: item.name, entityType: item.canonicalType, declaredUnit: "", message: `${item.canonicalType} '${item.name}' has no declared unit.` });
        continue;
      }
      try {
        item.parsedUnit = parseUnit(item.declaredUnits);
        referenceUnits.set(String(item.name || "").trim().toLowerCase(), { name: item.name, unit: item.parsedUnit, error: null });
      } catch (error) {
        item.parsedUnit = null;
        item.unitError = error;
        referenceUnits.set(String(item.name || "").trim().toLowerCase(), { name: item.name, unit: null, error });
        issues.push({ severity: "error", code: "invalid-declared-unit", entityId: String(item.id), entityName: item.name, entityType: item.canonicalType, declaredUnit: item.declaredUnits, message: `Invalid declared unit '${item.declaredUnits}': ${error.message}` });
      }
    }

    for (const item of items) {
      const expression = expressionFor(item);
      if (expression == null || item.unitError || !item.parsedUnit) continue;
      const context = { owner: item, issues, issueKeys, referenceUnits, timeUnit, timeUnitError };
      if (!String(expression).trim()) {
        addIssue(context, "unknown", "blank-expression", `${item.canonicalType} '${item.name}' has a blank definition, so its unit cannot be checked.`);
        continue;
      }
      let ast;
      try {
        if (!SystemikaEngine || typeof SystemikaEngine.parseExpression !== "function") throw new Error("Systemika expression parser is unavailable.");
        ast = SystemikaEngine.parseExpression(expression);
      } catch (error) {
        addIssue(context, "unknown", "unparseable-expression", `Could not check units because the definition could not be parsed: ${error.message}`);
        continue;
      }
      const errorCountBeforeInference = issues.filter(issue => issue.severity === "error" && issue.entityId === String(item.id)).length;
      const inferred = asComparableUnit(inferAst(ast, context));
      if (!inferred || inferred.kind === "unknown") {
        const errorCountAfterInference = issues.filter(issue => issue.severity === "error" && issue.entityId === String(item.id)).length;
        if (inferred && inferred.reason && errorCountAfterInference === errorCountBeforeInference) {
          addIssue(context, "unknown", "equation-unit-unknown", `Could not determine the definition unit: ${inferred.reason}`);
        }
        continue;
      }
      if (inferred.kind === "wildcard") continue;
      if (inferred.kind === "unit" && !unitsEqual(inferred.unit, item.parsedUnit)) {
        addIssue(context, "error", "declared-vs-equation",
          `Declared unit is ${item.declaredUnits}, but the definition evaluates dimensionally to ${formatUnit(inferred.unit)}.`,
          { expectedUnit: formatUnit(inferred.unit) });
      }
    }

    const itemById = new Map(items.map(item => [String(item.id), item]));
    for (const flow of items.filter(item => item.type === "Flow")) {
      if (!flow.parsedUnit) continue;
      for (const [endpointName, stockId] of [["source", flow.sourceId], ["target", flow.targetId]]) {
        if (stockId == null || stockId === "") continue;
        const stock = itemById.get(String(stockId));
        if (!stock || stock.type !== "Stock") continue;
        const context = { owner: flow, issues, issueKeys, referenceUnits, timeUnit, timeUnitError };
        if (!stock.parsedUnit) {
          addIssue(context, "unknown", "flow-stock-unit-unknown", `Cannot verify ${endpointName} Stock '${stock.name}' because its unit is missing or invalid.`);
          continue;
        }
        if (!timeUnit) {
          addIssue(context, "unknown", "flow-time-unit-unknown", `Cannot verify Flow '${flow.name}' against Stock '${stock.name}' because the model time unit is missing or invalid.`);
          continue;
        }
        const required = divideUnits(stock.parsedUnit, timeUnit);
        if (!unitsEqual(flow.parsedUnit, required)) {
          addIssue(context, "error", `flow-${endpointName}-stock-unit`,
            `Flow '${flow.name}' has unit ${flow.declaredUnits}, but a Flow connected to Stock '${stock.name}' (${stock.declaredUnits}) requires ${formatUnit(required)} when the model time unit is ${timeUnitsText}.`,
            { expectedUnit: formatUnit(required) });
        }
      }
    }

    const errors = issues.filter(issue => issue.severity === "error");
    const unknowns = issues.filter(issue => issue.severity === "unknown");
    return {
      ok: errors.length === 0,
      timeUnits: timeUnitsText,
      errors,
      unknowns,
      issues,
      checkedEntityCount: items.length,
      summary: { errors: errors.length, unknowns: unknowns.length, checked: items.length }
    };
  }

  function currentModelSpec() {
    if (typeof primitives !== "function") throw new UnitCheckError("Systemika model API is not available.");
    const safeOrig = cell => (typeof orig === "function" ? orig(cell) : cell);
    const items = [];
    for (const cell of primitives()) {
      if (!cell || !cell.value) continue;
      const type = cell.value.nodeName;
      if (!["Stock", "Flow", "Variable", "Converter"].includes(type)) continue;
      const item = {
        id: String(cell.id),
        name: typeof getName === "function" ? getName(cell) : cell.getAttribute("name"),
        type,
        units: typeof getUnits === "function" ? getUnits(cell) : (cell.getAttribute("Units") || ""),
        isConstant: type === "Variable" && cell.getAttribute("isConstant") === "true"
      };
      if (type === "Stock") item.initial = cell.getAttribute("InitialValue") || "";
      if (type === "Flow") {
        item.equation = cell.getAttribute("FlowRate") || "";
        item.sourceId = cell.source ? String(safeOrig(cell.source).id) : null;
        item.targetId = cell.target ? String(safeOrig(cell.target).id) : null;
      }
      if (type === "Variable") item.equation = cell.getAttribute("Equation") || "";
      items.push(item);
    }
    return { timeUnits: typeof getTimeUnits === "function" ? getTimeUnits() : "", items };
  }

  function checkCurrentModel() { return checkModel(currentModelSpec()); }

  return Object.freeze({
    version: "0.9.0",
    UnitCheckError,
    parseUnit,
    formatUnit,
    unitsEqual,
    multiplyUnits,
    divideUnits,
    powerUnit,
    inferAst,
    checkModel,
    currentModelSpec,
    checkCurrentModel
  });
});
