const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-calibration-sandbox.js'), 'utf8');

test('Calibration Sandbox toolbar tool uses the supplied icon and has no keyboard shortcut', () => {
  assert.match(html, /id="btn_calibration_sandbox"[\s\S]*data-title="Calibration Sandbox"[\s\S]*graphics\/calibration-sandbox\.svg/);
  assert.doesNotMatch(html, /Calibration Sandbox \([A-Z]\)/);
});

test('Calibration Sandbox is manual UI over the existing simulation engine', () => {
  assert.match(js, /RunResults\.runSimulation\(\)/);
  assert.match(js, /primitives\('Constant'\)/);
  assert.match(js, /Select Reference Mode/);
  assert.match(js, /Select Simulated Variable/);
  assert.match(js, /stroke-dasharray/);
  assert.match(js, /Reset All/);
  assert.match(js, /Save as Default/);
  assert.doesNotMatch(js, /optimis|optimizer|objective function|least squares/i);
});


test('Calibration Sandbox panel is user-resizable without forcing horizontal overflow', () => {
  assert.match(js, /grid-template-columns:minmax\(0,1fr\) 6px 408px/);
  assert.match(js, /panel-splitter/);
  assert.match(js, /function panelWidthBounds\(\)/);
  assert.match(js, /pointermove/);
  assert.match(js, /table-layout:fixed/);
  assert.match(js, /overflow-y:auto;overflow-x:hidden/);
});

