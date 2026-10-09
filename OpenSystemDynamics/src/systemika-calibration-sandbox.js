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

  // The editor/simulation engine lives in the main Systemika window while the
  // Calibration Sandbox is a separate window. Chromium aggressively throttles
  // timers in an occluded/background window. After an Alt+Tab cycle the main
  // editor can remain classified as background while the sandbox is visible,
  // which used to turn 0/10/40 ms calibration timers into much longer waits.
  // Keep the latency-sensitive calibration clock in the visible sandbox window
  // whenever it exists; fall back to the editor only when no sandbox is open.
  function liveTimerWindow() {
    return state.win && !state.win.closed ? state.win : root;
  }
  function liveSetTimeout(callback, delay = 0) {
    return liveTimerWindow().setTimeout(callback, delay);
  }
  function clearLiveRerunTimer() {
    if (state.timer == null) return;
    const host = liveTimerWindow();
    try { host.clearTimeout(state.timer); } catch (_error) {}
    state.timer = null;
  }
  function scheduleEngineCallback(callback, delay = 0) {
    return liveSetTimeout(callback, delay);
  }

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => { const n = Number(value); return Number.isFinite(n) ? n : null; };
  function constants() { return typeof primitives === 'function' ? primitives('Constant') : []; }
  function variables() { return typeof getPrimitiveList === 'function' ? getPrimitiveList().filter(p => !['Setting','Folder'].includes(p.value && p.value.nodeName)) : []; }
  function valueOf(p) { return typeof getValue === 'function' ? String(getValue(p)).replace(/\\n/g, '\n') : String(p.getAttribute('Equation') || p.getAttribute('Value') || '0'); }
  function numericValue(p) { const n = Number(valueOf(p).trim()); return Number.isFinite(n) ? n : 0; }
  function setNumericValue(p, value, options = {}) {
    const text = String(value);
    const live = Boolean(options.live);

    // Range inputs can emit many events per second. Going through setValue2() on
    // every live event performs definition checking, cache invalidation, SVG
    // attribute notifications, and an extra visual refresh. That work competes
    // with the native range control and can make its thumb appear to stick.
    // Constants are guaranteed numeric here, so live movement can update the
    // backing Equation attribute directly. The normal editor path is used once
    // the slider is committed/released.
    if (live && p && p.value && p.value.nodeName === 'Variable' && p.getAttribute('isConstant') === 'true') {
      p.value.setAttribute('Equation', text);
      return;
    }

    if (typeof setValue2 === 'function') setValue2(p, text);
    else p.setAttribute('Equation', text);
    const visual = root.object_array && root.object_array[p.id];
    if (visual && typeof visual.update === 'function') visual.update();
  }

  function closeOutputs() { if (root.SystemikaOutputDock && typeof root.SystemikaOutputDock.closeWorkspace === 'function') root.SystemikaOutputDock.closeWorkspace(); }

  function popupHtml() {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Calibration Sandbox</title><style>
      *{box-sizing:border-box} html,body{width:100%;height:100%;overflow:hidden} body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff}
      .shell{width:100vw;height:100vh;min-width:0;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 6px 408px;overflow:hidden}
      .main{min-width:0;min-height:0;padding:9px 10px 10px;background-image:linear-gradient(#eee 1px,transparent 1px),linear-gradient(90deg,#eee 1px,transparent 1px);background-size:28px 28px;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden}
      h1{font-size:20px;text-align:center;margin:0 0 3px;background:rgba(255,255,255,.9);display:block;padding:2px}.universal-legend{display:flex;justify-content:center;gap:28px;align-items:center;margin:0 0 7px;font-size:12px;background:rgba(255,255,255,.9);padding:2px}.legend-item{display:flex;align-items:center;gap:7px}.legend-line{width:34px;height:0;border-top:3px solid}.legend-reference{border-color:#7E2F8E;border-top-style:dashed}.legend-simulated{border-color:#009E73}
      .plots{min-width:0;min-height:0;height:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:10px;overflow:hidden}
      .plot{min-width:0;min-height:0;background:#fff;border:1px solid #777;display:flex;flex-direction:column;overflow:hidden}.chart{flex:1 1 auto;min-width:0;min-height:0;position:relative}.chart svg{width:100%;height:100%;display:block}
      .plot-controls{min-width:0;border-top:1px solid #ddd;padding:5px;display:flex;justify-content:flex-end;gap:5px;overflow:hidden}.plot-control-slot{display:flex;flex:1 1 0;min-width:0;gap:2px}.plot-control-slot .choose-plot{flex:1 1 auto;min-width:0;font-size:10px;padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.plot-control-slot .remove-plot{flex:0 0 24px;width:24px;padding:4px 2px;font-size:12px;font-weight:bold}.plot-control-slot .remove-plot:disabled{visibility:hidden}
      .splitter{cursor:col-resize;background:#eee;border-left:1px solid #aaa;border-right:1px solid #aaa;touch-action:none}.splitter:hover{background:#ddd} aside{min-width:0;min-height:0;padding:12px 10px;overflow-y:auto;overflow-x:hidden;background:#fff} aside h2{font-size:20px;font-weight:400;margin:0 0 9px}
      .top-actions{display:flex;gap:7px;align-items:center;margin-bottom:4px}.top-actions button,.add{padding:6px 8px}.top-actions button:disabled{opacity:.55;cursor:default}.save-status{min-height:16px;margin:0 0 5px;font-size:11px;color:#27632d}.add{width:100%;margin-bottom:8px}
      table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:11px}th,td{border:1px solid #aaa;padding:3px;text-align:center;overflow:hidden}th{font-size:9px;background:#fafafa;white-space:nowrap}td.name{text-align:left;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.col-name{width:19%}.col-bound{width:12%}.col-slider{width:27%}.col-step{width:14%}.col-reset{width:10%}.col-remove{width:6%}
      input[type=number]{width:100%;min-width:0;padding:3px}input[type=range]{width:100%;min-width:0}.slider-cell{min-width:0}.current{font-variant-numeric:tabular-nums;font-size:10px;display:block;margin-top:1px;overflow:hidden;text-overflow:ellipsis}.reset{width:100%;min-width:0;font-size:9px;padding:4px 2px;overflow:hidden;text-overflow:ellipsis}.remove{width:100%;min-width:0;padding:3px 1px;font-size:15px;line-height:1;border:0;background:transparent;cursor:pointer}.remove:hover{background:#eee}
      .empty{color:#666;font-size:12px;text-align:center;padding:15px}.picker{position:fixed;inset:0;background:rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;z-index:10}.picker-card{background:#fff;border:1px solid #777;box-shadow:0 8px 28px #0003;width:360px;max-width:calc(100vw - 28px);max-height:70vh;padding:14px;display:flex;flex-direction:column;gap:9px}.picker-card input{padding:7px}.picker-list{overflow:auto;border:1px solid #ccc}.picker-list button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #eee;background:#fff;padding:7px}.picker-list button[hidden]{display:none}.picker-list button:hover{background:#eee}.picker-actions{text-align:right}
      .systemika-alert-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;padding:24px}.systemika-alert-card{width:min(520px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:auto;background:#fff;border:1px solid #777;box-shadow:0 12px 42px rgba(0,0,0,.42);font-size:13px}.systemika-alert-title{font-weight:600;padding:10px 12px;border-bottom:1px solid #ccc;background:#f4f4f4}.systemika-alert-message{padding:18px 16px;line-height:1.4}.systemika-alert-actions{padding:9px 12px;border-top:1px solid #ddd;text-align:right}.systemika-alert-actions button{min-width:72px;padding:6px 14px}
      @media(max-width:1100px){.plots{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:8px}}
      @media(max-height:720px){.main{padding:6px 8px 7px}h1{font-size:17px;margin-bottom:1px}.universal-legend{margin-bottom:4px;padding:1px;font-size:11px}.plots{gap:7px}.plot-controls{padding:3px}.plot-controls button{padding:3px 4px;font-size:9px}aside{padding:8px}aside h2{font-size:18px;margin-bottom:6px}.top-actions button,.add{padding:5px 7px}.save-status{min-height:13px;margin-bottom:3px}.add{margin-bottom:6px}th,td{padding:2px}}
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

  function calibrationWindowRect() {
    const screenInfo = root.screen || {};
    const availWidth = Math.max(0, Number(screenInfo.availWidth) || 0);
    const availHeight = Math.max(0, Number(screenInfo.availHeight) || 0);
    const availLeft = Number(screenInfo.availLeft) || 0;
    const availTop = Number(screenInfo.availTop) || 0;
    const marginX = availWidth >= 900 ? 16 : 0;
    const marginY = availHeight >= 650 ? 20 : 0;
    return {
      width: availWidth ? Math.max(480, availWidth - marginX * 2) : 1480,
      height: availHeight ? Math.max(520, availHeight - marginY * 2) : 900,
      left: availLeft + marginX,
      top: availTop + marginY
    };
  }

  function panelWidthBounds() {
    const total = state.win && !state.win.closed ? Math.max(0, Number(state.win.innerWidth) || 0) : 0;
    const minPanel = 300;
    const minMain = total ? Math.min(650, Math.max(420, Math.round(total * 0.5))) : 650;
    return { min: minPanel, max: total ? Math.max(minPanel, total - minMain - 6) : 760 };
  }

  function applyPanelWidth() {
    if (!state.win || state.win.closed) return;
    const shell = state.win.document.querySelector('.shell');
    if (!shell) return;
    const bounds = panelWidthBounds();
    const preferred = Math.max(bounds.min, Math.round(Number(state.panelWidth) || 408));
    const visibleWidth = Math.min(bounds.max, preferred);
    shell.style.gridTemplateColumns = `minmax(0,1fr) 6px ${visibleWidth}px`;
  }

  function openWindow() {
    if (state.win && !state.win.closed) { state.win.focus(); return state.win; }
    const rect = calibrationWindowRect();
    const features = `width=${rect.width},height=${rect.height},left=${rect.left},top=${rect.top},resizable=yes,scrollbars=yes`;
    state.win = root.open('', 'systemika-calibration-sandbox', features);
    if (!state.win) { root.alert('Systemika could not open the Calibration Sandbox. Please allow pop-up windows and try again.'); return null; }
    try { state.win.moveTo(rect.left, rect.top); state.win.resizeTo(rect.width, rect.height); } catch (_error) {}
    state.win.document.open(); state.win.document.write(popupHtml()); state.win.document.close();
    state.win.addEventListener('beforeunload', () => {
      persistSandboxState();
      clearLiveRerunTimer();
      if (typeof RunResults !== 'undefined') RunResults.systemikaCallbackScheduler = null;
      state.alertQueue.length = 0; state.activeAlert = null; state.win = null;
    });
    // A focus/visibility transition is also a useful recovery point if the app
    // was suspended by the OS while the user was in another window.
    state.win.addEventListener('focus', reconcileLiveRunState);
    state.win.document.addEventListener('visibilitychange', () => {
      if (!state.win.document.hidden) reconcileLiveRunState();
    });
    state.win.document.getElementById('reset-all').onclick = resetAll;
    state.win.document.getElementById('save-default').onclick = saveAsDefault;
    state.win.document.getElementById('add-constant').onclick = chooseConstant;
    installPanelResizer();
    state.win.addEventListener('resize', applyPanelWidth);
    applyPanelWidth();
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
      const bounds = panelWidthBounds();
      const width = Math.max(bounds.min, Math.min(bounds.max, state.win.innerWidth - event.clientX));
      state.panelWidth=Math.round(width); shell.style.gridTemplateColumns = `minmax(0,1fr) 6px ${state.panelWidth}px`; schedulePersist();
    });
    const finish = () => { dragging = false; };
    splitter.addEventListener('pointerup', finish); splitter.addEventListener('pointercancel', finish);
  }

  function applyPickerFilter(host, query) {
    const q=String(query||'').trim().toLocaleLowerCase();
    let visible=0;
    host.querySelectorAll('.picker-list button').forEach(button=>{
      const matches=!q||button.textContent.toLocaleLowerCase().includes(q);
      // The picker stylesheet intentionally makes every result button display:block.
      // In Chromium that author rule can override the browser's default [hidden]
      // styling, which made the previous search update the hidden property without
      // changing what users saw. Set display explicitly as well as hidden so the
      // live filter is deterministic in both Electron and the WebApp.
      button.hidden=!matches;
      button.style.display=matches?'':'none';
      if(matches)visible++;
    });
    const empty=host.querySelector('.picker-no-match');
    if(empty){
      const showEmpty=visible===0;
      empty.hidden=!showEmpty;
      empty.style.display=showEmpty?'block':'none';
    }
  }

  function choose(title, items, callback) {
    if (!state.win || state.win.closed) return;
    const d=state.win.document, host=d.getElementById('picker-host');
    const rows=items.map(p=>`<button type="button" data-id="${esc(p.id)}">${esc(getName(p))}</button>`).join('');
    host.innerHTML=`<div class="picker"><div class="picker-card"><strong>${esc(title)}</strong><input type="search" placeholder="Find variable…" autocomplete="off" spellcheck="false"><div class="picker-list">${rows}<div class="empty picker-no-match" hidden>No matching model entities.</div></div><div class="picker-actions"><button type="button" class="cancel">Cancel</button></div></div></div>`;
    const input=host.querySelector('input');
    const filter=()=>applyPickerFilter(host,input.value);
    input.addEventListener('input',filter);
    input.addEventListener('search',filter);
    host.querySelector('.cancel').onclick=()=>host.innerHTML='';
    host.querySelectorAll('.picker-list button').forEach(b=>b.onclick=()=>{const p=findID(b.dataset.id);host.innerHTML='';if(p)callback(p);});
    applyPickerFilter(host,'');
    input.focus();
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
    let body=''; state.ranges.forEach((r,id)=>{const p=findID(id);if(!p)return;const v=numericValue(p);body+=`<tr data-id="${esc(id)}"><td class="name" title="${esc(getName(p))}">${esc(getName(p))}</td><td><input class="min" type="number" value="${r.min}"></td><td class="slider-cell"><input class="slider" type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}"><span class="current">${v}</span></td><td><input class="max" type="number" value="${r.max}"></td><td><input class="step" type="number" min="0" value="${r.step}"></td><td><button class="reset">Reset</button></td><td><button class="remove" type="button" title="Remove parameter" aria-label="Remove ${esc(getName(p))} from calibration sliders">×</button></td></tr>`;});
    host.innerHTML=`<table><colgroup><col class="col-name"><col class="col-bound"><col class="col-slider"><col class="col-bound"><col class="col-step"><col class="col-reset"><col class="col-remove"></colgroup><thead><tr><th>PARAMETER</th><th>MIN</th><th>SLIDER</th><th>MAX</th><th>INCREMENT</th><th></th><th></th></tr></thead><tbody>${body}</tbody></table>`;
    host.querySelectorAll('tr[data-id]').forEach(tr=>{const id=tr.dataset.id,p=findID(id),r=state.ranges.get(id),slider=tr.querySelector('.slider'),current=tr.querySelector('.current');
      const syncBounds=()=>{r.min=num(tr.querySelector('.min').value)??r.min;r.max=num(tr.querySelector('.max').value)??r.max;r.step=Math.max(num(tr.querySelector('.step').value)??r.step,Number.EPSILON);slider.min=r.min;slider.max=r.max;slider.step=r.step;schedulePersist();};
      tr.querySelector('.min').onchange=syncBounds;tr.querySelector('.max').onchange=syncBounds;tr.querySelector('.step').onchange=syncBounds;
      slider.oninput=()=>{const v=num(slider.value);if(v==null)return;root.clearTimeout(state.persistTimer);state.persistTimer=null;current.textContent=String(v);setNumericValue(p,v,{live:true});updateSaveDefaultState(true);scheduleRerun();};
      // Persist only after the user commits/releases the slider. Live input remains
      // simulation-only so calibration metadata and full editor validation never
      // compete with interactive range-control movement.
      slider.onchange=()=>{const v=num(slider.value);if(v!=null)setNumericValue(p,v);schedulePersist(0);};
      tr.querySelector('.reset').onclick=()=>{const v=state.defaults.get(id);if(v==null)return;setNumericValue(p,v);slider.value=v;current.textContent=String(v);updateSaveDefaultState(true);scheduleRerun();schedulePersist();};
      tr.querySelector('.remove').onclick=()=>{state.ranges.delete(id);renderParameters();schedulePersist(0);};
    });
    updateSaveDefaultState(false);
  }

  function resetAll(){state.ranges.forEach((_r,id)=>{const p=findID(id),v=state.defaults.get(id);if(p&&v!=null)setNumericValue(p,v);});renderParameters();updateSaveDefaultState(true);scheduleRerun();schedulePersist();}
  function saveAsDefault(){state.ranges.forEach((_r,id)=>{const p=findID(id);if(p)state.defaults.set(id,numericValue(p));});if(typeof History!=='undefined'&&typeof History.storeUndoState==='function')History.storeUndoState();if(root.InfoBar&&typeof InfoBar.update==='function')InfoBar.update();renderParameters();showDefaultSavedFeedback();schedulePersist();}

  function snapshot(){return {version:1,plots:state.plots.map(p=>({...p})),parameters:Array.from(state.ranges.entries()).map(([id,r])=>({id,min:r.min,max:r.max,step:r.step,defaultValue:state.defaults.get(id),value:(()=>{const p=findID(id);return p?numericValue(p):null;})()})),panelWidth:state.panelWidth};}
  function restore(saved){if(!saved||saved.version!==1)return;state.plots=Array.from({length:6},(_,i)=>({...((saved.plots&&saved.plots[i])||{reference:null,simulated:null})}));state.ranges.clear();(saved.parameters||[]).forEach(x=>{if(!findID(String(x.id)))return;state.ranges.set(String(x.id),{min:Number(x.min),max:Number(x.max),step:Number(x.step)});if(Number.isFinite(Number(x.defaultValue)))state.defaults.set(String(x.id),Number(x.defaultValue));if(Number.isFinite(Number(x.value)))setNumericValue(findID(String(x.id)),Number(x.value));});if(Number.isFinite(Number(saved.panelWidth)))state.panelWidth=Math.max(300,Number(saved.panelWidth));}
  async function persistSandboxState(){if(!state.decision||!state.decision.persist||!root.systemikaSimulationData||typeof root.systemikaSimulationData.updateRunMetadata!=='function')return;try{await root.systemikaSimulationData.updateRunMetadata(state.decision.runName,{calibrationSandbox:snapshot()});}catch(e){console.warn('Could not persist Calibration Sandbox state',e);}}
  function schedulePersist(delay=350){root.clearTimeout(state.persistTimer);state.persistTimer=root.setTimeout(persistSandboxState,Math.max(0,Number(delay)||0));}

  function seriesFor(id){ if(!id||typeof RunResults==='undefined')return[];const idx=RunResults.varIdList.indexOf(Number(id));if(idx<0)return[];return RunResults.results.map(r=>[Number(r[0]),Number(r[idx])]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])); }
  function svgPlot(index){
    const spec=state.plots[index], ref=seriesFor(spec.reference), sim=seriesFor(spec.simulated), all=ref.concat(sim); const W=600,H=350,l=52,r=15,t=18,b=38;
    if(!all.length)return `<svg viewBox="0 0 ${W} ${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="18" fill="#666">Select variables</text></svg>`;
    let xmin=Math.min(...all.map(p=>p[0])),xmax=Math.max(...all.map(p=>p[0])),ymin=Math.min(...all.map(p=>p[1])),ymax=Math.max(...all.map(p=>p[1]));if(xmax===xmin)xmax=xmin+1;if(ymax===ymin){ymin-=1;ymax+=1;}const pad=(ymax-ymin)*.06;ymin-=pad;ymax+=pad;
    const x=v=>l+(v-xmin)/(xmax-xmin)*(W-l-r), y=v=>t+(ymax-v)/(ymax-ymin)*(H-t-b); const path=a=>a.map((p,i)=>`${i?'L':'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
    let grid='';for(let i=0;i<=5;i++){let yy=t+i*(H-t-b)/5,v=ymax-i*(ymax-ymin)/5;grid+=`<line x1="${l}" y1="${yy}" x2="${W-r}" y2="${yy}" stroke="#e5e5e5"/><text x="${l-6}" y="${yy+4}" text-anchor="end" font-size="11">${v.toPrecision(3)}</text>`;}for(let i=0;i<=5;i++){let xx=l+i*(W-l-r)/5,v=xmin+i*(xmax-xmin)/5;grid+=`<line x1="${xx}" y1="${t}" x2="${xx}" y2="${H-b}" stroke="#eee"/><text x="${xx}" y="${H-b+17}" text-anchor="middle" font-size="11">${v.toPrecision(3)}</text>`;}
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<line x1="${l}" y1="${H-b}" x2="${W-r}" y2="${H-b}" stroke="#222"/><line x1="${l}" y1="${t}" x2="${l}" y2="${H-b}" stroke="#222"/>${ref.length?`<path d="${path(ref)}" fill="none" stroke="#7E2F8E" stroke-width="2.4" stroke-dasharray="8 6" vector-effect="non-scaling-stroke"/>`:''}${sim.length?`<path d="${path(sim)}" fill="none" stroke="#009E73" stroke-width="2.4" vector-effect="non-scaling-stroke"/>`:''}<text x="${(l+W-r)/2}" y="${H-5}" text-anchor="middle" font-size="12">Time</text></svg>`;
  }
  function renderPlots(){if(!state.win||state.win.closed)return;const host=state.win.document.getElementById('plots');host.innerHTML=state.plots.map((p,i)=>`<section class="plot"><div class="chart">${svgPlot(i)}</div><div class="plot-controls"><div class="plot-control-slot"><button class="choose-plot" data-i="${i}" data-role="reference">${p.reference?esc(getName(findID(p.reference))):'Select Reference Mode'}</button><button class="remove-plot" data-i="${i}" data-remove-role="reference" title="Remove reference variable" aria-label="Remove reference variable" ${p.reference?'':'disabled'}>×</button></div><div class="plot-control-slot"><button class="choose-plot" data-i="${i}" data-role="simulated">${p.simulated?esc(getName(findID(p.simulated))):'Select Simulated Variable'}</button><button class="remove-plot" data-i="${i}" data-remove-role="simulated" title="Remove simulated variable" aria-label="Remove simulated variable" ${p.simulated?'':'disabled'}>×</button></div></div></section>`).join('');host.querySelectorAll('.choose-plot').forEach(b=>b.onclick=()=>choosePlot(Number(b.dataset.i),b.dataset.role));host.querySelectorAll('.remove-plot:not(:disabled)').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i),role=b.dataset.removeRole;if(!state.plots[i]||!['reference','simulated'].includes(role))return;state.plots[i][role]=null;renderPlots();schedulePersist();});}

  // Live calibration reruns happen frequently. Rebuilding all six plot cards and
  // reattaching their button handlers after every run creates avoidable DOM work.
  // Once the cards exist, update only the SVG chart bodies; the controls change
  // only when the user explicitly chooses a different variable.
  function refreshPlotCharts(){
    if(!state.win||state.win.closed)return;
    const host=state.win.document.getElementById('plots');
    const cards=host?host.querySelectorAll('.plot'):[];
    if(!host||cards.length!==state.plots.length){renderPlots();return;}
    cards.forEach((card,i)=>{const chart=card.querySelector('.chart');if(chart)chart.innerHTML=svgPlot(i);});
  }

  function queuePendingRerunAfterPaint(){
    if(!state.rerunPending)return;
    state.rerunPending=false;
    const launch=()=>{
      if(state.running){state.rerunPending=true;return;}
      runCalibration(false);
    };
    // Yield through one sandbox paint before launching the newest pending run.
    // This keeps the range thumb responsive without adding another full debounce
    // interval after every completed simulation.
    if(state.win&&!state.win.closed&&typeof state.win.requestAnimationFrame==='function'){
      state.win.requestAnimationFrame(()=>liveSetTimeout(launch,0));
    }else{
      liveSetTimeout(launch,0);
    }
  }

  function finishRunIfStopped(token){
    if(token!==state.runToken||!state.running||typeof RunResults==='undefined')return false;
    if(RunResults.runState!=='stopped')return false;
    const completed=Boolean(RunResults.simulationDone);
    state.running=false;
    if(completed)refreshPlotCharts();
    if(completed&&state.rerunPending)queuePendingRerunAfterPaint();
    else if(!completed)state.rerunPending=false;
    return true;
  }

  function reconcileLiveRunState(){
    if(typeof RunResults==='undefined')return;
    if(state.running){finishRunIfStopped(state.runToken);return;}
    if(state.rerunPending)queuePendingRerunAfterPaint();
  }

  function waitForRun(token){
    const started=Date.now();
    const poll=()=>{
      if(token!==state.runToken||!state.running)return;
      if(typeof RunResults==='undefined')return;
      if(finishRunIfStopped(token))return;
      if(Date.now()-started<120000)liveSetTimeout(poll,10);
      else{state.running=false;state.rerunPending=false;}
    };
    liveSetTimeout(poll,10);
  }
  function runCalibration(persist){
    if(typeof RunResults==='undefined')return;
    if(state.running){state.rerunPending=true;return;}
    state.running=true;
    const token=++state.runToken;
    const base=state.decision||{proceed:true,persist:false,runName:'Calibration',overwrite:false};
    // Only the launch run is written to disk. Slider-driven calibration runs are
    // intentionally transient so disk I/O never sits in the live feedback path.
    RunResults.systemikaRunDecision={...base,persist:Boolean(persist&&base.persist)};
    // The engine normally schedules asynchronous pause/success callbacks on the
    // editor window. Route those callbacks through the sandbox window too, so
    // an Alt+Tab cannot make the simulation itself inherit background timer
    // throttling from the covered editor window.
    RunResults.systemikaCallbackScheduler=scheduleEngineCallback;
    try{
      RunResults.runSimulation();
      waitForRun(token);
    }catch(error){
      state.running=false;
      state.rerunPending=false;
      RunResults.systemikaRunDecision=null;
      throw error;
    }
  }
  function scheduleRerun(){
    if(state.running){state.rerunPending=true;return;}
    // Coalesce input to at most one launch every 40 ms, but do not restart the
    // clock on every range event. A true trailing debounce made continuous drags
    // feel slow because the simulation could not begin until the pointer paused.
    if(state.timer!=null)return;
    state.timer=liveSetTimeout(()=>{
      state.timer=null;
      if(state.running){state.rerunPending=true;return;}
      runCalibration(false);
    },40);
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
    if(!openWindow())return;applyPanelWidth();renderParameters();renderPlots();state.rerunPending=false; state.running=false; runCalibration(true);liveSetTimeout(schedulePersist,700);
  }

  function init(){const b=document.getElementById('btn_calibration_sandbox');if(b)b.addEventListener('click',e=>{e.preventDefault();launch();});}
  root.SystemikaCalibrationSandbox={launch,state,showTopAlert};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
