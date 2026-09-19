'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const src = path.join(root, 'OpenSystemDynamics', 'src');
const engine = require(path.join(src, 'systemika-engine.js'));
const models = require(path.join(root, 'validation-models', 'manifest.js'));

function last(values) { return values[values.length - 1]; }

test('permanent validation model set contains 19 openable .ssd fixtures', () => {
  assert.equal(models.length, 19);
  for (const model of models) {
    const file = path.join(root, 'validation-models', model.file);
    assert.equal(fs.existsSync(file), true, `${model.file} should exist`);
    const xml = fs.readFileSync(file, 'utf8');
    assert.match(xml, /^<\?xml[^>]*>\s*<InsightMakerModel>/);
    assert.match(xml, /<root>/);
    assert.match(xml, /<Setting\b/);
    assert.match(xml, /<\/InsightMakerModel>\s*$/);
  }
});

test('all permanent validation model numerical expectations pass', () => {
  for (const model of models) {
    const results = engine.simulate(model.spec);
    const expected = model.expect;
    if (expected.id && expected.final != null) {
      const actual = last(results.value(expected.id));
      assert.ok(Math.abs(actual - expected.final) <= expected.tolerance,
        `${model.title}: expected ${expected.final}, got ${actual}`);
    }
    if (expected.range) {
      for (const actual of results.value(expected.id)) {
        assert.ok(actual >= expected.range[0] && actual <= expected.range[1],
          `${model.title}: ${actual} should lie in [${expected.range[0]}, ${expected.range[1]}]`);
      }
    }
    if (expected.stochastic != null) assert.equal(results.stochastic, expected.stochastic, `${model.title}: stochastic flag`);
    if (expected.conservation) {
      const series = expected.conservation.map(id => results.value(id));
      for (let i = 0; i < results.times.length; i++) {
        const total = series.reduce((sum, values) => sum + values[i], 0);
        assert.ok(Math.abs(total - expected.total) <= expected.tolerance,
          `${model.title}: conservation failed at t=${results.times[i]} (${total})`);
      }
    }
  }
});

test('engine gives explicit arithmetic errors instead of generic non-finite failures', () => {
  assert.throws(() => engine.simulate({
    variables: [{id:'x',name:'X',equation:'1 / 0'}]
  }), /Division by zero/);
  assert.throws(() => engine.simulate({
    variables: [{id:'x',name:'X',equation:'5 mod 0'}]
  }), /Modulo by zero/);
});

test('engine prevents accidental settings that would freeze the UI with millions of integration steps', () => {
  assert.throws(() => engine.compileModel({
    timeStart: 0, timeLength: 100, dt: 0.00001,
    stocks: [{id:'s',name:'S',initial:'0'}]
  }), /integration steps.*Increase the time step or reduce the time length/i);
});

test('browser adapter reports a clear error when simulation settings are absent', () => {
  const old = { primitives: global.primitives, getSetting: global.getSetting };
  global.primitives = () => [];
  global.getSetting = () => null;
  try {
    assert.throws(() => engine.compileCurrentModel(), /missing simulation settings/i);
  } finally {
    global.primitives = old.primitives;
    global.getSetting = old.getSetting;
  }
});

class FakeElement {
  constructor(name, ownerDocument, nodeType=1) {
    this.nodeName = name;
    this.ownerDocument = ownerDocument || this;
    this.nodeType = nodeType;
    this.children = [];
    this.childNodes = this.children;
    this._attrs = new Map();
  }
  setAttribute(name,value) { this._attrs.set(String(name), String(value)); }
  getAttribute(name) { return this._attrs.has(String(name)) ? this._attrs.get(String(name)) : null; }
  appendChild(child) { this.children.push(child); child.ownerDocument = this.nodeType === 9 ? this : this.ownerDocument; return child; }
  cloneNode(deep) {
    const c = new FakeElement(this.nodeName, this.ownerDocument, this.nodeType);
    for (const [k,v] of this._attrs) c.setAttribute(k,v);
    if (deep) for (const ch of this.children) c.appendChild(ch.cloneNode(true));
    return c;
  }
  get attributes() {
    const a = Array.from(this._attrs, ([name,value]) => ({name,value,nodeName:name,nodeValue:value}));
    a.item = i => a[i];
    return a;
  }
}
class FakeDocument extends FakeElement {
  constructor(rootName=null) {
    super('#document', null, 9); this.ownerDocument=this; this.documentElement=null;
    this.implementation = { createDocument: (_ns, name) => new FakeDocument(name) };
    if (rootName) { this.documentElement=this.createElement(rootName); this.appendChild(this.documentElement); }
  }
  createElement(name) { return new FakeElement(name, this); }
}
function serialize(node) {
  if (!node) return '';
  if (node.nodeType === 9) return node.children.map(serialize).join('');
  const attrs = Array.from(node._attrs || [], ([k,v]) => ` ${k}="${String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"`).join('');
  if (!node.children.length) return `<${node.nodeName}${attrs}/>`;
  return `<${node.nodeName}${attrs}>${node.children.map(serialize).join('')}</${node.nodeName}>`;
}
function makePrimitive(doc, type, id, name, extra={}) {
  const value=doc.createElement(type); value.setAttribute('id',id); value.setAttribute('name',name);
  for (const [k,v] of Object.entries(extra)) value.setAttribute(k,v);
  const cell=doc.createElement('mxCell'); cell.setAttribute('parent','1');
  const geom=doc.createElement('mxGeometry'); geom.setAttribute('x','10'); geom.setAttribute('y','20'); geom.setAttribute('width','100'); geom.setAttribute('height','40'); geom.setAttribute('as','geometry');
  cell.appendChild(geom); value.appendChild(cell);
  return {id:String(id), value, getAttribute:n=>value.getAttribute(n)};
}

