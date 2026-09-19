(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SystemikaDocumentation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TYPE_ORDER = Object.freeze({ stock: 0, flow: 1, auxiliary: 2, constant: 3, lookup: 4 });
  const TYPE_LABEL = Object.freeze({ stock: "Stock", flow: "Flow", auxiliary: "Auxiliary", constant: "Constant", lookup: "Lookup" });
  const RESERVED_IDENTIFIERS = new Set(["and", "or", "not", "mod", "pi", "e", "eps", "epsilon", "true", "false", "time", "t", "dt", "ts", "tl", "te"]);

  function cleanName(value) { return String(value == null ? "" : value).trim(); }
  function decodeLineBreaks(value) { return String(value == null ? "" : value).replace(/\\n/g, "\n"); }
  function unbracketReferences(value) { return decodeLineBreaks(value).replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, "$1"); }

  const STATEFUL_INITIAL_ARGUMENT = Object.freeze({ smooth: 3, delay: 3, lag: 2 });

  function splitTopLevelArguments(value) {
    const text = String(value == null ? "" : value);
    const args = [];
    let depth = 0, start = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) {
        args.push(text.slice(start, i).trim());
        start = i + 1;
      }
    }
    args.push(text.slice(start).trim());
    return args;
  }

  function topLevelFunctionCall(expression) {
    const text = unbracketReferences(expression).trim();
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(text);
    if (!match) return null;
    const open = text.indexOf("(", match[1].length);
    let depth = 0, close = -1;
    for (let i = open; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") {
        depth--;
        if (depth === 0) { close = i; break; }
      }
    }
    if (close !== text.length - 1 || depth !== 0) return null;
    return { name: match[1], args: splitTopLevelArguments(text.slice(open + 1, close)) };
  }

  function statefulInitialInfo(entity) {
    if (!entity || String(entity.type || "").toLowerCase() === "stock") return null;
    const call = topLevelFunctionCall(entity.expression);
    if (!call) return null;
    const argIndex = STATEFUL_INITIAL_ARGUMENT[call.name.toLowerCase()];
    if (argIndex == null || call.args.length <= argIndex || !String(call.args[argIndex] || "").trim()) return null;
    const name = cleanName(entity.name);
    if (!name) return null;
    const initialValue = unbracketReferences(call.args[argIndex]).trim();
    const args = call.args.slice();
    args[argIndex] = `${name}(t0)`;
    return { initialValue, displayExpression: `${call.name}(${args.join(", ")})`, functionName: call.name, args: call.args.slice(), initialArgIndex: argIndex };
  }

  function extractReferences(expression) {
    const refs = [];
    const text = decodeLineBreaks(expression);
    const add = name => {
      name = cleanName(name);
      if (name && !refs.some(ref => ref.toLowerCase() === name.toLowerCase())) refs.push(name);
    };
    const bracketRegex = /\[([^\]]+)\]/g;
    let match;
    while ((match = bracketRegex.exec(text))) add(match[1]);

    const bareText = text.replace(bracketRegex, " ");
    const identifierRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
    while ((match = identifierRegex.exec(bareText))) {
      const name = match[1];
      if (RESERVED_IDENTIFIERS.has(name.toLowerCase())) continue;
      let cursor = identifierRegex.lastIndex;
      while (cursor < bareText.length && /\s/.test(bareText[cursor])) cursor++;
      if (bareText[cursor] === "(") continue; // function call, not a model entity reference
      add(name);
    }
    return refs;
  }

  function netFlowNames(entity) {
    return {
      inflows: (entity.inflows || []).map(cleanName).filter(Boolean),
      outflows: (entity.outflows || []).map(cleanName).filter(Boolean)
    };
  }

  function netFlowExpression(entity) {
    const { inflows, outflows } = netFlowNames(entity);
    const terms = [];
    inflows.forEach(name => terms.push(terms.length ? `+ ${name}` : name));
    outflows.forEach(name => terms.push(terms.length ? `- ${name}` : `-${name}`));
    return terms.length ? terms.join(" ") : "0";
  }

  function stockEquation(entity, form) {
    const name = cleanName(entity.name);
    const net = netFlowExpression(entity);
    if (form === "differential") return `d${name}/dt = ${net}`;
    if (form === "difference") return `${name}(t + DT) = ${name}(t) + DT * (${net})`;
    return `${name}(t) = ${name}(t0) + ∫(t0→t) (${net}) dτ`;
  }

  function lookupEquation(entity) {
    const input = cleanName(entity.lookupInput) || "Time";
    const data = decodeLineBreaks(entity.expression == null ? "" : entity.expression).replace(/\s*\n\s*/g, " ");
    return `${cleanName(entity.name)} = Lookup(${input}; ${data})`;
  }

  function equationFor(entity, form, expressionOverride) {
    const type = String(entity.type || "").toLowerCase();
    if (type === "stock") return stockEquation(entity, form);
    if (type === "lookup") return lookupEquation(entity);
    const expression = unbracketReferences(expressionOverride == null ? (entity.expression == null || entity.expression === "" ? "0" : entity.expression) : expressionOverride);
    return `${cleanName(entity.name)} = ${expression}`;
  }

  function dependencies(entity, knownNames) {
    const deps = extractReferences(entity.expression);
    if (String(entity.type).toLowerCase() === "lookup" && entity.lookupInput && String(entity.lookupInput).toLowerCase() !== "time") deps.push(String(entity.lookupInput));
    const unique = [];
    for (const ref of deps) {
      const key = ref.toLowerCase();
      if (knownNames.has(key) && !unique.includes(key)) unique.push(key);
    }
    return unique;
  }

  function computationOrder(entities) {
    const rows = entities.slice();
    const stocks = rows.filter(row => String(row.type).toLowerCase() === "stock")
      .sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), undefined, { sensitivity: "base" }));
    const algebraic = rows.filter(row => String(row.type).toLowerCase() !== "stock");
    const byName = new Map(algebraic.map(row => [cleanName(row.name).toLowerCase(), row]));
    const stockNames = new Set(stocks.map(row => cleanName(row.name).toLowerCase()));
    const deps = new Map();
    for (const row of algebraic) deps.set(row, dependencies(row, byName).filter(name => !stockNames.has(name)));

    const ordered = [];
    const resolved = new Set(stockNames);
    const pending = algebraic.slice();
    while (pending.length) {
      const ready = pending.filter(row => deps.get(row).every(name => resolved.has(name)));
      if (!ready.length) {
        pending.sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), undefined, { sensitivity: "base" }));
        ordered.push(...pending);
        break;
      }
      ready.sort((a, b) => {
        const ta = TYPE_ORDER[String(a.type).toLowerCase()] ?? 99;
        const tb = TYPE_ORDER[String(b.type).toLowerCase()] ?? 99;
        return ta - tb || cleanName(a.name).localeCompare(cleanName(b.name), undefined, { sensitivity: "base" });
      });
      for (const row of ready) {
        ordered.push(row);
        resolved.add(cleanName(row.name).toLowerCase());
        pending.splice(pending.indexOf(row), 1);
      }
    }
    return stocks.concat(ordered);
  }

  function sortEntities(entities, mode) {
    const rows = entities.slice();
    if (mode === "name") return rows.sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), undefined, { sensitivity: "base" }));
    if (mode === "computation") return computationOrder(rows);
    return rows.sort((a, b) => {
      const ta = TYPE_ORDER[String(a.type).toLowerCase()] ?? 99;
      const tb = TYPE_ORDER[String(b.type).toLowerCase()] ?? 99;
      return ta - tb || cleanName(a.name).localeCompare(cleanName(b.name), undefined, { sensitivity: "base" });
    });
  }

  function latexEscapeIdentifier(name) {
    return String(name == null ? "" : name).replace(/([_#%&])/g, "\\$1");
  }
  function latexIdentifier(name) { return `\\mathrm{${latexEscapeIdentifier(name)}}`; }

  function expressionToLatex(expression) {
    let text = unbracketReferences(expression);
    text = text.replace(/\\/g, "\\textbackslash{}");
    const tokens = text.match(/(?:<=|>=|==|!=|<>|&&|\|\|)|(?:\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)|(?:\.[0-9]+(?:[eE][+-]?\d+)?)|(?:[A-Za-z_][A-Za-z0-9_]*)|\S/g) || [];
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const lower = token.toLowerCase();
      const next = tokens[i + 1];
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
        if (lower === "pi") out.push("\\pi");
        else if (lower === "and" || token === "&&") out.push("\\land");
        else if (lower === "or" || token === "||") out.push("\\lor");
        else if (lower === "not") out.push("\\lnot");
        else if (next === "(") {
          const builtin = { sin: "\\sin", cos: "\\cos", tan: "\\tan", ln: "\\ln", log: "\\log", exp: "\\exp", sqrt: "\\sqrt" }[lower];
          out.push(builtin || `\\operatorname{${latexEscapeIdentifier(token)}}`);
        } else out.push(latexIdentifier(token));
      } else if (token === "*") out.push("\\cdot");
      else if (token === "<=") out.push("\\le");
      else if (token === ">=") out.push("\\ge");
      else if (token === "!=" || token === "<>") out.push("\\ne");
      else if (token === "==") out.push("=");
      else if (token === "&&") out.push("\\land");
      else if (token === "||") out.push("\\lor");
      else if (token === "%") out.push("\\bmod");
      else out.push(token);
    }
    return out.join(" ").replace(/\\sqrt\s*\(/g, "\\sqrt{").replace(/\\sqrt\{([^()]*)\)/g, "\\sqrt{$1}");
  }

  function stockLatexEquation(entity, form) {
    const name = latexIdentifier(cleanName(entity.name));
    const { inflows, outflows } = netFlowNames(entity);
    const terms = [];
    inflows.forEach(flow => terms.push({ sign: terms.length ? "+" : "", value: latexIdentifier(flow) }));
    outflows.forEach(flow => terms.push({ sign: "-", value: latexIdentifier(flow) }));
    const net = terms.length ? terms.map(term => `${term.sign} ${term.value}`.trim()).join(" ") : "0";
    if (form === "differential") return `\\frac{d ${name}}{dt} = ${net}`;
    if (form === "difference") return `${name}(t + \\mathrm{DT}) = ${name}(t) + \\mathrm{DT} \\cdot \\left(${net}\\right)`;
    return `${name}(t) = ${name}(t_0) + \\int_{t_0}^{t} \\left(${net}\\right)\\,d\\tau`;
  }

  function equationToLatex(entity, form, expressionOverride) {
    const type = String(entity.type || "").toLowerCase();
    if (type === "stock") return stockLatexEquation(entity, form);
    if (type === "lookup") {
      const input = latexIdentifier(cleanName(entity.lookupInput) || "Time");
      return `${latexIdentifier(cleanName(entity.name))} = \\operatorname{Lookup}\\left(${input};\\;\\texttt{${latexTextEscape(decodeLineBreaks(entity.expression).replace(/\s+/g, " "))}}\\right)`;
    }
    const expression = expressionOverride == null ? (entity.expression == null || entity.expression === "" ? "0" : entity.expression) : expressionOverride;
    return `${latexIdentifier(cleanName(entity.name))} = ${expressionToLatex(expression)}`;
  }

  function statefulLatexEquation(entity, stateful) {
    const name = cleanName(entity.name);
    const args = stateful.args.map((arg, index) => index === stateful.initialArgIndex
      ? `${latexIdentifier(name)}(t_0)`
      : expressionToLatex(arg));
    return `${latexIdentifier(name)} = \\operatorname{${latexEscapeIdentifier(stateful.functionName)}}\\left(${args.join(", ")}\\right)`;
  }

  function latexTextEscape(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\textbackslash{}")
      .replace(/([{}#$%&_])/g, "\\$1")
      .replace(/\^/g, "\\textasciicircum{}")
      .replace(/~/g, "\\textasciitilde{}");
  }

  function buildRows(entities, options) {
    const form = options && ["integral", "differential", "difference"].includes(options.form) ? options.form : "integral";
    const sort = options && ["type", "name", "computation"].includes(options.sort) ? options.sort : "type";
    return sortEntities(entities, sort).map((entity, index) => {
      const type = String(entity.type || "").toLowerCase();
      const name = cleanName(entity.name);
      const stateful = statefulInitialInfo(entity);
      const initialValue = type === "stock"
        ? unbracketReferences(entity.expression == null || entity.expression === "" ? "0" : entity.expression)
        : (stateful ? stateful.initialValue : "");
      const displayExpression = stateful ? stateful.displayExpression : null;
      const hasInitialCondition = type === "stock" || !!stateful;
      return {
        order: index + 1,
        type: TYPE_LABEL[type] || String(entity.type || ""),
        name,
        equation: equationFor(entity, form, displayExpression),
        initialCondition: hasInitialCondition ? `${name}(t0) = ${initialValue}` : "",
        units: String(entity.units == null ? "" : entity.units),
        comment: decodeLineBreaks(entity.comment == null ? "" : entity.comment),
        latexEquation: stateful ? statefulLatexEquation(entity, stateful) : equationToLatex(entity, form, displayExpression),
        latexInitialCondition: hasInitialCondition ? `${latexIdentifier(name)}(t_0) = ${expressionToLatex(initialValue)}` : ""
      };
    });
  }

  function csvEscape(value) {
    const text = String(value == null ? "" : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCSV(rows) {
    const header = ["Order", "Type", "Name", "Equation", "Initial Condition", "Units", "Comment"];
    return [header].concat(rows.map(row => [row.order, row.type, row.name, row.equation, row.initialCondition || "", row.units, row.comment || ""]))
      .map(cols => cols.map(csvEscape).join(",")).join("\n") + "\n";
  }

  function toPlainText(rows) {
    const lines = [];
    rows.forEach(row => {
      lines.push(row.equation);
      if (row.initialCondition) lines.push(row.initialCondition);
      if (row.comment) lines.push(`Comment: ${row.comment}`);
    });
    return lines.join("\n") + (lines.length ? "\n" : "");
  }

  function toLaTeX(rows) {
    const body = [];
    rows.forEach(row => {
      body.push(`  ${row.latexEquation} \\\\`);
      if (row.latexInitialCondition) body.push(`  ${row.latexInitialCondition} \\\\`);
      if (row.comment) body.push(`  \\text{\\textit{Comment: ${latexTextEscape(row.comment.replace(/\s+/g, " "))}}} \\\\`);
    });
    return [
      "\\documentclass{article}",
      "\\usepackage{amsmath}",
      "\\usepackage[T1]{fontenc}",
      "\\begin{document}",
      "\\section*{Systemika Studio Equations}",
      "\\begin{align*}",
      ...body,
      "\\end{align*}",
      "\\end{document}",
      ""
    ].join("\n");
  }

  return Object.freeze({
    TYPE_ORDER, TYPE_LABEL, decodeLineBreaks, unbracketReferences, extractReferences, statefulInitialInfo,
    equationFor, sortEntities, buildRows, toCSV, toPlainText, toLaTeX, expressionToLatex
  });
});
