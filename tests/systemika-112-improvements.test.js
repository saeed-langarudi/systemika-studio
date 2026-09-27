'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const editor = read('OpenSystemDynamics/src/editor.js');
const html = read('OpenSystemDynamics/src/index.html');
const calibration = read('OpenSystemDynamics/src/systemika-calibration-sandbox.js');
const api = read('OpenSystemDynamics/src/newAPI.js');
const update = read('OpenSystemDynamics/src/systemika-update.js');
const css = read('OpenSystemDynamics/src/style/editor.css');

function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
}

function sourceBetween(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(a, -1, `missing ${start}`);
  assert.notEqual(b, -1, `missing ${end}`);
  return source.slice(a, b);
}

test('update checker is available at startup and from Help', () => {
  assert.match(html, /systemika-update\.js/);
  assert.match(html, /id="btn_check_updates">Check for Updates\.\.\.<\/button>/);
  assert.match(update, /systemika\.no\/studio\/app\//);
  assert.match(read('electron/main.js'), /systemika\.no\/studio\/app\//);
  assert.match(read('electron/main.js'), /MultiSimulationAnalyser\/index\.html/);
  assert.doesNotMatch(read('electron/main.js'), /systemika\.no\/studio\/webapp\//);
  assert.match(update, /setTimeout\(\(\) => \{ void checkForUpdates\(\{ manual: false \}\); \}, 1200\)/);
  assert.match(read('electron/preload.js'), /checkForUpdates: \(\) => ipcRenderer\.invoke\("systemika:update:check"\)/);
  assert.match(read('electron/main.js'), /ipcMain\.handle\("systemika:update:check"/);
});

test('version comparator handles patch and multi-digit releases', () => {
  const context = {
    window: {
      systemika: { version: '2.3.4' },
      location: { href: 'https://systemika.no/studio/OpenSystemDynamics/src/index.html' },
      document: { readyState: 'loading', addEventListener: () => {} },
      setTimeout: () => 0,
      console,
    },
    URL,
  };
  vm.createContext(context);
  vm.runInContext(update, context);
  assert.equal(context.window.SystemikaUpdate.compareVersions('1.1.10', '1.1.9'), 1);
  assert.equal(context.window.SystemikaUpdate.compareVersions('2.3.4', '2.3.4'), 0);
  assert.equal(context.window.SystemikaUpdate.compareVersions('1.2.0', '1.10.0'), -1);
});

test('web/desktop build emits canonical WebApp-root release metadata from the central version', () => {
  const build = read('build/build.js');
  assert.match(build, /path\.join\(dest, 'systemika-update\.json'\)/);
  assert.doesNotMatch(build, /path\.join\(OUTPUT, 'release-metadata'\)/);
  assert.match(build, /PUBLIC_WEBAPP_ROOT = 'https:\/\/systemika\.no\/studio\/app\/'/);
  assert.match(build, /SYSTEMIKA_BUILD_INFO\.json/);
  assert.match(build, /JSON\.stringify\(\{ version, buildId, downloadUrl: UPDATE_DOWNLOAD_URL \}/);
  assert.match(read('.htaccess'), /svg\|png/);
  const manifest = JSON.parse(read('update.json'));
  assert.equal(manifest.version, '1.1.2');
});

test('Calibration Save as Default gives visible saved state and becomes dirty on slider edits', () => {
  assert.match(calibration, /id="save-default" disabled>Save as Default/);
  assert.match(calibration, /id="save-default-status"[\s\S]*aria-live="polite"/);
  assert.match(calibration, /Changes have been saved as the default parameter values\./);
  assert.match(calibration, /button\.textContent='Saved'/);
  assert.match(calibration, /slider\.oninput=[\s\S]*updateSaveDefaultState\(true\)/);
});

test('variable-name validation uses the immediate input event', () => {
  assert.match(editor, /find\("\.name-field"\)\.on\("input", \(event\) =>/);
  assert.doesNotMatch(editor, /find\("\.name-field"\)\.keyup\(\(event\) =>/);
  assert.match(editor, /let rawName = String\(\$\(event\.target\)\.val\(\) \?\? ""\);/);
  assert.match(editor, /let containsWhitespace = \/\\s\/\.test\(rawName\);/);
  assert.match(editor, /let validToolVarName = !containsWhitespace && isValidToolName\(newName\);/);
});

test('Auxiliary names receive the same translucent top-layer background as Stock names', () => {
  assert.match(editor, /\(this\.type === "stock" \|\| this\.type === "variable"\)[\s\S]*name_background_element/);
  assert.match(editor, /"fill-opacity": "0\.72"/);
  assert.match(editor, /this\.type === "variable" && typeof this\.getRadius === "function"/);
  assert.match(editor, /const auxiliaryOuterRadius = this\.getRadius\(\) \+ outlineStrokeWidth \/ 2 \+ 1;/);
});

test('renaming any named model entity updates references in every equation-bearing entity', () => {
  const snippet = sourceBetween(api, 'function replaceName(definition, oldName, newName)', 'function removeSpacesAtEnd');
  function primitive(type, attrs) {
    return {
      value: { nodeName: type },
      getAttribute(name) { return attrs[name] || ''; },
      setAttribute(name, value) { attrs[name] = value; },
    };
  }
  function valueAttribute(p) {
    return p.value.nodeName === 'Stock' ? 'InitialValue' :
      p.value.nodeName === 'Flow' ? 'FlowRate' :
      p.value.nodeName === 'Variable' ? 'Equation' : 'Data';
  }
  const attrs = {
    stock: { InitialValue: 'stock_a + FLOW_A + auxiliary_a + CONSTANT_A + lookup_a' },
    flow: { FlowRate: 'Stock_A + flow_a + Auxiliary_A + constant_a + Lookup_A' },
    auxiliary: { Equation: '[STOCK_A] + [flow_a] + AUXILIARY_A + Constant_A + lookup_a' },
    constant: { Equation: 'Stock_A + Flow_A + Auxiliary_A + Constant_A + Lookup_A' },
    multiline: { Equation: 'Stock_A # Stock_A in comment\\nflow_a + constant_a' },
    lookup: { Data: '0,0;1,1' },
  };
  const items = [
    primitive('Stock', attrs.stock),
    primitive('Flow', attrs.flow),
    primitive('Variable', attrs.auxiliary),
    primitive('Variable', attrs.constant),
    primitive('Variable', attrs.multiline),
    primitive('Converter', attrs.lookup),
  ];
  const context = {
    findAll: () => items,
    getValue(p) { return String(p.getAttribute(valueAttribute(p)) || '').replace(/\\n/g, '\n'); },
    setValue(p, value) { p.setAttribute(valueAttribute(p), String(value).replace(/\n/g, '\\n')); },
    DefinitionError: { check: () => {} },
  };
  vm.createContext(context);
  vm.runInContext(snippet, context);

  const renames = [
    ['Stock_A', 'Stock_B'],
    ['Flow_A', 'Flow_B'],
    ['Auxiliary_A', 'Auxiliary_B'],
    ['Constant_A', 'Constant_B'],
    ['Lookup_A', 'Lookup_B'],
  ];
  for (const [oldName, newName] of renames) {
    context.changeReferencesToName('source-id', oldName, newName);
  }

  assert.equal(attrs.stock.InitialValue, 'Stock_B + Flow_B + Auxiliary_B + Constant_B + Lookup_B');
  assert.equal(attrs.flow.FlowRate, 'Stock_B + Flow_B + Auxiliary_B + Constant_B + Lookup_B');
  assert.equal(attrs.auxiliary.Equation, 'Stock_B + Flow_B + Auxiliary_B + Constant_B + Lookup_B');
  assert.equal(attrs.constant.Equation, 'Stock_B + Flow_B + Auxiliary_B + Constant_B + Lookup_B');
  assert.equal(attrs.multiline.Equation, 'Stock_B # Stock_A in comment\\nFlow_B + Constant_B');
  assert.equal(attrs.lookup.Data, '0,0;1,1');
});

test('rename replacement is identifier-safe, case-insensitive, and leaves comments untouched', () => {
  const snippet = sourceBetween(api, 'function replaceName(definition, oldName, newName)', '/**\n * Changes names of all references');
  const context = {};
  vm.createContext(context);
  vm.runInContext(snippet, context);
  const input = 'myconstant + MYCONSTANT + MyConstantExtra + [myconstant] # MyConstant';
  assert.equal(
    context.replaceName(input, 'MyConstant', 'RenamedConstant'),
    'RenamedConstant + RenamedConstant + MyConstantExtra + RenamedConstant # MyConstant'
  );
});

test('toolbar artwork is installed and disabled tooltips stay fully readable', () => {
  assert.equal(sha256('OpenSystemDynamics/src/graphics/link.svg'), '9b04e6a0c886e7735676c0be5a17fce9ac2753b8471c1b13b3edabe65f82a73c');
  const linkSvg = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/graphics/link.svg'), 'utf8');
  assert.doesNotMatch(linkSvg, /light-dark\s*\(/i);
  assert.doesNotMatch(linkSvg, /color-scheme:\s*light\s+dark/i);
  assert.match(linkSvg, /color-scheme:\s*light/i);
  assert.equal(sha256('OpenSystemDynamics/src/graphics/find.svg'), '0fe55a98de91171ccc010cf7f9ae43441e8d21a7c5b53ea9777b91f602fdf237');
  assert.match(html, /id="btn_link"[\s\S]*graphics\/link\.svg/);
  assert.match(html, /id="btn_find_variable"[\s\S]*graphics\/find\.svg/);
  assert.match(css, /\.tool-panel button\.tool-button:disabled \{\s*opacity: 1;/);
  assert.match(css, /button\.tool-button:disabled > (?:img|svg)[\s\S]*opacity: 0\.5/);
  assert.match(css, /\[data-title\]:hover::after[\s\S]*background-color: var\(--color-text-primary\)/);
});

test('WebApp update check derives its root from the running page and does not guess a public /studio path', async () => {
  const requests = [];
  const context = {
    window: {
      systemika: { version: '1.1.2' },
      location: { href: 'https://systemika.no/anything/nested/OpenSystemDynamics/src/index.html?v=1.1.2&b=oldbuild12345' },
      document: { readyState: 'loading', addEventListener: () => {}, getElementById: () => null, querySelector: () => null },
      setTimeout: () => 0,
      console,
      confirm: () => false,
      alert: () => {},
      fetch: async (url) => {
        requests.push(String(url));
        return {
          ok: true,
          status: 200,
          text: async () => '<html><head><meta name="systemika-version" content="1.1.3"><meta name="systemika-build" content="abcdef123456"></head></html>'
        };
      },
    },
    URL,
    decodeURIComponent,
  };
  vm.createContext(context);
  vm.runInContext(update, context);
  assert.equal(context.window.SystemikaUpdate.currentDeploymentRoot(), 'https://systemika.no/anything/nested/');
  const result = await context.window.SystemikaUpdate.checkForUpdates({ manual: false });
  assert.equal(result.updateAvailable, true);
  assert.equal(result.latest, '1.1.3');
  assert.equal(requests.length, 1);
  assert.match(requests[0], /\/anything\/nested\/OpenSystemDynamics\/src\/index\.html\?_/);
  assert.doesNotMatch(requests.join('\n'), /\/studio\/webapp\//);
});



test('confirmed production analyser URL resolves to the canonical /studio/app/ WebApp root', () => {
  const context = {
    window: {
      systemika: { version: '1.1.2' },
      location: { href: 'https://systemika.no/studio/app/MultiSimulationAnalyser/index.html?v=1.1.2&b=05561d33976b#' },
      document: { readyState: 'loading', addEventListener: () => {}, getElementById: () => null, querySelector: () => null },
      setTimeout: () => 0,
      console,
    },
    URL,
    decodeURIComponent,
  };
  vm.createContext(context);
  vm.runInContext(update, context);
  assert.equal(context.window.SystemikaUpdate.currentDeploymentRoot(), 'https://systemika.no/studio/app/');
  assert.equal(context.window.SystemikaUpdate.CANONICAL_WEBAPP_ROOT, 'https://systemika.no/studio/app/');
});

test('manual update failure is concise while detailed probe diagnostics stay out of the alert', async () => {
  let alertText = '';
  const warnings = [];
  const context = {
    window: {
      systemika: { version: '1.1.2' },
      location: { href: 'https://mirror.example/app/OpenSystemDynamics/src/index.html?v=1.1.2' },
      document: { readyState: 'loading', addEventListener: () => {}, getElementById: () => null, querySelector: () => null },
      setTimeout: () => 0,
      console: { warn: (...args) => warnings.push(args.join(' ')) },
      confirm: () => false,
      alert: (value) => { alertText = String(value); },
      fetch: async () => ({ ok: false, status: 404, text: async () => '', json: async () => ({}) }),
    },
    URL,
    decodeURIComponent,
  };
  vm.createContext(context);
  vm.runInContext(update, context);
  await context.window.SystemikaUpdate.checkForUpdates({ manual: true });
  assert.match(alertText, /Systemika Studio could not check for updates/);
  assert.match(alertText, /update service is currently unavailable/i);
  assert.doesNotMatch(alertText, /HTTP 404.*HTTP 404/);
  assert.ok(warnings.some(line => line.includes('diagnostics')));
});


test('update checker refetches the running editor and detects a refreshed build of the same version', async () => {
  const requests = [];
  let confirmed = false;
  const context = {
    window: {
      systemika: { version: '1.1.2' },
      location: { href: 'https://systemika.no/studio/webapp/OpenSystemDynamics/src/index.html?v=1.1.2&b=oldbuild12345' },
      document: {
        readyState: 'loading',
        addEventListener: () => {},
        getElementById: () => null,
        querySelector: () => null,
      },
      setTimeout: () => 0,
      console,
      confirm: () => { confirmed = true; return false; },
      alert: () => {},
      fetch: async (url) => {
        requests.push(String(url));
        return {
          ok: true,
          status: 200,
          text: async () => '<html><head><meta name="systemika-version" content="1.1.2"><meta name="systemika-build" content="newbuild67890"></head></html>'
        };
      },
    },
    URL,
    decodeURIComponent,
  };
  context.window.top = context.window;
  vm.createContext(context);
  vm.runInContext(update, context);
  const result = await context.window.SystemikaUpdate.checkForUpdates({ manual: false });
  assert.equal(result.updateAvailable, true);
  assert.equal(result.sameVersionBuildUpdate, true);
  assert.equal(result.latest, '1.1.2');
  assert.equal(confirmed, true);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /\/studio\/webapp\/OpenSystemDynamics\/src\/index\.html\?_/);
});

test('loaded bracketed model-entity names are safely normalized without touching annotations', () => {
  const graph = read('OpenSystemDynamics/src/systemika-model-graph.js');
  assert.ok(graph.includes('const bracketed = rawName.match(/^\\[([A-Za-z_][A-Za-z0-9_]*)\\]$/);'));
  assert.match(graph, /namedTypes = new Set\(\["Stock", "Flow", "Variable", "Converter"\]\)/);
  assert.match(graph, /if \(!collision\) item\.value\.setAttribute\("name", cleanName\)/);
  assert.match(graph, /Ghost display names are derived from their source entity/);
});

test('links and link handles paint below every model-entity layer', () => {
  const link = html.indexOf('<g class="layer link"></g>');
  const anchor = html.indexOf('<g class="layer anchor"></g>');
  assert.ok(link >= 0 && anchor > link);
  for (const layer of ['stock', 'variable', 'constant', 'converter', 'flow']) {
    assert.ok(html.indexOf(`<g class="layer ${layer}"></g>`) > anchor, `${layer} should paint above links and handles`);
  }
});

test('Text Boxes persist and render whole-box font formatting', () => {
  const entities = read('OpenSystemDynamics/src/systemika-entities.js');
  for (const attr of ['FontFamily', 'FontSize', 'FontWeight', 'FontStyle', 'TextDecoration', 'TextAlign']) {
    assert.match(entities, new RegExp(`${attr}:`));
  }
  assert.match(editor, /class TextAreaDialog[\s\S]*text-font-family/);
  assert.match(editor, /class TextAreaDialog[\s\S]*text-font-size/);
  assert.match(editor, /class TextAreaDialog[\s\S]*text-bold/);
  assert.match(editor, /class TextAreaDialog[\s\S]*text-italic/);
  assert.match(editor, /class TextAreaDialog[\s\S]*text-underline/);
  assert.match(editor, /class TextAreaDialog[\s\S]*text-align/);
  assert.match(editor, /content\.style\.fontSize = `\$\{fontSize\}px`/);
  assert.match(editor, /content\.style\.textAlign = textAlign/);
  assert.match(editor, /content\.style\.whiteSpace = "pre-wrap"/);
});
