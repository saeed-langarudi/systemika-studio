'use strict';

/* Manual Calibration Sandbox: interface-only calibration built on Systemika's
 * existing model editor and simulation engine. No automatic fitting routine. */
(function (root) {
  const state = {
    win: null, decision: null, running: false, rerunPending: false,
    defaults: new Map(), ranges: new Map(), plots: Array.from({length: 6}, () => ({reference: null, simulated: null})),
    timer: null, persistTimer: null, feedbackTimer: null, runToken: 0, initialRunStarted: false, panelWidth: 408,
    alertQueue: [], activeAlert: null
  };

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => { const n = Number(value); return Number.isFinite(n) ? n : null; };
  function constants() { return typeof primitives === 'function' ? primitives('Constant') : []; }
  function variables() { return typeof getPrimitiveList === 'function' ? getPrimitiveList().filter(p => !['Setting','Folder'].includes(p.value && p.value.nodeName)) : []; }
  function valueOf(p) { return typeof getValue === 'function' ? String(getValue(p)).replace(/\\n/g, '\n') : String(p.getAttribute('Equation') || p.getAttribute('Value') || '0'); }
  function numericValue(p) { const n = Number(valueOf(p).trim()); return Number.isFinite(n) ? n : 0; }
  function setNumericValue(p, value) {
    if (typeof setValue2 === 'function') setValue2(p, String(value));
    else p.setAttribute('Equation', String(value));
    const visual = root.object_array && root.object_array[p.id];
    if (visual && typeof visual.update === 'function') visual.update();
  }

  function closeOutputs() { if (root.SystemikaOutputDock && typeof root.SystemikaOutputDock.closeWorkspace === 'function') root.SystemikaOutputDock.closeWorkspace(); }

  function popupHtml() {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Calibration Sandbox</title><style>
      *{box-sizing:border-box} body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff}
      .shell{height:100vh;display:grid;grid-template-columns:minmax(650px,1fr) 6px 408px;overflow:hidden}
      .main{padding:12px 14px 14px;background-image:linear-gradient(#eee 1px,transparent 1px),linear-gradient(90deg,#eee 1px,transparent 1px);background-size:28px 28px;overflow:auto}
      h1{font-size:22px;text-align:center;margin:0 0 5px;background:rgba(255,255,255,.9);display:block;padding:3px}.universal-legend{display:flex;justify-content:center;gap:28px;align-items:center;margin:0 0 10px;font-size:12px;background:rgba(255,255,255,.9);padding:3px}.legend-item{display:flex;align-items:center;gap:7px}.legend-line{width:34px;height:0;border-top:3px solid}.legend-reference{border-color:#7E2F8E;border-top-style:dashed}.legend-simulated{border-color:#009E73}
      .plots{display:grid;grid-template-columns:repeat(3,minmax(190px,1fr));grid-auto-rows:minmax(240px,1fr);gap:14px;min-height:calc(100vh - 70px)}
      .plot{background:#fff;border:1px solid #777;display:flex;flex-direction:column;min-height:240px}.chart{flex:1;min-height:150px;position:relative}.chart svg{width:100%;height:100%;display:block}
      .plot-controls{border-top:1px solid #ddd;padding:6px;display:flex;justify-content:flex-end;gap:5px}.plot-controls button{font-size:11px;padding:5px 7px}
      .splitter{cursor:col-resize;background:#eee;border-left:1px solid #aaa;border-right:1px solid #aaa;touch-action:none}.splitter:hover{background:#ddd} aside{padding:18px 14px;overflow:auto;background:#fff;min-width:300px} aside h2{font-size:22px;font-weight:400;margin:0 0 14px}
      .top-actions{display:flex;gap:7px;align-items:center;margin-bottom:5px}.top-actions button,.add{padding:7px 10px}.top-actions button:disabled{opacity:.55;cursor:default}.save-status{min-height:18px;margin:0 0 7px;font-size:11px;color:#27632d}.add{width:100%;margin-bottom:12px}
      table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #aaa;padding:5px;text-align:center}th{font-size:10px;background:#fafafa}td.name{text-align:left;font-weight:600;max-width:85px;overflow:hidden;text-overflow:ellipsis}
      input[type=number]{width:58px;padding:4px}input[type=range]{width:105px}.slider-cell{min-width:115px}.current{font-variant-numeric:tabular-nums;font-size:11px;display:block;margin-top:2px}.reset{font-size:10px;padding:4px}
      .empty{color:#666;font-size:12px;text-align:center;padding:15px}.picker{position:fixed;inset:0;background:rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;z-index:10}.picker-card{background:#fff;border:1px solid #777;box-shadow:0 8px 28px #0003;width:360px;max-height:70vh;padding:14px;display:flex;flex-direction:column;gap:9px}.picker-card input{padding:7px}.picker-list{overflow:auto;border:1px solid #ccc}.picker-list button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #eee;background:#fff;padding:7px}.picker-list button:hover{background:#eee}.picker-actions{text-align:right}
      .systemika-alert-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;padding:24px}.systemika-alert-card{width:min(520px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:auto;background:#fff;border:1px solid #777;box-shadow:0 12px 42px rgba(0,0,0,.42);font-size:13px}.systemika-alert-title{font-weight:600;padding:10px 12px;border-bottom:1px solid #ccc;background:#f4f4f4}.systemika-alert-message{padding:18px 16px;line-height:1.4}.systemika-alert-actions{padding:9px 12px;border-top:1px solid #ddd;text-align:right}.systemika-alert-actions button{min-width:72px;padding:6px 14px}
      @media(max-width:1000px){.plots{grid-template-columns:repeat(2,minmax(200px,1fr))}}
    </style></head><body><div class="shell"><main class="main"><h1>Calibration Sandbox</h1><div class="universal-legend"><span class="legend-item"><span class="legend-line legend-reference"></span>Reference</span><span class="legend-item"><span class="legend-line legend-simulated"></span>Simulated</span></div><div id="plots" class="plots"></div></main><div id="panel-splitter" class="splitter" title="Drag to resize parameter panel"></div><aside><h2>Parameter Sliders</h2><div class="top-actions"><button id="reset-all">Reset All</button><button id="save-default" disabled>Save as Default</button></div><div id="save-default-status" class="save-status" role="status" aria-live="polite"></div><button id="add-constant" class="add">Select Constant</button><div id="parameters"></div></aside></div><div id="picker-host"></div><div id="systemika-alert-host"></div></body></html>`;
  }

  function showNextTopAlert() {
    if (!state.win || state.win.closed || state.activeAlert || !state.alertQueue.length) return;
    const alert = state.alertQueue.shift();
    state.activeAlert = alert;
    const d = state.win.document, host = d.getElementById('systemika-alert-host');
    if (!host) { state.activeAlert = null; return; }
    host.innerHTML = `<div class="systemika-alert-overlay" role="alertdialog" aria-modal="true" aria-labelledby="systemika-alert-title"><div class="systemika-alert-card"><div id="systemika-alert-title" class="systemika-alert-title">${esc(alert.title || 'Alert')}</div><div class="systemika-alert-message">${alert.message}</div><div class="systemika-alert-actions"><button type="button">OK</button></div></div></div>`;
    const overlay = host.querySelector('.systemika-alert-overlay'), button = host.querySelector('button');
    const close = () => {
      if (!state.activeAlert) return;
      const finished = state.activeAlert;
      state.activeAlert = null;
      host.innerHTML = '';
      if (typeof finished.closeHandler === 'function') {
        try { finished.closeHandler(); } catch (error) { console.error(error); }
      }
      showNextTopAlert();
    };
    button.onclick = close;
    overlay.addEventListener('keydown', event => { if (event.key === 'Escape' || event.key === 'Enter') { event.preventDefault(); close(); } });
    try { state.win.focus(); button.focus(); } catch (_error) {}
  }

  function showTopAlert(message, closeHandler = null, title = 'Alert') {
    if (!state.win || state.win.closed) return false;
    state.alertQueue.push({ message: String(message == null ? '' : message), closeHandler, title: String(title || 'Alert') });
    showNextTopAlert();
    return true;
  }

  function openWindow() {
    if (state.win && !state.win.closed) { state.win.focus(); return state.win; }
    state.win = root.open('', 'systemika-calibration-sandbox', 'width=1380,height=850,resizable=yes,scrollbars=yes');
    if (!state.win) { root.alert('Systemika could not open the Calibration Sandbox. Please allow pop-up windows and try again.'); return null; }
    state.win.document.open(); state.win.document.write(popupHtml()); state.win.document.close();
    state.win.addEventListener('beforeunload', () => { persistSandboxState(); state.alertQueue.length = 0; state.activeAlert = null; state.win = null; });
    state.win.document.getElementById('reset-all').onclick = resetAll;
    state.win.document.getElementById('save-default').onclick = saveAsDefault;
    state.win.document.getElementById('add-constant').onclick = chooseConstant;
    installPanelResizer();
    renderPlots(); renderParameters();
    return state.win;
  }

  function installPanelResizer() {
    if (!state.win || state.win.closed) return;
    const d = state.win.document, shell = d.querySelector('.shell'), splitter = d.getElementById('panel-splitter');
    if (!shell || !splitter) return;
    let dragging = false;
    splitter.addEventListener('pointerdown', (event) => { dragging = true; splitter.setPointerCapture(event.pointerId); event.preventDefault(); });
    splitter.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const width = Math.max(300, Math.min(Math.round(state.win.innerWidth * 0.55), state.win.innerWidth - event.clientX));
      state.panelWidth=width; shell.style.gridTemplateColumns = `minmax(650px,1fr) 6px ${width}px`; schedulePersist();
    });
    const finish = () => { dragging = false; };
    splitter.addEventListener('pointerup', finish); splitter.addEventListener('pointercancel', finish);
  }

  function choose(title, items, callback) {
    if (!state.win || state.win.closed) return;
    const d=state.win.document, host=d.getElementById('picker-host');
    const rows=items.map(p=>`<button type="button" data-id="${esc(p.id)}">${esc(getName(p))}</button>`).join('');
    host.innerHTML=`<div class="picker"><div class="picker-card"><strong>${esc(title)}</strong><input type="search" placeholder="Find variable…"><div class="picker-list">${rows || '<div class="empty">No matching model entities.</div>'}</div><div class="picker-actions"><button type="button" class="cancel">Cancel</button></div></div></div>`;
    const input=host.querySelector('input'); input.oninput=()=>{const q=input.value.toLowerCase();host.querySelectorAll('.picker-list button').forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(q));};
    host.querySelector('.cancel').onclick=()=>host.innerHTML='';
    host.querySelectorAll('.picker-list button').forEach(b=>b.onclick=()=>{const p=findID(b.dataset.id);host.innerHTML='';if(p)callback(p);}); input.focus();
  }
  function chooseConstant(){ choose('Select Constant', constants().filter(p=>!state.ranges.has(String(p.id))), p=>{const v=numericValue(p), span=Math.max(Math.abs(v)*.5,1);state.ranges.set(String(p.id),{min:v-span,max:v+span,step:Math.max(span/100,.01)});if(!state.defaults.has(String(p.id)))state.defaults.set(String(p.id),v);renderParameters();schedulePersist();}); }
  function choosePlot(index, role){ choose(role==='reference'?'Select Reference Mode':'Select Simulated Variable', variables(), p=>{state.plots[index][role]=String(p.id);renderPlots();schedulePersist();}); }

  function hasDefaultChanges(){
    for(const id of state.ranges.keys()){const p=findID(id);if(!p)continue;const saved=state.defaults.get(id),current=numericValue(p);if(saved==null||Math.abs(current-saved)>1e-12)return true;}
    return false;
  }
  function updateSaveDefaultState(clearStatus=false){
    if(!state.win||state.win.closed)return;const button=state.win.document.getElementById('save-default'),status=state.win.document.getElementById('save-default-status');
    if(button){button.disabled=!hasDefaultChanges();if(clearStatus||button.textContent!=='Saved')button.textContent='Save as Default';}
    if(clearStatus){root.clearTimeout(state.feedbackTimer);if(status)status.textContent='';}
  }
  function showDefaultSavedFeedback(){
    if(!state.win||state.win.closed)return;const button=state.win.document.getElementById('save-default'),status=state.win.document.getElementById('save-default-status');
    if(button){button.disabled=true;button.textContent='Saved';}if(status)status.textContent='Changes have been saved as the default parameter values.';
    root.clearTimeout(state.feedbackTimer);state.feedbackTimer=root.setTimeout(()=>{if(!state.win||state.win.closed)return;if(button)button.textContent='Save as Default';updateSaveDefaultState(false);},1800);
  }

  function renderParameters(){
    if(!state.win||state.win.closed)return; const d=state.win.document, host=d.getElementById('parameters');
    if(!state.ranges.size){host.innerHTML='<div class="empty">Select model constants to add calibration sliders.</div>';updateSaveDefaultState(false);return;}
    let body=''; state.ranges.forEach((r,id)=>{const p=findID(id);if(!p)return;const v=numericValue(p);body+=`<tr data-id="${esc(id)}"><td class="name" title="${esc(getName(p))}">${esc(getName(p))}</td><td><input class="min" type="number" value="${r.min}"></td><td class="slider-cell"><input class="slider" type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}"><span class="current">${v}</span></td><td><input class="max" type="number" value="${r.max}"></td><td><input class="step" type="number" min="0" value="${r.step}"></td><td><button class="reset">Reset</button></td></tr>`;});
    host.innerHTML=`<table><thead><tr><th>PARAMETER</th><th>MIN</th><th>SLIDER</th><th>MAX</th><th>INCREMENT</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
    host.querySelectorAll('tr[data-id]').forEach(tr=>{const id=tr.dataset.id,p=findID(id),r=state.ranges.get(id),slider=tr.querySelector('.slider'),current=tr.querySelector('.current');
      const syncBounds=()=>{r.min=num(tr.querySelector('.min').value)??r.min;r.max=num(tr.querySelector('.max').value)??r.max;r.step=Math.max(num(tr.querySelector('.step').value)??r.step,Number.EPSILON);slider.min=r.min;slider.max=r.max;slider.step=r.step;schedulePersist();};
      tr.querySelector('.min').onchange=syncBounds;tr.querySelector('.max').onchange=syncBounds;tr.querySelector('.step').onchange=syncBounds;
      slider.oninput=()=>{const v=num(slider.value);if(v==null)return;current.textContent=String(v);setNumericValue(p,v);updateSaveDefaultState(true);scheduleRerun();schedulePersist();};
      tr.querySelector('.reset').onclick=()=>{const v=state.defaults.get(id);if(v==null)return;setNumericValue(p,v);slider.value=v;current.textContent=String(v);updateSaveDefaultState(true);scheduleRerun();schedulePersist();};
    });
    updateSaveDefaultState(false);
  }

  function resetAll(){state.ranges.forEach((_r,id)=>{const p=findID(id),v=state.defaults.get(id);if(p&&v!=null)setNumericValue(p,v);});renderParameters();updateSaveDefaultState(true);scheduleRerun();schedulePersist();}
  function saveAsDefault(){state.ranges.forEach((_r,id)=>{const p=findID(id);if(p)state.defaults.set(id,numericValue(p));});if(typeof History!=='undefined'&&typeof History.storeUndoState==='function')History.storeUndoState();if(root.InfoBar&&typeof InfoBar.update==='function')InfoBar.update();renderParameters();showDefaultSavedFeedback();schedulePersist();}

  function snapshot(){return {version:1,plots:state.plots.map(p=>({...p})),parameters:Array.from(state.ranges.entries()).map(([id,r])=>({id,min:r.min,max:r.max,step:r.step,defaultValue:state.defaults.get(id),value:(()=>{const p=findID(id);return p?numericValue(p):null;})()})),panelWidth:state.panelWidth};}
  function restore(saved){if(!saved||saved.version!==1)return;state.plots=Array.from({length:6},(_,i)=>({...((saved.plots&&saved.plots[i])||{reference:null,simulated:null})}));state.ranges.clear();(saved.parameters||[]).forEach(x=>{if(!findID(String(x.id)))return;state.ranges.set(String(x.id),{min:Number(x.min),max:Number(x.max),step:Number(x.step)});if(Number.isFinite(Number(x.defaultValue)))state.defaults.set(String(x.id),Number(x.defaultValue));if(Number.isFinite(Number(x.value)))setNumericValue(findID(String(x.id)),Number(x.value));});if(Number.isFinite(Number(saved.panelWidth)))state.panelWidth=Math.max(300,Number(saved.panelWidth));}
  async function persistSandboxState(){if(!state.decision||!state.decision.persist||!root.systemikaSimulationData||typeof root.systemikaSimulationData.updateRunMetadata!=='function')return;try{await root.systemikaSimulationData.updateRunMetadata(state.decision.runName,{calibrationSandbox:snapshot()});}catch(e){console.warn('Could not persist Calibration Sandbox state',e);}}
  function schedulePersist(){root.clearTimeout(state.persistTimer);state.persistTimer=root.setTimeout(persistSandboxState,350);}

  function seriesFor(id){ if(!id||typeof RunResults==='undefined')return[];const idx=RunResults.varIdList.indexOf(Number(id));if(idx<0)return[];return RunResults.results.map(r=>[Number(r[0]),Number(r[idx])]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])); }
  function svgPlot(index){
    const spec=state.plots[index], ref=seriesFor(spec.reference), sim=seriesFor(spec.simulated), all=ref.concat(sim); const W=600,H=350,l=52,r=15,t=18,b=38;
    if(!all.length)return `<svg viewBox="0 0 ${W} ${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="18" fill="#666">Select variables</text></svg>`;
    let xmin=Math.min(...all.map(p=>p[0])),xmax=Math.max(...all.map(p=>p[0])),ymin=Math.min(...all.map(p=>p[1])),ymax=Math.max(...all.map(p=>p[1]));if(xmax===xmin)xmax=xmin+1;if(ymax===ymin){ymin-=1;ymax+=1;}const pad=(ymax-ymin)*.06;ymin-=pad;ymax+=pad;
    const x=v=>l+(v-xmin)/(xmax-xmin)*(W-l-r), y=v=>t+(ymax-v)/(ymax-ymin)*(H-t-b); const path=a=>a.map((p,i)=>`${i?'L':'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
    let grid='';for(let i=0;i<=5;i++){let yy=t+i*(H-t-b)/5,v=ymax-i*(ymax-ymin)/5;grid+=`<line x1="${l}" y1="${yy}" x2="${W-r}" y2="${yy}" stroke="#e5e5e5"/><text x="${l-6}" y="${yy+4}" text-anchor="end" font-size="11">${v.toPrecision(3)}</text>`;}for(let i=0;i<=5;i++){let xx=l+i*(W-l-r)/5,v=xmin+i*(xmax-xmin)/5;grid+=`<line x1="${xx}" y1="${t}" x2="${xx}" y2="${H-b}" stroke="#eee"/><text x="${xx}" y="${H-b+17}" text-anchor="middle" font-size="11">${v.toPrecision(3)}</text>`;}
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<line x1="${l}" y1="${H-b}" x2="${W-r}" y2="${H-b}" stroke="#222"/><line x1="${l}" y1="${t}" x2="${l}" y2="${H-b}" stroke="#222"/>${ref.length?`<path d="${path(ref)}" fill="none" stroke="#7E2F8E" stroke-width="2.4" stroke-dasharray="8 6" vector-effect="non-scaling-stroke"/>`:''}${sim.length?`<path d="${path(sim)}" fill="none" stroke="#009E73" stroke-width="2.4" vector-effect="non-scaling-stroke"/>`:''}<text x="${(l+W-r)/2}" y="${H-5}" text-anchor="middle" font-size="12">Time</text></svg>`;
  }
  function renderPlots(){if(!state.win||state.win.closed)return;const host=state.win.document.getElementById('plots');host.innerHTML=state.plots.map((p,i)=>`<section class="plot"><div class="chart">${svgPlot(i)}</div><div class="plot-controls"><button data-i="${i}" data-role="reference">${p.reference?esc(getName(findID(p.reference))):'Select Reference Mode'}</button><button data-i="${i}" data-role="simulated">${p.simulated?esc(getName(findID(p.simulated))):'Select Simulated Variable'}</button></div></section>`).join('');host.querySelectorAll('.plot-controls button').forEach(b=>b.onclick=()=>choosePlot(Number(b.dataset.i),b.dataset.role));}

  function waitForRun(token){const started=Date.now();const poll=()=>{if(token!==state.runToken)return;if(typeof RunResults==='undefined')return;if(RunResults.runState==='stopped'&&RunResults.simulationDone){state.running=false;renderPlots();if(state.rerunPending){state.rerunPending=false;runCalibration(false);}return;}if(Date.now()-started<120000)root.setTimeout(poll,20);else state.running=false;};root.setTimeout(poll,20);}
  function runCalibration(persist){
    if(typeof RunResults==='undefined')return;
    if(state.running){state.rerunPending=true;return;}
    state.running=true;
    const token=++state.runToken;
    const base=state.decision||{proceed:true,persist:false,runName:'Calibration',overwrite:false};
    // Only the launch run is written to disk. Slider-driven calibration runs are
    // intentionally transient so disk I/O never sits in the live feedback path.
    RunResults.systemikaRunDecision={...base,persist:Boolean(persist&&base.persist)};
    RunResults.runSimulation();
    waitForRun(token);
  }
  function scheduleRerun(){
    root.clearTimeout(state.timer);
    state.timer=root.setTimeout(()=>{
      if(state.running){state.rerunPending=true;return;}
      runCalibration(false);
    },25);
  }

  async function launch(){
    if(typeof DefinitionError!=='undefined'&&DefinitionError.getAllPrims().length){root.alert('The model contains a definition error. Resolve it before opening the Calibration Sandbox.');return;}
    closeOutputs();
    const input=document.getElementById('systemika-run-name'); if(input && !input.value.trim()) input.value='Calibration';
    let decision={proceed:true,persist:false,runName:input&&input.value.trim()?input.value.trim():'Calibration',overwrite:false};
    let savedSandbox=null;
    const requestedName=decision.runName;
    try{if(root.systemikaSimulationData&&typeof root.systemikaSimulationData.runExists==='function'&&await root.systemikaSimulationData.runExists(requestedName)){const oldRun=await root.systemikaSimulationData.loadRun(requestedName,false);savedSandbox=oldRun&&oldRun.metadata&&oldRun.metadata.calibrationSandbox?oldRun.metadata.calibrationSandbox:null;}if(root.SystemikaRunManager)decision=await SystemikaRunManager.prepareUserRun();}catch(e){root.alert(`Unable to prepare the calibration run.\n\n${e.message||e}`);return;}
    if(!decision||!decision.proceed)return; state.decision=decision;if(savedSandbox)restore(savedSandbox);
    constants().forEach(p=>{const id=String(p.id);if(!state.defaults.has(id))state.defaults.set(id,numericValue(p));});
    if(!openWindow())return;const shell=state.win.document.querySelector('.shell');if(shell)shell.style.gridTemplateColumns=`minmax(650px,1fr) 6px ${state.panelWidth}px`;renderParameters();renderPlots();state.rerunPending=false; state.running=false; runCalibration(true);root.setTimeout(schedulePersist,700);
  }

  function init(){const b=document.getElementById('btn_calibration_sandbox');if(b)b.addEventListener('click',e=>{e.preventDefault();launch();});}
  root.SystemikaCalibrationSandbox={launch,state,showTopAlert};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
