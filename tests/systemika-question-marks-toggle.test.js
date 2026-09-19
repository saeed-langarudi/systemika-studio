const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'index.html'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'editor.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'style', 'editor.css'), 'utf8');
const icon = fs.readFileSync(path.join(root, 'OpenSystemDynamics', 'src', 'graphics', 'hidden.svg'), 'utf8');

test('vertical toolbar exposes the requested question-mark visibility toggle and icon', () => {
  assert.match(html, /id="btn_question_marks"[^>]+data-title="Hide\/Unhide Question Marks \(Q\)"[^>]+data-action="toggle-question-marks"/);
  assert.match(html, /id="btn_question_marks"[\s\S]{0,300}graphics\/hidden\.svg/);
  assert.match(icon, /id="hidden"/);
  assert.match(css, /button\.tool-button\.toggle-active/);
});

test('Q toggles question-mark display without changing definition-error state', () => {
  assert.match(editor, /const DefinitionQuestionMarks = \{[\s\S]{0,900}visible: true[\s\S]{0,900}visibilityFor\(hasDefinitionError\)/);
  assert.match(editor, /if \(key === "q"\)[\s\S]{0,180}DefinitionQuestionMarks\.toggle\(\)/);
  assert.match(editor, /data-action"\) === "toggle-question-marks"[\s\S]{0,180}DefinitionQuestionMarks\.toggle\(\)/);
  assert.equal((editor.match(/DefinitionQuestionMarks\.visibilityFor\(hasDefError\)/g) || []).length, 2);
  assert.match(editor, /DefinitionError\.has\(prim\)/);
  assert.match(editor, /Hide \/ unhide definition question marks<\/td><td>Q/);
});
