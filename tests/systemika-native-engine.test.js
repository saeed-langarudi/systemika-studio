'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const engine = require(path.join('..', 'OpenSystemDynamics', 'src', 'systemika-engine.js'));

function last(array) { return array[array.length - 1]; }

test('parser evaluates references, math, comparison, and lazy IfThenElse', () => {
  const ast = engine.parseExpression('IfThenElse([X] > 2, Sqrt([X]^2) + Max(1, 3), 1/0)');
  const value = engine.evaluateAst(ast, {
    time: 0, dt: 1, timeStart: 0, timeLength: 10, timeEnd: 10,
    resolve(name) { return name === 'X' ? 4 : NaN; }
  });
  assert.equal(value, 7);
});

test('Euler solves a constant inflow exactly at sample points', () => {
  const results = engine.simulate({
    timeStart: 0, timeLength: 5, dt: 1, method: 'Euler',
    stocks: [{ id: 's', name: 'Stock', initial: '0' }],
    flows: [{ id: 'f', name: 'Inflow', equation: '10', targetId: 's' }]
  });
  assert.deepEqual(results.times, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(results.value('s'), [0, 10, 20, 30, 40, 50]);
});

test('flows are signed and never clamped to zero, including legacy nonNegative specifications', () => {
  const results = engine.simulate({
    timeStart: 0, timeLength: 2, dt: 1, method: 'Euler',
    stocks: [{ id: 's', name: 'Stock', initial: '10' }],
    flows: [{ id: 'f', name: 'Signed Flow', equation: '-2', targetId: 's', nonNegative: true }]
  });
  assert.deepEqual(results.value('f'), [-2, -2, -2]);
  assert.deepEqual(results.value('s'), [10, 8, 6]);
});

test('RK4 accurately integrates exponential growth', () => {
  const results = engine.simulate({
    timeStart: 0, timeLength: 10, dt: 0.25, method: 'RK4',
    stocks: [{ id: 'p', name: 'Population', initial: '100' }],
    flows: [{ id: 'g', name: 'Growth', equation: '0.1 * [Population]', targetId: 'p' }]
  });
  const expected = 100 * Math.exp(1);
  assert.ok(Math.abs(last(results.value('p')) - expected) < 0.0001);
});

test('connected stock-to-stock flow conserves total material', () => {
  const results = engine.simulate({
    timeStart: 0, timeLength: 4, dt: 0.1, method: 'RK4',
    stocks: [
      { id: 'a', name: 'A', initial: '100' },
      { id: 'b', name: 'B', initial: '0' }
    ],
    flows: [{ id: 'move', name: 'Move', equation: '0.2 * [A]', sourceId: 'a', targetId: 'b' }]
  });
  const a = results.value('a');
  const b = results.value('b');
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] + b[i] - 100) < 1e-10);
});

test('variables and IfThenElse are recalculated during integration', () => {
  const results = engine.simulate({
    timeStart: 0, timeLength: 2, dt: 0.1, method: 'RK4',
    stocks: [{ id: 's', name: 'S', initial: '0' }],
    variables: [{ id: 'r', name: 'Rate', equation: 'IfThenElse(T() < 1, 1, 2)' }],
    flows: [{ id: 'f', name: 'F', equation: '[Rate]', targetId: 's' }]
  });
  assert.ok(Math.abs(last(results.value('s')) - 3) < 0.05);
});

test('linear lookup interpolates and clamps to endpoint values', () => {
  const results = engine.simulate({
    timeStart: -1, timeLength: 4, dt: 1, method: 'Euler',
    converters: [{ id: 'c', name: 'Lookup', data: '0,0; 1,10; 2,20', sourceId: 'Time', interpolation: 'Linear' }]
  });
  assert.deepEqual(results.value('c'), [0, 0, 10, 20, 20]);
});

test('unknown references fail during model compilation', () => {
  assert.throws(() => engine.compileModel({
    variables: [{ id: 'x', name: 'X', equation: '[Missing] + 1' }]
  }), /unknown model entity/i);
});

test('circular auxiliary dependencies are detected', () => {
  assert.throws(() => engine.simulate({
    variables: [
      { id: 'a', name: 'A', equation: '[B] + 1' },
      { id: 'b', name: 'B', equation: '[A] + 1' }
    ]
  }), /circular equation dependency/i);
});