test('save writer skips incomplete Links and tolerates a Ghost whose source was deleted', () => {
  const code=fs.readFileSync(path.join(src,'makexml.js'),'utf8');
  const doc=new FakeDocument();
  const stock=makePrimitive(doc,'Stock','2','Stock',{InitialValue:'1'});
  const ghost=makePrimitive(doc,'Ghost','3','Ghost',{Source:'999'});
  const hanging=makePrimitive(doc,'Link','4','Link',{}); hanging.source=stock; hanging.target=null;
  const list=[stock,ghost,hanging];
  const ctx={
    document:doc,
    XMLSerializer: class { serializeToString(n){return serialize(n);} },
    saveblePrimitiveTypes:['Stock','Ghost','Link'],
    primitives:()=>list.slice(),
    getType:p=>p.value.nodeName,
    getID:p=>p.id,
    get_object:()=>null,
    findID:id=>list.find(p=>p.id===String(id))||null,
    getEnds:p=>[p.source||null,p.target||null],
    getSourcePosition:()=>[0,0], getTargetPosition:()=>[10,10], getPosition:()=>[10,20],
    console
  };
  vm.createContext(ctx); vm.runInContext(code,ctx);
  const xml=ctx.createModelFileData();
  assert.match(xml, /<Stock\b/);
  assert.match(xml, /<Ghost\b/);
  assert.doesNotMatch(xml, /<Link\b/);
});

test('Link polarity validation fixture persists the polarity attribute in .ssd storage', () => {
  const xml=fs.readFileSync(path.join(root,'validation-models','15-link-polarity.ssd'),'utf8');
  assert.match(xml, /<Link\b[^>]*Polarity="\+"/);
});

test('model loader rejects non-Systemika XML and malformed model roots before editor synchronization', () => {
  const graphCode=fs.readFileSync(path.join(src,'systemika-model-graph.js'),'utf8');
  const invalidDoc=new FakeDocument('html');
  invalidDoc.getElementsByTagName=()=>[];
  const ctx1={console,DOMParser:class{parseFromString(){return invalidDoc;}}};
  vm.createContext(ctx1); vm.runInContext(graphCode,ctx1);
  assert.throws(()=>ctx1.loadXML('<html/>'),/not a Systemika \.ssd model/i);

  const noRootDoc=new FakeDocument('InsightMakerModel');
  noRootDoc.getElementsByTagName=()=>[];
  const ctx2={console,DOMParser:class{parseFromString(){return noRootDoc;}}};
  vm.createContext(ctx2); vm.runInContext(graphCode,ctx2);
  assert.throws(()=>ctx2.loadXML('<InsightMakerModel/>'),/exactly one model root/i);
});

test('model normalization repairs a missing Setting node with current Systemika defaults', () => {
  const graphCode=fs.readFileSync(path.join(src,'systemika-model-graph.js'),'utf8');
  const doc=new FakeDocument();
  const stockEl=doc.createElement('Stock'); stockEl.setAttribute('id','2'); stockEl.setAttribute('name','Stock');
  const rootNode={children:[]};
  const ctx={console}; vm.createContext(ctx); vm.runInContext(graphCode,ctx);
  const StockNode=vm.runInContext('SystemikaNode',ctx);
  const stock=new StockNode(stockEl,rootNode); stock.id='2'; rootNode.children.push(stock);
  const settingTemplate=doc.createElement('Setting');
  settingTemplate.setAttribute('Version','36'); settingTemplate.setAttribute('TimeStart','0');
  settingTemplate.setAttribute('TimeLength','100'); settingTemplate.setAttribute('TimeStep','1');
  settingTemplate.setAttribute('SolutionAlgorithm','RK1');
  ctx.primitiveBank={setting:settingTemplate};
  ctx.systemikaRootContainer=()=>rootNode;
  ctx.clearPrimitiveCache=()=>{};
  ctx.primitives=(type)=>rootNode.children.filter(item=>!type || (item.value && item.value.nodeName===type));
  ctx.getSetting=()=>ctx.primitives('Setting')[0]||null;
  ctx.changeNodeName=(node,name)=>{const out=doc.createElement(name); for(const a of node.attributes) out.setAttribute(a.name,a.value); return out;};
  ctx.systemikaNormalizeLoadedModel();
  const setting=ctx.getSetting();
  assert.ok(setting,'missing Setting should be repaired');
  assert.equal(setting.getAttribute('Version'),'36');
  assert.equal(setting.getAttribute('TimeLength'),'100');
  assert.equal(setting.getAttribute('TimeStep'),'1');
  assert.equal(setting.getAttribute('SolutionAlgorithm'),'RK1');
});

