'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const src = path.join(root, 'OpenSystemDynamics', 'src');
const graphCode = fs.readFileSync(path.join(src, 'systemika-model-graph.js'), 'utf8');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');

class FakeElement {
  constructor(name, ownerDocument, nodeType=1) {
    this.nodeName = name;
    this.ownerDocument = ownerDocument || this;
    this.nodeType = nodeType;
    this.children = [];
    this.childNodes = this.children;
    this._attrs = new Map();
  }
  setAttribute(name, value) { this._attrs.set(String(name), String(value)); }
  getAttribute(name) { return this._attrs.has(String(name)) ? this._attrs.get(String(name)) : null; }
  removeAttribute(name) { this._attrs.delete(String(name)); }
  appendChild(child) { this.children.push(child); child.ownerDocument = this.nodeType === 9 ? this : this.ownerDocument; return child; }
  cloneNode(deep) {
    const copy = new FakeElement(this.nodeName, this.ownerDocument, this.nodeType);
    for (const [k,v] of this._attrs) copy.setAttribute(k,v);
    if (deep) for (const child of this.children) copy.appendChild(child.cloneNode(true));
    return copy;
  }
  get attributes() {
    const arr = Array.from(this._attrs, ([name,value]) => ({name, value, nodeName:name, nodeValue:value}));
    arr.item = i => arr[i];
    return arr;
  }
}

function element(doc, name, attrs={}) {
  const e = new FakeElement(name, doc);
  for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
  return e;
}

function geometryCell(doc, attrs={}) {
  const cell = element(doc, 'mxCell', attrs);
  cell.appendChild(element(doc, 'mxGeometry', {x:'0',y:'0',width:'20',height:'20',as:'geometry'}));
  return cell;
}

function makeContext() {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(graphCode, ctx);
  ctx.SystemikaNodeCtor = vm.runInContext('SystemikaNode', ctx);
  return ctx;
}

test('0.6 startup uses the Systemika model graph and removes all inherited insightmaker source files', () => {
  assert.match(html, /src="systemika-model-graph\.js"/);
  assert.doesNotMatch(html, /insightmaker\//);
  assert.equal(fs.existsSync(path.join(src, 'insightmaker')), false);
  assert.equal(fs.existsSync(path.join(src, 'systemika-model-graph.js')), true);
});

test('Systemika graph reconstructs Link endpoints and strips mxCell wrappers', () => {
  const ctx = makeContext();
  const doc = new FakeElement('#document', null, 9); doc.ownerDocument = doc;
  const model = element(doc, 'mxGraphModel');
  const rootEl = element(doc, 'root');
  model.appendChild(rootEl); doc.appendChild(model);
  rootEl.appendChild(element(doc, 'mxCell', {id:'0'}));
  rootEl.appendChild(element(doc, 'mxCell', {id:'1', parent:'0'}));
  const a = element(doc, 'Variable', {id:'2', name:'A', isConstant:'false'}); a.appendChild(geometryCell(doc,{parent:'1',vertex:'1'}));
  const b = element(doc, 'Converter', {id:'3', name:'L'}); b.appendChild(geometryCell(doc,{parent:'1',vertex:'1'}));
  const link = element(doc, 'Link', {id:'4', name:'Link'}); link.appendChild(geometryCell(doc,{parent:'1',edge:'1',source:'2',target:'3'}));
  rootEl.appendChild(a); rootEl.appendChild(b); rootEl.appendChild(link);

  const graph = ctx.systemikaWrapXmlNode(doc, null);
  ctx.systemikaResolveLoadedStructure(graph);
  const container = graph.children[0].children[0];
  const wrappedA = container.children.find(x => x.id === '2');
  const wrappedB = container.children.find(x => x.id === '3');
  const wrappedLink = container.children.find(x => x.id === '4');
  assert.equal(wrappedLink.source, wrappedA);
  assert.equal(wrappedLink.target, wrappedB);
  assert.equal(wrappedLink.children.some(x => x.value && x.value.nodeName === 'mxCell'), false);
});

test('Systemika graph cloning allocates a fresh id and appends clipboard clones exactly once', () => {
  const ctx = makeContext();
  const doc = new FakeElement('#document', null, 9); doc.ownerDocument = doc;
  const template = element(doc, 'Stock', {name:'Stock'});
  const parent = new ctx.SystemikaNodeCtor(element(doc,'root'));
  const existing = new ctx.SystemikaNodeCtor(element(doc,'Stock',{id:'7'}), parent); existing.id='7'; parent.children.push(existing);
  ctx.primitives = () => [existing];
  const clone = ctx.simpleCloneNode2({value:template}, parent);
  assert.equal(clone.id, '8');
  assert.equal(parent.children.filter(x => x === clone).length, 1);
});

test('Systemika model normalization converts legacy Parameter and Lookup table storage', () => {
  const ctx = makeContext();
  const doc = new FakeElement('#document', null, 9); doc.ownerDocument = doc;
  const parameter = new ctx.SystemikaNodeCtor(element(doc,'Parameter',{id:'2',name:'A'})); parameter.id='2';
  const lookup = new ctx.SystemikaNodeCtor(element(doc,'Converter',{id:'3',name:'L',Inputs:'0,1',Outputs:'10,20'})); lookup.id='3';
  const setting = new ctx.SystemikaNodeCtor(element(doc,'Setting',{id:'4',TimeStep:'1'})); setting.id='4';
  const items=[parameter,lookup,setting];
  ctx.primitives = type => !type ? items : items.filter(x => x.value.nodeName === type);
  ctx.getSetting = () => setting;
  ctx.changeNodeName = (node,newName) => { const out=element(doc,newName); for(const a of node.attributes) out.setAttribute(a.name,a.value); return out; };
  const settingTemplate = element(doc,'Setting',{Version:'36',TimeLength:'100',SolutionAlgorithm:'RK1'});
  ctx.primitiveBank = {setting:settingTemplate};
  ctx.systemikaNormalizeLoadedModel();
  assert.equal(parameter.value.nodeName,'Variable');
  assert.equal(parameter.getAttribute('isConstant'),'false');
  assert.equal(lookup.getAttribute('Data'),'0,10;1,20');
  assert.equal(lookup.getAttribute('Source'),'Time');
  assert.equal(lookup.getAttribute('Interpolation'),'Linear');
  assert.equal(setting.getAttribute('Version'),'36');
  assert.equal(setting.getAttribute('TimeLength'),'100');
});

test('legacy sanitizer/updater code and Insight Maker license headers are absent from active source code', () => {
  const jsFiles = fs.readdirSync(src).filter(name => name.endsWith('.js'));
  const combined = jsFiles.map(name => fs.readFileSync(path.join(src,name),'utf8')).join('\n');
  assert.doesNotMatch(combined, /Insight Maker Public License/);
  assert.doesNotMatch(combined, /alert\(["']in update model["']\)/);
  assert.doesNotMatch(html, /Sanitize\.js|Updater\.js|mxShim\.js/);
});