test('pause/resume controller exposes compatible results and state-independent setValue', () => {
  const pauses = [];
  let finalResults = null;
  const controller = engine.createController({
    timeStart: 0, timeLength: 3, dt: 1, method: 'Euler', pauseInterval: 1,
    stocks: [{ id: 's', name: 'S', initial: '0' }],
    variables: [{ id: 'r', name: 'Rate', equation: '1' }],
    flows: [{ id: 'f', name: 'F', equation: '[Rate]', targetId: 's' }]
  }, {
    onPause(res) {
      pauses.push(res.times.at(-1));
      if (pauses.length === 1) res.setValue({ id: 'r' }, '2');
    },
    onSuccess(res) { finalResults = res; }
  });

  controller.start();
  assert.deepEqual(pauses, [1]);
  controller.resume();
  assert.deepEqual(pauses, [1, 2]);
  controller.resume();
  assert.ok(finalResults);
  assert.deepEqual(finalResults.value('s'), [0, 1, 3, 5]);
});

test('Lag implements a fixed time shift and uses its initial value before history exists', () => {
  const results = engine.simulate({
    timeStart: 0, timeLength: 5, dt: 1, method: 'RK4',
    variables: [
      { id: 'input', name: 'Input', equation: 'T()' },
      { id: 'lag', name: 'Lagged', equation: 'Lag([Input], 2, -1)' }
    ]
  });
  assert.deepEqual(results.value('lag'), [-1, -1, 0, 1, 2, 3]);
});

test('Lag linearly interpolates historical input when lag time falls between simulation points', () => {
  const results = engine.simulate({
    timeStart: 0, timeLength: 3, dt: 1, method: 'RK4',
    variables: [
      { id: 'input', name: 'Input', equation: 'T()' },
      { id: 'lag', name: 'Lagged', equation: 'Lag([Input], 1.5, -1)' }
    ]
  });
  assert.deepEqual(results.value('lag'), [-1, -1, 0.5, 1.5]);
});

test('Smooth and Delay implement N-stage exponential pipelines', () => {
  for (const fn of ['Smooth', 'Delay']) {
    const results = engine.simulate({
      timeStart: 0, timeLength: 4, dt: 0.05, method: 'RK4',
      variables: [{ id: 'x', name: 'X', equation: `${fn}(10, 4, 2, 0)` }]
    });
    const expected = 10 * (1 - Math.exp(-2) * (1 + 2));
    assert.equal(results.value('x')[0], 0);
    assert.ok(Math.abs(last(results.value('x')) - expected) < 1e-5, `${fn} should match the two-stage analytical response`);
  }
});

test('programming functions validate order and time arguments', () => {
  assert.throws(() => engine.compileModel({
    variables: [{ id: 'x', name: 'X', equation: 'Smooth(1, 2, 1.5, 0)' }]
  }), /order must be an integer/i);
  assert.throws(() => engine.simulate({
    variables: [{ id: 'x', name: 'X', equation: 'Lag(1, 0, 0)' }]
  }), /time must be greater than zero/i);
});

test('seeded random functions are reproducible and report stochastic output', () => {
  const spec = {
    timeStart: 0, timeLength: 3, dt: 1, method: 'RK4', randomSeed: 123456,
    variables: [
      { id: 'u', name: 'Uniform', equation: 'RandomUniform(-2, 5)' },
      { id: 'n', name: 'Normal', equation: 'RandomNormal(10, 2)' },
      { id: 't', name: 'Triangular', equation: 'RandomTriangular(0, 10, 3)' },
      { id: 'g', name: 'Gamma', equation: 'RandomGamma(2.5, 3)' },
      { id: 'b', name: 'Beta', equation: 'RandomBeta(2, 5)' }
    ]
  };
  const a = engine.simulate(spec);
  const b = engine.simulate(spec);
  assert.equal(a.stochastic, true);
  assert.equal(a.randomSeed, 123456);
  for (const id of ['u', 'n', 't', 'g', 'b']) assert.deepEqual(a.value(id), b.value(id));
  for (const value of a.value('u')) assert.ok(value >= -2 && value < 5);
  for (const value of a.value('t')) assert.ok(value >= 0 && value <= 10);
  for (const value of a.value('g')) assert.ok(value >= 0);
  for (const value of a.value('b')) assert.ok(value >= 0 && value <= 1);
  for (const value of a.value('n')) assert.ok(Number.isFinite(value));
});