test('Calibration Sandbox opens to the available screen and keeps all six plots inside the viewport', () => {
  const electron = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
  assert.match(js, /function calibrationWindowRect\(\)/);
  assert.match(js, /screenInfo\.availWidth/);
  assert.match(js, /screenInfo\.availHeight/);
  assert.match(js, /resizeTo\(rect\.width, rect\.height\)/);
  assert.match(js, /grid-template-rows:auto auto minmax\(0,1fr\)/);
  assert.match(js, /grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(js, /@media\(max-width:1100px\)[\s\S]{0,180}grid-template-rows:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(electron, /frameName === "systemika-calibration-sandbox"/);
  assert.match(electron, /details\.frameName !== "systemika-calibration-sandbox"/);
  assert.match(electron, /childWindow\.maximize\(\)/);
});


test('Calibration Sandbox variable picker search visibly filters its result list', () => {
  const filterBlock = js.slice(js.indexOf('function applyPickerFilter'), js.indexOf('function chooseConstant'));
  assert.match(js, /\.picker-list button\[hidden\]\{display:none\}/);
  assert.match(filterBlock, /addEventListener\('input',filter\)/);
  assert.match(filterBlock, /addEventListener\('search',filter\)/);
  assert.match(filterBlock, /button\.hidden=!matches/);
  assert.match(filterBlock, /button\.style\.display=matches\?'':'none'/);
  assert.match(filterBlock, /picker-no-match/);
  assert.match(filterBlock, /applyPickerFilter\(host,''\)/);
});

test('Calibration live reruns avoid persistence and reset schedules a refresh', () => {
  assert.match(js, /runCalibration\(false\)/);
  assert.match(js, /persist:Boolean\(persist&&base\.persist\)/);
  assert.match(js, /reset[^;]*[\s\S]{0,220}scheduleRerun\(\)/i);
  assert.match(js, /resetAll\(\)[\s\S]{0,260}scheduleRerun\(\)/);
});

test('run saving snapshots current run before asynchronous disk IO', () => {
  const manager = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-run-data-manager.js'), 'utf8');
  assert.match(manager, /const run = this\.currentRun/);
  assert.match(manager, /this\.runCache\.set\(run\.runName, run\)/);
});

test('Calibration Sandbox persists its interface state in run metadata', () => {
  const manager = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-run-data-manager.js'), 'utf8');
  assert.match(js, /calibrationSandbox:snapshot\(\)/);
  assert.match(js, /metadata\.calibrationSandbox/);
  assert.match(manager, /async updateRunMetadata\(runName, patch\)/);
});

test('Calibration Sandbox uses universal teal and purple legend and plot colors', () => {
  assert.match(js, /universal-legend/);
  assert.match(js, /Reference/);
  assert.match(js, /Simulated/);
  assert.match(js, /#7E2F8E/);
  assert.match(js, /#009E73/);
});


test('Calibration Sandbox renders queued alerts above all sandbox controls and focuses the popup', () => {
  assert.match(js, /id="systemika-alert-host"/);
  assert.match(js, /systemika-alert-overlay\{[^}]*z-index:2147483647/);
  assert.match(js, /function showTopAlert\(message, closeHandler = null, title = 'Alert'\)/);
  assert.match(js, /state\.alertQueue\.push\(/);
  assert.match(js, /showNextTopAlert\(\)/);
  assert.match(js, /state\.win\.focus\(\); button\.focus\(\)/);
  assert.match(js, /event\.key === 'Escape' \|\| event\.key === 'Enter'/);
});

test('Systemika alert dialogs route into the Calibration Sandbox while it is open', () => {
  const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
  const start = editor.indexOf('class XAlertDialog extends jqDialog');
  const end = editor.indexOf('class GhostSourceDialog', start);
  const alertDialog = editor.slice(start, end);
  assert.match(alertDialog, /SystemikaCalibrationSandbox\.showTopAlert/);
  assert.match(alertDialog, /this\.getHtml\(\)/);
  assert.match(alertDialog, /this\.getTitle\(\)/);
  assert.match(alertDialog, /this\.visible = false; this\.afterClose\(\)/);
  assert.match(alertDialog, /super\.show\(\)/);
  assert.match(editor, /Simulation error:<br\/><br\/>\$\{htmlEscape\(res\.error\)\}/);
});

test('Calibration live rerun debounce is 40 ms and slider metadata saves only after commit', () => {
  const scheduleBlock = js.slice(js.indexOf('function scheduleRerun'), js.indexOf('async function launch'));
  assert.match(scheduleBlock, /\},40\);/);
  const inputLine = js.match(/slider\.oninput=.*;/)?.[0] || '';
  assert.match(inputLine, /clearTimeout\(state\.persistTimer\)/);
  assert.match(inputLine, /state\.persistTimer=null/);
  assert.match(inputLine, /scheduleRerun\(\)/);
  assert.doesNotMatch(inputLine, /schedulePersist/);
  assert.match(js, /slider\.onchange=.*setNumericValue\(p,v\).*schedulePersist\(0\)/);
  assert.match(js, /beforeunload[\s\S]{0,180}persistSandboxState\(\)/);
});


test('Calibration slider live input stays lightweight and failed runs release the rerun gate', () => {
  assert.match(js, /setNumericValue\(p,v,\{live:true\}\)/);
  assert.match(js, /live && p && p\.value[\s\S]{0,220}p\.value\.setAttribute\('Equation', text\)/);
  assert.match(js, /slider\.onchange=.*setNumericValue\(p,v\).*schedulePersist\(0\)/);
  const finishBlock = js.slice(js.indexOf('function finishRunIfStopped'), js.indexOf('function reconcileLiveRunState'));
  assert.match(finishBlock, /completed&&state\.rerunPending\)queuePendingRerunAfterPaint\(\)/);
  assert.match(finishBlock, /else if\(!completed\)state\.rerunPending=false/);
  const waitBlock = js.slice(js.indexOf('function waitForRun'), js.indexOf('function runCalibration'));
  assert.match(waitBlock, /liveSetTimeout\(poll,10\)/);
});

test('Calibration reruns are coalesced during continuous dragging instead of trailing-debounced', () => {
  const scheduleBlock = js.slice(js.indexOf('function scheduleRerun'), js.indexOf('async function launch'));
  assert.match(scheduleBlock, /if\(state\.running\)\{state\.rerunPending=true;return;\}/);
  assert.match(scheduleBlock, /if\(state\.timer!=null\)return/);
  assert.match(scheduleBlock, /state\.timer=null/);
  assert.match(scheduleBlock, /\},40\);/);
  assert.doesNotMatch(scheduleBlock, /clearTimeout\(state\.timer\)/);
});

