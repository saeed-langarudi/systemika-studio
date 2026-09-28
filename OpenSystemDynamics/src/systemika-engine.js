/*
 * Systemika native simulation engine
 *
 * Copyright (c) 2026 Systemika contributors.
 *
 * This module is an independently written, deliberately small numerical
 * simulation kernel for Systemika. It does not depend on the Insight Maker
 * simulation engine. Its public API is designed so the existing Systemika UI
 * can be migrated to it incrementally.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.SystemikaEngine = api;
    // Compatibility entry point for legacy editor/API callers. The old
    // Insight Maker runModel implementation is intentionally replaced here.
    root.runModel = function (config) {
      return api.runCurrentModel(config || {});
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  class SystemikaEngineError extends Error {
    constructor(message, details) {
      super(message);
      this.name = "SystemikaEngineError";
      this.details = details || null;
    }
  }

  class ExpressionError extends SystemikaEngineError {
    constructor(message, position, expression) {
      super(message, { position, expression });
      this.name = "SystemikaExpressionError";
      this.position = position;
      this.expression = expression;
    }
  }

  const MAX_SIMULATION_STEPS = 2000000;

  function finiteNumber(value, context) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new SystemikaEngineError(`${context || "Value"} must be a finite number.`);
    }
    return n;
  }

  function normalizeKey(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function decodeStoredExpression(value) {
    return String(value == null ? "" : value).replace(/\\n/g, "\n");
  }

  const RESERVED_IDENTIFIERS = new Set([
    "pi", "e", "eps", "epsilon", "true", "false", "time", "t", "dt", "ts", "tl", "te"
  ]);

  class Tokenizer {
    constructor(expression) {
      this.expression = String(expression == null ? "" : expression);
      this.index = 0;
      this.current = null;
      this.next();
    }

    error(message, position) {
      throw new ExpressionError(message, position == null ? this.index : position, this.expression);
    }

    skipWhitespaceAndComments() {
      while (this.index < this.expression.length) {
        const ch = this.expression[this.index];
        if (/\s/.test(ch)) {
          this.index++;
          continue;
        }
        if (ch === "#") {
          while (this.index < this.expression.length && this.expression[this.index] !== "\n") this.index++;
          continue;
        }
        break;
      }
    }

    next() {
      this.skipWhitespaceAndComments();
      const start = this.index;
      if (start >= this.expression.length) {
        this.current = { type: "eof", value: null, position: start };
        return this.current;
      }

      const source = this.expression;
      const ch = source[this.index];

      if (ch === "[") {
        this.index++;
        const refStart = this.index;
        while (this.index < source.length && source[this.index] !== "]") this.index++;
        if (this.index >= source.length) this.error("Unclosed model entity reference.", start);
        const value = source.slice(refStart, this.index).trim();
        this.index++;
        if (!value) this.error("Model entity reference cannot be empty.", start);
        this.current = { type: "reference", value, position: start };
        return this.current;
      }

      const numberMatch = source.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (numberMatch) {
        this.index += numberMatch[0].length;
        this.current = { type: "number", value: Number(numberMatch[0]), position: start };
        return this.current;
      }

      const identMatch = source.slice(this.index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (identMatch) {
        this.index += identMatch[0].length;
        const raw = identMatch[0];
        const word = raw.toLowerCase();
        if (word === "and" || word === "or" || word === "not" || word === "mod") {
          this.current = { type: "operator", value: word, position: start };
        } else {
          this.current = { type: "identifier", value: raw, position: start };
        }
        return this.current;
      }

      const two = source.slice(this.index, this.index + 2);
      if ([">=", "<=", "==", "!=", "<>", "&&", "||"].includes(two)) {
        this.index += 2;
        this.current = { type: "operator", value: two, position: start };
        return this.current;
      }

      if ("+-*/^%<>=!".includes(ch)) {
        this.index++;
        this.current = { type: "operator", value: ch, position: start };
        return this.current;
      }
      if (ch === "(" || ch === ")" || ch === ",") {
        this.index++;
        this.current = { type: ch, value: ch, position: start };
        return this.current;
      }

      this.error(`Unexpected character '${ch}'.`, start);
    }
  }

  const PRECEDENCE = {
    "or": 1, "||": 1,
    "and": 2, "&&": 2,
    "=": 3, "==": 3, "!=": 3, "<>": 3,
    "<": 4, "<=": 4, ">": 4, ">=": 4,
    "+": 5, "-": 5,
    "*": 6, "/": 6, "%": 6, "mod": 6,
    "^": 7
  };

  class Parser {
    constructor(expression) {
      this.expression = String(expression == null ? "" : expression).trim();
      if (!this.expression) this.expression = "0";
      this.tokens = new Tokenizer(this.expression);
    }

    parse() {
      const ast = this.parseExpression(0);
      if (this.tokens.current.type !== "eof") {
        this.tokens.error("Unexpected token after expression.", this.tokens.current.position);
      }
      return ast;
    }

    parseExpression(minPrecedence) {
      let left = this.parsePrefix();
      while (this.tokens.current.type === "operator") {
        const op = this.tokens.current.value;
        const precedence = PRECEDENCE[op];
        if (precedence == null || precedence < minPrecedence) break;
        const rightAssociative = op === "^";
        this.tokens.next();
        const right = this.parseExpression(precedence + (rightAssociative ? 0 : 1));
        left = { type: "binary", op, left, right };
      }
      return left;
    }

    parsePrefix() {
      const token = this.tokens.current;
      if (token.type === "operator" && ["+", "-", "!", "not"].includes(token.value)) {
        this.tokens.next();
        return { type: "unary", op: token.value, value: this.parseExpression(8) };
      }
      if (token.type === "number") {
        this.tokens.next();
        return { type: "number", value: token.value };
      }
      if (token.type === "reference") {
        this.tokens.next();
        return { type: "reference", name: token.value };
      }
      if (token.type === "identifier") {
        this.tokens.next();
        const name = token.value;
        if (this.tokens.current.type === "(") {
          this.tokens.next();
          const args = [];
          if (this.tokens.current.type !== ")") {
            while (true) {
              args.push(this.parseExpression(0));
              if (this.tokens.current.type === ",") {
                this.tokens.next();
                continue;
              }
              break;
            }
          }
          if (this.tokens.current.type !== ")") {
            this.tokens.error(`Expected ')' after ${name}(...).`, this.tokens.current.position);
          }
          this.tokens.next();
          return { type: "call", name, args };
        }
        return { type: "identifier", name };
      }
      if (token.type === "(") {
        this.tokens.next();
        const value = this.parseExpression(0);
        if (this.tokens.current.type !== ")") {
          this.tokens.error("Expected ')'.", this.tokens.current.position);
        }
        this.tokens.next();
        return value;
      }
      this.tokens.error("Expected a number, model entity reference, function, or parenthesized expression.", token.position);
    }
  }

  function parseExpression(expression) {
    return new Parser(expression).parse();
  }

  function collectReferences(ast, out) {
    out = out || new Set();
    if (!ast) return out;
    if (ast.type === "reference") out.add(ast.name);
    if (ast.type === "identifier" && !RESERVED_IDENTIFIERS.has(normalizeKey(ast.name))) out.add(ast.name);
    if (ast.type === "unary") collectReferences(ast.value, out);
    if (ast.type === "binary") {
      collectReferences(ast.left, out);
      collectReferences(ast.right, out);
    }
    if (ast.type === "call") ast.args.forEach(arg => collectReferences(arg, out));
    return out;
  }

  const PIPELINE_FUNCTIONS = new Set(["smooth", "delay"]);
  const STATEFUL_FUNCTIONS = new Set(["smooth", "delay", "lag"]);
  const RANDOM_FUNCTIONS = new Set([
    "randomuniform", "randomnormal", "randomtriangular", "randomgamma", "randombeta"
  ]);
  const RANDOM_BASE_ARGS = Object.freeze({
    randomuniform: 2,
    randomnormal: 2,
    randomtriangular: 3,
    randomgamma: 2,
    randombeta: 2
  });

  function collectFunctionCalls(ast, out) {
    out = out || [];
    if (!ast) return out;
    if (ast.type === "unary") collectFunctionCalls(ast.value, out);
    if (ast.type === "binary") {
      collectFunctionCalls(ast.left, out);
      collectFunctionCalls(ast.right, out);
    }
    if (ast.type === "call") {
      out.push(ast);
      ast.args.forEach(arg => collectFunctionCalls(arg, out));
    }
    return out;
  }

  function evaluateCompileTimeNumber(ast, label) {
    if (collectReferences(ast).size) {
      throw new SystemikaEngineError(`${label} must be a constant number.`);
    }
    const value = evaluateAst(ast, {
      time: NaN, dt: NaN, timeStart: NaN, timeLength: NaN, timeEnd: NaN,
      resolve() { throw new SystemikaEngineError(`${label} must be a constant number.`); }
    });
    return finiteNumber(value, label);
  }

  function annotateSpecialCalls(ast, owner, registry) {
    if (!ast) return;
    if (ast.type === "unary") annotateSpecialCalls(ast.value, owner, registry);
    if (ast.type === "binary") {
      annotateSpecialCalls(ast.left, owner, registry);
      annotateSpecialCalls(ast.right, owner, registry);
    }
    if (ast.type !== "call") return;

    const key = normalizeKey(ast.name);
    if (PIPELINE_FUNCTIONS.has(key)) {
      const required = 4;
      if (ast.args.length !== required) {
        const signature = `${ast.name}(input, ${key === "smooth" ? "smooth" : "delay"} time, order, initial value)`;
        throw new SystemikaEngineError(`${ast.name}() requires exactly ${required} arguments: ${signature}.`);
      }
      const order = evaluateCompileTimeNumber(ast.args[2], `${ast.name} order`);
      if (!Number.isInteger(order) || order < 1 || order > 100) {
        throw new SystemikaEngineError(`${ast.name} order must be an integer from 1 to 100.`);
      }
      const callId = `stateful:${++registry.counter}`;
      const stageIds = Array.from({ length: order }, (_, i) => `@${callId}:${i + 1}`);
      ast.systemikaCallId = callId;
      registry.stateful.push({
        callId, kind: key, ownerId: owner.id, ownerName: owner.name, node: ast, order, stageIds,
        durationArgIndex: 1, initialArgIndex: 3
      });
    } else if (key === "lag") {
      if (ast.args.length !== 3) {
        throw new SystemikaEngineError("Lag() requires exactly three arguments: Lag(input, lag time, initial value).");
      }
      const callId = `lag:${++registry.counter}`;
      ast.systemikaCallId = callId;
      registry.lags.push({
        callId, kind: key, ownerId: owner.id, ownerName: owner.name, node: ast,
        durationArgIndex: 1, initialArgIndex: 2
      });
    } else if (RANDOM_FUNCTIONS.has(key)) {
      const baseArgs = RANDOM_BASE_ARGS[key];
      if (ast.args.length !== baseArgs && ast.args.length !== baseArgs + 1) {
        throw new SystemikaEngineError(`${ast.name}() requires ${baseArgs} arguments, plus an optional seed.`);
      }
      ast.systemikaCallId = `random:${++registry.counter}`;
      if (ast.args.length === baseArgs + 1) {
        ast.systemikaExplicitSeed = seedToUint32(
          evaluateCompileTimeNumber(ast.args[baseArgs], `${ast.name} seed`)
        );
      }
      registry.randomCount++;
    }
    ast.args.forEach(arg => annotateSpecialCalls(arg, owner, registry));
  }

  function hashString32(value) {
    const text = String(value);
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seedToUint32(seed) {
    if (typeof seed === "number" && Number.isFinite(seed)) return (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
    return hashString32(seed == null ? "systemika" : seed) || 0x6d2b79f5;
  }

  function automaticSeed() {
    try {
      if (typeof crypto !== "undefined" && crypto && typeof crypto.getRandomValues === "function") {
        const values = new Uint32Array(1);
        crypto.getRandomValues(values);
        return values[0] >>> 0;
      }
    } catch (_error) { /* fall through */ }
    const now = typeof Date !== "undefined" ? Date.now() : 0;
    return hashString32(`${now}:${Math.random()}`);
  }

  function makeDeterministicRng(seed, stepIndex, callId) {
    let state = hashString32(`${seedToUint32(seed)}|${stepIndex}|${callId}`) || 0x9e3779b9;
    return function next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4294967296;
    };
  }

  function openUnit(rng) {
    let u = rng();
    if (u <= 0) u = 1 / 4294967296;
    if (u >= 1) u = 1 - 1 / 4294967296;
    return u;
  }

  function normal01(rng) {
    const u1 = openUnit(rng);
    const u2 = openUnit(rng);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function gammaSample(shape, scale, rng) {
    if (!(shape > 0) || !(scale > 0)) {
      throw new SystemikaEngineError("RandomGamma() requires shape and scale greater than zero.");
    }
    if (shape < 1) {
      const u = openUnit(rng);
      return gammaSample(shape + 1, scale, rng) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (let attempts = 0; attempts < 100000; attempts++) {
      const x = normal01(rng);
      let v = 1 + c * x;
      if (v <= 0) continue;
      v = v * v * v;
      const u = openUnit(rng);
      if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return scale * d * v;
      }
    }
    throw new SystemikaEngineError("RandomGamma() could not generate a sample for the supplied parameters.");
  }

  const FUNCTION_TABLE = Object.freeze({
    abs: { min: 1, max: 1, fn: Math.abs },
    min: { min: 1, max: Infinity, fn: Math.min },
    max: { min: 1, max: Infinity, fn: Math.max },
    sqrt: { min: 1, max: 1, fn: Math.sqrt },
    exp: { min: 1, max: 1, fn: Math.exp },
    ln: { min: 1, max: 1, fn: Math.log },
    log: { min: 1, max: 1, fn: Math.log10 },
    log10: { min: 1, max: 1, fn: Math.log10 },
    sin: { min: 1, max: 1, fn: Math.sin },
    cos: { min: 1, max: 1, fn: Math.cos },
    tan: { min: 1, max: 1, fn: Math.tan },
    arcsin: { min: 1, max: 1, fn: Math.asin },
    arccos: { min: 1, max: 1, fn: Math.acos },
    arctan: { min: 1, max: 1, fn: Math.atan },
    asin: { min: 1, max: 1, fn: Math.asin },
    acos: { min: 1, max: 1, fn: Math.acos },
    atan: { min: 1, max: 1, fn: Math.atan },
    floor: { min: 1, max: 1, fn: Math.floor },
    ceiling: { min: 1, max: 1, fn: Math.ceil },
    ceil: { min: 1, max: 1, fn: Math.ceil },
    round: { min: 1, max: 1, fn: Math.round },
    sign: { min: 1, max: 1, fn: Math.sign }
  });

  function evaluateAst(ast, context) {
    switch (ast.type) {
      case "number": return ast.value;
      case "reference": return context.resolve(ast.name);
      case "identifier": {
        const key = normalizeKey(ast.name);
        if (key === "pi") return Math.PI;
        if (key === "e") return Math.E;
        if (key === "eps" || key === "epsilon") return Number.EPSILON;
        if (key === "true") return true;
        if (key === "false") return false;
        if (key === "time" || key === "t") return context.time;
        if (key === "dt") return context.dt;
        return context.resolve(ast.name);
      }
      case "unary": {
        const value = evaluateAst(ast.value, context);
        if (ast.op === "+") return +value;
        if (ast.op === "-") return -value;
        if (ast.op === "!" || ast.op === "not") return !value;
        throw new SystemikaEngineError(`Unsupported unary operator '${ast.op}'.`);
      }
      case "binary": {
        if (ast.op === "and" || ast.op === "&&") {
          const left = evaluateAst(ast.left, context);
          return left ? Boolean(evaluateAst(ast.right, context)) : false;
        }
        if (ast.op === "or" || ast.op === "||") {
          const left = evaluateAst(ast.left, context);
          return left ? true : Boolean(evaluateAst(ast.right, context));
        }
        const left = evaluateAst(ast.left, context);
        const right = evaluateAst(ast.right, context);
        switch (ast.op) {
          case "+": return left + right;
          case "-": return left - right;
          case "*": return left * right;
          case "/":
            if (right === 0) throw new SystemikaEngineError("Division by zero.");
            return left / right;
          case "%": case "mod":
            if (right === 0) throw new SystemikaEngineError("Modulo by zero.");
            return left % right;
          case "^": return Math.pow(left, right);
          case "=": case "==": return left === right;
          case "!=": case "<>": return left !== right;
          case "<": return left < right;
          case "<=": return left <= right;
          case ">": return left > right;
          case ">=": return left >= right;
          default: throw new SystemikaEngineError(`Unsupported operator '${ast.op}'.`);
        }
      }
      case "call": {
        const key = normalizeKey(ast.name);
        if (STATEFUL_FUNCTIONS.has(key) || RANDOM_FUNCTIONS.has(key)) {
          if (!context || typeof context.callSpecial !== "function") {
            throw new SystemikaEngineError(`${ast.name}() requires an active simulation context.`);
          }
          return context.callSpecial(ast, key);
        }
        if (key === "ifthenelse") {
          if (ast.args.length !== 3) throw new SystemikaEngineError("IfThenElse() requires exactly three arguments.");
          return evaluateAst(ast.args[0], context)
            ? evaluateAst(ast.args[1], context)
            : evaluateAst(ast.args[2], context);
        }
        if (key === "t" || key === "time") {
          if (ast.args.length !== 0) throw new SystemikaEngineError(`${ast.name}() takes no arguments.`);
          return context.time;
        }
        if (key === "dt") {
          if (ast.args.length !== 0) throw new SystemikaEngineError("DT() takes no arguments.");
          return context.dt;
        }
        if (key === "ts" || key === "timestart") {
          if (ast.args.length !== 0) throw new SystemikaEngineError(`${ast.name}() takes no arguments.`);
          return context.timeStart;
        }
        if (key === "tl" || key === "timelength") {
          if (ast.args.length !== 0) throw new SystemikaEngineError(`${ast.name}() takes no arguments.`);
          return context.timeLength;
        }
        if (key === "te" || key === "timeend") {
          if (ast.args.length !== 0) throw new SystemikaEngineError(`${ast.name}() takes no arguments.`);
          return context.timeEnd;
        }
        const spec = FUNCTION_TABLE[key];
        if (!spec) throw new SystemikaEngineError(`Unsupported function '${ast.name}'.`);
        if (ast.args.length < spec.min || ast.args.length > spec.max) {
          const requirement = spec.min === spec.max ? `${spec.min}` : `${spec.min} to ${spec.max === Infinity ? "any number of" : spec.max}`;
          throw new SystemikaEngineError(`${ast.name}() requires ${requirement} argument(s).`);
        }
        const args = ast.args.map(arg => evaluateAst(arg, context));
        const result = spec.fn.apply(Math, args);
        if (!Number.isFinite(result)) {
          throw new SystemikaEngineError(`${ast.name}() produced a non-finite result.`);
        }
        return result;
      }
      default:
        throw new SystemikaEngineError(`Unknown expression node '${ast.type}'.`);
    }
  }

  function parseConverterData(data) {
    // Lookup definitions are stored in XML attributes, where editor line breaks
    // are encoded as the two characters "\\n". Decode them before parsing so
    // rows separated by semicolon + line break are equivalent to one-line data.
    const beforeComment = decodeStoredExpression(data).split("#")[0];
    if (!beforeComment.trim()) return [];
    const points = beforeComment.split(";").map((row, index) => {
      const cells = row.trim().split(",");
      if (cells.length !== 2 || cells[0].trim() === "" || cells[1].trim() === "") {
        throw new SystemikaEngineError(`Invalid lookup row ${index + 1}. Expected 'x,y'.`);
      }
      return [finiteNumber(cells[0], "Lookup X"), finiteNumber(cells[1], "Lookup Y")];
    });
    points.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < points.length; i++) {
      if (points[i][0] === points[i - 1][0]) {
        throw new SystemikaEngineError(`Lookup contains duplicate X value ${points[i][0]}.`);
      }
    }
    return points;
  }

  function interpolate(points, x, mode) {
    if (!points.length) throw new SystemikaEngineError("Lookup has no data points.");
    if (points.length === 1 || x <= points[0][0]) return points[0][1];
    if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (points[mid][0] <= x) lo = mid;
      else hi = mid;
    }
    if (normalizeKey(mode) === "discrete") return points[lo][1];
    const [x0, y0] = points[lo];
    const [x1, y1] = points[hi];
    return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
  }

  function compileModel(spec) {
    if (!spec || typeof spec !== "object") throw new SystemikaEngineError("Model specification is required.");
    const timeStart = finiteNumber(spec.timeStart == null ? 0 : spec.timeStart, "Time start");
    const timeLength = finiteNumber(spec.timeLength == null ? 100 : spec.timeLength, "Time length");
    const dt = finiteNumber(spec.dt == null ? 1 : spec.dt, "Time step");
    if (timeLength < 0) throw new SystemikaEngineError("Time length cannot be negative.");
    if (dt <= 0) throw new SystemikaEngineError("Time step must be greater than zero.");
    const timeEnd = finiteNumber(timeStart + timeLength, "Simulation end time");
    const estimatedSteps = timeLength === 0 ? 0 : Math.ceil(timeLength / dt);
    if (!Number.isFinite(estimatedSteps) || estimatedSteps > MAX_SIMULATION_STEPS) {
      throw new SystemikaEngineError(
        `Simulation settings would require ${Number.isFinite(estimatedSteps) ? estimatedSteps.toLocaleString("en-US") : "too many"} integration steps. Increase the time step or reduce the time length.`
      );
    }
    const methodRaw = normalizeKey(spec.method || spec.algorithm || "euler");
    const method = (methodRaw === "rk4" || methodRaw === "rungekutta4") ? "rk4" :
      (methodRaw === "rk1" || methodRaw === "euler") ? "euler" : null;
    if (!method) throw new SystemikaEngineError(`Unsupported integration method '${spec.method || spec.algorithm}'.`);

    const items = [];
    const idMap = new Map();
    const nameMap = new Map();
    const specialRegistry = { counter: 0, stateful: [], lags: [], randomCount: 0 };

    function addItem(raw, type) {
      raw = raw || {};
      const id = String(raw.id == null ? `${type}-${items.length + 1}` : raw.id);
      const name = String(raw.name == null ? id : raw.name).trim();
      if (!name) throw new SystemikaEngineError(`${type} '${id}' must have a name.`);
      if (idMap.has(id)) throw new SystemikaEngineError(`Duplicate model entity id '${id}'.`);
      const nameKey = normalizeKey(name);
      if (nameMap.has(nameKey)) throw new SystemikaEngineError(`Duplicate model entity name '${name}'.`);
      const item = Object.assign({}, raw, { id, name, type });
      item.isConstant = type === "variable" && (raw.isConstant === true || String(raw.isConstant).toLowerCase() === "true");
      if (type === "stock") {
        item.initial = String(raw.initial == null ? "0" : raw.initial);
        item.ast = parseExpression(item.initial);
        item.nonNegative = Boolean(raw.nonNegative);
      } else if (type === "flow" || type === "variable") {
        item.equation = String(raw.equation == null || raw.equation === "" ? "0" : raw.equation);
        item.ast = parseExpression(item.equation);
        if (type === "flow") {
          item.sourceId = raw.sourceId == null ? null : String(raw.sourceId);
          item.targetId = raw.targetId == null ? null : String(raw.targetId);
        }
      } else if (type === "converter") {
        item.points = parseConverterData(raw.data);
        item.interpolation = raw.interpolation || "Linear";
        item.sourceId = raw.sourceId == null ? "Time" : String(raw.sourceId);
      }
      if (item.ast) annotateSpecialCalls(item.ast, item, specialRegistry);
      items.push(item);
      idMap.set(id, item);
      nameMap.set(nameKey, item);
      return item;
    }

    (spec.stocks || []).forEach(x => addItem(x, "stock"));
    (spec.flows || []).forEach(x => addItem(x, "flow"));
    (spec.variables || []).forEach(x => addItem(x, "variable"));
    (spec.converters || []).forEach(x => addItem(x, "converter"));

    const stocks = items.filter(x => x.type === "stock");
    const flows = items.filter(x => x.type === "flow");
    const variables = items.filter(x => x.type === "variable");
    const constants = variables.filter(x => x.isConstant);
    const converters = items.filter(x => x.type === "converter");

    flows.forEach(flow => {
      for (const endpoint of ["sourceId", "targetId"]) {
        const id = flow[endpoint];
        if (id != null) {
          const target = idMap.get(id);
          if (!target) throw new SystemikaEngineError(`Flow '${flow.name}' refers to missing model entity id '${id}'.`);
          if (target.type !== "stock") throw new SystemikaEngineError(`Flow '${flow.name}' ${endpoint === "sourceId" ? "source" : "target"} must be a stock.`);
        }
      }
    });

    converters.forEach(converter => {
      if (normalizeKey(converter.sourceId) !== "time" && !idMap.has(converter.sourceId)) {
        throw new SystemikaEngineError(`Lookup '${converter.name}' refers to missing input model entity id '${converter.sourceId}'.`);
      }
    });

    // Validate named references now, so misspellings fail before integration begins.
    items.forEach(item => {
      if (!item.ast) return;
      for (const refName of collectReferences(item.ast)) {
        if (!nameMap.has(normalizeKey(refName))) {
          throw new SystemikaEngineError(`Model entity '${item.name}' refers to unknown model entity '${refName}'.`);
        }
      }
    });

    const memoryMap = new Map(specialRegistry.stateful.map(memory => [memory.callId, memory]));
    const lagMap = new Map(specialRegistry.lags.map(lag => [lag.callId, lag]));
    const randomSeed = spec.randomSeed == null || spec.randomSeed === "" ? null : spec.randomSeed;

    return {
      timeStart, timeLength, timeEnd, dt, method, randomSeed,
      pauseInterval: spec.pauseInterval == null ? null : Number(spec.pauseInterval),
      items, stocks, flows, variables, constants, converters, idMap, nameMap,
      memory: specialRegistry.stateful, memoryMap, lags: specialRegistry.lags, lagMap,
      hasRandomFunctions: specialRegistry.randomCount > 0
    };
  }

  class Runtime {
    constructor(compiled) {
      this.model = compiled;
      this.state = Object.create(null);
      this.time = compiled.timeStart;
      this.stepIndex = 0;
      this.randomSeed = compiled.randomSeed == null ? automaticSeed() : seedToUint32(compiled.randomSeed);
      this.overrides = new Map();
      this.lagHistories = new Map(compiled.lags.map(lag => [lag.callId, []]));
      this.constantValues = Object.create(null);
      this.dynamicStateIds = compiled.stocks.map(stock => stock.id);
      compiled.memory.forEach(memory => memory.stageIds.forEach(id => this.dynamicStateIds.push(id)));
      this.initializeInitialValues();
      this.initializeMemory();
      this.commitLagSamples();
    }

    initializeInitialValues() {
      const resolving = new Set();
      const cache = new Map();
      const resolveInitial = (item) => {
        if (item.type === "stock" && Object.prototype.hasOwnProperty.call(this.state, item.id)) return this.state[item.id];
        if (item.type === "variable" && item.isConstant && Object.prototype.hasOwnProperty.call(this.constantValues, item.id)) {
          return this.constantValues[item.id];
        }
        const fixedAtStart = item.type === "stock" || (item.type === "variable" && item.isConstant);
        if (!fixedAtStart) {
          return this.evaluateItem(item, this.state, this.model.timeStart, cache, resolving, true, resolveInitial);
        }
        if (resolving.has(item.id)) {
          throw new SystemikaEngineError(`Circular dependency while evaluating initial value of '${item.name}'.`);
        }
        resolving.add(item.id);
        const value = finiteNumber(
          this.evaluateAstFor(item.ast, this.state, this.model.timeStart, cache, resolving, true, resolveInitial),
          `${item.type === "stock" ? "Initial value" : "Constant value"} of '${item.name}'`
        );
        resolving.delete(item.id);
        if (item.type === "stock") {
          this.state[item.id] = item.nonNegative ? Math.max(0, value) : value;
          return this.state[item.id];
        }
        this.constantValues[item.id] = value;
        cache.set(item.id, value);
        return value;
      };
      this.model.constants.forEach(resolveInitial);
      this.model.stocks.forEach(resolveInitial);
    }

    initializeMemory() {
      if (!this.model.memory.length) return;
      const cache = new Map();
      const stack = new Set();
      this.model.memory.forEach(memory => {
        const initialAst = memory.node.args[memory.initialArgIndex];
        const value = finiteNumber(
          this.evaluateAstFor(initialAst, this.state, this.model.timeStart, cache, stack, true, null),
          `Initial value of ${memory.node.name}() in '${memory.ownerName}'`
        );
        memory.stageIds.forEach(stageId => { this.state[stageId] = value; });
      });
    }

    commitLagSamples() {
      if (!this.model.lags.length) return;
      this.model.lags.forEach(lag => {
        const cache = new Map();
        const stack = new Set();
        const value = finiteNumber(
          this.evaluateAstFor(lag.node.args[0], this.state, this.time, cache, stack, false, null),
          `Input to Lag() in '${lag.ownerName}'`
        );
        const history = this.lagHistories.get(lag.callId);
        const last = history.length ? history[history.length - 1] : null;
        if (last && Math.abs(last.time - this.time) <= Math.max(1, Math.abs(this.time)) * 1e-12) {
          last.value = value;
        } else {
          history.push({ time: this.time, value });
        }
      });
    }

    lagHistoryValue(lag, targetTime, currentState, currentTime, cache, stack, initializing, resolveInitial) {
      const history = this.lagHistories.get(lag.callId) || [];
      const epsilon = Math.max(1, Math.abs(this.model.timeStart), Math.abs(targetTime)) * 1e-12;
      if (targetTime < this.model.timeStart - epsilon) {
        return finiteNumber(
          this.evaluateAstFor(lag.node.args[lag.initialArgIndex], currentState, currentTime, cache, stack, initializing, resolveInitial),
          `Initial value of Lag() in '${lag.ownerName}'`
        );
      }
      if (!history.length) {
        return finiteNumber(
          this.evaluateAstFor(lag.node.args[lag.initialArgIndex], currentState, currentTime, cache, stack, initializing, resolveInitial),
          `Initial value of Lag() in '${lag.ownerName}'`
        );
      }

      const first = history[0];
      if (targetTime <= first.time + epsilon) return first.value;

      let lo = 0;
      let hi = history.length - 1;
      if (targetTime <= history[hi].time + epsilon) {
        while (hi - lo > 1) {
          const mid = Math.floor((lo + hi) / 2);
          if (history[mid].time <= targetTime) lo = mid;
          else hi = mid;
        }
        const left = history[lo];
        const right = history[hi];
        if (Math.abs(targetTime - left.time) <= epsilon) return left.value;
        if (Math.abs(targetTime - right.time) <= epsilon) return right.value;
        if (right.time === left.time) return right.value;
        return left.value + (targetTime - left.time) * (right.value - left.value) / (right.time - left.time);
      }

      // During RK4 sub-steps, a short lag can point inside the current
      // integration interval. Interpolate from the most recent committed input
      // sample to the input evaluated at the current stage state/time.
      const left = history[history.length - 1];
      const currentInput = finiteNumber(
        this.evaluateAstFor(lag.node.args[0], currentState, currentTime, cache, stack, initializing, resolveInitial),
        `Input to Lag() in '${lag.ownerName}'`
      );
      if (currentTime <= left.time + epsilon) return left.value;
      const fraction = Math.max(0, Math.min(1, (targetTime - left.time) / (currentTime - left.time)));
      return left.value + fraction * (currentInput - left.value);
    }

    resolveReference(name, state, time, cache, stack, initializing, resolveInitial) {
      const item = this.model.nameMap.get(normalizeKey(name));
      if (!item) throw new SystemikaEngineError(`Unknown model entity '${name}'.`);
      if (item.type === "stock") {
        if (Object.prototype.hasOwnProperty.call(state, item.id)) return state[item.id];
        if (initializing && resolveInitial) return resolveInitial(item);
        throw new SystemikaEngineError(`Stock '${item.name}' has no current value.`);
      }
      if (item.type === "variable" && item.isConstant) {
        if (Object.prototype.hasOwnProperty.call(this.constantValues, item.id)) return this.constantValues[item.id];
        if (initializing && resolveInitial) return resolveInitial(item);
      }
      return this.evaluateItem(item, state, time, cache, stack, initializing, resolveInitial);
    }

    evaluateAstFor(ast, state, time, cache, stack, initializing, resolveInitial) {
      const context = {
        time,
        dt: this.model.dt,
        timeStart: this.model.timeStart,
        timeLength: this.model.timeLength,
        timeEnd: this.model.timeEnd,
        resolve: (name) => this.resolveReference(name, state, time, cache, stack, initializing, resolveInitial)
      };
      context.callSpecial = (node, key) => this.evaluateSpecialCall(
        node, key, state, time, cache, stack, initializing, resolveInitial
      );
      return evaluateAst(ast, context);
    }

    evaluateSpecialCall(node, key, state, time, cache, stack, initializing, resolveInitial) {
      if (PIPELINE_FUNCTIONS.has(key)) {
        const memory = this.model.memoryMap.get(node.systemikaCallId);
        if (!memory) throw new SystemikaEngineError(`${node.name}() was not compiled as a stateful function.`);
        const outputId = memory.stageIds[memory.stageIds.length - 1];
        if (Object.prototype.hasOwnProperty.call(state, outputId)) return state[outputId];
        const initialAst = node.args[memory.initialArgIndex];
        return finiteNumber(
          this.evaluateAstFor(initialAst, state, time, cache, stack, initializing, resolveInitial),
          `Initial value of ${node.name}()`
        );
      }

      if (key === "lag") {
        const lag = this.model.lagMap.get(node.systemikaCallId);
        if (!lag) throw new SystemikaEngineError("Lag() was not compiled as a fixed time lag.");
        const duration = finiteNumber(
          this.evaluateAstFor(node.args[lag.durationArgIndex], state, time, cache, stack, initializing, resolveInitial),
          `Lag time in '${lag.ownerName}'`
        );
        if (!(duration > 0)) throw new SystemikaEngineError(`Lag() time must be greater than zero in '${lag.ownerName}'.`);
        return finiteNumber(
          this.lagHistoryValue(lag, time - duration, state, time, cache, stack, initializing, resolveInitial),
          `Lag() result in '${lag.ownerName}'`
        );
      }

      if (!RANDOM_FUNCTIONS.has(key)) {
        throw new SystemikaEngineError(`Unsupported special function '${node.name}'.`);
      }
      if (!node.systemikaCallId) throw new SystemikaEngineError(`${node.name}() is missing its compiled call identifier.`);
      const baseArgs = RANDOM_BASE_ARGS[key];
      const args = node.args.slice(0, baseArgs).map(arg => finiteNumber(
        this.evaluateAstFor(arg, state, time, cache, stack, initializing, resolveInitial),
        `Argument to ${node.name}()`
      ));
      const effectiveSeed = node.systemikaExplicitSeed == null ? this.randomSeed : node.systemikaExplicitSeed;
      const rng = makeDeterministicRng(effectiveSeed, this.stepIndex, node.systemikaCallId);
      let result;

      if (key === "randomuniform") {
        const [minimum, maximum] = args;
        if (maximum < minimum) throw new SystemikaEngineError("RandomUniform() maximum must be greater than or equal to minimum.");
        result = minimum === maximum ? minimum : minimum + (maximum - minimum) * rng();
      } else if (key === "randomnormal") {
        const [mean, standardDeviation] = args;
        if (standardDeviation < 0) throw new SystemikaEngineError("RandomNormal() standard deviation cannot be negative.");
        result = standardDeviation === 0 ? mean : mean + standardDeviation * normal01(rng);
      } else if (key === "randomtriangular") {
        const [minimum, maximum, mode] = args;
        if (!(maximum > minimum)) throw new SystemikaEngineError("RandomTriangular() maximum must be greater than minimum.");
        if (mode < minimum || mode > maximum) throw new SystemikaEngineError("RandomTriangular() mode must lie between minimum and maximum.");
        const u = rng();
        const split = (mode - minimum) / (maximum - minimum);
        result = u < split
          ? minimum + Math.sqrt(u * (maximum - minimum) * (mode - minimum))
          : maximum - Math.sqrt((1 - u) * (maximum - minimum) * (maximum - mode));
      } else if (key === "randomgamma") {
        result = gammaSample(args[0], args[1], rng);
      } else if (key === "randombeta") {
        const [alpha, beta] = args;
        if (!(alpha > 0) || !(beta > 0)) throw new SystemikaEngineError("RandomBeta() requires alpha and beta greater than zero.");
        const x = gammaSample(alpha, 1, rng);
        const y = gammaSample(beta, 1, rng);
        result = x / (x + y);
      }

      return finiteNumber(result, `${node.name}() result`);
    }

    evaluateItem(item, state, time, cache, stack, initializing, resolveInitial) {
      if (item.type === "stock") return state[item.id];
      if (item.type === "variable" && item.isConstant) {
        if (Object.prototype.hasOwnProperty.call(this.constantValues, item.id)) return this.constantValues[item.id];
        if (initializing && resolveInitial) return resolveInitial(item);
      }
      if (cache.has(item.id)) return cache.get(item.id);
      if (stack.has(item.id)) {
        const cycle = [...stack, item.id].map(id => this.model.idMap.get(id)?.name || id).join(" -> ");
        throw new SystemikaEngineError(`Circular equation dependency detected: ${cycle}.`);
      }
      stack.add(item.id);
      let value;
      if (item.type === "converter") {
        let input;
        if (normalizeKey(item.sourceId) === "time") input = time;
        else {
          const source = this.model.idMap.get(item.sourceId);
          if (source.type === "stock") {
            input = Object.prototype.hasOwnProperty.call(state, source.id)
              ? state[source.id]
              : (initializing && resolveInitial ? resolveInitial(source) : state[source.id]);
          } else {
            input = this.evaluateItem(source, state, time, cache, stack, initializing, resolveInitial);
          }
        }
        value = interpolate(item.points, finiteNumber(input, `Input to lookup '${item.name}'`), item.interpolation);
      } else {
        const ast = this.overrides.get(item.id) || item.ast;
        value = this.evaluateAstFor(ast, state, time, cache, stack, initializing, resolveInitial);
        value = finiteNumber(value, `Equation of '${item.name}'`);
      }
      stack.delete(item.id);
      cache.set(item.id, value);
      return value;
    }

    evaluateAll(state, time) {
      const cache = new Map();
      const stack = new Set();
      const values = Object.create(null);
      this.model.items.forEach(item => {
        values[item.id] = item.type === "stock"
          ? state[item.id]
          : this.evaluateItem(item, state, time, cache, stack, false, null);
      });
      return values;
    }

    derivatives(state, time) {
      const cache = new Map();
      const stack = new Set();
      const derivative = Object.create(null);
      this.dynamicStateIds.forEach(id => { derivative[id] = 0; });

      this.model.flows.forEach(flow => {
        const rate = this.evaluateItem(flow, state, time, cache, stack, false, null);
        if (flow.sourceId != null) derivative[flow.sourceId] -= rate;
        if (flow.targetId != null) derivative[flow.targetId] += rate;
      });

      this.model.memory.forEach(memory => {
        const duration = finiteNumber(
          this.evaluateAstFor(memory.node.args[memory.durationArgIndex], state, time, cache, stack, false, null),
          `${memory.node.name} time in '${memory.ownerName}'`
        );
        if (!(duration > 0)) {
          throw new SystemikaEngineError(`${memory.node.name}() time must be greater than zero in '${memory.ownerName}'.`);
        }
        const stageTime = duration / memory.order;
        let upstream = finiteNumber(
          this.evaluateAstFor(memory.node.args[0], state, time, cache, stack, false, null),
          `Input to ${memory.node.name}() in '${memory.ownerName}'`
        );
        memory.stageIds.forEach(stageId => {
          const current = finiteNumber(state[stageId], `${memory.node.name}() internal state`);
          derivative[stageId] = (upstream - current) / stageTime;
          upstream = current;
        });
      });
      return derivative;
    }

    combine(base, delta, scale) {
      const next = Object.create(null);
      this.dynamicStateIds.forEach(id => {
        next[id] = base[id] + scale * delta[id];
      });
      return next;
    }

    integrateStep(h) {
      const t = this.time;
      const s = this.state;
      let next = Object.create(null);
      if (this.model.method === "euler") {
        const k1 = this.derivatives(s, t);
        this.dynamicStateIds.forEach(id => {
          next[id] = s[id] + h * k1[id];
        });
      } else {
        const k1 = this.derivatives(s, t);
        const k2State = this.combine(s, k1, h / 2);
        const k2 = this.derivatives(k2State, t + h / 2);
        const k3State = this.combine(s, k2, h / 2);
        const k3 = this.derivatives(k3State, t + h / 2);
        const k4State = this.combine(s, k3, h);
        const k4 = this.derivatives(k4State, t + h);
        this.dynamicStateIds.forEach(id => {
          next[id] = s[id] + h * (k1[id] + 2 * k2[id] + 2 * k3[id] + k4[id]) / 6;
        });
      }
      this.dynamicStateIds.forEach(id => {
        next[id] = finiteNumber(next[id], "Integrated simulation state");
      });
      this.model.stocks.forEach(stock => {
        if (stock.nonNegative && next[stock.id] < 0) next[stock.id] = 0;
      });
      this.state = next;
      this.time = Math.min(this.model.timeEnd, t + h);
      this.stepIndex += 1;
      this.commitLagSamples();
    }

    setValue(primitiveOrId, expression) {
      const id = typeof primitiveOrId === "object" && primitiveOrId !== null
        ? String(primitiveOrId.id)
        : String(primitiveOrId);
      const item = this.model.idMap.get(id);
      if (!item) throw new SystemikaEngineError(`Cannot change unknown model entity id '${id}'.`);
      if (item.type !== "variable" && item.type !== "flow") {
        throw new SystemikaEngineError(`Interactive changes are currently supported only for auxiliaries/constants and flows; '${item.name}' is a ${item.type}.`);
      }
      const ast = parseExpression(String(expression));
      const refs = [...collectReferences(ast)];
      if (refs.length) {
        throw new SystemikaEngineError(`Interactive value for '${item.name}' must not depend on model entities.`);
      }
      const special = collectFunctionCalls(ast).find(call => {
        const key = normalizeKey(call.name);
        return STATEFUL_FUNCTIONS.has(key) || RANDOM_FUNCTIONS.has(key);
      });
      if (special) {
        throw new SystemikaEngineError(`Interactive value for '${item.name}' cannot introduce ${special.name}(). Edit the model equation before running instead.`);
      }
      // Evaluate once now to validate functions and finiteness.
      finiteNumber(evaluateAst(ast, {
        time: this.time,
        dt: this.model.dt,
        timeStart: this.model.timeStart,
        timeLength: this.model.timeLength,
        timeEnd: this.model.timeEnd,
        resolve: () => { throw new SystemikaEngineError("Model entity references are not allowed here."); }
      }), `Interactive value for '${item.name}'`);
      this.overrides.set(id, ast);
    }
  }

  class ResultBuilder {
    constructor(model) {
      this.model = model;
      this.times = [];
      this.data = [];
      this.seriesById = Object.create(null);
      model.items.forEach(item => { this.seriesById[item.id] = []; });
    }

    record(runtime) {
      const time = Number(runtime.time.toPrecision(15));
      const values = runtime.evaluateAll(runtime.state, runtime.time);
      this.times.push(time);
      const row = Object.create(null);
      this.model.items.forEach(item => {
        const value = values[item.id];
        this.seriesById[item.id].push(value);
        row[item.id] = value;
      });
      this.data.push(row);
    }

    // Advance mode may recompile the live model after the user edits an
    // equation or adds/removes model structure. Keep the trajectory already
    // generated, add blank historical slots for newly introduced entities, and
    // refresh the current-time sample against the newly compiled equations.
    retargetModel(model, runtime) {
      this.model = model;
      const periods = this.times.length;
      model.items.forEach(item => {
        if (!Object.prototype.hasOwnProperty.call(this.seriesById, item.id)) {
          this.seriesById[item.id] = Array(periods).fill(null);
        } else {
          while (this.seriesById[item.id].length < periods) this.seriesById[item.id].push(null);
        }
      });
      if (!periods) return;
      const values = runtime.evaluateAll(runtime.state, runtime.time);
      const last = periods - 1;
      const row = this.data[last] || Object.create(null);
      model.items.forEach(item => {
        const value = values[item.id];
        this.seriesById[item.id][last] = value;
        row[item.id] = value;
      });
      this.data[last] = row;
    }

    snapshot(runtime, controller) {
      const builder = this;
      const result = {
        times: builder.times.slice(),
        periods: builder.times.length,
        data: builder.data.slice(),
        error: "none",
        stochastic: Boolean(builder.model.hasRandomFunctions),
        randomSeed: runtime.randomSeed,
        value(primitiveOrId) {
          let id;
          if (primitiveOrId && typeof primitiveOrId === "object") id = String(primitiveOrId.id);
          else id = String(primitiveOrId);
          if (Object.prototype.hasOwnProperty.call(builder.seriesById, id)) return builder.seriesById[id].slice();
          const byName = builder.model.nameMap.get(normalizeKey(id));
          if (byName) return builder.seriesById[byName.id].slice();
          return [];
        }
      };
      this.model.items.forEach(item => {
        result[item.id] = { results: builder.seriesById[item.id].slice(), dataMode: "auto" };
      });
      if (controller) {
        result.resume = controller.resume.bind(controller);
        result.terminate = controller.terminate.bind(controller);
        result.completed = controller.completed.bind(controller);
        result.setValue = controller.setValue.bind(controller);
        result.recompile = controller.recompile.bind(controller);
        result.recompileCurrentModel = controller.recompileCurrentModel.bind(controller);
      }
      return result;
    }
  }

  function simulate(spec) {
    const model = spec && spec.items ? spec : compileModel(spec);
    const runtime = new Runtime(model);
    const results = new ResultBuilder(model);
    results.record(runtime);
    const epsilon = Math.max(1, Math.abs(model.timeEnd)) * 1e-12;
    while (runtime.time < model.timeEnd - epsilon) {
      runtime.integrateStep(Math.min(model.dt, model.timeEnd - runtime.time));
      results.record(runtime);
    }
    return results.snapshot(runtime, null);
  }

  class SimulationController {
    constructor(spec, config) {
      this.model = spec && spec.items ? spec : compileModel(spec);
      this.runtime = new Runtime(this.model);
      this.resultsBuilder = new ResultBuilder(this.model);
      this.config = config || {};
      this.terminated = false;
      this.running = false;
      this.nextPause = null;
      const interval = Number(this.config.pauseInterval != null ? this.config.pauseInterval : this.model.pauseInterval);
      if (Number.isFinite(interval) && interval > 0) this.nextPause = this.model.timeStart + interval;
      this.pauseInterval = Number.isFinite(interval) && interval > 0 ? interval : null;
      this.resultsBuilder.record(this.runtime);
    }

    completed() {
      return this.terminated || this.runtime.time >= this.model.timeEnd - 1e-12;
    }

    terminate() {
      this.terminated = true;
      this.running = false;
    }

    currentResults() {
      return this.resultsBuilder.snapshot(this.runtime, this);
    }

    setValue(primitiveOrId, expression) {
      return this.runtime.setValue(primitiveOrId, expression);
    }

    recompile(spec) {
      if (this.running) throw new SystemikaEngineError("The model can only be changed while Advance is paused.");
      const nextModel = spec && spec.items ? spec : compileModel(spec);
      const previous = this.runtime;
      const previousModel = this.model;
      const nextRuntime = new Runtime(nextModel);

      // Preserve simulation time and all stock states that still exist. Newly
      // added stocks begin from their declared initial values at the edit point.
      nextRuntime.time = previous.time;
      nextRuntime.stepIndex = previous.stepIndex;
      nextRuntime.randomSeed = previous.randomSeed;
      nextModel.stocks.forEach(stock => {
        const oldItem = previousModel.idMap.get(stock.id);
        if (oldItem && oldItem.type === "stock" && Object.prototype.hasOwnProperty.call(previous.state, stock.id)) {
          nextRuntime.state[stock.id] = previous.state[stock.id];
        }
      });

      // Preserve the internal state of unchanged Smooth/Delay pipelines. Match
      // by owning entity, function kind, order, and occurrence within that owner.
      const oldMemoryGroups = new Map();
      previousModel.memory.forEach(memory => {
        const key = `${memory.ownerId}|${memory.kind}|${memory.order}`;
        if (!oldMemoryGroups.has(key)) oldMemoryGroups.set(key, []);
        oldMemoryGroups.get(key).push(memory);
      });
      const newMemoryCount = new Map();
      nextModel.memory.forEach(memory => {
        const key = `${memory.ownerId}|${memory.kind}|${memory.order}`;
        const index = newMemoryCount.get(key) || 0;
        newMemoryCount.set(key, index + 1);
        const oldMemory = (oldMemoryGroups.get(key) || [])[index];
        if (!oldMemory) return;
        for (let i = 0; i < Math.min(memory.stageIds.length, oldMemory.stageIds.length); i++) {
          const oldId = oldMemory.stageIds[i];
          if (Object.prototype.hasOwnProperty.call(previous.state, oldId)) nextRuntime.state[memory.stageIds[i]] = previous.state[oldId];
        }
      });

      // Preserve fixed-lag histories when the corresponding Lag() call remains.
      const oldLagGroups = new Map();
      previousModel.lags.forEach(lag => {
        const key = `${lag.ownerId}|${lag.kind}`;
        if (!oldLagGroups.has(key)) oldLagGroups.set(key, []);
        oldLagGroups.get(key).push(lag);
      });
      const newLagCount = new Map();
      nextModel.lags.forEach(lag => {
        const key = `${lag.ownerId}|${lag.kind}`;
        const index = newLagCount.get(key) || 0;
        newLagCount.set(key, index + 1);
        const oldLag = (oldLagGroups.get(key) || [])[index];
        if (!oldLag) return;
        const history = previous.lagHistories.get(oldLag.callId);
        if (history) nextRuntime.lagHistories.set(lag.callId, history.map(sample => ({ time: sample.time, value: sample.value })));
      });

      this.model = nextModel;
      this.runtime = nextRuntime;
      this.resultsBuilder.retargetModel(nextModel, nextRuntime);
      return this.currentResults();
    }

    recompileCurrentModel() {
      return this.recompile(compileCurrentModel());
    }

    emitCallback(name, payload) {
      const callback = this.config && this.config[name];
      if (typeof callback !== "function") return;
      if (this.config.asyncCallbacks && typeof setTimeout === "function") {
        setTimeout(() => {
          if (name === "onPause" && this.terminated) return;
          callback(payload);
        }, 0);
      } else {
        callback(payload);
      }
    }

    start() {
      this.resume();
      return this;
    }

    resume() {
      if (this.terminated || this.running) return this;
      this.running = true;
      try {
        this.runChunk();
      } catch (error) {
        this.running = false;
        this.terminated = true;
        const payload = { error: error.message || String(error), errorPrimitive: null };
        if (typeof this.config.onError === "function") this.emitCallback("onError", payload);
        else throw error;
      }
      return this;
    }

    runChunk() {
      const epsilon = Math.max(1, Math.abs(this.model.timeEnd)) * 1e-12;
      while (!this.terminated && this.runtime.time < this.model.timeEnd - epsilon) {
        let h = Math.min(this.model.dt, this.model.timeEnd - this.runtime.time);
        if (this.nextPause != null && this.nextPause > this.runtime.time + epsilon) {
          h = Math.min(h, this.nextPause - this.runtime.time);
        }
        this.runtime.integrateStep(h);
        this.resultsBuilder.record(this.runtime);
        if (this.nextPause != null && this.runtime.time >= this.nextPause - epsilon && this.runtime.time < this.model.timeEnd - epsilon) {
          this.running = false;
          const result = this.currentResults();
          this.nextPause += this.pauseInterval;
          this.emitCallback("onPause", result);
          return;
        }
      }
      this.running = false;
      if (!this.terminated) {
        const result = this.currentResults();
        this.terminated = true;
        this.emitCallback("onSuccess", result);
      }
    }
  }

  function createController(spec, config) {
    return new SimulationController(spec, config);
  }

  function run(spec, config) {
    return createController(spec, config).start();
  }

  // Browser adapter. It intentionally reads only the existing model/editor API;
  // it does not call into the Insight Maker simulation engine.
  function compileCurrentModel() {
    if (typeof primitives !== "function" || typeof getSetting !== "function") {
      throw new SystemikaEngineError("Systemika editor model API is not available in this environment.");
    }
    const setting = getSetting();
    if (!setting) throw new SystemikaEngineError("The model is missing simulation settings. Reopen or resave the model to repair it.");
    const safeOrig = (cell) => (typeof orig === "function" ? orig(cell) : cell);
    const itemName = (cell) => {
      if (typeof getName === "function") return getName(cell);
      return cell.getAttribute("name");
    };
    const all = primitives();
    const stocks = [];
    const flows = [];
    const variables = [];
    const converters = [];

    all.forEach(cell => {
      if (!cell || !cell.value) return;
      const type = cell.value.nodeName;
      if (type === "Stock") {
        stocks.push({
          id: String(cell.id), name: itemName(cell),
          initial: decodeStoredExpression(cell.getAttribute("InitialValue") || "0"),
          nonNegative: String(cell.getAttribute("NonNegative")).toLowerCase() === "true"
        });
      } else if (type === "Flow") {
        flows.push({
          id: String(cell.id), name: itemName(cell),
          equation: decodeStoredExpression(cell.getAttribute("FlowRate") || "0"),
          sourceId: cell.source ? String(safeOrig(cell.source).id) : null,
          targetId: cell.target ? String(safeOrig(cell.target).id) : null
        });
      } else if (type === "Variable") {
        variables.push({
          id: String(cell.id), name: itemName(cell), equation: decodeStoredExpression(cell.getAttribute("Equation") || "0"),
          isConstant: String(cell.getAttribute("isConstant")).toLowerCase() === "true"
        });
      } else if (type === "Converter") {
        converters.push({
          id: String(cell.id), name: itemName(cell), data: cell.getAttribute("Data") || "",
          interpolation: cell.getAttribute("Interpolation") || "Linear",
          sourceId: cell.getAttribute("Source") || "Time"
        });
      }
    });

    return compileModel({
      timeStart: Number(setting.getAttribute("TimeStart")),
      timeLength: Number(setting.getAttribute("TimeLength")),
      dt: Number(setting.getAttribute("TimeStep")),
      method: setting.getAttribute("SolutionAlgorithm") || "RK1",
      pauseInterval: Number(setting.getAttribute("TimePause")),
      randomSeed: null,
      stocks, flows, variables, converters
    });
  }

  function runCurrentModel(config) {
    config = config || {};
    try {
      const compiled = compileCurrentModel();
      return run(compiled, Object.assign({}, config, {
        pauseInterval: config.pauseInterval != null ? config.pauseInterval : compiled.pauseInterval,
        // The browser UI must regain control between simulation chunks so its
        // Run/Pause button remains responsive. Direct engine users remain
        // synchronous unless they explicitly request asynchronous callbacks.
        asyncCallbacks: config.asyncCallbacks == null ? true : Boolean(config.asyncCallbacks)
      }));
    } catch (error) {
      const payload = { error: error && error.message ? error.message : String(error), errorPrimitive: null };
      if (typeof config.onError === "function") {
        if (config.asyncCallbacks !== false && typeof setTimeout === "function") setTimeout(() => config.onError(payload), 0);
        else config.onError(payload);
        return null;
      }
      throw error;
    }
  }

  return Object.freeze({
    version: "0.8.5",
    SystemikaEngineError,
    ExpressionError,
    parseExpression,
    collectReferences,
    evaluateAst,
    parseConverterData,
    interpolate,
    compileModel,
    compileCurrentModel,
    simulate,
    createController,
    run,
    runCurrentModel
  });
});