test('optional per-function seeds reproduce each random function independently of the run seed', () => {
  const variables = [
    { id: 'u', name: 'Uniform', equation: 'RandomUniform(-2, 5, 101)' },
    { id: 'n', name: 'Normal', equation: 'RandomNormal(10, 2, 102)' },
    { id: 't', name: 'Triangular', equation: 'RandomTriangular(0, 10, 3, 103)' },
    { id: 'g', name: 'Gamma', equation: 'RandomGamma(2.5, 3, 104)' },
    { id: 'b', name: 'Beta', equation: 'RandomBeta(2, 5, 105)' }
  ];
  const a = engine.simulate({ timeStart: 0, timeLength: 3, dt: 1, method: 'RK4', randomSeed: 1, variables });
  const b = engine.simulate({ timeStart: 0, timeLength: 3, dt: 1, method: 'RK4', randomSeed: 999, variables });
  for (const id of ['u', 'n', 't', 'g', 'b']) assert.deepEqual(a.value(id), b.value(id));
});

test('unseeded random calls use the fresh run seed while seeded calls ignore it', () => {
  const variables = [
    { id: 'seeded', name: 'Seeded', equation: 'RandomUniform(0, 1, 42)' },
    { id: 'fresh', name: 'Fresh', equation: 'RandomUniform(0, 1)' }
  ];
  const a = engine.simulate({ timeStart: 0, timeLength: 3, dt: 1, method: 'Euler', randomSeed: 111, variables });
  const b = engine.simulate({ timeStart: 0, timeLength: 3, dt: 1, method: 'Euler', randomSeed: 222, variables });
  assert.deepEqual(a.value('seeded'), b.value('seeded'));
  assert.notDeepEqual(a.value('fresh'), b.value('fresh'));
});

test('random-function seed must be a constant numeric expression', () => {
  assert.throws(() => engine.compileModel({
    variables: [
      { id: 's', name: 'SeedSource', equation: '42' },
      { id: 'x', name: 'X', equation: 'RandomUniform(0, 1, [SeedSource])' }
    ]
  }), /seed must be a constant number/i);
});

test('random shocks are held constant across RK4 stages within each integration step', () => {
  const base = {
    timeStart: 0, timeLength: 4, dt: 1, randomSeed: 98765,
    stocks: [{ id: 's', name: 'S', initial: '0' }],
    flows: [{ id: 'f', name: 'F', equation: 'RandomUniform(0, 1)', targetId: 's' }]
  };
  const euler = engine.simulate({ ...base, method: 'Euler' });
  const rk4 = engine.simulate({ ...base, method: 'RK4' });
  assert.deepEqual(rk4.value('s'), euler.value('s'));
});

test('statistical functions reject invalid distribution parameters', () => {
  for (const [equation, pattern] of [
    ['RandomUniform(2, 1)', /maximum/i],
    ['RandomNormal(0, -1)', /standard deviation/i],
    ['RandomTriangular(0, 1, 2)', /mode/i],
    ['RandomGamma(0, 1)', /shape and scale/i],
    ['RandomBeta(-1, 2)', /alpha and beta/i]
  ]) {
    assert.throws(() => engine.simulate({ variables: [{ id: 'x', name: 'X', equation }] }), pattern);
  }
});

test('Systemika HTML loads native engine before editor code', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
  const nativePos = html.indexOf('src="systemika-engine.js"');
  const editorPos = html.indexOf('src="editor.js');
  assert.ok(nativePos >= 0 && editorPos > nativePos);
});

test('browser adapter compiles the existing Systemika primitive/setting shape', () => {
  function cell(id, type, name, attrs) {
    return {
      id: String(id), value: { nodeName: type }, source: null, target: null,
      getAttribute(key) { return key === 'name' ? name : (attrs || {})[key]; }
    };
  }
  const stock = cell(1, 'Stock', 'Population', { InitialValue: '10', NonNegative: 'false' });
  const rate = cell(2, 'Variable', 'Rate', { Equation: '-2' });
  const flow = cell(3, 'Flow', 'Growth', { FlowRate: '[Rate]', OnlyPositive: 'true' });
  flow.target = stock;

  const old = { primitives: global.primitives, getSetting: global.getSetting, orig: global.orig, getName: global.getName };
  global.primitives = () => [stock, rate, flow];
  global.getSetting = () => ({ getAttribute(key) { return ({
    TimeStart: '0', TimeLength: '2', TimeStep: '1', SolutionAlgorithm: 'RK1', TimePause: '1'
  })[key]; } });
  global.orig = x => x;
  global.getName = x => x.getAttribute('name');

  try {
    const compiled = engine.compileCurrentModel();
    const results = engine.simulate(compiled);
    assert.deepEqual(results.value(flow), [-2, -2, -2]);
    assert.deepEqual(results.value(stock), [10, 8, 6]);
  } finally {
    Object.assign(global, old);
  }
});

