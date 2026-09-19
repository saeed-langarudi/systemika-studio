const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const runs = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'systemika-run-manager.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'style', 'editor.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');

test('text entry is isolated from single-key modeling/output shortcuts', () => {
  assert.match(editor, /\/\^\(INPUT\|TEXTAREA\|SELECT\)\$\/[\s\S]{0,260}if \(editableTarget\) return;/);
  assert.match(editor, /this\.nameInput\.on\("keydown keyup keypress", event => event\.stopPropagation\(\)\)/);
  assert.doesNotMatch(editor, /n: "numberbox"/);
  assert.doesNotMatch(html, /id="btn_numberbox"/);
});

test('Run Name accepts Enter and run shortcuts without leaving the field', () => {
  assert.match(runs, /event\.key === 'Enter' \|\| runShortcut/);
  assert.match(runs, /key === '1' \|\| key === 'r'/);
  assert.match(runs, /root\.systemikaRunModel\(\)/);
  assert.match(editor, /window\.systemikaRunModel = \(\) => RunTool\.enterTool\(\)/);
});

test('output and run/variable selectors have fixed scrollable compact heights', () => {
  assert.match(css, /\.systemika-compare-run-options\s*\{[\s\S]{0,220}height:\s*78px\s*!important[\s\S]{0,180}overflow-y:\s*auto\s*!important/);
  assert.match(css, /\.included-list-div,[\s\S]{0,100}\.excluded-list-div[\s\S]{0,220}height:\s*145px\s*!important[\s\S]{0,180}overflow-y:\s*auto\s*!important/);
});

test('workspace uses settings-derived output width with toolbar-only output navigation', () => {
  assert.match(html, /class="workspace-row"[\s\S]*id="svgplanebackground"[\s\S]*id="systemika-output-splitter"[\s\S]*id="systemika-output-panel"/);
  assert.match(html, /id="systemika-output-view"[\s\S]*id="systemika-output-horizontal-splitter"[\s\S]*id="systemika-output-settings"/);
  assert.match(html, /id="systemika-output-title">Equations/);
  assert.match(html, /id="systemika-output-detach"[\s\S]{0,220}graphics\/unlink\.svg/);
  assert.doesNotMatch(html, /<span>Detach<\/span>|<span>Attach<\/span>/);
  assert.doesNotMatch(html, /systemika-output-selector|systemika-output-new|systemika-output-equations/);
  assert.match(html, /id="btn_equations"[^>]*data-title="Equations \(E\)"[\s\S]*graphics\/equations\.svg/);
  assert.match(css, /--systemika-setting-box-width:\s*360px[\s\S]{0,140}--systemika-default-panel-width:\s*378px[\s\S]{0,180}flex:\s*0 0 var\(--systemika-default-panel-width\)[\s\S]{0,120}min-width:\s*var\(--systemika-default-panel-width\)/);
  assert.match(editor, /syncDefaultPanelWidthToSettings\(\)[\s\S]{0,500}boxWidth \* 1\.05/);
  assert.match(editor, /const SystemikaOutputDock = \{/);
  assert.match(editor, /showEquations\(reveal = true\)[\s\S]{0,2200}equationList\.renderPanelHtml\(\)/);
  assert.match(editor, /SystemikaOutputDock\.openType\(\$\(this\)\.attr\("data-tool"\)\)/);
  assert.match(editor, /\["e", "p", "t", "x", "h"\]/);
});

test('Output workspace is closed by default and toolbar outputs reopen it', () => {
  assert.match(html, /id="systemika-output-splitter" class="systemika-output-splitter systemika-output-hidden"/);
  assert.match(html, /id="systemika-output-panel" class="systemika-output-panel systemika-output-hidden"[^>]*aria-hidden="true"/);
  assert.match(html, /id="systemika-output-close"[^>]*aria-label="Close output panel"[^>]*>×<\/button>/);
  assert.match(css, /\.systemika-output-hidden\s*\{[\s\S]{0,80}display:\s*none !important/);
  assert.match(editor, /_hidden:\s*true/);
  assert.match(editor, /closeButton\.addEventListener\("click", \(\) => this\.closeWorkspace\(\)\)/);
  assert.match(editor, /openType\(type\)[\s\S]{0,180}this\.openWorkspace\(\)/);
  assert.match(editor, /showEquations\(false\)/);
});

test('Closing a detached output hides it and the next toolbar invocation reopens docked', () => {
  assert.match(editor, /popup\.addEventListener\("beforeunload"[\s\S]{0,180}this\.closeWorkspace\(true\)/);
  assert.match(editor, /closeWorkspace\(fromExternalWindowClose = false\)[\s\S]{0,900}row\.appendChild\(panel\)[\s\S]{0,900}systemika-output-hidden/);
  assert.match(editor, /openWorkspace\(\)[\s\S]{0,500}classList\.remove\("systemika-output-hidden"\)[\s\S]{0,300}_hidden = false/);
});

test('Auxiliary and Equations toolbar tools use distinct icons', () => {
  assert.match(html, /id="btn_equations"[\s\S]{0,180}graphics\/equations\.svg/);
  assert.match(html, /id="btn_variable"[\s\S]{0,180}graphics\/variable\.svg/);
  assert.notEqual(
    fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'graphics', 'equations.svg'), 'utf8'),
    fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'graphics', 'variable.svg'), 'utf8')
  );
});

