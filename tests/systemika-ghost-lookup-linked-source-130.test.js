'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const editor = fs.readFileSync('OpenSystemDynamics/src/editor.js', 'utf8');
const modelGraph = fs.readFileSync('OpenSystemDynamics/src/systemika-model-graph.js', 'utf8');
const api = fs.readFileSync('OpenSystemDynamics/src/newAPI.js', 'utf8');

function snippet(src, start, end) {
  const from = src.indexOf(start);
  const to = src.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `cannot extract ${start}`);
  return src.slice(from, to);
}

// This is the causal sequence that corrupted models in RC5: attaching the
// start of an information Link triggers attachEvent on the source visual.
test('connecting an outgoing Link never changes a Lookup Ghost Source', () => {
  const converter = snippet(editor, 'class ConverterVisual extends BasePrimitive', 'class TwoPointer extends BaseObject');
  const attachEvent = converter.match(/\tattachEvent\(\) \{[\s\S]*?\n\t\}\n\tnameDoubleClick\(/);
  assert.ok(attachEvent);
  let calls = 0;
  const ctx = {
    obj: {
      id: 'ghost-12', is_ghost: true,
      primitive: {value: {nodeName: 'Ghost'}, setAttribute: () => { throw Error('Ghost Source overwritten'); }}
    },
    getType: p => p.value.nodeName,
    findLinkedInPrimitives: () => { calls++; return []; },
    orig: x => x
  };
  vm.createContext(ctx);
  const body = attachEvent[0].replace(/^\tattachEvent\(\) \{/, '').replace(/\n\t\}\n\tnameDoubleClick\($/, '');
  vm.runInContext(`(function(){${body}}).call(obj)`, ctx);
  assert.equal(calls, 0, 'Ghost must never run numeric Lookup input resolution');

  let value = 'uninitialized';
  const realCtx = {
    obj: {id:'lookup-1', is_ghost:false, primitive:{value:{nodeName:'Converter'},setAttribute: (key,v)=>{assert.equal(key,'Source');value=v;}}},
    getType: p => p.value.nodeName,
    findLinkedInPrimitives: () => [],
    orig: x => x
  };
  vm.createContext(realCtx);
  vm.runInContext(`(function(){${body}}).call(obj)`, realCtx);
  assert.equal(value, 'Time', 'a real Lookup must still default to Time without an incoming Link');
});

test('legacy Ghosts with damaged Source are recovered only from a unique original variable name', () => {
  const modelCode = snippet(modelGraph, 'function systemikaNormalizeLoadedModel()', 'function loadXML(');
  assert.match(modelCode, /ghost\.value\.setAttribute\("Source", String\(source\.id\)\)/);
  assert.match(modelCode, /matches\.length === 1/);
  const entity = (type, id, name, source = null) => {
    const attrs = {id,name,...(source == null ? {} : {Source:source})};
    return {id,value:{nodeName:type,setAttribute(k,v){attrs[k]=v;}},getAttribute:k=>attrs[k]??null};
  };
  const original = entity('Converter','10','DrugDeaths');
  const ghost = entity('Ghost','11','DrugDeaths','Time');
  const ctx = {
    console, getSetting:()=>({value:{nodeName:'Setting',setAttribute:()=>{}},getAttribute:()=>null}),
    primitiveBank: {setting:{attributes:[]}},
    primitives: kind => !kind ? [original,ghost] : kind === 'Ghost' ? [ghost] : kind === 'Converter' ? [original] : [],
    findID: id => [original,ghost].find(v=>v.id===String(id)) || null
  };
  vm.createContext(ctx);
  vm.runInContext(modelCode,ctx);
  vm.runInContext('systemikaNormalizeLoadedModel()',ctx);
  assert.equal(ghost.getAttribute('Source'),'10');
  assert.equal(ghost.getAttribute('name'),'DrugDeaths');
});

test('unknown Ghost original is not guessed from unrelated names or deleted during repair', () => {
  assert.match(editor, /An orphaned Ghost must not crash model loading or be deleted/);
  assert.match(editor, /Systemika: retaining an unrenderable Link/);
  assert.match(editor, /Their saved records and links have been preserved, not deleted/);
  assert.match(api, /item = orig\(item\);/);
});