test('normal UI compilation ignores legacy model-level RandomSeed so unseeded functions stay fresh', () => {
  const old = { primitives: global.primitives, getSetting: global.getSetting };
  global.primitives = () => [];
  global.getSetting = () => ({ getAttribute(key) { return ({
    TimeStart: '0', TimeLength: '2', TimeStep: '1', SolutionAlgorithm: 'RK4', TimePause: '1', RandomSeed: '123456'
  })[key]; } });
  try {
    const compiled = engine.compileCurrentModel();
    assert.equal(compiled.randomSeed, null);
  } finally {
    global.primitives = old.primitives;
    global.getSetting = old.getSetting;
  }
});

test('multiline nested IfThenElse equations parse and evaluate normally', () => {
  const model = engine.compileModel({
    timeStart: 0, timeLength: 0, dt: 1, method: 'Euler',
    variables: [
      { id: 'x', name: 'X', equation: '10' },
      { id: 'y', name: 'Y', equation: `IfThenElse(
        [X] > 0,
        IfThenElse(
          [X] > 5,
          2,
          1
        ),
        0
      )` }
    ]
  });
  const result = engine.simulate(model);
  assert.equal(result.value('Y')[0], 2);
});

test('native equation editor keeps clean function names while showing optional seeds in hover help and click templates', async () => {
  const fs = require('node:fs/promises');
  const categories = await fs.readFile(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'functionCategories.js'), 'utf8');
  const editor = await fs.readFile(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');

  assert.ok(!categories.includes('Conditional Function'), 'Conditional Function category should be removed');
  assert.match(categories, /name: "Programming Functions"[\s\S]*name: "IfThenElse"/);

  for (const signature of [
    'RandomUniform(Minimum, Maximum, Seed?)',
    'RandomNormal(Mean, Standard Deviation, Seed?)',
    'RandomTriangular(Minimum, Maximum, Mode, Seed?)',
    'RandomGamma(Shape, Scale, Seed?)',
    'RandomBeta(Alpha, Beta, Seed?)'
  ]) {
    assert.ok(categories.includes(`syntax: "${signature}"`), `${signature} should be stored as hover-help syntax`);
  }
  for (const template of [
    'RandomUniform(##Minimum$$, ##Maximum$$)',
    'RandomNormal(##Mean$$, ##Standard Deviation$$)',
    'RandomTriangular(##Minimum$$, ##Maximum$$, ##Mode$$)',
    'RandomGamma(##Shape$$, ##Scale$$)',
    'RandomBeta(##Alpha$$, ##Beta$$)'
  ]) {
    assert.ok(categories.includes(`replacement: "${template}"`), `${template} should be the click-to-insert template`);
  }
  assert.match(editor, /codeSnippetName = func\.name;/, 'function list should show only clean names');
  assert.match(editor, /const syntaxHelp = func\.syntax \?/, 'hover tooltip should render optional-argument syntax');
  assert.doesNotMatch(editor, /displayText: f\.signature \|\| f\.name/, 'autocomplete must not show full signatures as names');
  assert.equal((editor.match(/name: "Seed"/g) || []).length, 5, 'all five random functions should expose Seed as an optional argument in inline help');
  assert.match(categories, /Optional third argument: Seed/);
  assert.match(categories, /Optional fourth argument: Seed/);

  for (const supported of ['Smooth(', 'Delay(', 'Lag(', 'RandomUniform(', 'RandomNormal(', 'RandomTriangular(', 'RandomGamma(', 'RandomBeta(']) {
    assert.ok(categories.includes(supported), `${supported} should appear in function help`);
  }
  for (const unsupported of ['RandPoisson', 'Delay1(', 'Delay3(', 'PastMax', 'PastMean', 'StopIf', 'Pulse(', 'Ramp(']) {
    assert.equal(categories.includes(unsupported), false, `${unsupported} should not appear in function help`);
  }

  const autocompleteStart = editor.indexOf('const functions = [');
  const autocompleteEnd = editor.indexOf('\n]\n\nclass FunctionHelper', autocompleteStart);
  const autocomplete = editor.slice(autocompleteStart, autocompleteEnd);
  for (const unsupported of ['PoFlow', 'RandPoisson', 'Delay1', 'Delay3', 'Pulse', 'Ramp', 'PastMax', 'StopIf']) {
    assert.equal(autocomplete.includes(`name: "${unsupported}"`), false, `${unsupported} should not appear in autocomplete`);
  }
  for (const supported of ['IfThenElse', 'Abs', 'Min', 'Max', 'Sqrt', 'Exp', 'Ln', 'Log', 'Sin', 'Cos', 'Tan', 'Round', 'Ceiling', 'Floor', 'Sign', 'Smooth', 'Delay', 'Lag', 'RandomUniform', 'RandomNormal', 'RandomTriangular', 'RandomGamma', 'RandomBeta', 'T', 'DT', 'TS', 'TL', 'TE']) {
    assert.ok(autocomplete.includes(`name: "${supported}"`), `${supported} should appear in autocomplete`);
  }
});

