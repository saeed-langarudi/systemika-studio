'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const units = require(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-units.js'));

function report(items, timeUnits = 'Year') {
  return units.checkModel({ timeUnits, items });
}

function hasError(result, fragment) {
  return result.errors.some(issue => issue.message.includes(fragment));
}

test('unit parser normalizes algebra but keeps symbols literal and case-sensitive', () => {
  assert.ok(units.unitsEqual(units.parseUnit('Person/Year'), units.parseUnit('Person*Year^-1')));
  assert.ok(units.unitsEqual(units.parseUnit('USD/(Person*Year)'), units.parseUnit('USD/Person/Year')));
  assert.equal(units.unitsEqual(units.parseUnit('USD'), units.parseUnit('$')), false);
  assert.equal(units.unitsEqual(units.parseUnit('Person'), units.parseUnit('People')), false);
  assert.equal(units.unitsEqual(units.parseUnit('Year'), units.parseUnit('year')), false);
});

test('unit parser rejects implicit multiplication and conversion factors', () => {
  assert.throws(() => units.parseUnit('Person Year'), /Expected '\*' or '\/'/);
  assert.throws(() => units.parseUnit('1000*USD'), /Only the number 1/);
  assert.throws(() => units.parseUnit('Person\/\/Year'), /Expected a unit symbol/);
});

test('pure numeric constants may carry an explicitly declared unit', () => {
  const r = report([
    { id: 'r', name: 'Birth Rate', type: 'Variable', isConstant: true, units: '1/Year', equation: '0.1' },
    { id: 'p', name: 'Initial Population', type: 'Variable', isConstant: true, units: 'Person', equation: '100' }
  ]);
  assert.equal(r.errors.length, 0);
  assert.equal(r.unknowns.length, 0);
});

test('multiplication and division derive compound units', () => {
  const r = report([
    { id: 'p', name: 'Population', type: 'Stock', units: 'Person', initial: '100' },
    { id: 'r', name: 'Birth Rate', type: 'Variable', isConstant: true, units: '1/Year', equation: '0.1' },
    { id: 'b', name: 'Births', type: 'Flow', units: 'Person/Year', equation: '[Population]*[Birth Rate]', targetId: 'p' }
  ]);
  assert.equal(r.errors.length, 0);
  assert.equal(r.unknowns.length, 0);
});

test('addition rejects different declared symbols without synonym matching', () => {
  const r = report([
    { id: 'a', name: 'A', type: 'Variable', units: 'USD', equation: '10' },
    { id: 'b', name: 'B', type: 'Variable', units: '$', equation: '20' },
    { id: 'c', name: 'C', type: 'Variable', units: 'USD', equation: '[A]+[B]' }
  ]);
  assert.ok(hasError(r, "Operator '+' uses incompatible units: USD and $."));
  assert.equal(r.unknowns.some(issue => issue.entityId === 'c'), false, 'do not duplicate a known error as an unknown result');
});

test('declared unit is compared with the dimensional result of a definition', () => {
  const r = report([
    { id: 'p', name: 'Population', type: 'Stock', units: 'Person', initial: '100' },
    { id: 'r', name: 'Rate', type: 'Variable', units: '1/Year', equation: '0.1' },
    { id: 'x', name: 'Wrong', type: 'Variable', units: 'Person', equation: '[Population]*[Rate]' }
  ]);
  assert.ok(hasError(r, 'Declared unit is Person, but the definition evaluates dimensionally to Person/Year.'));
});

test('flow unit must equal connected stock unit divided by the exact model time unit', () => {
  const r = report([
    { id: 's', name: 'Inventory', type: 'Stock', units: 'Item', initial: '100' },
    { id: 'f', name: 'Production', type: 'Flow', units: 'Item/Month', equation: '5', targetId: 's' }
  ], 'Year');
  assert.ok(hasError(r, "requires Item/Year when the model time unit is Year"));
});

test('no time-unit conversion is attempted', () => {
  const r = report([
    { id: 'x', name: 'Input', type: 'Variable', units: 'Person', equation: '1' },
    { id: 'tau', name: 'Tau', type: 'Variable', isConstant: true, units: 'Month', equation: '2' },
    { id: 'y', name: 'Smoothed', type: 'Variable', units: 'Person', equation: 'Smooth([Input],[Tau],2,0)' }
  ], 'Year');
  assert.ok(hasError(r, 'Smooth time must use the model time unit Year, but is Month.'));
});

test('IfThenElse branches must have compatible units', () => {
  const r = report([
    { id: 'a', name: 'People', type: 'Variable', units: 'Person', equation: '10' },
    { id: 'b', name: 'Money', type: 'Variable', units: 'USD', equation: '20' },
    { id: 'c', name: 'Choice', type: 'Variable', units: 'Person', equation: 'IfThenElse(T()>1,[People],[Money])' }
  ]);
  assert.ok(hasError(r, 'IfThenElse result branches uses incompatible units'));
});

