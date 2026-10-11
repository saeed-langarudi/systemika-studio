const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');
const env = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/environment.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/style/editor.css'), 'utf8');

test('version is displayed alongside the current model, not overwriting the filename', () => {
  assert.match(html, /id="current-model-name"/);
  assert.match(html, /id="systemika-version-label"/);
  assert.match(env, /versionLabel\.textContent = `v\$\{systemika\.version\}`/);
  assert.match(css, /\.current-model-identity\s*\{[^}]*display:\s*flex/);
});

test('fit uses finite model bounds, viewport and padding rather than the 6000px canvas', () => {
  const chunk = src.slice(src.indexOf('class Zoom {'), src.indexOf('class MousePan {'));
  assert.ok(chunk.includes('static zoomToFit()'));
  const view = { clientWidth: 800, clientHeight: 600, scrollLeft: 0, scrollTop: 0 };
  const svg = { parentElement: view, setAttribute(name, val) { this[name] = val; } };
  const context = { SVG: {svgElement: svg}, CANVAS_WIDTH:6000, CANVAS_HEIGHT:2000,
    document: { querySelectorAll(){return []; } },
    get_root_objects(){ return { a: {getBoundRect(){return {minX:100,maxX:200,minY:100,maxY:170};}},
      b: {getBoundRect(){return {minX:350,maxX:440,minY:240,maxY:340};}} }; }
  };
  const Zoom = vm.runInNewContext(`${chunk}\nZoom`, context);
  Zoom.zoomToFit();
  assert.ok(Zoom.level > 1 && Zoom.level <= Zoom.MAX, 'zoom should increase to fit modest model');
  const midX = (view.scrollLeft + view.clientWidth/2) / Zoom.level;
  const midY = (view.scrollTop + view.clientHeight/2) / Zoom.level;
  assert.ok(Math.abs(midX - 270) < 0.01, 'model centered horizontally');
  assert.ok(Math.abs(midY - 220) < 0.01, 'model centered vertically');
});

test('highlighter tooltips move inside the chart near its right border', () => {
  const chunk = src.slice(src.indexOf('function keepSystemikaPlotTooltipVisible('), src.indexOf('let systemikaDetachedPlotStageCounter'));
  assert.ok(chunk.includes('chartWidth - margin'));
  const tooltip = { style: { left:'260px', display:'block' }, offsetWidth:100 };
  const chart = { dataset:{}, clientWidth:300, addEventListener(name, cb){this[name]=cb;},
    querySelector(sel){return sel === '.jqplot-highlighter-tooltip' ? tooltip : null;} };
  const clamp = vm.runInNewContext(`${chunk}\nkeepSystemikaPlotTooltipVisible`, {});
  clamp(chart);
  chart.mousemove();
  assert.ok(parseFloat(tooltip.style.left) + tooltip.offsetWidth <= chart.clientWidth - 5);
  tooltip.style.left='80px';
  chart.mousemove();
  assert.equal(tooltip.style.left, '80px', 'normal placement unchanged');
});

test('View and shortcut help expose both zoom actions, with Ctrl+0 no longer clearing outputs', () => {
  assert.match(html, /id="btn_zoom_fit">Zoom to Fit/);
  assert.match(html, /id="btn_zoom_reset">Zoom 100%/);
  assert.match(src, /Zoom 100% \/ Zoom to Fit/);
  const out = html.indexOf('id="btn_zoom_out"');
  const hundred = html.indexOf('id="btn_zoom_reset"');
  const fit = html.indexOf('id="btn_zoom_fit"');
  assert.ok(out >= 0 && out < hundred && hundred < fit, 'Zoom 100% sits between Zoom Out and Zoom to Fit');
  assert.match(src, /Clear outputs<\/td><td>Toolbar button/);
});