test('equation editor uses Enter to apply and Shift+Enter for new lines', async () => {
  const fs = require('node:fs/promises');
  const editor = await fs.readFile(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
  const start = editor.indexOf('class DefinitionEditor');
  const end = editor.indexOf('class EquationListDialog', start);
  const definitionEditor = editor.slice(start, end);
  assert.doesNotMatch(definitionEditor, /"Enter": \(\) => \{\s*this\.dialogParameters\.buttons\["Apply"\]/);
  assert.doesNotMatch(definitionEditor, /"Ctrl-Enter"|"Cmd-Enter"/);
  assert.match(definitionEditor, /keyHtml\("Enter"\).*Apply changes/);
  assert.match(definitionEditor, /keyHtml\(\["Shift", "Enter"\]\).*Add new line/);
  assert.doesNotMatch(definitionEditor, /keyHtml\(\[modifierKey, "Enter"\]\).*Apply changes/);
  assert.match(editor, /cm\.getRange\(\{ line: 0, ch: 0 \}, cursor\)/, 'function argument help should work across equation line breaks');
});

test('Run and Advance paths use the native Systemika engine backend', async () => {
  const fs = require('node:fs/promises');
  const editor = await fs.readFile(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
  assert.equal((editor.match(/SystemikaEngine\.runCurrentModel\(/g) || []).length, 2);
  const runResultsSection = editor.slice(editor.indexOf('class RunResults'), editor.indexOf('class RunResults') + 12000);
  assert.equal(runResultsSection.includes('runModel({'), false);
});

test('browser-style asynchronous callbacks yield between native engine chunks', async () => {
  const events = [];
  const controller = engine.createController({
    timeStart: 0, timeLength: 2, dt: 1, method: 'Euler', pauseInterval: 1,
    stocks: [{ id: 's', name: 'S', initial: '0' }],
    flows: [{ id: 'f', name: 'F', equation: '1', targetId: 's' }]
  }, {
    asyncCallbacks: true,
    onPause(res) {
      events.push(`pause-${res.times.at(-1)}`);
      res.resume();
    },
    onSuccess(res) {
      events.push(`success-${res.times.at(-1)}`);
    }
  });

  controller.start();
  assert.deepEqual(events, []);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(events, ['pause-1', 'success-2']);
});

test('legacy Insight Maker simulation engine is absent from startup and source package', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
  assert.equal(html.includes('insightmaker/SimulationEngine/'), false);
  assert.equal(html.includes('insightmaker/resources/'), false);
  await assert.rejects(
    fs.access(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'insightmaker', 'SimulationEngine'))
  );
  await assert.rejects(
    fs.access(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'insightmaker', 'resources'))
  );
});

test('editor contains no legacy macro or simulation-function registration hooks', async () => {
  const fs = require('node:fs/promises');
  const editor = await fs.readFile(path.join(__dirname, '..', 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
  for (const legacy of ['class MacroDialog', 'sdsLoadFunctions', 'RandPoisson', 'defineFunction("T"', 'SetRandSeed']) {
    assert.equal(editor.includes(legacy), false, `${legacy} should be removed from active editor source`);
  }
});