test('Lag preserves input units and requires the exact model time unit for its lag time', () => {
  const good = report([
    { id: 'x', name: 'X', type: 'Variable', units: 'Person', equation: '1' },
    { id: 'tau', name: 'Tau', type: 'Variable', units: 'Year', equation: '2' },
    { id: 'y', name: 'Y', type: 'Variable', units: 'Person', equation: 'Lag([X],[Tau],0)' }
  ]);
  assert.equal(good.errors.length, 0);

  const bad = report([
    { id: 'x', name: 'X', type: 'Variable', units: 'Person', equation: '1' },
    { id: 'tau', name: 'Tau', type: 'Variable', units: 'Month', equation: '2' },
    { id: 'y', name: 'Y', type: 'Variable', units: 'Person', equation: 'Lag([X],[Tau],0)' }
  ]);
  assert.ok(hasError(bad, 'Lag time must use the model time unit Year, but is Month.'));
});

test('random function rules preserve strict units and require dimensionless seeds', () => {
  const r = report([
    { id: 'lo', name: 'Low', type: 'Variable', units: 'USD', equation: '1' },
    { id: 'hi', name: 'High', type: 'Variable', units: 'USD', equation: '10' },
    { id: 'seed', name: 'Seed', type: 'Variable', units: 'Person', equation: '42' },
    { id: 'u', name: 'Uniform', type: 'Variable', units: 'USD', equation: 'RandomUniform([Low],[High],[Seed])' },
    { id: 'beta', name: 'Beta', type: 'Variable', units: 'USD', equation: 'RandomBeta(2,5,42)' }
  ]);
  assert.ok(hasError(r, 'RandomUniform seed must be Unitless, but is Person.'));
  assert.ok(hasError(r, 'Declared unit is USD, but the definition evaluates dimensionally to Unitless.'));
});

test('missing units are reported as cannot verify, never silently accepted', () => {
  const r = report([
    { id: 'a', name: 'A', type: 'Variable', units: '', equation: '10' },
    { id: 'b', name: 'B', type: 'Variable', units: 'Person', equation: '[A]' }
  ]);
  assert.ok(r.unknowns.some(issue => issue.entityId === 'a' && /no declared unit/i.test(issue.message)));
  assert.ok(r.unknowns.some(issue => issue.entityId === 'b' && /Referenced model entity 'A' has no declared unit/.test(issue.message)));
});

test('invalid declared unit syntax is an error', () => {
  const r = report([{ id: 'a', name: 'A', type: 'Variable', units: 'Person Year', equation: '1' }]);
  assert.ok(hasError(r, "Invalid declared unit 'Person Year'"));
});

test('missing model time unit is reported as cannot verify stock-flow timing', () => {
  const r = report([
    { id: 's', name: 'S', type: 'Stock', units: 'Person', initial: '1' },
    { id: 'f', name: 'F', type: 'Flow', units: 'Person/Year', equation: '1', targetId: 's' }
  ], '');
  assert.ok(r.unknowns.some(issue => issue.code === 'missing-time-unit'));
  assert.ok(r.unknowns.some(issue => /model time unit is missing or invalid/.test(issue.message)));
});

