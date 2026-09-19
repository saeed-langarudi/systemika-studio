'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('OpenSystemDynamics/src/index.html');
const editor = read('OpenSystemDynamics/src/editor.js');
const preferences = read('OpenSystemDynamics/src/preferences.js');
const notices = read('OpenSystemDynamics/src/third-party-licenses.html');

test('Help menu contains only Systemika classroom help and legal notices', () => {
  for (const id of [
    'btn_getting_started', 'btn_shortcuts', 'btn_functions_help', 'btn_units_help',
    'btn_preferences', 'btn_about', 'btn_license', 'btn_thirdparty'
  ]) assert.match(html, new RegExp(`id="${id}"`));

  for (const obsolete of [
    'Support forum', 'StochSD User\'s Manual', 'Optim Manual', 'Sensi Manual',
    'StatRes Manual', 'ParmVar Manual', 'What is Full Potential CSS?',
    'Restart and Clear Model', 'Restart and Keep Model'
  ]) assert.doesNotMatch(html, new RegExp(obsolete.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('legacy hidden StochSD plugin menu is not exposed by the editor', () => {
  assert.doesNotMatch(html, /id="tools-menu-button"/);
  assert.doesNotMatch(editor, /querySelector\("#tools-menu-button"\)/);
  assert.doesNotMatch(editor, /class FullPotentialCSSDialog/);
});

test('Histogram is restored as a normal output toolbar tool with H shortcut', () => {
  assert.match(html, /<button id="btn_histoplot"[^>]*data-title="Histogram \(H\)"[^>]*data-tool="histoplot"/);
  assert.match(editor, /h:\s*"histoplot"/);
  assert.match(editor, /class HistoPlotDialog/);
});

test('built-in Systemika help covers workflow, shortcuts, functions, and strict units', () => {
  assert.match(editor, /class GettingStartedDialog extends CloseDialog/);
  assert.match(editor, /class KeyboardShortcutsDialog extends CloseDialog/);
  assert.match(editor, /class FunctionsAndEquationsDialog extends CloseDialog/);
  assert.match(editor, /class UnitsHelpDialog extends CloseDialog/);
  assert.match(editor, /strict reporting-only unit checker/);
  assert.match(editor, /Time Plot \/ XY Plot \/ Histogram/);
  assert.match(editor, /functionCategories\.map/);
});

test('Preferences use classroom-facing terminology rather than implementation names', () => {
  assert.doesNotMatch(preferences, /Prompt TimeUnitDialog|Force TimeUnit|DefinitionEditor|Experimental feature/);
  assert.match(preferences, /Ask for a time unit when starting a new model/);
  assert.match(preferences, /Show equation function helper/);
});

test('license and About text no longer contain stale 0.6 or all-rights-reserved language', () => {
  assert.match(editor, /GNU Affero General Public License, version 3 \(AGPLv3\)/);
  assert.doesNotMatch(editor, /Systemika 0\.6/);
  assert.doesNotMatch(editor, /All rights reserved/);
  assert.match(editor, /Systemika was developed from the open-source <a[^>]+>StochSD<\/a> codebase/);
});

test('third-party notice screen lists bundled libraries and drops obsolete runtime notices', () => {
  for (const name of ['Electron', 'jQuery', 'jqPlot', 'jQuery-UI', 'Normalize.css', 'CodeMirror', 'IDB-Keyval']) {
    assert.match(notices, new RegExp(`<h1>${name.replace('.', '\\.')}</h1>`));
  }
  assert.doesNotMatch(notices, /Insight Maker Public License/);
  assert.doesNotMatch(notices, /<h1>NW\.js<\/h1>/);
  assert.doesNotMatch(notices, /<h1>jStat<\/h1>|<h1>Springy<\/h1>|<h1>ANTLR<\/h1>/);
});


test('provenance links live in About rather than the top-right menu bar', () => {
  assert.doesNotMatch(html, /id="homepage-info"/);
  assert.doesNotMatch(html, /Editor lineage:/);
  assert.match(editor, /href="https:\/\/systemika\.no"/);
  assert.match(editor, /href="https:\/\/stochsd\.sourceforge\.io"/);
  assert.match(editor, /href="https:\/\/insightmaker\.com"/);
  assert.match(editor, /historical lineage to <a[^>]+>Insight Maker<\/a>/);
});

test('main page has balanced HTML comments and no orphan marker after jQuery include', () => {
  const starts = (html.match(/<!--/g) || []).length;
  const ends = (html.match(/-->/g) || []).length;
  assert.equal(starts, ends);
  assert.doesNotMatch(html, /jquery\/jquery-1\.8\.3\.min\.js"><\/script>\s*-->/);
});
