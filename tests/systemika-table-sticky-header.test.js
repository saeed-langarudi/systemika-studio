const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const editor = fs.readFileSync('OpenSystemDynamics/src/editor.js', 'utf8');
const css = fs.readFileSync('OpenSystemDynamics/src/style/editor.css', 'utf8');
const index = fs.readFileSync('OpenSystemDynamics/src/index.html', 'utf8');
const msaSettings = fs.readFileSync('MultiSimulationAnalyser/settings.js', 'utf8');

test('Table output uses a dedicated scrolling region beneath the fixed selection summary', () => {
  const start = editor.indexOf('class TableVisual extends HtmlTwoPointer');
  const end = editor.indexOf('class HtmlOverlayTwoPointer', start);
  const tableVisual = editor.slice(start, end);
  assert.match(tableVisual, /systemika-table-selection-summary/);
  assert.match(tableVisual, /<div class="systemika-table-scroll-region"><table class='sticky-table/);
  assert.match(tableVisual, /html \+= `<\/div>`/);
});

test('Docked Table keeps its own viewport and sticky headings inside the table scroll region', () => {
  assert.match(css, /\.systemika-output-view\.systemika-output-table-view\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
  assert.match(css, /\.systemika-output-view \.systemika-docked-table\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
  assert.match(editor, /view\.classList\.toggle\("systemika-output-table-view", visual instanceof TableVisual\)/);
  assert.match(css, /\.systemika-table-scroll-region\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/);
  assert.match(css, /table\.sticky-table th\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;[\s\S]*?z-index:\s*4;/);
  assert.match(css, /table\.sticky-table\.systemika-multi-run-table thead\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;[\s\S]*?z-index:\s*6;/);
});


test('WebApp source entry points use the current release cache key', () => {
  assert.match(index, /editor\.js\?v=1\.1\.0/);
  assert.match(index, /style\/editor\.css\?v=1\.1\.0/);
  assert.match(msaSettings, /OpenSystemDynamics\/src\/index\.html\?v=1\.1\.0/);
});
