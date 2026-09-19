'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const src = path.join(root, 'OpenSystemDynamics', 'src');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const utilsCode = fs.readFileSync(path.join(src, 'systemika-model-utils.js'), 'utf8');
const apiCode = fs.readFileSync(path.join(src, 'systemika-model-api.js'), 'utf8');

class FakeElement {
  constructor(name, ownerDocument) {
    this.nodeName = name;
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.childNodes = this.children;
    this._attrs = new Map();
  }
  setAttribute(name, value) { this._attrs.set(String(name), String(value)); }
  getAttribute(name) { return this._attrs.has(String(name)) ? this._attrs.get(String(name)) : null; }
  removeAttribute(name) { this._attrs.delete(String(name)); }
  appendChild(child) { this.children.push(child); child.ownerDocument = this.ownerDocument; return child; }
  cloneNode(deep) {
    const copy = new FakeElement(this.nodeName, this.ownerDocument);
    for (const [k,v] of this._attrs) copy.setAttribute(k,v);
    if (deep) for (const child of this.children) copy.appendChild(child.cloneNode(true));
    return copy;
  }
  get attributes() {
    const arr = Array.from(this._attrs, ([name,value]) => ({name, value, nodeName:name, nodeValue:value}));
    arr.item = i => arr[i];
    arr.getNamedItem = name => this._attrs.has(name) ? ({name, value:this._attrs.get(name)}) : null;
    return arr;
  }
}
class FakeDocument {
  createElement(name) { return new FakeElement(name, this); }
}
class SimpleNode {
  constructor(value, parent=null) { this.value=value; this.parent=parent; this.parentNode=parent; this.children=[]; this.id=null; this.attributeSubscribers=[]; this.positionSubscribers=[]; }
  getAttribute(name) { return this.value.getAttribute(name); }
  setAttribute(name,value) { this.value.setAttribute(name,value); this.id=this.value.getAttribute('id'); }
  positionUpdate() { for (const fn of this.positionSubscribers) fn(); }
  subscribePosition(fn) { this.positionSubscribers.push(fn); }
  subscribeAttribute(fn) { this.attributeSubscribers.push(fn); }
}

function makeContext() {
  const document = new FakeDocument();
  const ctx = {
    console, document, window: { prompt(){}, confirm(){return true;} }, Blob: class {}, URL: {createObjectURL(){return 'blob:';}, revokeObjectURL(){}},
    setTimeout(fn){ if (typeof fn === 'function') fn(); }, SimpleNode,
    defaultPrimitiveCreatedHandler(){}, defaultPrimitiveBeforeDestroyHandler(){},
    setAttributeUndoable(item,name,value){ item.setAttribute(name,value); },
    propogateGhosts(){},
  };
  vm.createContext(ctx);
  vm.runInContext(utilsCode, ctx);
  vm.runInContext(apiCode, ctx);

  const makeTemplate = (name, attrs={}) => { const e=document.createElement(name); for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v); return e; };
  ctx.primitiveBank = {
    stock: makeTemplate('Stock', {InitialValue:'', Units:'Unitless'}),
    flow: makeTemplate('Flow', {FlowRate:'', Units:'Unitless'}),
    link: makeTemplate('Link', {BiDirectional:'false', Polarity:''}),
    variable: makeTemplate('Variable', {Equation:'', isConstant:'false', Units:'Unitless'}),
    converter: makeTemplate('Converter', {Data:'', Source:'Time', Interpolation:'Linear', Units:'Unitless'})
  };
  let nextId=2;
  ctx.simpleCloneNode = function(template,parent){ const n=new SimpleNode(template.cloneNode(true),parent); n.setAttribute('id', String(++nextId)); return n; };
  const graphDoc = document.createElement('mxGraphModel');
  const root = new SimpleNode(document.createElement('root'));
  const container = new SimpleNode(document.createElement('mxCell'), root);
  root.children=[container]; container.children=[];
  ctx.graph = new SimpleNode(graphDoc); ctx.graph.children=[root];
  const setting = new SimpleNode(makeTemplate('Setting',{id:'2',TimeStep:'0.25',TimeStart:'0',TimeLength:'100',AdvanceBy:'1',SolutionAlgorithm:'RK1',TimeUnits:'Year'}), container); setting.id='2';
  container.children.push(setting);
  return {ctx, container};
}