test('Calibration pending reruns yield one paint but do not wait another 40 ms', () => {
  const queueBlock = js.slice(js.indexOf('function queuePendingRerunAfterPaint'), js.indexOf('function waitForRun'));
  assert.match(queueBlock, /requestAnimationFrame/);
  assert.match(queueBlock, /liveSetTimeout\(launch,0\)/);
  assert.match(queueBlock, /runCalibration\(false\)/);
  assert.doesNotMatch(queueBlock, /40/);
});

test('Calibration rerun timing survives Alt+Tab/background throttling', () => {
  const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
  const engine = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-engine.js'), 'utf8');
  const electron = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
  const timerBlock = js.slice(js.indexOf('function liveTimerWindow'), js.indexOf('function closeOutputs'));
  const queueBlock = js.slice(js.indexOf('function queuePendingRerunAfterPaint'), js.indexOf('function runCalibration'));
  const scheduleBlock = js.slice(js.indexOf('function scheduleRerun'), js.indexOf('async function launch'));

  assert.match(timerBlock, /state\.win && !state\.win\.closed \? state\.win : root/);
  assert.match(js, /RunResults\.systemikaCallbackScheduler=scheduleEngineCallback/);
  assert.match(js, /addEventListener\('focus', reconcileLiveRunState\)/);
  assert.match(js, /visibilitychange[\s\S]{0,160}reconcileLiveRunState\(\)/);
  assert.match(queueBlock, /liveSetTimeout\(poll,10\)/);
  assert.doesNotMatch(queueBlock, /root\.setTimeout/);
  assert.match(scheduleBlock, /liveSetTimeout\(/);
  assert.doesNotMatch(scheduleBlock, /root\.setTimeout/);
  assert.match(editor, /callbackScheduler:[^\n]*systemikaCallbackScheduler/);
  assert.match(engine, /config\.callbackScheduler/);
  assert.match(electron, /backgroundThrottling:\s*false/);
});

test('Calibration live plot refresh updates chart bodies without rebuilding plot controls', () => {
  const refreshBlock = js.slice(js.indexOf('function refreshPlotCharts'), js.indexOf('function queuePendingRerunAfterPaint'));
  assert.match(refreshBlock, /querySelectorAll\('\.plot'\)/);
  assert.match(refreshBlock, /querySelector\('\.chart'\)/);
  assert.match(refreshBlock, /chart\.innerHTML=svgPlot\(i\)/);
  assert.doesNotMatch(refreshBlock, /plot-controls button/);
});

test('Calibration metadata uses a lightweight sidecar instead of recompressing the sysrun dataset', () => {
  const manager = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-run-data-manager.js'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
  const packageStore = fs.readFileSync(path.join(root, 'electron/systemika-run-package.js'), 'utf8');
  const browserStore = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/systemika-run-browser-store.js'), 'utf8');
  assert.match(manager, /typeof api\.updateMetadata === 'function'/);
  assert.match(preload, /systemika:runs:update-metadata/);
  assert.match(main, /systemika:runs:update-metadata/);
  assert.match(packageStore, /METADATA_SIDECAR_SUFFIX/);
  assert.match(packageStore, /async function updateRunMetadata/);
  assert.match(browserStore, /updateMetadata: updateRunMetadata/);
});

test('copied model entities use underscore suffixes', () => {
  const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics/src/editor.js'), 'utf8');
  assert.match(editor, /candidate = `\$\{base\}_\$\{counter\}`/);
  assert.doesNotMatch(editor, /candidate = `\$\{base\} \$\{counter\}`/);
});