test('Equations reset plot/table split sizing and plot/table views default to equal 50/50 shares', () => {
  assert.match(editor, /showEquations\(reveal = true\)[\s\S]{0,1000}view\.style\.removeProperty\("flex"\)/);
  assert.match(editor, /showEquations\(reveal = true\)[\s\S]{0,1200}settings\.style\.removeProperty\("flex"\)/);
  assert.match(editor, /activateVisual\(visual, reveal = true\)[\s\S]{0,1200}view\.style\.flex = this\._visualViewFlex \|\| "1 1 0px"/);
  assert.match(editor, /settings\.style\.flex = "1 1 0px"/);
  assert.match(css, /\.systemika-output-view\s*\{[\s\S]{0,140}flex:\s*1 1 0px/);
  assert.match(css, /\.systemika-output-settings\s*\{[\s\S]{0,140}flex:\s*1 1 0px/);
  assert.match(css, /systemika-output-equations-mode \.systemika-output-view[\s\S]{0,120}flex:\s*1 1 auto !important/);
});

test('Detach opens a true external window and Attach returns the live panel', () => {
  assert.match(editor, /window\.open\("about:blank", "SystemikaOutputWindow"/);
  assert.match(editor, /host\.appendChild\(panel\)/);
  assert.match(editor, /attachExternalWindow\(fromWindowClose = false\)/);
  assert.doesNotMatch(editor, /label\.textContent = this\._detached \? "Attach" : "Detach"/);
  assert.match(editor, /button\.title = this\._detached \? "Attach output panel" : "Detach output panel"/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /frameName === "SystemikaOutputWindow"/);
  assert.match(main, /parent:\s*null/);
  assert.match(css, /\.systemika-output-panel\.systemika-output-external/);
});

test('Equations have no lower settings pane and use a compact top summary', () => {
  assert.match(css, /systemika-output-equations-mode \.systemika-output-horizontal-splitter,[\s\S]*systemika-output-settings[\s\S]*display:\s*none/);
  assert.match(editor, /equation-document-summary/);
  assert.match(editor, /equation-entity-count/);
  assert.match(editor, /equation-document-table/);
  assert.doesNotMatch(editor, /documentation-print/);
});

test('active plot/table settings are mounted live below the output and both dividers are draggable', () => {
  assert.match(editor, /mountInDock\(container\)[\s\S]{0,1500}systemikaLiveSettings/);
  assert.match(editor, /requestLiveApply\(delay = 80\)/);
  assert.doesNotMatch(editor, /className = "systemika-dock-settings-footer"/);
  assert.doesNotMatch(editor, /systemika-dock-apply/);
  assert.match(editor, /SystemikaOutputDock\.activateVisual\(visual\)/);
  assert.match(editor, /startVerticalResize[\s\S]{0,900}panel\.style\.flexBasis/);
  assert.match(editor, /systemika-output-horizontal-splitter[\s\S]{0,2600}view\.style\.flex/);
});


test('dialogs close on Escape even when focused text controls stop propagation', () => {
  assert.match(editor, /this\.dialogDiv\.addEventListener\("keydown"[\s\S]{0,300}event\.key === "Escape"[\s\S]{0,220}dialog\("close"\)/);
});

test('Table settings use the compact selected-variable finder and expose loading state', () => {
  assert.match(editor, /class TableSelectorComponent extends PlotVariableSelectorComponent/);
  assert.match(editor, /class PlotVariableSelectorComponent[\s\S]{0,6500}<strong>Selected Variable\(s\)<\/strong>/);
  assert.match(editor, /<b>Selected Variable\(s\):<\/b> \${selected}/);
  assert.match(editor, /this\.data\.namesToDisplay = IdsToDisplay\.map\(findID\)\.filter\(Boolean\)\.map\(getName\)/);
  assert.match(editor, /systemika-table-selection-summary/);
  assert.match(editor, /class TableSelectorComponent[\s\S]{0,4200}setDisplayIds\(this\.primitive, this\.displayIds\)/);
});

test('clipboard and Delete remain usable for outputs after plots leave the canvas', () => {
  assert.match(editor, /Clipboard\.captureIds\(\[selectedGraph\.id\], "copy"\)/);
  assert.match(editor, /Clipboard\.captureIds\(\[selectedGraph\.id\], "cut"\)/);
  assert.match(editor, /let dockOutput = window\.SystemikaOutputDock \? SystemikaOutputDock\.activeVisual : null;[\s\S]{0,360}tool_deletePrimitive\(String\(dockOutput\.id\)\)/);
});

test('output keyboard shortcuts toggle the currently visible output panel', () => {
  assert.match(editor, /toggleType\(type\)[\s\S]{0,900}!this\._hidden && sameActive[\s\S]{0,220}this\.closeWorkspace\(\)/);
  assert.match(editor, /toggleType\(type\)[\s\S]{0,1300}this\._hidden && sameActive[\s\S]{0,260}this\.openWorkspace\(\)/);
  assert.match(editor, /\["e", "p", "t", "x", "h"\][\s\S]{0,260}SystemikaOutputDock\.toggleType\(toolShortcuts\[key\]\)/);
});

test('startup Time Unit prompt centers against the full modeling canvas with outputs closed', () => {
  assert.match(editor, /class TimeUnitDialog extends jqDialog[\s\S]{0,2600}centerOnFullCanvas\(\)/);
  assert.match(editor, /centerOnFullCanvas\(\)[\s\S]{0,1000}document\.querySelector\("\.workspace-row"\)[\s\S]{0,500}document\.getElementById\("svgplanebackground"\)/);
  assert.match(editor, /centerX = \(canvasRect\.left \+ workspaceRect\.right\) \/ 2/);
  assert.match(editor, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => this\.centerOnFullCanvas\(\)\)\)/);
});