test('0.5 startup replaces inherited Utilities/API files with Systemika-owned model layer', () => {
  assert.match(html, /src="systemika-model-utils\.js"/);
  assert.match(html, /src="systemika-model-api\.js"/);
  assert.doesNotMatch(html, /insightmaker\/Utilities\.js/);
  assert.doesNotMatch(html, /insightmaker\/API\/API\.js/);
  assert.equal(fs.existsSync(path.join(src,'insightmaker','Utilities.js')), false);
  assert.equal(fs.existsSync(path.join(src,'insightmaker','API','API.js')), false);
});

test('canonical Auxiliary Constant and Lookup queries map to legacy .ssd storage tags', () => {
  const {ctx} = makeContext();
  const a=ctx.createPrimitive('A','Auxiliary',[0,0],[20,20]);
  const c=ctx.createPrimitive('C','Constant',[20,0],[20,20]);
  const l=ctx.createPrimitive('L','Lookup',[40,0],[20,20]);
  assert.equal(a.value.nodeName,'Variable'); assert.equal(a.getAttribute('isConstant'),'false');
  assert.equal(c.value.nodeName,'Variable'); assert.equal(c.getAttribute('isConstant'),'true');
  assert.equal(l.value.nodeName,'Converter');
  assert.deepEqual(Array.from(ctx.primitives('Auxiliary')).map(x=>x.id), [a.id]);
  assert.deepEqual(Array.from(ctx.primitives('Constant')).map(x=>x.id), [c.id]);
  assert.deepEqual(Array.from(ctx.primitives('Lookup')).map(x=>x.id), [l.id]);
});

test('model API creates and connects links without allowing storage/API terminology to leak', () => {
  const {ctx} = makeContext();
  const source=ctx.createPrimitive('Source','Auxiliary',[0,0],[20,20]);
  const lookup=ctx.createPrimitive('Table','Lookup',[100,0],[20,20]);
  const link=ctx.createConnector('Link1','Link',source,lookup);
  assert.equal(ctx.getEnds(link)[0], source);
  assert.equal(ctx.getEnds(link)[1], lookup);
  assert.equal(link.value.children[0].getAttribute('source'), source.id);
  assert.equal(link.value.children[0].getAttribute('target'), lookup.id);
  assert.equal(ctx.connected(source,lookup), true);
  ctx.setTarget(link,null);
  assert.equal(ctx.getEnds(link)[1], null);
  assert.equal(link.value.children[0].getAttribute('target'), null);
});

test('simulation settings are owned by the Systemika model API', () => {
  const {ctx}=makeContext();
  assert.equal(ctx.getTimeStep(),0.25);
  assert.equal(ctx.getAdvanceBy(),1);
  ctx.setAdvanceBy(3); assert.equal(ctx.getAdvanceBy(),3);
  ctx.setAlgorithm('RK4'); assert.equal(ctx.getAlgorithm(),'RK4');
  assert.throws(()=>ctx.setAdvanceBy(0), /greater than or equal to 1/);
  assert.throws(()=>ctx.setAlgorithm('RK2'), /RK1 \(Euler\) and RK4/);
});

test('connector endpoint writes do not emit premature position updates', () => {
  const {ctx} = makeContext();
  const source=ctx.createPrimitive('Source','Auxiliary',[0,0],[20,20]);
  const target=ctx.createPrimitive('Target','Auxiliary',[100,0],[20,20]);
  const link=ctx.createConnector('Link1','Link',source,target);
  let updates=0;
  link.subscribePosition(()=>{ updates++; });
  ctx.setSourcePosition(link,[10,20]);
  ctx.setTargetPosition(link,[90,20]);
  assert.equal(updates,0, 'low-level endpoint writes must not notify while a connector is being assembled');
  ctx.setPosition(link,[60,30]);
  assert.equal(updates,1, 'whole-connector movement must emit exactly one position update');
});

test('editor contains no blocking connector-position debug alert', () => {
  const editorCode = fs.readFileSync(path.join(src, 'editor.js'), 'utf8');
  assert.doesNotMatch(editorCode, /alert\(["']Position got updated["']\)/);
});