test('model normalization removes legacy positive-only flow restriction', () => {
  const graphCode=fs.readFileSync(path.join(src,'systemika-model-graph.js'),'utf8');
  const doc=new FakeDocument();
  const flowEl=doc.createElement('Flow'); flowEl.setAttribute('id','7'); flowEl.setAttribute('name','Flow'); flowEl.setAttribute('OnlyPositive','true');
  const settingEl=doc.createElement('Setting'); settingEl.setAttribute('id','9'); settingEl.setAttribute('Version','36');
  const rootNode={children:[]};
  const ctx={console}; vm.createContext(ctx); vm.runInContext(graphCode,ctx);
  const SystemikaNode=vm.runInContext('SystemikaNode',ctx);
  const flow=new SystemikaNode(flowEl,rootNode); flow.id='7';
  const setting=new SystemikaNode(settingEl,rootNode); setting.id='9';
  rootNode.children.push(flow,setting);
  const settingTemplate=doc.createElement('Setting'); settingTemplate.setAttribute('Version','36');
  ctx.primitiveBank={setting:settingTemplate};
  ctx.primitives=(type)=>rootNode.children.filter(item=>!type || (item.value && item.value.nodeName===type));
  ctx.getSetting=()=>setting;
  ctx.changeNodeName=(node,name)=>node;
  ctx.systemikaNormalizeLoadedModel();
  assert.equal(flow.getAttribute('OnlyPositive'),'false');
});

test('save writer preserves all seven canonical model entities and their critical attributes', () => {
  const code=fs.readFileSync(path.join(src,'makexml.js'),'utf8');
  const doc=new FakeDocument();
  const stock=makePrimitive(doc,'Stock','2','Population',{InitialValue:'100',NonNegative:'true'});
  const aux=makePrimitive(doc,'Variable','3','Birth Rate',{Equation:'0.03',isConstant:'false'});
  const constant=makePrimitive(doc,'Variable','4','Capacity',{Equation:'1000',isConstant:'true'});
  const lookup=makePrimitive(doc,'Converter','5','Response',{Data:'0,0;1,10',Source:'3',Interpolation:'Linear'});
  const ghost=makePrimitive(doc,'Ghost','6','Population Ghost',{Source:'2'});
  const flow=makePrimitive(doc,'Flow','7','Births',{FlowRate:'[Population] * [Birth Rate]',OnlyPositive:'false'}); flow.source=null; flow.target=stock;
  const link=makePrimitive(doc,'Link','8','Link',{Polarity:'+'}); link.source=aux; link.target=lookup;
  const setting=makePrimitive(doc,'Setting','9','Setting',{TimeStart:'0',TimeLength:'20',TimeStep:'0.25',SolutionAlgorithm:'RK4'});
  const list=[stock,aux,constant,lookup,ghost,flow,link,setting];
  const ctx={
    document:doc,
    XMLSerializer: class { serializeToString(n){return serialize(n);} },
    saveblePrimitiveTypes:['Stock','Variable','Converter','Ghost','Flow','Link','Setting'],
    primitives:()=>list.slice(),
    getType:p=>p.value.nodeName, getID:p=>p.id, get_object:()=>null,
    findID:id=>list.find(p=>p.id===String(id))||null,
    getEnds:p=>[p.source||null,p.target||null],
    getSourcePosition:()=>[1,2], getTargetPosition:()=>[3,4], getPosition:()=>[10,20],
    console
  };
  vm.createContext(ctx); vm.runInContext(code,ctx);
  const xml=ctx.createModelFileData();
  assert.match(xml, /<Stock\b[^>]*name="Population"[^>]*InitialValue="100"/);
  assert.match(xml, /<Variable\b[^>]*name="Birth Rate"[^>]*Equation="0\.03"[^>]*isConstant="false"/);
  assert.match(xml, /<Variable\b[^>]*name="Capacity"[^>]*Equation="1000"[^>]*isConstant="true"/);
  assert.match(xml, /<Converter\b[^>]*name="Response"[^>]*Data="0,0;1,10"[^>]*Source="3"[^>]*Interpolation="Linear"/);
  assert.match(xml, /<Ghost\b[^>]*Source="2"/);
  assert.match(xml, /<Flow\b[^>]*FlowRate="\[Population\] \* \[Birth Rate\]"[^>]*OnlyPositive="false"/);
  assert.match(xml, /<mxCell\b[^>]*target="2"[^>]*edge="1"|<mxCell\b[^>]*edge="1"[^>]*target="2"/);
  assert.match(xml, /<Link\b[^>]*Polarity="\+"/);
  assert.match(xml, /<mxCell\b[^>]*source="3"[^>]*target="5"|<mxCell\b[^>]*target="5"[^>]*source="3"/);
  assert.match(xml, /<Setting\b[^>]*TimeLength="20"[^>]*TimeStep="0\.25"[^>]*SolutionAlgorithm="RK4"/);
});