test('unit report UI replaces the old Yes/No ignore-units toggle', () => {
  const index = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
  const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
  assert.match(index, /systemika-units\.js/);
  assert.match(index, /id="check_units-label">Check Units<\/div>\s*<div id="check_units-value">Report<\/div>/);
  assert.match(editor, /class UnitCheckDialog extends jqDialog/);
  assert.match(editor, /SystemikaUnits\.checkCurrentModel\(\)/);
  assert.doesNotMatch(editor, /#btn_check_units[\s\S]{0,500}setIgnoreUnits/);
});

test('mathematical function unit rules cover the complete native math function family', () => {
  const r = report([
    { id: 'length', name: 'Length', type: 'Variable', units: 'm', equation: '4' },
    { id: 'area', name: 'Area', type: 'Variable', units: 'm^2', equation: '[Length]^2' },
    { id: 'abs', name: 'Abs Length', type: 'Variable', units: 'm', equation: 'Abs([Length])' },
    { id: 'min', name: 'Min Length', type: 'Variable', units: 'm', equation: 'Min([Length], 2)' },
    { id: 'max', name: 'Max Length', type: 'Variable', units: 'm', equation: 'Max(2, [Length])' },
    { id: 'sqrt', name: 'Root Area', type: 'Variable', units: 'm', equation: 'Sqrt([Area])' },
    { id: 'floor', name: 'Floor Length', type: 'Variable', units: 'm', equation: 'Floor([Length])' },
    { id: 'ceil', name: 'Ceil Length', type: 'Variable', units: 'm', equation: 'Ceiling([Length])' },
    { id: 'round', name: 'Round Length', type: 'Variable', units: 'm', equation: 'Round([Length])' },
    { id: 'sign', name: 'Sign Length', type: 'Variable', units: 'Unitless', equation: 'Sign([Length])' },
    { id: 'remainder', name: 'Remainder Length', type: 'Variable', units: 'm', equation: '[Length] mod 3' },
    { id: 'pow', name: 'Power Root', type: 'Variable', units: 'm', equation: '[Area]^0.5' },
    { id: 'exp', name: 'Exp Value', type: 'Variable', units: 'Unitless', equation: 'Exp(1)' },
    { id: 'ln', name: 'Ln Value', type: 'Variable', units: 'Unitless', equation: 'Ln(2)' },
    { id: 'log', name: 'Log Value', type: 'Variable', units: 'Unitless', equation: 'Log(10)' },
    { id: 'sin', name: 'Sin Value', type: 'Variable', units: 'Unitless', equation: 'Sin(pi/2)' },
    { id: 'cos', name: 'Cos Value', type: 'Variable', units: 'Unitless', equation: 'Cos(pi)' },
    { id: 'tan', name: 'Tan Value', type: 'Variable', units: 'Unitless', equation: 'Tan(pi/4)' },
    { id: 'asin', name: 'ASin Value', type: 'Variable', units: 'Unitless', equation: 'ArcSin(0.5)' },
    { id: 'acos', name: 'ACos Value', type: 'Variable', units: 'Unitless', equation: 'ArcCos(0.5)' },
    { id: 'atan', name: 'ATan Value', type: 'Variable', units: 'Unitless', equation: 'ArcTan(1)' },
    { id: 'time', name: 'Time Copy', type: 'Variable', units: 'Year', equation: 'T()+DT()+TS()+TL()+TE()' }
  ]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.unknowns, []);
});

test('dimensionless math functions reject dimensioned inputs', () => {
  const r = report([
    { id: 'x', name: 'X', type: 'Variable', units: 'Person', equation: '10' },
    { id: 'bad', name: 'Bad', type: 'Variable', units: 'Unitless', equation: 'Exp([X])' }
  ]);
  assert.ok(hasError(r, 'Exp() argument must be Unitless, but is Person.'));
});

test('Smooth Delay and Lag all preserve the input unit and validate initial values', () => {
  const r = report([
    { id: 'x', name: 'Input', type: 'Variable', units: 'Person', equation: '10' },
    { id: 'tau', name: 'Tau', type: 'Variable', units: 'Year', equation: '2' },
    { id: 'initial', name: 'Initial Wrong', type: 'Variable', units: 'USD', equation: '0' },
    { id: 'smooth', name: 'Smooth Result', type: 'Variable', units: 'Person', equation: 'Smooth([Input],[Tau],2,0)' },
    { id: 'delay', name: 'Delay Result', type: 'Variable', units: 'Person', equation: 'Delay([Input],[Tau],3,0)' },
    { id: 'lag', name: 'Lag Result', type: 'Variable', units: 'Person', equation: 'Lag([Input],[Tau],0)' },
    { id: 'bad', name: 'Bad Initial', type: 'Variable', units: 'Person', equation: 'Delay([Input],[Tau],2,[Initial Wrong])' }
  ]);
  assert.ok(hasError(r, 'Delay input and initial value uses incompatible units: Person and USD.'));
  assert.equal(r.errors.filter(issue => ['smooth','delay','lag'].includes(issue.entityId)).length, 0);
});

test('all five statistical distributions have explicit strict unit rules', () => {
  const r = report([
    { id: 'money', name: 'Money', type: 'Variable', units: 'USD', equation: '10' },
    { id: 'money2', name: 'Money 2', type: 'Variable', units: 'USD', equation: '20' },
    { id: 'u', name: 'Uniform', type: 'Variable', units: 'USD', equation: 'RandomUniform([Money],[Money 2],42)' },
    { id: 'n', name: 'Normal', type: 'Variable', units: 'USD', equation: 'RandomNormal([Money],2,42)' },
    { id: 't', name: 'Triangular', type: 'Variable', units: 'USD', equation: 'RandomTriangular([Money],[Money 2],15,42)' },
    { id: 'g', name: 'Gamma', type: 'Variable', units: 'USD', equation: 'RandomGamma(2,[Money],42)' },
    { id: 'b', name: 'Beta', type: 'Variable', units: 'Unitless', equation: 'RandomBeta(2,5,42)' }
  ]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.unknowns, []);
});
