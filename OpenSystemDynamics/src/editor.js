/*

This file may distributed and/or modified under the
terms of the Affero General Public License (http://www.gnu.org/licenses/agpl-3.0.html).


*/
// Dialog window handlers
/** @type {DefinitionEditor} */
var definitionEditor;
/** @type {ConverterDialog} */
var converterDialog;
/** @type {LinkPropertiesDialog} */
var linkPropertiesDialog;
/** @type {PreferencesDialog} */
var preferencesDialog;
/** @type {SimulationSettings} */
var simulationSettings;
/** @type {TimeUnitDialog} */
var timeUnitDialog;
/** @type {EquationListDialog} */
var equationList;
/** @type {UnitCheckDialog} */
var unitCheckDialog;
/** @type {DebugDialog} */
var debugDialog;
/** @type {AboutDialog} */
var aboutDialog;
/** @type {GettingStartedDialog} */
var gettingStartedDialog;
/** @type {KeyboardShortcutsDialog} */
var keyboardShortcutsDialog;
/** @type {FindVariableDialog} */
var findVariableDialog;
/** @type {FunctionsAndEquationsDialog} */
var functionsAndEquationsDialog;
/** @type {UnitsHelpDialog} */
var unitsHelpDialog;
/** @type {ThirdPartyLicensesDialog} */
var thirdPartyLicensesDialog;
/** @type {LicenseDialog} */
var licenseDialog;
/** @type {DirectoryDialog} */
let directoryDialog;
/** @type {BrowserModelsDialog} */
let browserModelsDialog;

const isMac = ["Macintosh", "MacIntel", "MacPPC", "Mac68K"].includes(window.navigator.platform);
// The keyboard handler listens for Cmd on macOS and Ctrl elsewhere, so every
// shortcut label has to say the same thing. CodeMirror's Ctrl-Space
// autocomplete is deliberately left out of this: Cmd-Space is Spotlight.
const modifierKey = isMac ? "Cmd" : "Ctrl";

// Menu labels and tool tooltips are written with "Ctrl" in the markup, since
// that is right everywhere except macOS. Rewrite them once at startup.
function applyPlatformShortcutLabels() {
	if (!isMac) {
		return;
	}
	$(".shortcut").each(function () {
		this.textContent = this.textContent.replace(/\bCtrl\b/g, modifierKey);
	});
	// Tool button tooltips, drawn by CSS from attr(data-title).
	$("[data-title]").each(function () {
		let title = this.getAttribute("data-title");
		if (title.includes("Ctrl")) {
			this.setAttribute("data-title", title.replace(/\bCtrl\b/g, modifierKey));
		}
	});
}

// The drawing area, in canvas coordinates. Matches the width and height the
// svg is authored with in index.html.
const CANVAS_WIDTH = 6000;
const CANVAS_HEIGHT = 2000;

// This values are not used by StochSD, as primitives cannot be resized in StochSD
// Legacy geometry defaults retained for .ssd file compatibility
const type_size = {
	"stock": [80, 60],
	"variable": [60, 60],
	"flow": [60, 60],
	"converter": [80, 60],
	"text": [120, 60]
}

// Name type translations
// the keys are what the visuals have as type
// The values what new names should be based on when creating new visuals
const type_basename = {
	timeplot: "TimePlot", // legacy TimePlot primitives remain loadable
	compareplot: "TimePlot",
	xyplot: "XyPlot",
	histoplot: "HistoPlot",
	table: "Table",
	rectangle: "Rectangle",
	ellipse: "Ellipse",
	line: "Line",
	numberbox: "Numberbox",
	text: "Text",
	stock: "Stock",
	variable: "Auxiliary",
	flow: "Flow",
	link: "Link",
	converter: "Lookup",
	text: "Text",
	constant: "Constant"
};

// Stores Visual objects and connections
/** @type {{ [id: string]: TwoPointer }} */
var connection_array = {};
/** @type {{ [id: string]: OnePointer }} */
var object_array = {};

// Display preference for the question-mark overlays that flag definition errors.
// This is intentionally UI-only: definition checking and simulation validation
// continue to work even when the markers are hidden.
const DefinitionQuestionMarks = {
	visible: true,
	visibilityFor(hasDefinitionError) {
		return this.visible && hasDefinitionError ? "visible" : "hidden";
	},
	toggle() {
		this.visible = !this.visible;
		this.refresh();
	},
	refresh() {
		for (let item of Object.values(get_all_objects())) {
			if (!item || !item.icons || !item.primitive) continue;
			let prim = item.is_ghost ? findID(item.primitive.getAttribute("Source")) : item.primitive;
			if (!prim) continue;
			item.icons.set("questionmark", this.visibilityFor(DefinitionError.has(prim)));
		}
		let button = typeof document !== "undefined" ? document.getElementById("btn_question_marks") : null;
		if (button) {
			button.setAttribute("aria-pressed", String(!this.visible));
			button.classList.toggle("toggle-active", !this.visible);
		}
	}
};

const mouse = {
	// Stores state related to mouse
	clickedOnObject: false,
	lastClickedPrimitive: null, // Points to the object we last clicked
	isLeftDown: false,
	downX: 0,
	downY: 0,
	x: 0,
	y: 0,
	lastCanvasX: NaN,
	lastCanvasY: NaN,
	emptyClickDown: false,
	// NOTE: values for event.which should be used
	// event.button will give incorrect results
	left: 1,
	middle: 2,
	right: 3
};


// Stores log for the global log
var global_log = "";


// default svg values
var defaultFill = "transparent";
var defaultStroke = "black";


function applicationReload() {
	environment.reloadingStarted = true;
	location.reload();
}

// Called once a save of any kind has actually succeeded. Cancelling a save
// dialog must not reach this, or the model looks saved when it is not.
function markModelSaved(savedState = null) {
	History.markSaved(savedState);
}

function getSelectedGhostNavigationContext() {
	if (typeof get_selected_root_objects !== "function") return null;
	let selected = Object.values(get_selected_root_objects() || {}).filter(Boolean);
	if (selected.length !== 1) return null;

	let visual = selected[0];
	let ghostableTypes = ["stock", "variable", "constant", "converter", "flow"];
	if (!visual || (!visual.is_ghost && !ghostableTypes.includes(String(visual.type || "").toLowerCase()))) return null;

	let selectedId = String(visual.id || "");
	let primitive = selectedId ? findID(selectedId) : null;
	if (!primitive) return null;

	let sourceId = selectedId;
	if (visual.is_ghost || getType(primitive) === "Ghost") {
		sourceId = String(primitive.getAttribute("Source") || "");
	}
	if (!sourceId || !findID(sourceId) || !get_object(sourceId)) return null;

	return { selectedId, sourceId, selectedVisual: visual };
}

function updateFindGhostsButtonState() {
	let button = typeof document !== "undefined" ? document.getElementById("btn_find_ghosts") : null;
	if (button) button.disabled = getSelectedGhostNavigationContext() == null;
}

function refreshSelectionStacking() {
	if (typeof SVG !== "undefined" && SVG.svgElement && typeof get_selected_root_objects === "function") {
		let selected = Object.values(get_selected_root_objects() || {}).filter(Boolean);
		SVG.svgElement.classList.toggle("selection-on-top", selected.length > 0);
	}
	updateFindGhostsButtonState();
}

function timeAxisLabel() {
	let unit = String(typeof getTimeUnits === "function" ? (getTimeUnits() || "") : "").trim();
	return unit ? `Time (${unit})` : "Time";
}

function directedLinkExists(sourceId, targetId, ignoreLinkId = null) {
	if (sourceId == null || targetId == null) return false;
	return primitives("Link").some(link => {
		if (ignoreLinkId != null && String(getID(link)) === String(ignoreLinkId)) return false;
		return link.source && link.target &&
			String(link.source.id) === String(sourceId) &&
			String(link.target.id) === String(targetId);
	});
}

// Save into browser storage. Once a model has a name there, Save just
// overwrites it; before that we have to ask what to call it.
function saveModelToBrowser() {
	if (fileManager.storedModelName === null) {
		browserModelsDialog.showForSaveAs();
		return;
	}
	browserModelsDialog.storeModel(fileManager.storedModelName);
}

function preserveRestart() {
	History.toLocalStorage();
	localStorage.setItem("fileName", fileManager.fileName);
	localStorage.setItem("storedModelName", fileManager.storedModelName ?? "");
	localStorage.setItem("reloadPending", "1");
	applicationReload();
}

function restoreAfterRestart() {
	do_global_log("restoring");
	let reloadPending = localStorage.getItem("reloadPending");

	if (reloadPending == null) {
		// No reload is pending
		do_global_log("nothing pending to restore");

		// Clean up file manager - file handle
		fileManager.clean();

		// Set by startNewModel() so this particular reload lands on the time unit
		// dialog directly instead of showing the picker it was triggered from.
		let skipStartupPicker = localStorage.getItem("skipStartupPicker");
		localStorage.removeItem("skipStartupPicker");

		if (skipStartupPicker) {
			timeUnitDialog.show();
		} else if (environment instanceof WebEnvironment && ModelStorage.list().length > 0) {
			// Only worth landing on the picker if there is actually something
			// stored to pick from — otherwise it's just an empty table standing
			// between the user and a blank canvas.
			browserModelsDialog.showAtStartup();
		} else if (Preferences.get("promptTimeUnitDialogOnStart") && isTimeUnitOk(getTimeUnits()) === false) {
			// if creating new file without OK timeUnit => promt TimeUnitDialog
			// prompt TimeUnitDialog is unit not set
			timeUnitDialog.show();
		}
		return;
	}
	fileManager.init();
	do_global_log("removing pending flag");
	// Else remove the pending reload
	localStorage.removeItem("reloadPending");

	fileManager.fileName = localStorage.getItem("fileName");
	// Empty means the model is not in browser storage, so Save must ask for a name.
	fileManager.storedModelName = localStorage.getItem("storedModelName") || null;
	fileManager.updateTitle();

	do_global_log("restore the file");

	// Read the history from localStorage
	History.fromLocalStorage();

	if (Preferences.get("promptTimeUnitDialogOnStart") && isTimeUnitOk(getTimeUnits()) === false) {
		// if opening new file without OK timeUnit => promt TimeUnitDialog
		// prompt TimeUnitDialog is unit not set
		timeUnitDialog.show();
	}
}

class History {
	static #undoStates = []
	static get undoStates() {
		return this.#undoStates
	}
	static set undoStates(value) {
		this.#undoStates = value
		this.#updateUndoRedoButtons()
	}
	static #undoIndex = -1
	static get undoIndex() {
		return this.#undoIndex
	}
	static set undoIndex(value) {
		this.#undoIndex = value
		this.#updateUndoRedoButtons()
	}
	static #updateUndoRedoButtons() {
		$("#btn_undo").prop("disabled", this.undoStates.length == 0 || this.undoIndex == 0)
		$("#btn_redo").prop("disabled", this.undoStates.length == 0 || this.undoIndex == this.undoStates.length - 1)
	}

	static init() {
		// We define this.undoIndex as pointing to the currently active undoState
		// If we are at the first step with no undo-states behind it is -1
		this.undoStates = [];
		this.undoIndex = -1;
		this.lastUndoState = "";
		this.undoLimit = 10;

		// Keep the exact XML snapshot that was last successfully saved/loaded.
		// Dirty state must be derived from model state, not merely from whether
		// an edit has ever happened, otherwise Undo cannot return to "saved".
		this.savedState = null;
		this.setUnsavedChanges(false);
	}

	static setUnsavedChanges(value) {
		this.unsavedChanges = Boolean(value);
		if (this.unsavedChanges) {
			$("#unsaved_changes").removeClass("hidden");
			window.addEventListener("beforeunload", checkBeforeClose);
		} else {
			$("#unsaved_changes").addClass("hidden");
			window.removeEventListener("beforeunload", checkBeforeClose);
		}
	}

	static updateUnsavedState(currentState = null) {
		let state = currentState;
		if (state == null && this.undoIndex >= 0 && this.undoIndex < this.undoStates.length) {
			state = this.undoStates[this.undoIndex];
		}
		if (state == null && typeof createModelFileData === "function") {
			state = createModelFileData();
		}

		// A null savedState is used only before an initial model baseline exists.
		// Once a model is loaded or saved, equality with that exact snapshot is
		// authoritative and Undo/Redo can toggle the indicator in both directions.
		if (this.savedState == null) {
			this.setUnsavedChanges(Boolean(state));
			return;
		}
		this.setUnsavedChanges(state !== this.savedState);
	}

	static markSaved(savedState = null) {
		this.savedState = savedState != null
			? savedState
			: (typeof createModelFileData === "function" ? createModelFileData() : this.getCurrentState());
		this.setUnsavedChanges(false);
	}

	// Files can contain harmless XML-formatting/order differences that disappear
	// when Systemika serializes the loaded model.  If the active undo snapshot is
	// exactly the snapshot that was loaded/saved, replace both with the canonical
	// serialization of the model now in memory.  This prevents a selection click
	// (or any other non-mutating UI action followed by storeUndoState()) from
	// turning on Unsaved Changes merely because the XML text was normalized.
	static normalizeCleanBaseline(canonicalState = null) {
		if (this.savedState == null || this.getCurrentState() !== this.savedState) return false;
		let state = canonicalState;
		if (state == null && typeof createModelFileData === "function") state = createModelFileData();
		if (state == null) return false;
		if (this.undoIndex >= 0 && this.undoIndex < this.undoStates.length) {
			this.undoStates[this.undoIndex] = state;
		}
		this.lastUndoState = state;
		this.savedState = state;
		this.setUnsavedChanges(false);
		return true;
	}

  static storeUndoState() {
		// Create new XML for state
		let modelDocumentWriter = new SystemikaModelDocument();
		modelDocumentWriter.appendPrimitives();
    let undoState = modelDocumentWriter.getXmlString();

    // This means it's only the "Setting" and "Display" nodes,
    // which means the model is empty
    if (primitives().length === 2) return;

		// Add to undo history if it is different then previous state
		if (this.lastUndoState != undoState) {
			// Preserves only states from 0 to undoIndex
			this.undoStates.splice(this.undoIndex + 1);

			this.undoStates.push(undoState);
			this.undoIndex = this.undoStates.length - 1;
			this.lastUndoState = undoState;

			if (this.undoLimit < this.undoStates.length) {
				this.undoStates = this.undoStates.slice(this.undoStates.length - this.undoLimit);
				this.undoIndex = this.undoStates.length - 1;
			}
			this.updateUnsavedState(undoState);
			if (window.SystemikaOutputDock) SystemikaOutputDock.refreshEquationsIfVisible();
		}
	}

	static forceCustomUndoState(newState) {
		this.undoStates = [];
		this.undoStates.push(newState);
		this.undoIndex = 0;
		this.lastUndoState = newState;
		this.savedState = newState;
		this.setUnsavedChanges(false);
	}

	static doUndo() {
		if (this.undoIndex > 0) {
			this.undoIndex--;
			this.restoreUndoState();
		} else {
			xAlert("No more undo");
		}
	}

	static doRedo() {
		if (this.undoIndex < this.undoStates.length - 1) {
			this.undoIndex++;
			this.restoreUndoState();
		} else {
			xAlert("No more redo");
		}
	}

	static getCurrentState() {
		return this.undoStates[this.undoIndex];
	}

	static debug() {
		console.error("undo index " + this.undoIndex);
		console.error("history length " + this.undoStates.length);
		console.error(this.undoStates);
	}

	static restoreUndoState() {
		this.lastUndoState = this.undoStates[this.undoIndex];
		loadModelFromXml(this.lastUndoState);
		this.updateUnsavedState(this.lastUndoState);
	}

	static clearUndoHistory() {
		this.undoStates = [];
		this.undoIndex = -1;
		this.lastUndoState = "";
		this.savedState = null;
		this.setUnsavedChanges(false);
	}

	static toLocalStorage() {
		localStorage.setItem("undoState_length", this.undoStates.length);
		if (this.savedState == null) localStorage.removeItem("history_saved_state");
		else localStorage.setItem("history_saved_state", this.savedState);

		for (let i in this.undoStates) {
			let state = this.undoStates[i];
			localStorage.setItem("undoState_" + i, state);
		}

		localStorage.setItem("undoIndex", this.undoIndex);
	}

	static fromLocalStorage() {
		this.clearUndoHistory();
		this.savedState = localStorage.getItem("history_saved_state");
		let undoState_length = localStorage.getItem("undoState_length");
		for (let i = 0; i < undoState_length; i++) {
			let state = localStorage.getItem("undoState_" + i);
			this.undoStates.push(state);
		}
		this.undoIndex = localStorage.getItem("undoIndex");
		this.restoreUndoState();
	}
}
History.init();

function loadModelFromXml(XmlString) {
	clearModel();
	stochsd_clear_sync();
	loadXML(XmlString);
	replaceDiagamsWithTimePlots();
	syncAllVisuals();
}

function showPluginMenu() {
	$(".pluginMenu").show();
}

function sendToParentFrame(returnobj, target) {
	results = {};
	results.target = target;
	results.returnobj = returnobj;
	parent.postMessage(JSON.stringify(results), "*");
}

function loadPlugin(pluginName) {
	sendToParentFrame({ "app_name": pluginName }, "load_app");
}

function setParentTitle(newTitle) {
	sendToParentFrame({ "title": newTitle }, "update_title");
}

function quitQuestion() {
	// Called from ElectronEnvironment.ready() when electron/main.js intercepts
	// the window's close button and asks whether it's safe to actually close.
	saveChangedAlert(function () {
		environment.closeWindow()
	});
}

class InfoBar {

	static init() {
		this.infoDefinitionElement = $(".info-bar__definition")[0];
		this.cmInfoDef = new CodeMirror(this.infoDefinitionElement,
			{
				mode: "stochsd-dynamic-mode",
				theme: "stochsdtheme oneline",
				readOnly: "nocursor",
				lineWrapping: false
			}
		);
		this.infoDE = $(".info-bar__definition-error");
		$(this.infoDefinitionElement).find(".CodeMirror").css("border", "none");
		InfoBar.update()
	}
	static update() {
		let selected_hash = get_selected_root_objects();
		let selected_array = [];
		for (let key in selected_hash) {
			selected_array.push(selected_hash[key]);
		}

		if (selected_array.length == 0) {
			$(this.infoDefinitionElement).find(".CodeMirror").addClass("cm-comment")
			this.cmInfoDef.setValue("Nothing selected")
			this.infoDE.html("");
		} else if (selected_array.length == 1) {
			$(this.infoDefinitionElement).find(".CodeMirror").removeClass("cm-comment")
			let selected = selected_array[0];
			let primitive = selected_array[0].primitive;
			if (selected.is_ghost) {
				primitive = findID(primitive.getAttribute("Source"));
			}
			let name = primitive.getAttribute("name");
			let definition = getValue(primitive);
			this.infoDE.html(`${DefinitionError.getMessage(primitive)}`);

			let definitionLines = definition.split("\n");
			if (definitionLines[0] !== "") {
				this.cmInfoDef.setValue(`[${name}] = ${definitionLines[0]} | Unit: ${getUnits(primitive)}`);
			} else {
				let type = selected.type;

				// Make first letter uppercase
				// let Type = type.charAt(0).toUpperCase() + type.slice(1);
				let Type = type_basename[type];
				switch (type) {
					case "numberbox":
						let targetName = `${getName(findID(selected.primitive.getAttribute("Target")))}`
						this.cmInfoDef.setValue(`Numberbox: Value of [${targetName}]`);
						break;
					case "timeplot":
					case "compareplot":
					case "table":
					case "xyplot":
					case "histoplot":
						let names = selected.dialog.displayIdList.map(findID).filter(exist => exist).map(getName);
						this.cmInfoDef.setValue(`${Type}: ${names.map(name => ` [${name}]`)}`);
						break;
					case "link":
						let source = selected.getStartAttach() ? `[${getName(selected.getStartAttach().primitive)}]` : "NONE";
						let target = selected.getEndAttach() ? `[${getName(selected.getEndAttach().primitive)}]` : "NONE";
						this.cmInfoDef.setValue(`Link: ${source} -> ${target}`);
						break;
					default:
						this.cmInfoDef.setValue(`${Type} selected`);
				}
			}
		} else {
			$(this.infoDefinitionElement).find(".CodeMirror").removeClass("cm-comment")
			this.cmInfoDef.setValue(`${selected_array.length} objects selected`);
			this.infoDE.html("");
		}
	}
}

defaultAttributeChangeHandler = function (primitive, attributeName, value) {
	let id = getID(primitive);
	let type = getType(primitive);
	let visualObject = get_object(id);
	if (visualObject) {
		visualObject.attributeChangeHandler(attributeName, value);
	}

	switch (attributeName) {
		case "name":
			set_name(id, value);
			break;
	}
	//~ do_global_log("tjohej "+type+" "+attributeName);
	if (type == "Numberbox" && attributeName == "Target") {
		let visualObject = get_object(id);
		// render() can only be done when the numberbox is fully loaded
		// Therefor we have to check that visualObject is not null
		if (visualObject) {
			visualObject.render();
		}
	}
}

defaultPositionChangeHandler = function (primitive) {
	let newPosition = getCenterPosition(primitive)
	let visualObject = object_array[getID(primitive)];
	if (visualObject) {
		visualObject.setPos(newPosition);
	}
}

defaultPrimitiveCreatedHandler = function (primitive) {
	syncVisual(primitive);
}

defaultPrimitiveBeforeDestroyHandler = function (primitive) {
	stochsd_delete_primitive_and_references(getID(primitive));
}

// Legacy StochSD macros and Insight Maker simulation-function hooks were removed.
// Systemika equations are evaluated exclusively by systemika-engine.js.

function getVisibleNeighborhoodIds(id) {
	let neighbors = neighborhood(findID(id));
	let visibleNeighbors = neighbors.filter((neighbor) => { return (!neighbor.linkHidden) });
	return visibleNeighbors.map((neighbor) => { return neighbor.item.getAttribute("id"); });
}

function makePrimitiveName(primitiveName) {
	// Systemika model-entity names are identifier-safe, so the canonical equation
	// syntax uses bare names (Population, BirthRate) rather than Insight Maker's
	// legacy [Population] reference notation. The engine still accepts brackets
	// when opening older .ssd models.
	return String(primitiveName == null ? "" : primitiveName);
}

function stripBrackets(primitiveName) {
	let value = String(primitiveName == null ? "" : primitiveName).trim();
	if (value.startsWith("[") && value.endsWith("]")) return value.slice(1, -1);
	return value;
}

function formatFunction(functionName) {
	return functionName + "()";
}

function warningHtml(message, specNotOk = false) {
	let noChanges = "";
	if (specNotOk) noChanges = "<br/><b>Your specification is not accepted!</b>";
	return (`<span class="warning">${message} ${noChanges}</span>`);
}

function noteHtml(message) {
	return (`<span class="note">Note:<br/>${message}</span>`);
}

// Param keys is array of string or a string
function keyHtml(keys) {
	return Array.isArray(keys)
		? keys.map(key => `<kbd>${key}</kbd>`).join("+")
		: `<kbd>${keys}</kbd>`
}

function checkedHtml(value) {
	if (value) {
		return ' checked ';
	} else {
		return ' ';
	}
};

class EditorControll {
	static showEditor(primitive, annotations) {
		let primitiveId = getID(primitive);
		get_object(primitiveId).doubleClick();
	}
}

// But where the lines can be as long as required to print the variable
function stocsd_format(number, tdecimals, roundToZeroAt) {
	// tdecimals is optional and sets the number of decimals. It is rarly used (only in some tables)
	// Since the numbers automaticly goes to e-format when low enought

	// Used when e.g. the actuall error is reseted to null
	if (number == null) {
		return "";
	}

	// since its not written as E-format by default even as its <1E-7
	// Zero is a special case also or Round to zero when close
	if (number == 0 || (roundToZeroAt && Math.abs(number) < roundToZeroAt)) {
		return "0";
	}

	// Check if number is to small to be viewed in field
	// If so, force e-format

	if (Math.abs(number) < Math.pow(10, (-tdecimals))) {
		return number.toExponential(2);
	}
	//Check if the number is to big to be view ed in the field
	if (Math.abs(number) > Math.pow(10, tdecimals)) {
		return number.toExponential(2);
	}

	// Else format it as a regular number, and remove ending zeros
	let stringified = number.toFixed(tdecimals);

	// Find the length of stringified, where the ending zeros have been removed
	let i = stringified.length;
	while (stringified.charAt(i - 1) == '0') {
		i = i - 1;
		// If we find a dot. Stop removing decimals
		if (stringified.charAt(i - 1) == '.') {
			i = i - 1;
			break;
		}
	}
	// Creates a stripped string without ending zeros
	let stripped = stringified.substring(0, i);
	return stripped;
}

function get_parent_id(id) {
	let parent_id = id.toString().split(".")[0];
	//~ do_global_log("x flowa "+parent_id);
	return parent_id;
}

function get_parent(child) {
	return get_object(get_parent_id(child.id));
}

// Get a list of all children for a parent
function getChildren(parentId) {
	let result = {}
	for (let key in object_array) {
		if (get_parent_id(key) == parentId && key != parentId) {
			result[key] = object_array[key];
		}
	}
	for (let key in connection_array) {
		if (get_parent_id(key) == parentId && key != parentId) {
			result[key] = connection_array[key];
		}
	}
	return result;
}

// Return true if parent has any selected children
function hasSelectedChildren(parentId) {
	// Make sure we actually work on parent element
	parentId = get_parent_id(parentId);

	// Find the children
	let children = getChildren(parentId);
	for (let id in children) {
		if (children[id].isSelected()) {
			return true;
		}
	}
	return false;
}
/**
 *
 * @param {*} id
 * @param {"value" | "field"} field
 */
function openPrimitiveDialog(id, field = "name") {
	let primitive = findID(id)
	if (getType(primitive) == "Ghost") {
		// If we click on a ghost change id to point to source
		id = findID(id).getAttribute("Source");
		primitive = findID(id)
	}
	primitiveType = getType(primitive)
	if (primitiveType == "Converter") {
		converterDialog.open(id, `.${field}-field`);
	} else {
		definitionEditor.open(id, `.${field}-field`);
	}
}

class BaseObject {
		/**
	 * @param {string} id
	 * @param {string} type
	 * @param {[number, number]} pos
	 */
	constructor(id, type, pos) {
		this.id = id;
		this.type = type;
		this.selected = false;
		this.name_radius = 30;
		this.superClass = "baseobject";
		this.color = defaultStroke;
		// Warning: this.primitive can be null, since all DIM objects does not have a IM object such as anchors and flow_auxiliarys
		// We should therefor check if this.primitive is null, in case we dont know which class we are dealing with
		this.primitive = findID(this.id);

		this.element_array = [];
		this.selector_array = [];
		this.icons; 	// SVG.group with icons such as ghost and questionmark
		this.group = null;
		// Stock and Auxiliary names may be re-parented into a dedicated top SVG layer.
		// Keep the overlay group here so it follows the primitive and is cleaned up
		// with the rest of the visual.
		this.name_overlay_group = null;
		this.name_background_element = null;

		this.namePosList = [[0, this.name_radius + 8], [this.name_radius, 0], [0, -this.name_radius], [-this.name_radius, 0]];
	}

	setColor(color) {
		this.color = color;
		for (let element of this.element_array) {
			if (element.getAttribute("class") == "element") {
				element.setAttribute("stroke", this.color);
			} else if (element.getAttribute("class") == "name_element") {
				element.setAttribute("fill", this.color);
			} else if (element.getAttribute("class") == "highlight") {
				element.setAttribute("fill", this.color);
			}
		}
		// AnchorPoint has no primitive
		this.primitive?.setAttribute("Color", this.color);
		this.updateStockNameBackground();
	}

	updateDefinitionError() {
		let definitionErrorTypes = ["stock", "variable", "constant", "flow", "converter"];
		if (definitionErrorTypes.includes(this.type)) {
			DefinitionError.check(this.primitive);
			DefinitionError.has(this.primitive);
		}
	}

	getBoundRect() {
		// Override this function
		// This functions returns a hash map, e.i. {"minX": 10, "maxX": 20, "minY": 40, "maxY": 50}
		// The hashmap dictates in what rect mouse can click to create connections
	}

	getLinkMountPos(closeToPoint) {
		return this.getPos();
	}

	isSelected() {
		return this.selected;
	}

	clean() {
		// Clean all children
		let children = getChildren(this.id);
		for (let id in children) {
			children[id].clean();
			delete object_array[id];
		}

		this.clearImage();
	}
	clearImage() {
		// A Stock or Auxiliary name can live in the dedicated top label layer rather than
		// inside the primitive group. Remove that wrapper as part of the same
		// visual lifecycle.
		if (this.name_overlay_group) {
			this.name_overlay_group.remove();
			this.name_overlay_group = null;
			this.name_background_element = null;
		}
		// Do the cleaning
		for (let i in this.selector_array) {
			this.selector_array[i].remove();
		}
		for (let key in this.element_array) {
			this.element_array[key].remove();
		}
		if (!this.group)
			console.log(this.id, this.name, this.type);
		this.group.remove();
	}
	doubleClick() {
		// This function has to be overriden
	}
	afterNameChange() {
		// Do nothing. this method is supposed to be overriden by subclasses
	}
	afterMove(diff_x, diff_y) {
		// Override this
	}
	attachEvent() {
		// This happens every time a connection is connected or disconnected
		// Or when the connections starting point is connected or disconnected
		// Override this
	}
	get name_pos() {
		return this._name_pos;
	}

	set name_pos(value) {
		//~ alert("name pos for "+this.id+" "+getStackTrace());
		//~ do_global_log("updating name pos to "+value);
		this._name_pos = Number(value);
		if (this.primitive) {
			this.primitive.setAttribute("RotateName", value.toString());
		}
	}
	getType() {
		return this.type;
	}
	nameDoubleClick() {

		if (this.is_ghost) {
			errorPopUp("You must rename a ghost by renaming the original.");
			return;
		}
		let id = get_parent_id(this.id)
		definitionEditor.open(id, ".name-field");
		event.stopPropagation();
	}

	setName(new_name) {
		if (this.name_element == null) {
			do_global_log("Element has no name");
			return;
		}
		this.name_element.innerHTML = new_name;
		this.updateStockNameBackground();
	}

	getStockNameTextRgb() {
		if (!this.name_element) {
			return null;
		}
		let fill = this.name_element.getAttribute("fill") || this.color || "black";
		try {
			if (typeof window !== "undefined" && window.getComputedStyle) {
				fill = window.getComputedStyle(this.name_element).fill || fill;
			}
		} catch (error) {
			// Fall back to the SVG fill attribute if computed style is unavailable.
		}

		let match = String(fill).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
		if (match) {
			return [Number(match[1]), Number(match[2]), Number(match[3])];
		}
		match = String(fill).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
		if (match) {
			let hex = match[1];
			if (hex.length === 3) {
				hex = hex.split("").map(character => character + character).join("");
			}
			return [
				parseInt(hex.slice(0, 2), 16),
				parseInt(hex.slice(2, 4), 16),
				parseInt(hex.slice(4, 6), 16)
			];
		}
		return null;
	}

	getStockNameBackgroundColor() {
		const rgb = this.getStockNameTextRgb();
		if (!rgb) {
			return "#ffffff";
		}
		const linear = rgb.map(value => {
			const channel = Math.max(0, Math.min(255, value)) / 255;
			return channel <= 0.03928
				? channel / 12.92
				: Math.pow((channel + 0.055) / 1.055, 2.4);
		});
		const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
		return luminance > 0.5 ? "#111111" : "#ffffff";
	}

	updateStockNameBackground() {
		if (!this.name_background_element || !this.name_element) {
			return;
		}
		if (!String(this.name_element.textContent || "").trim()) {
			this.name_background_element.setAttribute("visibility", "hidden");
			return;
		}
		let box;
		try {
			box = this.name_element.getBBox();
		} catch (error) {
			return;
		}
		if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y) || !Number.isFinite(box.width) || !Number.isFinite(box.height)) {
			return;
		}
		const paddingX = 4;
		const paddingY = 2;
		let backgroundX = box.x - paddingX;
		let backgroundY = box.y - paddingY;
		let backgroundWidth = box.width + paddingX * 2;
		let backgroundHeight = box.height + paddingY * 2;

		// Keep the translucent label background clear of the Stock outline.
		// A Stock rectangle's stroke is centred on its geometric boundary, so
		// merely stopping at stockTop/stockBottom/etc. still paints over half of
		// the visible border. Reserve the half-stroke plus a small anti-aliasing
		// gap so the outline remains fully crisp while the label background stays
		// close to the name. Clamp only the edge facing the Stock; the other three
		// sides retain their normal padding.
		if (this.type === "stock" && typeof this.getSize === "function") {
			const [stockWidth, stockHeight] = this.getSize();
			const stockLeft = -stockWidth / 2;
			const stockRight = stockWidth / 2;
			const stockTop = -stockHeight / 2;
			const stockBottom = stockHeight / 2;
			const outlineElement = this.element_array.find(element =>
				element && element.getAttribute && element.getAttribute("class") === "element"
			);
			let outlineStrokeWidth = Number(outlineElement?.getAttribute("stroke-width"));
			if (!(outlineStrokeWidth > 0)) {
				try {
					outlineStrokeWidth = parseFloat(window.getComputedStyle(outlineElement).strokeWidth);
				} catch (error) {
					outlineStrokeWidth = 1;
				}
			}
			if (!(outlineStrokeWidth > 0)) {
				outlineStrokeWidth = 1;
			}
			const borderClearance = outlineStrokeWidth / 2 + 1;
			const stockOuterLeft = stockLeft - borderClearance;
			const stockOuterRight = stockRight + borderClearance;
			const stockOuterTop = stockTop - borderClearance;
			const stockOuterBottom = stockBottom + borderClearance;

			switch (Number(this.name_pos)) {
				case 0: { // Below
					const overlap = stockOuterBottom - backgroundY;
					if (overlap > 0) {
						backgroundY += overlap;
						backgroundHeight = Math.max(0, backgroundHeight - overlap);
					}
					break;
				}
				case 1: { // Right
					const overlap = stockOuterRight - backgroundX;
					if (overlap > 0) {
						backgroundX += overlap;
						backgroundWidth = Math.max(0, backgroundWidth - overlap);
					}
					break;
				}
				case 2: { // Above
					const backgroundBottom = backgroundY + backgroundHeight;
					const overlap = backgroundBottom - stockOuterTop;
					if (overlap > 0) {
						backgroundHeight = Math.max(0, backgroundHeight - overlap);
					}
					break;
				}
				case 3: { // Left
					const backgroundRight = backgroundX + backgroundWidth;
					const overlap = backgroundRight - stockOuterLeft;
					if (overlap > 0) {
						backgroundWidth = Math.max(0, backgroundWidth - overlap);
					}
					break;
				}
			}
		} else if (this.type === "variable" && typeof this.getRadius === "function") {
			// Auxiliary names use the same top-layer background as Stock names.
			// Because that overlay is painted above the Auxiliary circle, trim only
			// the edge facing the circle so the background never covers its outline.
			const outlineElement = this.element_array.find(element =>
				element && element.getAttribute && element.getAttribute("class") === "element"
			);
			let outlineStrokeWidth = Number(outlineElement?.getAttribute("stroke-width"));
			if (!(outlineStrokeWidth > 0)) {
				try {
					outlineStrokeWidth = parseFloat(window.getComputedStyle(outlineElement).strokeWidth);
				} catch (error) {
					outlineStrokeWidth = 1;
				}
			}
			if (!(outlineStrokeWidth > 0)) {
				outlineStrokeWidth = 1;
			}
			const auxiliaryOuterRadius = this.getRadius() + outlineStrokeWidth / 2 + 1;

			switch (Number(this.name_pos)) {
				case 0: { // Below
					const overlap = auxiliaryOuterRadius - backgroundY;
					if (overlap > 0) {
						backgroundY += overlap;
						backgroundHeight = Math.max(0, backgroundHeight - overlap);
					}
					break;
				}
				case 1: { // Right
					const overlap = auxiliaryOuterRadius - backgroundX;
					if (overlap > 0) {
						backgroundX += overlap;
						backgroundWidth = Math.max(0, backgroundWidth - overlap);
					}
					break;
				}
				case 2: { // Above
					const backgroundBottom = backgroundY + backgroundHeight;
					const overlap = backgroundBottom + auxiliaryOuterRadius;
					if (overlap > 0) {
						backgroundHeight = Math.max(0, backgroundHeight - overlap);
					}
					break;
				}
				case 3: { // Left
					const backgroundRight = backgroundX + backgroundWidth;
					const overlap = backgroundRight + auxiliaryOuterRadius;
					if (overlap > 0) {
						backgroundWidth = Math.max(0, backgroundWidth - overlap);
					}
					break;
				}
			}
		}

		this.name_background_element.setAttribute("x", backgroundX);
		this.name_background_element.setAttribute("y", backgroundY);
		this.name_background_element.setAttribute("width", backgroundWidth);
		this.name_background_element.setAttribute("height", backgroundHeight);
		this.name_background_element.setAttribute("fill", this.getStockNameBackgroundColor());
		this.name_background_element.setAttribute("visibility", "visible");
	}

	attributeChangeHandler(attributeName, value) {
		// Override this
	}
}

class OnePointer extends BaseObject {
		/**
	 * @param {string} id
	 * @param {string} type
	 * @param {[number, number]} pos
	 */
	constructor(id, type, pos, extras = false) {
		super(id, type, pos);
		// Add object to global
		object_array[id] = this;
		this.id = id;
		this.type = type;
		this.element_array = [];
		this.selector_array = [];
		this.group = null;
		this.superClass = "OnePointer";
		this.draggable = true; // Default value, change it afterwords if you want
		this.name_centered = false;
		this.pos = pos;
		this.is_ghost = false; // Default value
		if (extras != false) {
			do_global_log("has extras");
			if ("is_ghost" in extras) {
				this.is_ghost = extras["is_ghost"];
			}
		}
		do_global_log("is ghost " + this.is_ghost);

		this.loadImage();

		this.select();

		// Handled for when attribute changes in corresponding SimpleNode
		this.changeAttributeHandler = (attribute, value) => {
			if (attribute == "name") {
				this.setName(value);
			}
		}
	}

	getBoundRect() {
		let [x, y] = this.getPos();
		return { "minX": x - 10, "maxX": x + 10, "minY": y - 10, "maxY": y + 10 };
	}

	setPos(pos) {
		if (pos[0] == this.pos[0] && pos[1] == this.pos[1]) {
			// If the position has not changed we should not update it
			// This turned out to be a huge optimisation
			return;
		}
		// Recreating the array is intentional to avoid copying a reference
		//~ alert(" old pos "+this.pos[0]+","+this.pos[1]+" new pos "+pos[0]+","+pos[1]);
		this.pos = [pos[0], pos[1]];
	}

	/** @returns {[number, number]} */
	getPos() {
		// This must be done by splitting up the array and joining it again to avoid sending a reference
		// Earlier we had a bug that was caused by getPos was sent as reference and we got unwanted updates of the values
		return [this.pos[0], this.pos[1]];
	}


	loadImage() {
		let element_array = this.getImage();
		if (element_array == false) {
			alert("getImage() must be overriden to add graphics to this object");
		}

		this.element_array = element_array;

		for (let key in element_array) {
			if (element_array[key].getAttribute("class") == "highlight") {
				this.selector_array.push(element_array[key]);
			}
		}

		for (let key in element_array) {
			if (element_array[key].getAttribute("class") == "icons") {
				this.icons = this.element_array[key]
				break;
			}
		}

		if (this.is_ghost && this.icons) {
			this.icons.set("ghost", "visible");
		}


		// Set name element
		this.name_element = null;
		for (let key in element_array) {
			if (element_array[key].getAttribute("class") == "name_element") {
				this.name_element = element_array[key];
				$(this.name_element).dblclick((event) => {
					this.nameDoubleClick();
				});
			}
		}
		this.group = SVG.append(this.getLayer(), SVG.group(this.element_array));
		if (!this.group)
			console.log("group", this.id, this.primitive, this.name, this.type, this.getLayer() ,this.group);
		this.group.setAttribute("node_id", this.id);

		// Stock and Auxiliary labels must remain readable even when a flow pipe, valve,
		// link, or another primitive crosses the label. SVG paints later siblings on
		// top, so move those names into the final label layer and put the same
		// semi-transparent contrast background behind them. Keeping the text element
		// itself preserves its existing rename and selection event handlers. Ghosts
		// of Stocks/Auxiliaries receive the same treatment through their visual type.
		if ((this.type === "stock" || this.type === "variable") && this.name_element && SVG.stockLabelLayer) {
			this.name_background_element = SVG.rect(0, 0, 0, 0, "none", "#ffffff", "stock-name-background", {
				"fill-opacity": "0.72",
				"rx": "3",
				"ry": "3",
				"pointer-events": "none"
			});
			this.name_overlay_group = SVG.append(
				SVG.stockLabelLayer,
				SVG.group([this.name_background_element, this.name_element])
			);
			this.name_overlay_group.setAttribute("node_id", this.id);
			this.updateStockNameBackground();
		}

		this.update();

		for (let key in this.element_array) {
			let element = this.element_array[key];
			$(element).on("mousedown", (event) => {
				primitive_mousedown(this.id, event);
			});
		}
		$(this.group).dblclick((event) => {
			if (!$(event.target).hasClass("name_element")) {
				this.doubleClick(this.id);
			}
		});
	}
	getLayer() {
		return false;
	}

	select() {
		this.selected = true;
		for (let i in this.selector_array) {
			this.selector_array[i].setAttribute("visibility", "visible");
		}
		if (this.icons) {
			this.icons.setColor("white");
		}
		refreshSelectionStacking();
	}
	unselect() {
		this.selected = false;
		for (let i in this.selector_array) {
			this.selector_array[i].setAttribute("visibility", "hidden");
		}
		if (this.icons) {
			this.icons.setColor(this.color);
		}
		refreshSelectionStacking();
	}
	update() {
		const primitiveTransform = "translate(" + this.pos[0] + "," + this.pos[1] + ")";
		this.group.setAttribute("transform", primitiveTransform);
		if (this.name_overlay_group) {
			this.name_overlay_group.setAttribute("transform", primitiveTransform);
		}

		let prim = this.is_ghost ? findID(this.primitive.getAttribute("Source")) : this.primitive;
		if (this.icons && prim) {
			const hasDefError = DefinitionError.has(prim);
			this.icons.set("questionmark", DefinitionQuestionMarks.visibilityFor(hasDefError));
			this.icons.set("dice", (!hasDefError && hasRandomFunction(getValue(prim))) ? "visible" : "hidden");
		}

		if (!this.is_ghost) {
			this.updateGhosts();
		}
	}
	updateGhosts() {
		let ghostIds = findGhostsOfID(this.id);
		ghostIds.map(gId => {
			if (object_array[gId]) {
				object_array[gId].update();
			}
		});
	}
	updatePosition() {
		this.update();
	}
	getImage() {
		return false;
	}
}

class BasePrimitive extends OnePointer {
	constructor(id, type, pos, extras) {
		super(id, type, pos, extras);
	}
	doubleClick() {
		openPrimitiveDialog(get_parent_id(this.id));
	}
}

/** @typedef {"invalid" | "start" | "end" | "bezier1" | "bezier2" | "orthoMiddle"} AnchorType */
class AnchorPoint extends OnePointer {
	/**
	 * @param {string} id
	 * @param {string} type
	 * @param {[number, number]} pos
	 * @param {AnchorType} anchorType
	 */
	constructor(id, type, pos, anchorType) {
		super(id, type, pos);
		this.anchorType = anchorType;
		this.isSquare = false;
	}
	isAttached() {
		let parent = get_parent(this);
		if (!parent.getStartAttach) {
			return;
		}
		switch (this.anchorType) {
			case "start":
				return !!parent.getStartAttach();
			case "end":
				return !!parent.getEndAttach()
			default:
				// It's not a start or end anchor so it cannot be attached
				return false;
		}
	}
	setAnchorType(anchorType) {
		this.anchorType = anchorType;
	}
	getAnchorType() {
		return this.anchorType;
	}
	setVisible(newVisible) {
		if (newVisible) {
			for (let element of this.element_array) {
				// Show all elements except for selectors
				if (element.getAttribute("class") != "highlight") {
					element.setAttribute("visibility", "visible");
				}
			}
		}
		else {
			// Hide elements
			for (let element of this.element_array) {
				element.setAttribute("visibility", "hidden");
			}
		}
	}
	updatePosition() {
		this.update();
		let parent = get_parent(this);
		if (parent.start_anchor && parent.end_anchor) {
			parent.syncAnchorToPrimitive(this.anchorType);
		}
	}
	getImage() {
		if (this.isSquare) {
			return [
				SVG.rect(-4, -4, 8, 8, this.color, "white", "element"),
				SVG.rect(-4, -4, 8, 8, "none", this.color, "highlight")
			];
		} else {
			return [
				SVG.circle(0, 0, 5, this.color, "white", "element"),
				SVG.circle(0, 0, 5, "none", this.color, "highlight")
			];
		}

	}
	getLayer() {
		return SVG.anchorLayer;
	}
	makeSquare() {
		this.isSquare = true;
		this.reloadImage();
	}
	reloadImage() {
		this.clearImage();
		this.loadImage();
	}
	afterMove(diff_x, diff_y) {
		// This is an attempt to make bezier points move with the anchors points but id does not work well with undo
		// commented out until fixed
		let parentId = get_parent_id(this.id);
		let parent = get_object(parentId);

		if (parent.type == "link") {
			switch (this.anchorType) {
				case "start":
					{
						const [x, y] = parent.b1_anchor.getPos();
						parent.b1_anchor.setPos([x + diff_x, y + diff_y]);
					}
					break;
				case "end":
					{
						const [x, y] = parent.b2_anchor.getPos();
						parent.b2_anchor.setPos([x + diff_x, y + diff_y]);
					}
					break;
			}
		}
	}
}

class OrthoAnchorPoint extends AnchorPoint {
	constructor(id, type, pos, anchorType, index) {
		super(id, type, pos, anchorType);
		this.changed = true;
		this.index = index;
	}
}

// Flow endpoints and elbows are small visual handles, but they need a larger
// invisible hit target so they remain easy to grab when they overlap a Stock
// boundary or a pipe segment.  The visible handle stays at the existing 5 px
// radius; only pointer interaction is enlarged.
class FlowAnchorPoint extends AnchorPoint {
	getImage() {
		return [
			SVG.circle(0, 0, 11, "none", "transparent", "flow-anchor-hit-target", { "pointer-events": "all" }),
			SVG.circle(0, 0, 5, this.color, "white", "element"),
			SVG.circle(0, 0, 5, "none", this.color, "highlight")
		];
	}
}

class FlowOrthoAnchorPoint extends OrthoAnchorPoint {
	getImage() {
		return [
			SVG.circle(0, 0, 11, "none", "transparent", "flow-anchor-hit-target", { "pointer-events": "all" }),
			SVG.circle(0, 0, 5, this.color, "white", "element"),
			SVG.circle(0, 0, 5, "none", this.color, "highlight")
		];
	}
}

function safeDivision(nominator, denominator) {
	// Make sure division by Zero does not happen
	return denominator == 0 ? 9999999 : (nominator / denominator);
}

function sign(value) {
	return (value < 0) ? -1 : 1;
}

class StockVisual extends BasePrimitive {
	constructor(id, type, pos, extras) {
		super(id, type, pos, extras);
		this.updateDefinitionError();
		this.namePosList = [[0, 32], [27, 5], [0, -24], [-27, 5]];
	}

	getSize() {
		return [50, 38];
	}

	getBoundRect() {
		let pos = this.getPos()
		let size = this.getSize();
		return {
			"minX": pos[0] - size[0] / 2,
			"maxX": pos[0] + size[0] / 2,
			"minY": pos[1] - size[1] / 2,
			"maxY": pos[1] + size[1] / 2
		};
	}

	setPos(pos) {
		let diff = translate(neg(this.pos), pos);
		super.setPos(pos);
		let startConn = find_start_connections(this);
		for (let conn of startConn) {
			if (conn.type === "flow" && conn.isSelected() === false) {
				let oldConnPos = conn.start_anchor.getPos();
				let newConnPos = translate(oldConnPos, diff);
				conn.requestNewAnchorPos(newConnPos, conn.start_anchor.id);
			}
		}
		let endConn = find_end_connections(this);
		for (let conn of endConn) {
			if (conn.type === "flow" && conn.isSelected() === false) {
				let oldAnchorPos = conn.end_anchor.getPos();
				let newAnchorPos = translate(oldAnchorPos, diff);
				conn.requestNewAnchorPos(newAnchorPos, conn.end_anchor.id);
			}
		}
	}

	// Used for FlowVisual
	getFlowMountPos([xTarget, yTarget]) {
		const [xCenter, yCenter] = this.getPos();
		const [width, height] = this.getSize();
		const boxSlope = safeDivision(height, width);
		const targetSlope = safeDivision(yTarget - yCenter, xTarget - xCenter);
		let xEdge;
		let yEdge;
		if (isInLimits(-boxSlope, targetSlope, boxSlope)) { // Left or right of box
			xEdge = sign(xTarget - xCenter) * width / 2 + xCenter;
			if (isInLimits(yCenter - height / 2, yTarget, yCenter + height / 2)) { // if within box y-limits
				yEdge = yTarget;
			} else {
				yEdge = yCenter + sign(yTarget - yCenter) * height / 2
			}
		} else { // above or below box
			if (isInLimits(xCenter - width / 2, xTarget, xCenter + width / 2)) {	// If within box x-limits
				xEdge = xTarget;
			} else {
				xEdge = xCenter + sign(xTarget - xCenter) * width / 2;
			}
			yEdge = sign(yTarget - yCenter) * (height / 2) + yCenter;
		}
		return [xEdge, yEdge];
	}

	// Used for LinkVisual
	getLinkMountPos([xTarget, yTarget]) {
		// See "docs/code/mountPoints.svg" for math explanation
		const [xCenter, yCenter] = this.getPos();
		const [width, height] = this.getSize();
		const boxSlope = safeDivision(height, width);
		const targetSlope = safeDivision(yTarget - yCenter, xTarget - xCenter);
		let xEdge;
		let yEdge;
		if (isInLimits(-boxSlope, targetSlope, boxSlope)) {
			const xSign = sign(xTarget - xCenter); // -1 if target left of box and 1 if target right of box
			xEdge = xSign * (width / 2) + xCenter;
			yEdge = xSign * (width / 2) * targetSlope + yCenter;
		} else {
			const ySign = sign(yTarget - yCenter); // -1 if target above box and 1 if target below box
			xEdge = ySign * safeDivision(height / 2, targetSlope) + xCenter;
			yEdge = ySign * (height / 2) + yCenter;
		}
		return [xEdge, yEdge];
	}

	getImage() {
		const textElement = SVG.text(0, 39, this.primitive.getAttribute("name"), "name_element");
		textElement.setAttribute("fill", this.color);
		const size = this.getSize();
		const w = size[0];
		const h = size[1];
		return [
			SVG.rect(-w / 2, -h / 2, w, h, this.color, defaultFill, "element"),
			SVG.rect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, "none", this.color, "highlight"),
			textElement,
			SVG.icons(defaultStroke, defaultFill, "icons")
		];
	}
	getLayer() {
		return SVG.stockLayer;
	}
}

class NumberboxVisual extends BasePrimitive {
	constructor(id, type, pos, extras) {
		super(id, type, pos, extras);
		this.name_centered = true;
		update_name_pos(id);
		this.setSelectionSizeToText();

		this.runHandler = () => {
			this.render();
		}
		RunResults.subscribeRun(id, this.runHandler);

		this.dialog = new NumberboxDialog(this.id);
		this.dialog.subscribePool.subscribe(() => {
			this.render();
		});
	}
	setSelectionSizeToText() {
		const boundingRect = this.name_element.getBoundingClientRect();
		const elementRect = this.element_array[0];
		const selectorRect = this.selector_array[0];
		const marginX = 10;
		const marginY = 2;
		for (let rect of [elementRect, selectorRect]) {
			rect.setAttribute("width", boundingRect.width + marginX * 2);
			rect.setAttribute("height", boundingRect.height + marginY * 2);
			rect.setAttribute("x", -boundingRect.width / 2 - marginX);
			rect.setAttribute("y", -boundingRect.height / 2 - marginY);
		}
	}
	render() {
		if (this.targetID == null) {
			this.name_element.innerHTML = "-";
			this.setSelectionSizeToText();
			return;
		}
		let valueString = "";
		let lastValue = RunResults.getLastValue(this.targetID);
		if (lastValue || lastValue === 0) {
			let roundToZero = this.primitive.getAttribute("RoundToZero");
			let roundToZeroAtValue = -1;
			if (roundToZero === "true") {
				roundToZeroAtValue = this.primitive.getAttribute("RoundToZeroAtValue");
				if (isNaN(roundToZeroAtValue)) {
					roundToZeroAtValue = getDefaultAttributeValue("numberbox", "RoundToZeroAtValue");
				} else {
					roundToZeroAtValue = Number(roundToZeroAtValue);
				}
			}
			let number_length = JSON.parse(this.primitive.getAttribute("NumberLength"));
			let number_options = {
				"round_to_zero_limit": roundToZeroAtValue,
				"precision": number_length["usePrecision"] ? number_length["precision"] : undefined,
				"decimals": number_length["usePrecision"] ? undefined : number_length["decimal"]
			};
			valueString = format_number(lastValue, number_options);
		} else {
			valueString += "_";
		}
		let output = `${valueString}`;
		this.name_element.innerHTML = output;
		this.setSelectionSizeToText();

		// update color in case hide frame changes
		this.setColor(this.color);

	}
	get targetID() {
		return Number(this.primitive.getAttribute("Target"));
	}
	set targetID(newTargetID) {
		this.primitive.setAttribute("Target", newTargetID);
		this.render();
	}
	afterNameChange() {
		this.setSelectionSizeToText();
	}
	getImage() {
		this.element = SVG.rect(-20, -15, 40, 30, this.color, defaultFill, "element");
		return [
			this.element,
			SVG.rect(-20, -15, 40, 30, "none", this.color, "highlight"),
			SVG.text(0, 0, "", "name_element", { "alignment-baseline": "middle", "style": "font-size: 16px", "fill": this.color }),
		];
	}
	setColor(color) {
		super.setColor(color);
		if (this.selected) {
			this.name_element.setAttribute("fill", "white");
		}
		let frameColor = this.primitive.getAttribute("HideFrame") === "true" ? "transparent" : color;
		this.element.setAttribute("stroke", frameColor);
	}
	select() {
		super.select();
		this.name_element.setAttribute("fill", "white");
	}
	unselect() {
		super.unselect();
		this.name_element.setAttribute("fill", this.color);
	}
	nameDoubleClick() {
		// Override this function
		// Do nothing - otherwise double clicked is called twice
	}
	doubleClick() {
		this.dialog.show();
	}
	getLayer() {
		return SVG.plotLayer;
	}
}

function auxiliaryUsesDelayFunction(primitive) {
	if (!primitive) return false;
	let sourcePrimitive = primitive;
	if (primitive.value && primitive.value.nodeName === "Ghost") {
		sourcePrimitive = findID(primitive.getAttribute("Source"));
	}
	if (!sourcePrimitive || !sourcePrimitive.value || sourcePrimitive.value.nodeName !== "Variable") return false;
	if (sourcePrimitive.getAttribute("isConstant") === "true") return false;
	let definition = String(getValue(sourcePrimitive) || "");
	return /\b(?:Smooth|Delay|Lag)\s*\(/i.test(definition);
}

class VariableVisual extends BasePrimitive {
	constructor(id, type, pos, extras) {
		super(id, type, pos, extras);
		this.updateDefinitionError();
		this.namePosList = [[0, 34], [23, 5], [0, -25], [-23, 5]];
	}

	getRadius() {
		return 20;
	}

	getBoundRect() {
		let pos = this.getPos();
		let radius = this.getRadius();
		return {
			"minX": pos[0] - radius,
			"maxX": pos[0] + radius,
			"minY": pos[1] - radius,
			"maxY": pos[1] + radius
		};
	}

	getImage() {
		this.element = SVG.circle(0, 0, this.getRadius(), this.color, defaultFill, "element");
		this.processingElement = SVG.fromString('<image href="graphics/processing.svg" x="-20" y="-20" width="40" height="40" class="processing-element" preserveAspectRatio="xMidYMid meet"></image>');
		return [
			this.element,
			this.processingElement,
			SVG.text(0, 0, this.primitive.getAttribute("name"), "name_element", { "fill": this.color }),
			SVG.circle(0, 0, this.getRadius() - 2, "none", this.color, "highlight"),
			SVG.icons(defaultStroke, defaultFill, "icons")
		];
	}

	update() {
		super.update();
		let showProcessing = auxiliaryUsesDelayFunction(this.primitive);
		if (this.element) this.element.setAttribute("visibility", showProcessing ? "hidden" : "visible");
		if (this.processingElement) this.processingElement.setAttribute("visibility", showProcessing ? "visible" : "hidden");
	}

	getLayer() {
		return SVG.variableLayer;
	}

	getLinkMountPos([xTarget, yTarget]) {
		// See "docs/code/mountPoints.svg" for math explanation
		const [xCenter, yCenter] = this.getPos();
		const rTarget = distance([xCenter, yCenter], [xTarget, yTarget]);
		const dXTarget = xTarget - xCenter;
		const dYTarget = yTarget - yCenter;
		const dXEdge = safeDivision(dXTarget * this.getRadius(), rTarget);
		const dYEdge = safeDivision(dYTarget * this.getRadius(), rTarget);
		const xEdge = dXEdge + xCenter;
		const yEdge = dYEdge + yCenter;
		return [xEdge, yEdge];
	}
}

class ConstantVisual extends VariableVisual {
	constructor(id, type, pos, extras) {
		super(id, type, pos, extras);
		this.namePosList = [[0, 36], [25, 5], [0, -29], [-25, 5]];
	}

	getImage() {
		let r = this.getRadius();
		let rs = r - 3; // Selector radius
		return [
			SVG.path(`M0,${r} ${r},0 0,-${r} -${r},0Z`, this.color, defaultFill, "element"),
			SVG.text(0, 0, this.primitive.getAttribute("name"), "name_element", { "fill": this.color }),
			SVG.path(`M0,${rs} ${rs},0 0,-${rs} -${rs},0Z`, "none", this.color, "highlight"),
			SVG.icons(defaultStroke, defaultFill, "icons")
		];
	}
	getLayer() {
		return SVG.constantLayer;
	}

	getRadius() {
		return 22;
	}

	getLinkMountPos([xTarget, yTarget]) {
		const [xCenter, yCenter] = this.getPos();
		const targetSlope = safeDivision(yCenter - yTarget, xCenter - xTarget);

		// "k" in the formula: y = kx + m
		const edgeSlope = -sign(targetSlope);

		// Where the line intercepts the x-axis ("m" in the formula: y = kx + m)
		const edgeIntercept = this.getRadius() * sign(yTarget - yCenter);

		// Relative coodinates relative center of ConstantVisual
		const xEdgeRel = safeDivision(edgeIntercept, targetSlope - edgeSlope);
		const yEdgeRel = edgeSlope * xEdgeRel + edgeIntercept;

		const xEdge = xEdgeRel + xCenter;
		const yEdge = yEdgeRel + yCenter;
		return [xEdge, yEdge];
	}
}

class ConverterVisual extends BasePrimitive {
	constructor(id, type, pos, extras) {
		super(id, type, pos, extras);
		this.updateDefinitionError();
		this.namePosList = [[0, 29], [23, 5], [0, -21], [-23, 5]];
	}
	getImage() {
		return [
			SVG.path("M-20 0  L-10 -15  L10 -15  L20 0  L10 15  L-10 15  Z", this.color, defaultFill, "element"),
			SVG.path("M-20 0  L-10 -15  L10 -15  L20 0  L10 15  L-10 15  Z", "none", this.color, "highlight", { "transform": "scale(0.87)" }),
			SVG.icons(defaultStroke, defaultFill, "icons"),
			SVG.text(0, 0, this.primitive.getAttribute("name"), "name_element", { "fill": this.color }),
		];
	}
	getLayer() {
		return SVG.converterLayer;
	}

	getLinkMountPos([xTarget, yTarget]) {
		// See "docs/code/mountPoints.svg" for math explanation
		const [xCenter, yCenter] = this.getPos();
		const hexSlope = safeDivision(15.0, 10);  // placement of corner is at (10,15)
		const targetSlope = safeDivision(yTarget - yCenter, xTarget - xCenter);
		let xEdgeRel; 	// Relative x Position to center of Visual object.
		let yEdgeRel; 	// Relative y Position to center of Visual object.
		if (hexSlope < targetSlope || targetSlope < -hexSlope) {
			const ySign = sign(yTarget - yCenter); 	// -1 if target above hexagon and 1 if target below hexagon
			xEdgeRel = ySign * safeDivision(15, targetSlope);
			yEdgeRel = ySign * 15;
		} else if (0 < targetSlope && targetSlope < hexSlope) {
			const xSign = sign(xTarget - xCenter); // -1 if target left of hexagon and 1 if target right of hexagon
			xEdgeRel = xSign * safeDivision(30, (3 / 2) + targetSlope);
			yEdgeRel = xEdgeRel * targetSlope;
		} else {
			const xSign = sign(xTarget - xCenter); // -1 if target left of hexagon and 1 if target right of hexagon
			xEdgeRel = xSign * safeDivision(30, (3 / 2) - targetSlope);
			yEdgeRel = xEdgeRel * targetSlope;
		}
		const xEdge = xEdgeRel + xCenter;
		const yEdge = yEdgeRel + yCenter;
		return [xEdge, yEdge];
	}
	attachEvent() {
		// A Lookup's input is defined only by its single incoming Link. Outgoing
		// Links must never change the Lookup source. When the incoming Link is
		// removed, the Lookup falls back to Time.
		let incoming = findLinkedInPrimitives(this.id);
		this.primitive.setAttribute("Source", incoming.length > 0 ? incoming[0].id : "Time");
	}
	nameDoubleClick() {
		openPrimitiveDialog(this.id, "name")
	}
	doubleClick() {
		openPrimitiveDialog(this.id, "name")
	}
}

class TwoPointer extends BaseObject {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.id = id;
		this.type = type;
		this.selected = false;
		this.superClass = "TwoPointer";
		connection_array[this.id] = this;

		// anchors must exist before make graphics
		this.createInitialAnchors(pos0, pos1);

		this.makeGraphics();
		$(this.group).on("mousedown", function (event) {
			let node_id = this.getAttribute("node_id");
			primitive_mousedown(node_id, event);
		});

		// this is done so anchor is ontop
		this.start_anchor.reloadImage();
		this.end_anchor.reloadImage();
	}

	createInitialAnchors(pos0, pos1) {
		this.start_anchor = new AnchorPoint(this.id + ".start_anchor", "dummy_anchor", pos0, "start");
		this.end_anchor = new AnchorPoint(this.id + ".end_anchor", "dummy_anchor", pos1, "end");
	}

	getAnchors() {
		return [this.start_anchor, this.end_anchor];
	}

	getBoundRect() {
		return {
			"minX": this.getMinX(),
			"maxX": this.getMinX() + this.getWidth(),
			"minY": this.getMinY(),
			"maxY": this.getMinY() + this.getHeight()
		};
	}

	setColor(color) {
		super.setColor(color);
		this.start_anchor.setColor(color);
		this.end_anchor.setColor(color);
	}

	get startX() { return this.start_anchor.getPos()[0]; }
	get startY() { return this.start_anchor.getPos()[1]; }
	get endX() { return this.end_anchor.getPos()[0]; }
	get endY() { return this.end_anchor.getPos()[1]; }

	getPos() { return [(this.startX + this.endX) / 2, (this.startY + this.endY) / 2]; }
	getMinX() { return Math.min(this.startX, this.endX); }
	getMinY() { return Math.min(this.startY, this.endY); }
	getWidth() { return Math.abs(this.startX - this.endX); }
	getHeight() { return Math.abs(this.startY - this.endY); }

	unselect() {
		this.selected = false;
		for (let anchor of this.getAnchors()) {
			anchor.setVisible(false);
		}
		refreshSelectionStacking();
	}
	select() {
		this.selected = true;
		for (let anchor of this.getAnchors()) {
			anchor.select();
			anchor.setVisible(true);
		}
		refreshSelectionStacking();
	}

	update() {
		this.updateGraphics();
	}
	makeGraphics() {

	}
	updateGraphics() {

	}
	/** @param {AnchorType} anchorType */
	syncAnchorToPrimitive(anchorType) {
		// This function should sync anchor position to primitive
		let primitive = findID(this.id);
		if (!primitive) return;
		switch (anchorType) {
			case "start":
				setSourcePosition(primitive, this.start_anchor.getPos());
				break;
			case "end":
				setTargetPosition(primitive, this.end_anchor.getPos());
				break;
		}
	}
}

class BaseConnection extends TwoPointer {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		/** @type {BaseObject} */
		this._start_attach = null;
		/** @type {BaseObject} */
		this._end_attach = null;
		this.positionUpdateHandler = () => {
			let primitive = findID(this.id);
			let sourcePoint = getSourcePosition(primitive);
			let targetPoint = getTargetPosition(primitive);
			this.start_anchor.setPos(sourcePoint);
			this.end_anchor.setPos(targetPoint);
		}
	}

	isAcceptableStartAttach(attachVisual) {
		// function to decide if attachVisual is OK allowed to attach start to
		return false;
	}
	isAcceptableEndAttach(attachVisual) {
		return false;
	}
	setStartAttach(new_start_attach) {
		if (new_start_attach != null && this.getEndAttach() == new_start_attach) {
			return false;		// Will not attach if other anchor is attached to same
		}
		if (new_start_attach != null && this.isAcceptableStartAttach(new_start_attach) === false) {
			return false; 	// Will not attach if not acceptable attachType
		}

		// Update the attachment primitive
		this._start_attach = new_start_attach;

		let sourcePrimitive = null;
		if (this._start_attach != null) {
			sourcePrimitive = findID(this._start_attach.id);
		}
		setSource(this.primitive, sourcePrimitive);

		// Trigger the attach event on the new attachment primitives
		this.triggerAttachEvents();
		return true;
	}
	getStartAttach() {
		return this._start_attach;
	}
	setEndAttach(new_end_attach) {
		do_global_log("end_attach");
		if (new_end_attach != null && this.getStartAttach() == new_end_attach) {
			return false; 	// Will not attach if other anchor is attached to same
		}
		if (new_end_attach != null && this.isAcceptableEndAttach(new_end_attach) === false) {
			return false;		// Will not attach if not acceptable attachType
		}

		// Update the attachment primitive
		this._end_attach = new_end_attach;
		let targetPrimitive = null;
		if (this._end_attach != null) {
			targetPrimitive = findID(this._end_attach.id);
		}
		setTarget(this.primitive, targetPrimitive);

		// Trigger the attach event on the new attachment primitives
		this.triggerAttachEvents();
		return true;
	}
	getEndAttach() {
		return this._end_attach;
	}
	triggerAttachEvents() {
		// We must always trigger both start and end, since a change in the start might affect the logics of the primitive attach at the end of a link or flow
		if (this.getStartAttach() != null) {
			this.getStartAttach().attachEvent();
		}
		if (this.getEndAttach() != null) {
			this.getEndAttach().attachEvent();
		}
	}
	clean() {
		this.triggerAttachEvents();
		super.clean();
	}
	updateGraphics() {

	}
}

function getStackTrace() {
	try {
		let a = {};
		a.debug();
	} catch (ex) {
		return ex.stack;
	}
}


class FlowVisual extends BaseConnection {
	/** @type {StockVisual} */
	_start_attach;
	/** @type {StockVisual} */
	_end_attach;
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.updateDefinitionError();
		this.namePosList = [[0, 40], [31, 5], [0, -33], [-31, 5]]; 	// Textplacement when rotating text

		// List of anchors. Not start- and end-anchor. TYPE: [AnchorPoint]
		this.middleAnchors = [];

		this.valveIndex; 	// index to indicate what inbetween path valve is placed
		this.variableSide;	// bool to indicate what side of path variable is placed

		this.startCloud;
		this.endCloud;
		this.outerPath; 	// Black path element
		this.innerPath; 	// White path element
		this.arrowHeadPath; // Head of Arrow element
		this.flowPathGroup; // Group element with outer- inner- & arrowHeadPath within.
		this.valve;
		this.variable; 		// variable (only svg group-element with circle and text)
	}

	createInitialAnchors(pos0, pos1) {
		this.start_anchor = new FlowAnchorPoint(this.id + ".start_anchor", "dummy_anchor", pos0, "start");
		this.end_anchor = new FlowAnchorPoint(this.id + ".end_anchor", "dummy_anchor", pos1, "end");
	}

	isAcceptableStartAttach(attachVisual) {
		return attachVisual.getType() === "stock";
	}

	isAcceptableEndAttach(attachVisual) {
		return attachVisual.getType() === "stock";
	}

	getRadius() {
		return 20;
	}

	getAnchors() {
		let anchors = [this.start_anchor];
		anchors = anchors.concat(this.middleAnchors);
		anchors = anchors.concat([this.end_anchor]);
		return anchors;
	}

	setAnchorsInEditLayer(editing) {
		let layer = editing && SVG.flowAnchorEditLayer ? SVG.flowAnchorEditLayer : SVG.anchorLayer;
		if (!layer) return;
		for (let anchor of this.getAnchors()) {
			if (anchor && anchor.group && anchor.group.parentNode !== layer) layer.appendChild(anchor.group);
		}
	}

	getPreviousAnchor(anchor_id) {
		let anchors = this.getAnchors();
		let anchor_ids = anchors.map(anchor => anchor.id);
		let prev_index = anchor_ids.indexOf(anchor_id) - 1;
		return prev_index >= 0 ? anchors[prev_index] : null;
	}

	getNextAnchor(anchor_id) {
		let anchors = this.getAnchors();
		let anchor_ids = anchors.map(anchor => anchor.id);
		let index = anchor_ids.indexOf(anchor_id);
		if (index === -1 && index === anchors.length - 1) {
			return null;
		} else {
			return anchors[index + 1];
		}
	}

	/**
	 * @param {number} requestedValue x-> or 1->y
	 * @param {string} anchorId
	 * @param {number} dimensionIndex
	 * @returns {number}
	 */
	requestNewAnchorDimension(requestedValue, anchorId, dimensionIndex) {
		/** @type {AnchorPoint} */
		const anchor = object_array[anchorId];
		let newValue = requestedValue;
		const anchorAttach = anchor.getAnchorType() === "start"
			? this._start_attach
			: anchor.getAnchorType() == "end"
			? this._end_attach
			: undefined;
		// if anchor is attached limit movement
		if (anchorAttach) {
			// stockX or stockY
			const stockDimension = anchorAttach.getPos()[dimensionIndex];
			// stockWidth or stockHeight
			const stockSpanSize = anchorAttach.getSize()[dimensionIndex];
			newValue = clampValue(requestedValue, stockDimension - stockSpanSize / 2, stockDimension + stockSpanSize / 2);
		} else {
			// dont allow being closer than minDistance units to a neightbour node
			const minDistance = 10;
			const prevAnchor = this.getPreviousAnchor(anchorId);
			const nextAnchor = this.getNextAnchor(anchorId);

			let requestPos = anchor.getPos();
			requestPos[dimensionIndex] = requestedValue;
			if ((prevAnchor && distance(requestPos, prevAnchor.getPos()) < minDistance) ||
				(nextAnchor && distance(requestPos, nextAnchor.getPos()) < minDistance)) {
				// set old value of anchor
				newValue = anchor.getPos()[dimensionIndex];
			} else {
				// set requested value
				newValue = requestedValue;
			}
		}

		const pos = anchor.getPos();
		pos[dimensionIndex] = newValue;
		anchor.setPos(pos);
		return newValue;
	}

	/**
	 * @param {[number, number]} newPosition
	 * @param {string} anchorId
	 */
	requestNewAnchorPos(newPosition, anchorId) {
		let [x, y] = newPosition;
		let mainAnchor = object_array[anchorId];

		let prevAnchor = this.getPreviousAnchor(anchorId);
		let nextAnchor = this.getNextAnchor(anchorId);

		let isPreviousAlongX = true;
		let isNextAlongX = true;

		if (prevAnchor && this.middleAnchors.length === 0) {
			const prevAnchorPos = prevAnchor.getPos();
			isPreviousAlongX = Math.abs(prevAnchorPos[0] - x) < Math.abs(prevAnchorPos[1] - y);
			isNextAlongX = !isPreviousAlongX;
		} else if (nextAnchor && this.middleAnchors.length === 0) {
			const nextAnchorPos = nextAnchor.getPos();
			isNextAlongX = Math.abs(nextAnchorPos[0] - x) < Math.abs(nextAnchorPos[1] - y);
			isPreviousAlongX = !isNextAlongX;
		} else {
			// if more than two anchor
			let anchors = this.getAnchors();
			const [x1, y1] = anchors[0].getPos();
			const [x2, y2] = anchors[1].getPos();
			const isStartAlongX = Math.abs(x1 - x2) < Math.abs(y1 - y2);
			const index = anchors.map(anchor => anchor.id).indexOf(anchorId);
			isPreviousAlongX = ((index % 2) === 1) === isStartAlongX;
			isNextAlongX = !isPreviousAlongX;
		}

		if (prevAnchor) {
			// Get direction of movement or direction of previous anchor
			if (isPreviousAlongX) {
				x = this.requestNewAnchorDimension(x, prevAnchor.id, 0);
			} else {
				y = this.requestNewAnchorDimension(y, prevAnchor.id, 1);
			}
		}
		if (nextAnchor) {
			if (isNextAlongX) {
				x = this.requestNewAnchorDimension(x, nextAnchor.id, 0);
			} else {
				y = this.requestNewAnchorDimension(y, nextAnchor.id, 1);
			}
		}
		mainAnchor.setPos([x, y]);
	}


	syncAnchorToPrimitive(anchorType) {
		// Save middle anchor points to primitive
		super.syncAnchorToPrimitive(anchorType);
		let middlePoints = "";
		for (i = 0; i < this.middleAnchors.length; i++) {
			let pos = this.middleAnchors[i].getPos();
			let x = pos[0];
			let y = pos[1];
			middlePoints += `${x},${y} `;
		}
		this.primitive.setAttribute("MiddlePoints", middlePoints);
	}

	getLinkMountPos([xTarget, yTarget]) {
		// See "docs/code/mountPoints.svg" for math explanation
		const [xCenter, yCenter] = this.getVariablePos();
		const rTarget = distance([xCenter, yCenter], [xTarget, yTarget]);
		const dXTarget = xTarget - xCenter;
		const dYTarget = yTarget - yCenter;
		const dXEdge = safeDivision(dXTarget * this.getRadius(), rTarget);
		const dYEdge = safeDivision(dYTarget * this.getRadius(), rTarget);
		const xEdge = dXEdge + xCenter;
		const yEdge = dYEdge + yCenter;
		return [xEdge, yEdge];
	}

	moveValve() {
		if (this.variableSide) {
			this.valveIndex = (this.valveIndex + 1) % (this.middleAnchors.length + 1);
		}
		this.variableSide = !this.variableSide;

		this.primitive.setAttribute("ValveIndex", this.valveIndex);
		this.primitive.setAttribute("VariableSide", this.variableSide);

		// update_all_objects();
		update_relevant_objects("");
	}

	getFreeMiddleAnchorId() {
		let serial = 0;
		while (object_array[this.id + ".point" + serial]) serial++;
		return this.id + ".point" + serial;
	}

	reindexMiddleAnchors() {
		this.middleAnchors.forEach((anchor, index) => {
			anchor.index = index;
		});
	}

	createMiddleAnchorPoint(x, y, insertIndex = this.middleAnchors.length) {
		insertIndex = Math.max(0, Math.min(this.middleAnchors.length, Number(insertIndex)));
		let newAnchor = new FlowOrthoAnchorPoint(
			this.getFreeMiddleAnchorId(),
			"dummy_anchor",
			[x, y],
			"orthoMiddle",
			insertIndex
		);
		this.middleAnchors.splice(insertIndex, 0, newAnchor);
		this.reindexMiddleAnchors();
		if (this.isSelected()) this.setAnchorsInEditLayer(true);

		// Inserting on a segment before the valve should not unexpectedly jump the
		// valve to a different part of the pipe.
		if (this.valveIndex > insertIndex) this.valveIndex++;
		this.primitive.setAttribute("ValveIndex", this.valveIndex);
		return newAnchor;
	}

	closestPipeSegment(point, maxDistance = Infinity) {
		let anchors = this.getAnchors();
		let best = null;
		for (let segmentIndex = 0; segmentIndex < anchors.length - 1; segmentIndex++) {
			let a = anchors[segmentIndex].getPos();
			let b = anchors[segmentIndex + 1].getPos();
			let dx = b[0] - a[0];
			let dy = b[1] - a[1];
			let lengthSquared = dx * dx + dy * dy;
			let t = 0;
			if (lengthSquared > 0) {
				t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared;
				t = Math.max(0, Math.min(1, t));
			}
			let projected = [a[0] + t * dx, a[1] + t * dy];
			let d = distance(point, projected);
			if (!best || d < best.distance) best = { segmentIndex, point: projected, distance: d };
		}
		return best && best.distance <= maxDistance ? best : null;
	}

	middleAnchorNear(point, radius = 12) {
		let bestIndex = -1;
		let bestDistance = Infinity;
		for (let i = 0; i < this.middleAnchors.length; i++) {
			let d = distance(point, this.middleAnchors[i].getPos());
			if (d <= radius && d < bestDistance) {
				bestDistance = d;
				bestIndex = i;
			}
		}
		return bestIndex;
	}

	setStartAttach(new_start_attach) {
		super.setStartAttach(new_start_attach);
		// needs to update Links a few times to follow along
		for (let i = 0; i < 4; i++) update_twopointer_objects([]);
	}

	setEndAttach(new_end_attach) {
		super.setEndAttach(new_end_attach);
		for (let i = 0; i < 4; i++) update_twopointer_objects([]);
	}

	removeMiddleAnchorPoint(index) {
		if (index < 0 || index >= this.middleAnchors.length) return false;
		let removedAnchor = this.middleAnchors[index];
		this.middleAnchors.splice(index, 1);
		if (this.valveIndex > index) this.valveIndex--;
		this.valveIndex = Math.max(0, Math.min(this.valveIndex, this.middleAnchors.length));
		this.primitive.setAttribute("ValveIndex", this.valveIndex);
		this.reindexMiddleAnchors();
		delete_object(removedAnchor.id);
		return true;
	}

	removeLastMiddleAnchorPoint() {
		return this.removeMiddleAnchorPoint(this.middleAnchors.length - 1);
	}


	/**
	 *
	 * @param {string} middlePointsString
	 * @returns {[number, number][]}
	 */
	parseMiddlePoints(middlePointsString) {
		if (!middlePointsString) {
			return [];
		}
		// example input: "15,17 19,12 "

		// example ["15,17", "19,12"]
		const stringPoints = middlePointsString.trim().split(" ");

		// example [["15", "17"], ["19", "12"]]
		const stringDimension = stringPoints.map(stringPos => stringPos.split(","));

		// example [[15,17], [19,12]]
		const points = stringDimension.map(dim => [parseInt(dim[0]), parseInt(dim[1])]);

		return points;
	}

	loadMiddlePoints() {
		const middlePointsString = this.primitive.getAttribute("MiddlePoints");
		const points = this.parseMiddlePoints(middlePointsString);
		for (let point of points) {
			let index = this.middleAnchors.length;
			let newAnchor = new FlowOrthoAnchorPoint(
				this.id + ".point" + index,
				"dummy_anchor",
				point,
				"orthoMiddle",
				index
			);
			this.middleAnchors.push(newAnchor);
		}
	}

	getBoundRect() {
		let pos = this.getVariablePos();
		let radius = this.getRadius();
		return {
			"minX": pos[0] - radius,
			"maxX": pos[0] + radius,
			"minY": pos[1] - radius,
			"maxY": pos[1] + radius
		};
	}

	getValvePos() {
		let points = this.getAnchors().map(anchor => anchor.getPos());
		let valveX = (points[this.valveIndex][0] + points[this.valveIndex + 1][0]) / 2;
		let valveY = (points[this.valveIndex][1] + points[this.valveIndex + 1][1]) / 2;
		return [valveX, valveY];
	}

	getValveRotation() {
		let points = this.getAnchors().map(anchor => anchor.getPos());
		let dir = neswDirection(points[this.valveIndex], points[this.valveIndex + 1]);
		let valveRot = 0;
		if (dir == "north" || dir == "south") {
			valveRot = 90;
		}
		return valveRot;
	}

	/** @returns {[number, number]} */
	getVariablePos() {
		let points = this.getAnchors().map(anchor => anchor.getPos());
		let dir = neswDirection(points[this.valveIndex], points[this.valveIndex + 1]);
		let variableOffset = [0, 0];
		if (dir == "north" || dir == "south") {
			if (this.variableSide) {
				variableOffset = [this.getRadius(), 0];
			} else {
				variableOffset = [-this.getRadius(), 0];
			}
		} else {
			if (this.variableSide) {
				variableOffset = [0, -this.getRadius()];
			} else {
				variableOffset = [0, this.getRadius()];
			}
		}
		let [valveX, valveY] = this.getValvePos();
		return [valveX + variableOffset[0], valveY + variableOffset[1]];
	}

	setColor(color) {
		this.color = color;
		this.primitive.setAttribute("Color", this.color);
		this.startCloud.setAttribute("stroke", color);
		this.endCloud.setAttribute("stroke", color);
		this.outerPath.setAttribute("stroke", color);
		this.arrowHeadPath.setAttribute("stroke", color);
		this.valve.setAttribute("stroke", color);
		this.variable.getElementsByClassName("element")[0].setAttribute("stroke", color);
		this.variable.getElementsByClassName("highlight")[0].setAttribute("fill", color);
		this.name_element.setAttribute("fill", color);
		this.getAnchors().map(anchor => anchor.setColor(color));
	}

	makeGraphics() {
		this.startCloud = SVG.cloud(this.color, defaultFill, { "class": "element" });
		this.endCloud = SVG.cloud(this.color, defaultFill, { "class": "element" });
		this.outerPath = SVG.widePath(5, this.color, { "class": "element" });
		this.innerPath = SVG.widePath(3, "white"); // Must have white ohterwise path is black
		this.arrowHeadPath = SVG.arrowHead(this.color, defaultFill, { "class": "element" });
		this.flowPathGroup = SVG.group([this.startCloud, this.endCloud, this.outerPath, this.innerPath, this.arrowHeadPath]);
		this.valve = SVG.path("M8,8 -8,-8 8,-8 -8,8 Z", this.color, defaultFill, "element");
		this.name_element = SVG.text(0, -this.getRadius(), "vairable", "name_element");
		this.icons = SVG.icons(defaultStroke, defaultFill, "icons");
		this.variable = SVG.group([
			SVG.circle(0, 0, this.getRadius(), this.color, "white", "element"),
			SVG.circle(0, 0, this.getRadius() - 2, "none", this.color, "highlight"),
			this.icons,
			this.name_element
		]);
		this.icons.setColor("white");
		this.middleAnchors = [];
		this.valveIndex = 0;
		this.variableSide = false;

		$(this.name_element).dblclick((event) => {
			this.nameDoubleClick();
		});

		this.group = SVG.append(SVG.flowLayer, SVG.group([this.flowPathGroup, this.valve, this.variable]));
		this.group.setAttribute("node_id", this.id);

		// New/loaded Flows start inactive.  The first-stage activation target is
		// the complete valve control: the bow-tie valve plus the circular flow
		// variable immediately below it.  The pipe/clouds/endpoints remain inert.
		this.flowPathGroup.setAttribute("pointer-events", "none");
		this.variable.setAttribute("pointer-events", "none");
		this.variable.getElementsByClassName("element")[0].setAttribute("pointer-events", "all");
		this.variable.getElementsByClassName("highlight")[0].setAttribute("pointer-events", "all");
		this.name_element.setAttribute("pointer-events", "none");
		this.icons.setAttribute("pointer-events", "none");
		this.valve.setAttribute("pointer-events", "all");

		$(this.group).dblclick(() => {
			this.doubleClick(this.id);
		});
		this.updateGraphics();
	}

	getDirection() {
		// This function is used to determine which way the arrowHead should aim
		let points = this.getAnchors().map(anchor => anchor.getPos());
		let len = points.length;
		let p1 = points[len - 1];
		let p2 = points[len - 2];
		return [p2[0] - p1[0], p2[1] - p1[1]];
	}

	shortenLastPoint(shortenAmount) {
		let points = this.getAnchors().map(anchor => anchor.getPos());
		let last = points[points.length - 1];
		let secondLast = points[points.length - 2];
		let sine = sin(last, secondLast);
		let cosine = cos(last, secondLast);
		let newLast = rotate([shortenAmount, 0], sine, cosine);
		newLast = translate(newLast, last);
		points[points.length - 1] = newLast;
		return points;
	}

	update() {
		// This function is similar to TwoPointer::update but it takes attachments into account

		// Get start position from attach
		// _start_attach is null if we are not attached to anything

		let points = this.getAnchors().map(anchor => anchor.getPos());
		let connectionStartPos = points[1];
		let connectionEndPos = points[points.length - 2];

		if (this.getStartAttach() != null && this.start_anchor != null) {
			let oldPos = this.start_anchor.getPos();
			let newPos = this.getStartAttach().getFlowMountPos(connectionStartPos);
			if (oldPos[0] != newPos[0] || oldPos[1] != newPos[1]) {
				this.requestNewAnchorPos(newPos, this.start_anchor.id);
			}
		}
		if (this.getEndAttach() != null && this.end_anchor != null) {
			let oldPos = this.end_anchor.getPos();
			let newPos = this.getEndAttach().getFlowMountPos(connectionEndPos);
			if (oldPos[0] != newPos[0] || oldPos[1] != newPos[1]) {
				this.requestNewAnchorPos(newPos, this.end_anchor.id);
			}
		}
		super.update();
		// update anchors
		this.getAnchors().map(anchor => anchor.updatePosition());

		if (this.primitive && this.icons) {
			const hasDefError = DefinitionError.has(this.primitive);
			this.icons.set("questionmark", DefinitionQuestionMarks.visibilityFor(hasDefError));
			this.icons.set("dice", (!hasDefError && hasRandomFunction(getValue(this.primitive))) ? "visible" : "hidden");
		}
	}

	updateGraphics() {
		let points = this.getAnchors().map(anchor => anchor.getPos());
		if (this.getStartAttach() == null) {
			this.startCloud.setVisibility(true);
			this.startCloud.setPosition(points[0], points[1]);
		} else {
			this.startCloud.setVisibility(false);
		}
		if (this.getEndAttach() == null) {
			this.endCloud.setVisibility(true);
			this.endCloud.setPosition(points[points.length - 1], points[points.length - 2]);
		} else {
			this.endCloud.setVisibility(false);
		}
		this.outerPath.setPoints(this.shortenLastPoint(12));
		this.innerPath.setPoints(this.shortenLastPoint(8));
		this.arrowHeadPath.setPosition(points[points.length - 1], this.getDirection());

		let [valveX, valveY] = this.getValvePos();
		let valveRot = this.getValveRotation();
		let [varX, varY] = this.getVariablePos();
		SVG.transform(this.valve, valveX, valveY, valveRot, 1);
		SVG.translate(this.variable, varX, varY);
		// Update
		this.startCloud.update();
		this.endCloud.update();
		this.outerPath.update();
		this.innerPath.update();
		this.arrowHeadPath.update();
	}

	unselect() {
		this.setAnchorsInEditLayer(false);
		super.unselect();
		this.variable.getElementsByClassName("highlight")[0].setAttribute("visibility", "hidden");
		this.icons.setColor(this.color);

		// An inactive Flow must not compete with Stocks or other primitives for
		// pointer input.  Only the composite valve control (bow-tie + circular
		// flow variable) remains hit-testable.  Endpoint editing stays two-stage:
		// activate the Flow here first, then interact with its endpoint anchors.
		this.flowPathGroup.setAttribute("pointer-events", "none");
		this.variable.setAttribute("pointer-events", "none");
		this.variable.getElementsByClassName("element")[0].setAttribute("pointer-events", "all");
		this.variable.getElementsByClassName("highlight")[0].setAttribute("pointer-events", "all");
		this.name_element.setAttribute("pointer-events", "none");
		this.icons.setAttribute("pointer-events", "none");
		this.valve.setAttribute("pointer-events", "all");
	}

	select() {
		super.select();
		this.setAnchorsInEditLayer(true);
		this.variable.getElementsByClassName("highlight")[0].setAttribute("visibility", "visible");
		this.icons.setColor("white");

		// Once activated through the valve, restore the Flow's normal hit targets.
		// Its endpoint anchors are made visible by TwoPointer.select().
		this.flowPathGroup.setAttribute("pointer-events", "all");
		this.variable.setAttribute("pointer-events", "all");
		this.valve.setAttribute("pointer-events", "all");
	}

	doubleClick() {
		openPrimitiveDialog(this.id);
	}
}


// Decorative annotations must never take double-click priority over a model
// entity occupying the same canvas position.  SVG/foreignObject hit testing can
// vary between browsers (and selected annotations use enlarged/invisible hit
// targets), so layer order alone is not a sufficient interaction guarantee.
// When an annotation receives a double-click, explicitly check the model geometry
// at that canvas position and route the action to the top-most model entity first.
function modelEntityUnderAnnotationEvent(event) {
	if (!event || typeof mousePosition !== "function" || typeof find_elements_under !== "function") return null;
	let point = mousePosition(event);
	let candidates = find_elements_under(point.x, point.y).filter(candidate => {
		return candidate && ["stock", "variable", "constant", "converter", "flow"].includes(String(candidate.type || "").toLowerCase());
	});
	if (!candidates.length) return null;

	// Match the model-layer paint order in index.html.  If two model entities
	// overlap, the entity in the visually higher layer receives precedence.
	const layerPriority = { stock: 1, variable: 2, constant: 3, converter: 4, flow: 5 };
	candidates.sort((a, b) => (layerPriority[String(b.type || "").toLowerCase()] || 0) -
		(layerPriority[String(a.type || "").toLowerCase()] || 0));
	return candidates[0];
}

function routeAnnotationDoubleClick(event) {
	let modelVisual = modelEntityUnderAnnotationEvent(event);
	if (!modelVisual) return false;

	// The two preceding mousedown events may have selected the annotation. Restore
	// the interaction state a direct double-click on the model entity would leave.
	if (typeof unselect_all === "function") unselect_all();
	if (typeof modelVisual.select === "function") modelVisual.select();
	if (typeof mouse !== "undefined") mouse.lastClickedPrimitive = modelVisual;
	if (typeof refreshSelectionStacking === "function") refreshSelectionStacking();

	if (event.preventDefault) event.preventDefault();
	if (event.stopImmediatePropagation) event.stopImmediatePropagation();
	if (event.stopPropagation) event.stopPropagation();
	if (typeof modelVisual.doubleClick === "function") modelVisual.doubleClick(modelVisual.id);
	return true;
}

class RectangleVisual extends TwoPointer {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.dialog = new RectangleDialog(this.id);
		this.dialog.subscribePool.subscribe(() => {
			this.updateGraphics();
		});
	}
	setAnchorsInEditLayer(editing) {
		// Rectangle graphics live in the background annotation layer. Raise selected
		// corner handles into the existing top editing layer so resize handles remain
		// easy to grab without ever raising the rectangle itself above model entities.
		let layer = editing && SVG.flowAnchorEditLayer ? SVG.flowAnchorEditLayer : SVG.anchorLayer;
		if (!layer) return;
		for (let anchor of this.getAnchors()) {
			if (anchor && anchor.group && anchor.group.parentNode !== layer) layer.appendChild(anchor.group);
		}
	}
	select() {
		super.select();
		this.setAnchorsInEditLayer(true);
	}
	unselect() {
		super.unselect();
		this.setAnchorsInEditLayer(false);
	}
	makeGraphics() {
		this.element = SVG.rect(this.getMinX(), this.getMinY(), this.getWidth(), this.getHeight(), defaultStroke, "none", "element");

		// Invisible rect to more easily click
		this.clickRect = SVG.rect(this.getMinX(), this.getMinY(), this.getWidth(), this.getHeight(), "transparent", "none");
		this.clickRect.setAttribute("stroke-width", "10");

		this.coordRect = new CoordRect();
		this.coordRect.element = this.element;

		this.clickCoordRect = new CoordRect();
		this.clickCoordRect.element = this.clickRect;

		this.group = SVG.append(SVG.annotationLayer, SVG.group([this.element, this.clickRect]));
		this.group.setAttribute("node_id", this.id);
		this.element_array = [this.element];
		for (let key in this.element_array) {
			this.element_array[key].setAttribute("node_id", this.id);
		}

		$(this.group).dblclick((event) => {
			this.doubleClick(event);
		});
	}
	doubleClick(event = null) {
		if (event && routeAnnotationDoubleClick(event)) return;
		this.dialog.show();
	}
	updateGraphics() {
		this.element.setAttribute("stroke-dasharray", this.primitive.getAttribute("StrokeDashArray"));
		this.element.setAttribute("stroke-width", this.primitive.getAttribute("StrokeWidth"));
		// Update rect to fit start and end position
		this.coordRect.x1 = this.startX;
		this.coordRect.y1 = this.startY;
		// Prevent width from being 0 (then rect is not visible)
		let endx = (this.startX != this.endX) ? this.endX : this.startX + 1;
		let endy = (this.startY != this.endY) ? this.endY : this.startY + 1;
		this.coordRect.x2 = endx;
		this.coordRect.y2 = endy;
		this.coordRect.update();

		this.clickCoordRect.x1 = this.startX;
		this.clickCoordRect.y1 = this.startY;
		this.clickCoordRect.x2 = endx;
		this.clickCoordRect.y2 = endy;
		this.clickCoordRect.update();
	}
}


class EllipseVisual extends TwoPointer {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.dialog = new EllipseDialog(this.id);
		this.dialog.subscribePool.subscribe(() => {
			this.updateGraphics();
		});
	}
	makeGraphics() {
		let cx = (this.startX + this.endX) / 2;
		let cy = (this.startY + this.endY) / 2;
		let rx = Math.max(Math.abs(this.startX - this.endX) / 2, 1);
		let ry = Math.max(Math.abs(this.startY - this.endY) / 2, 1);
		this.element = SVG.ellipse(cx, cy, rx, ry, defaultStroke, "none", "element");
		this.clickEllipse = SVG.ellipse(cx, cy, rx, ry, "transparent", "none", "element", { "stroke-width": "10" });
		this.selector = SVG.rect(cx, cy, rx, ry, defaultStroke, defaultFill, "highlight", { "stroke-dasharray": "2 2" });

		this.selectorCoordRect = new CoordRect();
		this.selectorCoordRect.element = this.selector;
		this.element_array = [this.element];
		this.group = SVG.append(SVG.annotationLayer, SVG.group([this.element, this.clickEllipse, this.selector]));
		this.group.setAttribute("node_id", this.id);

		$(this.group).dblclick((event) => {
			this.doubleClick(event);
		});
	}
	doubleClick(event = null) {
		if (event && routeAnnotationDoubleClick(event)) return;
		this.dialog.show();
	}
	updateGraphics() {
		let cx = (this.startX + this.endX) / 2;
		let cy = (this.startY + this.endY) / 2;
		let rx = Math.max(Math.abs(this.startX - this.endX) / 2, 1);
		let ry = Math.max(Math.abs(this.startY - this.endY) / 2, 1);
		this.element.setAttribute("cx", cx);
		this.element.setAttribute("cy", cy);
		this.element.setAttribute("rx", rx);
		this.element.setAttribute("ry", ry);
		this.element.setAttribute("stroke-dasharray", this.primitive.getAttribute("StrokeDashArray"));
		this.element.setAttribute("stroke-width", this.primitive.getAttribute("StrokeWidth"));
		this.clickEllipse.setAttribute("cx", cx);
		this.clickEllipse.setAttribute("cy", cy);
		this.clickEllipse.setAttribute("rx", rx);
		this.clickEllipse.setAttribute("ry", ry);
		this.selectorCoordRect.x1 = this.startX;
		this.selectorCoordRect.y1 = this.startY;
		this.selectorCoordRect.x2 = this.endX;
		this.selectorCoordRect.y2 = this.endY;
		this.selectorCoordRect.update();
	}

	select() {
		super.select();
		this.selector.setAttribute("visibility", "visible");
	}
	unselect() {
		super.unselect();
		this.selector.setAttribute("visibility", "hidden");
	}
}

class HtmlTwoPointer extends TwoPointer {
	updateHTML(html) {
		this.htmlElement.contentDiv.innerHTML = html;
	}
	clean() {
		super.clean();
		this.htmlElement.remove();
	}
}

// Build a side-by-side comparison table. Each selected run owns a group of
// variable columns, while Time remains the shared first column. The union of
// time points is used so runs with different time grids remain aligned without
// fabricating/interpolating values.
function buildSideBySideRunTable(runBlocks, variableCount) {
	if (!Array.isArray(runBlocks) || !runBlocks.length) return [];
	if (runBlocks.length === 1) return runBlocks[0].results.map(row => row.slice());

	let rowsByTime = new Map();
	let valueWidth = runBlocks.length * variableCount;
	let timeKey = (value) => {
		let number = Number(value);
		return Number.isFinite(number) ? `n:${number.toPrecision(14)}` : `s:${String(value)}`;
	};

	for (let runIndex = 0; runIndex < runBlocks.length; runIndex++) {
		let block = runBlocks[runIndex];
		for (let sourceRow of block.results) {
			let key = timeKey(sourceRow[0]);
			if (!rowsByTime.has(key)) {
				rowsByTime.set(key, {
					time: sourceRow[0],
					values: new Array(valueWidth).fill(null)
				});
			}
			let target = rowsByTime.get(key);
			for (let variableIndex = 0; variableIndex < variableCount; variableIndex++) {
				// Variable-first ordering: all selected runs for Variable 1, then all
				// selected runs for Variable 2, etc. This matches the way users
				// visually compare scenarios in a table.
				target.values[variableIndex * runBlocks.length + runIndex] = sourceRow[variableIndex + 1] ?? null;
			}
		}
	}

	return Array.from(rowsByTime.values())
		.sort((a, b) => {
			let aNumber = Number(a.time);
			let bNumber = Number(b.time);
			if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
			return String(a.time).localeCompare(String(b.time));
		})
		.map(entry => [entry.time].concat(entry.values));
}


// Docked output workspace -----------------------------------------------------------
// Plot and Table primitives remain part of the .ssd model for backward
// compatibility, but their presentation is owned by the right-hand Output panel
// rather than consuming modeling-canvas space.
const SystemikaOutputDock = {
	visuals: new Map(),
	activeVisual: null,
	activeType: "equations",
	initialized: false,
	_detached: false,
	_hidden: true,
	_externalWindow: null,
	_externalClosing: false,
	_visualViewFlex: "1 1 0px",
	_userSizedWidth: false,

	isOutputVisual(visual) {
		return Boolean(visual && ["table", "timeplot", "compareplot", "xyplot", "histoplot"].includes(String(visual.type || "").toLowerCase()));
	},
	labelForType(type) {
		return ({ table: "Table", timeplot: "Time Plot", compareplot: "Time Plot", xyplot: "XY Plot", histoplot: "Histogram" })[String(type || "").toLowerCase()] || "Output";
	},
	labelForVisual(visual) {
		if (!visual) return "Output";
		let name = visual.primitive ? String(getName(visual.primitive) || "").trim() : "";
		return name || this.labelForType(visual.type);
	},
	hostDocument() {
		if (this._externalWindow && !this._externalWindow.closed) return this._externalWindow.document;
		return document;
	},
	byId(id) {
		let host = this.hostDocument();
		return (host && host.getElementById(id)) || document.getElementById(id);
	},
	panel() { return this.byId("systemika-output-panel"); },
	view() { return this.byId("systemika-output-view"); },
	settings() { return this.byId("systemika-output-settings"); },
	actions() { return this.byId("systemika-output-actions"); },
	holding() { return this.byId("systemika-output-holding"); },

	setHeaderActions(actions = []) {
		let container = this.actions();
		if (!container) return;
		container.innerHTML = actions.map((action, index) => `<button type="button" class="systemika-output-export-button" data-action-index="${index}" title="${htmlEscape(action.title || action.label)}">${htmlEscape(action.label)}</button>`).join("");
		Array.from(container.querySelectorAll(".systemika-output-export-button")).forEach(button => {
			button.addEventListener("click", event => {
				event.preventDefault();
				let action = actions[Number(button.getAttribute("data-action-index"))];
				if (action && typeof action.run === "function") action.run();
			});
		});
	},

	refreshHeaderActions() {
		if (this.activeType === "equations") {
			this.setHeaderActions([
				{ label: "Export TXT", title: "Export equations as TXT", run: () => fileManager.exportFile(SystemikaDocumentation.toPlainText(equationList.getRows()), ".txt") },
				{ label: "Export CSV", title: "Export equations as CSV", run: () => fileManager.exportFile(SystemikaDocumentation.toCSV(equationList.getRows()), ".csv") },
				{ label: "Export LaTeX", title: "Export equations as LaTeX", run: () => fileManager.exportFile(SystemikaDocumentation.toLaTeX(equationList.getRows()), ".tex") }
			]);
			return;
		}
		let visual = this.activeVisual;
		if (visual instanceof TableVisual) {
			this.setHeaderActions([
				{ label: "Export CSV", title: "Export table data as CSV", run: () => visual.data && visual.data.exportCSV() }
			]);
			return;
		}
		if (visual instanceof PlotVisual) {
			this.setHeaderActions([
				{ label: "Export SVG", title: "Export graph as SVG", run: () => exportGraphVisual(visual, "svg") },
				{ label: "Export CSV", title: "Export plotted data as CSV", run: () => exportPlotDataCsv(visual) }
			]);
			return;
		}
		this.setHeaderActions([]);
	},

	init() {
		if (this.initialized) return;
		this.initialized = true;
		let splitter = document.getElementById("systemika-output-splitter");
		let horizontal = document.getElementById("systemika-output-horizontal-splitter");
		let panel = this.panel();
		let view = this.view();
		let settings = this.settings();
		if (!panel || !view || !settings) return;

		const startVerticalResize = (event) => {
			if (this._detached) return;
			this._userSizedWidth = true;
			event.preventDefault();
			let startX = event.clientX;
			let startWidth = panel.getBoundingClientRect().width;
			splitter.classList.add("systemika-resizing");
			let move = moveEvent => {
				let width = Math.max(378, Math.min(window.innerWidth * 0.7, startWidth - (moveEvent.clientX - startX)));
				panel.style.flexBasis = `${width}px`;
				this.resizeActive();
			};
			let up = () => {
				document.removeEventListener("mousemove", move);
				document.removeEventListener("mouseup", up);
				splitter.classList.remove("systemika-resizing");
			};
			document.addEventListener("mousemove", move);
			document.addEventListener("mouseup", up);
		};
		if (splitter) splitter.addEventListener("mousedown", startVerticalResize);

		if (horizontal) horizontal.addEventListener("mousedown", event => {
			if (panel.classList.contains("systemika-output-equations-mode")) return;
			event.preventDefault();
			let startY = event.clientY;
			let startHeight = view.getBoundingClientRect().height;
			let body = this.byId("systemika-output-body");
			let maxHeight = Math.max(180, body.getBoundingClientRect().height - 110);
			horizontal.classList.add("systemika-resizing");
			let move = moveEvent => {
				let height = Math.max(100, Math.min(maxHeight, startHeight + moveEvent.clientY - startY));
				this._visualViewFlex = `0 0 ${height}px`;
				view.style.flex = this._visualViewFlex;
				this.resizeActive();
			};
			let eventDocument = horizontal.ownerDocument || document;
			let up = () => {
				eventDocument.removeEventListener("mousemove", move);
				eventDocument.removeEventListener("mouseup", up);
				horizontal.classList.remove("systemika-resizing");
			};
			eventDocument.addEventListener("mousemove", move);
			eventDocument.addEventListener("mouseup", up);
		});

		let detachButton = document.getElementById("systemika-output-detach");
		if (detachButton) detachButton.addEventListener("click", () => this.toggleDetached());
		let closeButton = document.getElementById("systemika-output-close");
		if (closeButton) closeButton.addEventListener("click", () => this.closeWorkspace());

		if (typeof ResizeObserver !== "undefined") {
			this._resizeObserver = new ResizeObserver(() => this.resizeActive());
			this._resizeObserver.observe(view);
			this._resizeObserver.observe(panel);
		} else window.addEventListener("resize", () => this.resizeActive());
		this.refreshSelector();
		// Prepare the default Equations view without revealing the workspace.
		// Systemika starts with the modeling canvas at full width; invoking any
		// output toolbar tool/shortcut reveals the requested output.
		this.showEquations(false);
	},

	toggleDetached() {
		if (this._detached) this.attachExternalWindow();
		else this.detachToExternalWindow();
	},

	updateDetachButton() {
		let button = this.byId("systemika-output-detach");
		if (!button) return;
		button.title = this._detached ? "Attach output panel" : "Detach output panel";
		button.setAttribute("aria-label", button.title);
	},

	openWorkspace() {
		let panel = document.getElementById("systemika-output-panel");
		let splitter = document.getElementById("systemika-output-splitter");
		if (!panel) return;
		panel.classList.remove("systemika-output-hidden");
		panel.setAttribute("aria-hidden", "false");
		if (splitter) splitter.classList.remove("systemika-output-hidden");
		this._hidden = false;
		setTimeout(() => this.resizeActive(), 10);
	},

	closeWorkspace(fromExternalWindowClose = false) {
		let popup = this._externalWindow;
		let panel = this.panel();
		let row = document.querySelector(".workspace-row");
		if (this._detached) {
			if (panel && row && panel.ownerDocument !== document) row.appendChild(panel);
			if (panel) panel.classList.remove("systemika-output-external");
			this._detached = false;
			this._externalWindow = null;
			if (!fromExternalWindowClose && popup && !popup.closed) {
				this._externalClosing = true;
				try { popup.close(); } catch (_) {}
				this._externalClosing = false;
			}
		}
		panel = document.getElementById("systemika-output-panel");
		let splitter = document.getElementById("systemika-output-splitter");
		if (panel) {
			panel.classList.add("systemika-output-hidden");
			panel.setAttribute("aria-hidden", "true");
		}
		if (splitter) splitter.classList.add("systemika-output-hidden");
		this._hidden = true;
		this.updateDetachButton();
		setTimeout(() => { try { window.dispatchEvent(new Event("resize")); } catch (_) {} }, 10);
	},

	detachToExternalWindow() {
		this.openWorkspace();
		let panel = this.panel();
		if (!panel) return;
		let popup = null;
		try {
			popup = window.open("about:blank", "SystemikaOutputWindow", "popup=yes,width=760,height=760,resizable=yes,scrollbars=no");
		} catch (error) {
			console.error(error);
		}
		if (!popup) {
			xAlert("Systemika could not open the detached output window. Please allow pop-up windows for Systemika and try again.");
			return;
		}
		this._externalWindow = popup;
		this._detached = true;
		let baseHref = htmlEscape(document.baseURI);
		let styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
			.map(link => `<link rel="stylesheet" href="${htmlEscape(link.href)}">`).join("");
		popup.document.open();
		popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Systemika Output</title><base href="${baseHref}">${styleLinks}<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:white;}#systemika-output-window-host{width:100%;height:100%;display:flex;}</style></head><body><div id="systemika-output-window-host"></div></body></html>`);
		popup.document.close();
		let host = popup.document.getElementById("systemika-output-window-host");
		if (!host) {
			this._externalWindow = null;
			this._detached = false;
			try { popup.close(); } catch (_) {}
			return;
		}
		panel.classList.add("systemika-output-external");
		host.appendChild(panel);
		let splitter = document.getElementById("systemika-output-splitter");
		if (splitter) splitter.style.display = "none";
		this.updateDetachButton();
		popup.document.title = `Systemika - ${this.byId("systemika-output-title") ? this.byId("systemika-output-title").textContent : "Output"}`;
		popup.addEventListener("resize", () => this.resizeActive());
		popup.addEventListener("beforeunload", () => {
			if (!this._externalClosing && this._externalWindow === popup) this.closeWorkspace(true);
		});
		setTimeout(() => { try { popup.focus(); } catch (_) {} this.resizeActive(); }, 30);
	},

	attachExternalWindow(fromWindowClose = false) {
		let popup = this._externalWindow;
		let panel = this.panel();
		let row = document.querySelector(".workspace-row");
		let splitter = document.getElementById("systemika-output-splitter");
		if (panel && row && panel.ownerDocument !== document) row.appendChild(panel);
		if (panel) {
			panel.classList.remove("systemika-output-external", "systemika-output-hidden");
			panel.setAttribute("aria-hidden", "false");
		}
		if (splitter) {
			splitter.style.display = "";
			splitter.classList.remove("systemika-output-hidden");
		}
		this._hidden = false;
		this._detached = false;
		this._externalWindow = null;
		this.updateDetachButton();
		if (!fromWindowClose && popup && !popup.closed) {
			this._externalClosing = true;
			try { popup.close(); } catch (_) {}
			this._externalClosing = false;
		}
		setTimeout(() => this.resizeActive(), 30);
	},

	hideCanvasVisual(visual) {
		if (!visual) return;
		if (visual.group) visual.group.style.display = "none";
		if (visual.start_anchor && typeof visual.start_anchor.setVisible === "function") visual.start_anchor.setVisible(false);
		if (visual.end_anchor && typeof visual.end_anchor.setVisible === "function") visual.end_anchor.setVisible(false);
		if (visual.htmlElement) visual.htmlElement.style.display = "none";
		if (visual.targetElement) {
			$(visual.targetElement).off("mousedown dblclick contextmenu");
			let holding = this.holding();
			if (holding && visual.targetElement.parentNode !== holding) holding.appendChild(visual.targetElement);
			visual.targetElement.style.display = "none";
		}
	},

	registerVisual(visual) {
		if (!this.isOutputVisual(visual)) return;
		this.visuals.set(String(visual.id), visual);
		this.hideCanvasVisual(visual);
		this.refreshSelector();
	},
	unregisterVisual(visual) {
		if (!visual) return;
		let id = String(visual.id);
		this.visuals.delete(id);
		if (this.activeVisual === visual) {
			this.activeVisual = null;
			this.showEquations(!this._hidden);
		}
		this.refreshSelector();
	},

	refreshSelector() {
		// Output navigation is intentionally owned by toolbar buttons/shortcuts.
	},

	unmountActive() {
		let visual = this.activeVisual;
		if (!visual) return;
		if (visual.dialog && typeof visual.dialog.unmountFromDock === "function") visual.dialog.unmountFromDock();
		if (visual.targetElement) {
			visual.targetElement.classList.remove("systemika-docked-plot");
			let holding = this.holding();
			if (holding) holding.appendChild(visual.targetElement);
			visual.targetElement.style.display = "none";
		}
		if (visual.dockElement) visual.dockElement.remove();
	},

	showEquations(reveal = true) {
		this.init();
		if (reveal) this.openWorkspace();
		let panel = this.panel(), view = this.view(), settings = this.settings();
		if (!panel || !view) return;
		// Plot/Table resizing writes an inline flex basis on the shared view.
		// Preserve that split for output views, but remove it completely for
		// Equations so the documentation always owns the full panel height.
		if (this.activeVisual && view.style.flex) this._visualViewFlex = view.style.flex;
		this.unmountActive();
		this.activeVisual = null;
		this.activeType = "equations";
		view.style.removeProperty("flex");
		view.style.removeProperty("height");
		if (settings) {
			settings.style.removeProperty("flex");
			settings.style.removeProperty("height");
			settings.innerHTML = "";
		}
		panel.classList.add("systemika-output-equations-mode");
		view.classList.remove("systemika-output-table-view");
		this.byId("systemika-output-title").textContent = "Equations";
		this.refreshHeaderActions();
		if (typeof equationList !== "undefined" && equationList) {
			equationList._dockOriginalContent = equationList._dockOriginalContent || equationList.dialogContent;
			equationList.dialogContent = view;
			view.innerHTML = equationList.renderPanelHtml();
			equationList.bindPanelEvents();
		} else view.innerHTML = `<div style="padding:12px;">Model equations will appear here.</div>`;
		this.refreshSelector();
	},

	activateVisual(visual, reveal = true) {
		if (!visual || !this.isOutputVisual(visual)) return;
		this.init();
		if (reveal) this.openWorkspace();
		if (!this.visuals.has(String(visual.id))) this.registerVisual(visual);
		if (this.activeVisual !== visual) this.unmountActive();
		this.activeVisual = visual;
		this.activeType = String(visual.type || "").toLowerCase();
		let panel = this.panel(), view = this.view(), settings = this.settings();
		panel.classList.remove("systemika-output-equations-mode");
		// A Table must have exactly one vertical scroll owner. In web browsers the
		// shared output view can otherwise become a second scroll container and
		// cause sticky headings to scroll away.
		view.classList.toggle("systemika-output-table-view", visual instanceof TableVisual);
		// Output views have their own split state. By default the available
		// vertical space is divided equally between output and settings; resizing
		// this split never constrains Equations.
		view.style.flex = this._visualViewFlex || "1 1 0px";
		view.style.removeProperty("height");
		settings.style.flex = "1 1 0px";
		settings.style.removeProperty("height");
		view.innerHTML = "";
		settings.innerHTML = "";
		this.byId("systemika-output-title").textContent = this.labelForType(visual.type);
		this.refreshHeaderActions();
		if (visual instanceof PlotVisual) {
			view.appendChild(visual.targetElement);
			visual.targetElement.classList.add("systemika-docked-plot");
			visual.targetElement.style.display = "block";
		} else if (visual instanceof TableVisual) {
			if (!visual.dockElement) {
				visual.dockElement = document.createElement("div");
				visual.dockElement.className = "systemika-docked-table";
			}
			view.appendChild(visual.dockElement);
		}
		if (visual.dialog && typeof visual.dialog.mountInDock === "function") visual.dialog.mountInDock(settings);
		this.syncDefaultPanelWidthToSettings();
		this.refreshSelector();
		visual.render();
		setTimeout(() => {
			this.syncDefaultPanelWidthToSettings();
			this.resizeActive();
		}, 10);
	},

	syncDefaultPanelWidthToSettings() {
		if (this._detached || this._userSizedWidth) return;
		let panel = this.panel();
		let settings = this.settings();
		if (!panel || !settings) return;
		let box = settings.querySelector(".systemika-output-setting-box");
		if (!box) return;
		let boxWidth = box.getBoundingClientRect().width;
		if (!(boxWidth > 0)) return;
		let desired = Math.ceil(boxWidth * 1.05);
		panel.style.flexBasis = `${desired}px`;
	},

	resizeActive() {
		let visual = this.activeVisual;
		if (!visual) return;
		if (visual instanceof PlotVisual && typeof visual.updateDockedGraphics === "function") visual.updateDockedGraphics();
	},

	outputsOfType(type) {
		let normalized = String(type || "").toLowerCase();
		return Array.from(this.visuals.values()).filter(visual => {
			let candidate = String(visual.type || "").toLowerCase();
			return findID(visual.id) && candidate === normalized;
		});
	},

	openType(type) {
		this.init();
		this.openWorkspace();
		let normalized = String(type || "").toLowerCase();
		if (normalized === "equations") {
			this.showEquations(false);
			return null;
		}
		let existing = this.outputsOfType(normalized);
		if (existing.length) {
			let index = this.activeVisual ? existing.indexOf(this.activeVisual) : -1;
			let visual = existing[(index + 1 + existing.length) % existing.length];
			this.activateVisual(visual, false);
			return visual;
		}
		return this.createOutput(normalized, true);
	},

	// Keyboard output shortcuts are toggles: pressing the shortcut for the
	// currently visible output hides the workspace; pressing it again restores
	// that same output. A shortcut for a different output switches normally.
	toggleType(type) {
		this.init();
		let normalized = String(type || "").toLowerCase();
		let sameActive = normalized === "equations"
			? this.activeType === "equations"
			: Boolean(this.activeVisual && String(this.activeVisual.type || "").toLowerCase() === normalized);

		if (!this._hidden && sameActive) {
			this.closeWorkspace();
			return null;
		}

		if (this._hidden && sameActive) {
			this.openWorkspace();
			if (normalized === "equations") this.showEquations(false);
			else this.activateVisual(this.activeVisual, false);
			return this.activeVisual;
		}

		return this.openType(normalized);
	},

	createOutput(type) {
		let normalized = String(type || "").toLowerCase();
		let meta = {
			table: ["Table", TableVisual, "Table"],
			timeplot: ["TimePlot", TimePlotVisual, "TimePlot"],
			compareplot: ["ComparePlot", ComparePlotVisual, "TimePlot"],
			xyplot: ["XyPlot", XyPlotVisual, "XYPlot"],
			histoplot: ["HistoPlot", HistoPlotVisual, "Histogram"]
		}[normalized];
		if (!meta) return null;
		let [nodeType, VisualClass, baseName] = meta;
		let primitive = createConnector(findFreeName(baseName), nodeType, null, null);
		setSourcePosition(primitive, [20, 20]);
		setTargetPosition(primitive, [620, 420]);
		let visual = new VisualClass(primitive.id, normalized, [20, 20], [620, 420]);
		let selected = Object.values(get_selected_root_objects()).filter(Boolean)
			.map(item => item.primitive).filter(Boolean)
			.filter(item => ["Stock", "Flow", "Variable", "Converter"].includes(getType(item)))
			.map(item => String(getID(item)));
		if (normalized === "xyplot") selected = selected.slice(0, 2);
		if (normalized === "histoplot") selected = selected.slice(0, 1);
		if (selected.length) setDisplayIds(primitive, selected, normalized === "timeplot" ? selected.map(() => "L") : undefined);
		visual.update();
		visual.render();
		this.registerVisual(visual);
		this.activateVisual(visual);
		History.storeUndoState();
		return visual;
	},

	onModelSynced() {
		// Drop stale visual references after load/Undo, re-register current outputs,
		// and preserve the active output only if that primitive still exists.
		for (let [id, visual] of Array.from(this.visuals.entries())) if (!findID(id) || connection_array[id] !== visual) this.visuals.delete(id);
		for (let id in connection_array) if (this.isOutputVisual(connection_array[id])) this.registerVisual(connection_array[id]);
		if (this.activeVisual && this.visuals.has(String(this.activeVisual.id))) this.activateVisual(this.visuals.get(String(this.activeVisual.id)), !this._hidden);
		else this.showEquations(!this._hidden);
	},

	refreshEquationsIfVisible() {
		if (this.activeType === "equations" && !this._hidden) this.showEquations(false);
	}
};
if (typeof window !== "undefined") window.SystemikaOutputDock = SystemikaOutputDock;

class TableVisual extends HtmlTwoPointer {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.runHandler = () => {
			this.render();
		}
		RunResults.subscribeRun(id, this.runHandler);
		this.data = new TableData();
		initializeMultiRunSelection(this.primitive);
		SystemikaOutputDock.registerVisual(this);
	}
	updateHTML(html) {
		super.updateHTML(html);
		if (this.dockElement) this.dockElement.innerHTML = html;
	}
	clean() {
		SystemikaOutputDock.unregisterVisual(this);
		if (this.dockElement) this.dockElement.remove();
		super.clean();
	}
	removePlotReference(removeId) {
		let result = removeDisplayId(this.primitive, removeId);
		if (result) {
			let decimals = getTableDecimals(this.primitive);
			delete decimals[String(removeId)];
			this.primitive.setAttribute("TableDecimals", JSON.stringify(decimals));
			this.render();
		}
	}
	render() {
		let runNames = getCompareRunNames(this.primitive);
		if (!runNames.length) runNames = [""];
		let IdsToDisplay = getDisplayIds(this.primitive);
		this.primitive.setAttribute("Primitives", IdsToDisplay.join(","));
		this.data.namesToDisplay = IdsToDisplay.map(findID).filter(Boolean).map(getName);
		let selected = this.data.namesToDisplay.length ? this.data.namesToDisplay.map(htmlEscape).join(", ") : "None";
		let selectedSummary = `<div class="systemika-table-selection-summary"><b>Selected Variable(s):</b> ${selected}</div>`;
		if (!ensureDisplayRunsAvailable(this.primitive, () => this.render())) {
			this.updateHTML(`${selectedSummary}<div style="padding:8px;">Loading selected run data…</div>`);
			return;
		}

		let bounds = getCompareRunBounds(this.primitive);
		let limits = JSON.parse(this.primitive.getAttribute("TableLimits"));
		let defaultStart = bounds ? bounds.min : RunResults.getDataTimeStart(runNames[0]);
		let defaultEnd = bounds ? bounds.max : defaultStart + RunResults.getDataTimeLength(runNames[0]);
		limits.start.value = limits.start.auto ? defaultStart : limits.start.value;
		limits.end.value = limits.end.auto ? defaultEnd : limits.end.value;
		limits.step.value = limits.step.auto ? this.dialog.getDefaultPlotPeriod() : limits.step.value;
		let length = limits.end.value - limits.start.value;
		this.primitive.setAttribute("TableLimits", JSON.stringify(limits));

		let runBlocks = [];
		for (let runName of runNames) {
			if (!runName && (!RunResults.results || !RunResults.results.length)) continue;
			let results = RunResults.getFilteredSelectiveIdResults(
				IdsToDisplay, limits.start.value, length, limits.step.value, runName
			);
			if (!results || !results.length) continue;
			let label = runName || getCurrentRunSourceName() || "Current";
			runBlocks.push({ runName, label, results });
		}

		let multiRun = runBlocks.length > 1 && IdsToDisplay.length > 0;
		this.data.runNames = multiRun ? runBlocks.map(block => block.label) : [];
		this.data.results = buildSideBySideRunTable(runBlocks, IdsToDisplay.length);

		let steps = runNames
			.map(name => Number(RunResults.getTimeStep(name)))
			.filter(value => Number.isFinite(value) && value > 0);
		let displayTimeStep = steps.length ? Math.min(...steps) : Number(getTimeStep());
		let time_decimals = decimals_in_value_string(`${displayTimeStep}`);

		let roundToZero = this.primitive.getAttribute("RoundToZero");
		let round_to_zero_limit = -1;
		if (roundToZero === "true") {
			round_to_zero_limit = this.primitive.getAttribute("RoundToZeroAtValue");
			if (isNaN(round_to_zero_limit)) {
				round_to_zero_limit = getDefaultAttributeValue("table", "RoundToAtZeroValue");
			} else {
				round_to_zero_limit = Number(round_to_zero_limit);
			}
		}

		let tableDecimals = getTableDecimals(this.primitive);
		let decimalsByVariable = IdsToDisplay.map(id => getTableDecimalForId(this.primitive, id, tableDecimals));
		let decimalsForValueColumn = (columnIndex) => {
			let variableIndex = multiRun ? Math.floor(columnIndex / runBlocks.length) : columnIndex;
			return decimalsByVariable[variableIndex] ?? SYSTEMIKA_TABLE_DEFAULT_DECIMALS;
		};

		let units = runBlocks.length
			? RunResults.getDataTimeUnits(runBlocks[0].runName)
			: RunResults.getDataTimeUnits();
		let variableHeaders = this.data.namesToDisplay.map(name => {
			const primitives = findName(name);
			const primitive = Array.isArray(primitives) ? primitives.find(primitive => !isPrimitiveGhost(primitive)) : primitives;
			const color = primitive?.getAttribute("Color");
			return `<th class="prim-header-cell"><span class="cm-primitive cm-${color}">${htmlEscape(name)}</span></th>`;
		}).join("");

		let headerHtml = "";
		if (multiRun) {
			let variableGroupHeaders = this.data.namesToDisplay.map(name => {
				const primitives = findName(name);
				const primitive = Array.isArray(primitives) ? primitives.find(primitive => !isPrimitiveGhost(primitive)) : primitives;
				const color = primitive?.getAttribute("Color");
				return `<th class='prim-header-cell' colspan='${runBlocks.length}'><span class="cm-primitive cm-${color}">${htmlEscape(name)}</span></th>`;
			}).join("");
			let runHeaders = this.data.namesToDisplay.map(() =>
				runBlocks.map(block => `<th class='prim-header-cell'>${htmlEscape(block.label)}</th>`).join("")
			).join("");
			headerHtml = `<tr>
				<th class='time-header-cell' rowspan='2'>
					<div>Time</div>
					<div class="time-unit">${htmlEscape(units)}</div>
				</th>
				${variableGroupHeaders}
			</tr>
			<tr>${runHeaders}</tr>`;
		} else {
			headerHtml = `<tr>
				<th class='time-header-cell'>
					<div>Time</div>
					<div class="time-unit">${htmlEscape(units)}</div>
				</th>
				${variableHeaders}
			</tr>`;
		}

		let html = `${selectedSummary}<div class="systemika-table-scroll-region"><table class='sticky-table zebra-odd${multiRun ? " systemika-multi-run-table" : ""}'>
			<thead>${headerHtml}</thead>
			<tbody>
				${this.data.results.map((row) => {
					return `<tr>
						<td class="time-value-cell">${format_number(row[0], { round_to_zero_limit, decimals: time_decimals })}</td>
						${row.slice(1).map((value, columnIndex) => `<td class="prim-value-cell">${value == null ? "" : format_number(value, { round_to_zero_limit, decimals: decimalsForValueColumn(columnIndex) })}</td>`).join("")}
					</tr>`;
				}).join("")}
			</tbody>
		</table>`;
		if (this.data.results.length === 0) {
			html += (`<div class="empty-plot-header">Table</div>`);
		}
		html += `</div>`;
		this.updateHTML(html);
		this.dialog.data = this.data;
	}

	makeGraphics() {
		this.dialog = new TableDialog(this.id);
		this.dialog.subscribePool.subscribe(() => {
			this.render();
		});
		this.element = SVG.rect(this.getMinX(), this.getMinY(), this.getWidth(), this.getHeight(), defaultStroke, "none", "element", "");
		this.htmlElement = SVG.append(SVG.plotLayer,
			SVG.foreignScrollable(this.getMinX(), this.getMinY(), this.getWidth(), this.getHeight(), "table not rendered yet", "white")
		);

		$(this.htmlElement.cutDiv).mousedown((event) => {
			// This is an alternative to having the htmlElement in the group
			primitive_mousedown(this.id, event)
			mouseDownHandler(event);
			event.stopPropagation();
		});

		// Table properties are opened through a dedicated Settings button rather
		// than double-clicking the scrollable table surface.
		this.htmlElement.cutDiv.style.position = "relative";
		this.settingsButton = document.createElement("button");
		this.settingsButton.type = "button";
		this.settingsButton.className = "table-settings-button";
		this.settingsButton.title = "Settings";
		this.settingsButton.setAttribute("aria-label", "Settings");
		this.settingsButton.textContent = "⚙";
		this.htmlElement.cutDiv.appendChild(this.settingsButton);
		$(this.settingsButton).on("mousedown dblclick", event => event.stopPropagation());
		$(this.settingsButton).click(event => {
			event.preventDefault();
			event.stopPropagation();
			this.dialog.show();
		});

		this.coordRect = new CoordRect();
		this.coordRect.element = this.element;

		// this.group = SVG.group([this.element]);
		this.group = SVG.append(SVG.plotLayer, SVG.group([this.element]));
		this.group.setAttribute("node_id", this.id);

		this.element_array = [this.element];
		this.element_array = [this.htmlElement.scrollDiv, this.element];
		for (let key in this.element_array) {
			this.element_array[key].setAttribute("node_id", this.id);
		}
	}
	updateGraphics() {
		// Update rect to fit start and end position
		this.coordRect.x1 = this.startX;
		this.coordRect.y1 = this.startY;
		this.coordRect.x2 = this.endX;
		this.coordRect.y2 = this.endY;
		this.coordRect.update();

		this.htmlElement.setX(this.getMinX());
		this.htmlElement.setY(this.getMinY());
		this.htmlElement.setWidth(this.getWidth());
		this.htmlElement.setHeight(this.getHeight());

		$(this.htmlElement.scrollDiv).css("width", this.getWidth());
		$(this.htmlElement.scrollDiv).css("height", this.getHeight());
	}
}

class HtmlOverlayTwoPointer extends TwoPointer {
	updateHTML(html) {
		this.targetElement.innerHTML = html;
	}

	makeGraphics() {
		this.targetBorder = 4;
		this.targetElement = document.createElement("div");
		this.targetElement.classList.add("canvas-scaled-html-overlay");
		this.targetElement.style.position = "absolute";
		this.targetElement.style.transformOrigin = "0 0";
		this.targetElement.style.backgroundColor = "white";
		this.targetElement.style.zIndex = 100;
		this.targetElement.style.overflow = "hidden";
		let initialOverlayLeft = this.getMinX() + this.targetBorder + 1;
		let initialOverlayTop = this.getMinY() + this.targetBorder + 1;
		let initialZoomLevel = (typeof Zoom !== "undefined" && Number.isFinite(Zoom.level)) ? Zoom.level : 1;
		this.targetElement.dataset.canvasLeft = String(initialOverlayLeft);
		this.targetElement.dataset.canvasTop = String(initialOverlayTop);
		this.targetElement.style.left = (initialOverlayLeft * initialZoomLevel) + "px";
		this.targetElement.style.top = (initialOverlayTop * initialZoomLevel) + "px";
		this.targetElement.style.transform = `scale(${initialZoomLevel})`;
		this.targetElement.style.width = "2px";
		this.targetElement.style.height = "2px";
		document.getElementById("svgplanebackground").appendChild(this.targetElement);

		$(this.targetElement).mousedown((event) => {
			// This is an alternative to having the htmlElement in the group
			primitive_mousedown(this.id, event)
			mouseDownHandler(event);
			event.stopPropagation();
		});

		$(this.targetElement).dblclick(() => {
			this.doubleClick(this.id);
		});

		// Emergency solution since double clicking a ComparePlot or XyPlot does not always work.
		$(this.targetElement).bind("contextmenu", (event) => {
			this.doubleClick(this.id);
		});

		this.element = SVG.rect(this.getMinX(), this.getMinY(), this.getWidth(), this.getHeight(), defaultStroke, "white", "element", "");

		this.coordRect = new CoordRect();
		this.coordRect.element = this.element;

		this.group = SVG.append(SVG.plotLayer, SVG.group([this.element]));
		this.group.setAttribute("node_id", this.id);

		this.element_array = [this.element];
		for (let key in this.element_array) {
			this.element_array[key].setAttribute("node_id", this.id);
		}
	}

	updateGraphics() {
		// Update rect to fit start and end position
		this.coordRect.x1 = this.startX;
		this.coordRect.y1 = this.startY;
		this.coordRect.x2 = this.endX;
		this.coordRect.y2 = this.endY;
		this.coordRect.update();

		let overlayLeft = this.getMinX() + this.targetBorder + 1;
		let overlayTop = this.getMinY() + this.targetBorder + 1;
		let overlayWidth = this.getWidth() - (2 * this.targetBorder);
		let overlayHeight = this.getHeight() - (2 * this.targetBorder);
		this.targetElement.dataset.canvasLeft = String(overlayLeft);
		this.targetElement.dataset.canvasTop = String(overlayTop);
		this.targetElement.style.width = overlayWidth + "px";
		this.targetElement.style.height = overlayHeight + "px";
		let zoomLevel = (typeof Zoom !== "undefined" && Number.isFinite(Zoom.level)) ? Zoom.level : 1;
		this.targetElement.style.left = (overlayLeft * zoomLevel) + "px";
		this.targetElement.style.top = (overlayTop * zoomLevel) + "px";
		this.targetElement.style.transform = `scale(${zoomLevel})`;
	}

	clean() {
		super.clean();
		this.targetElement.remove();
	}
	doubleClick() {
		this.dialog.show();
	}
}


function normalizeLegendDashPattern(pattern) {
	if (Array.isArray(pattern)) {
		if (pattern.length === 1 && Number(pattern[0]) === 1) return "";
		return pattern.map(Number).filter(Number.isFinite).join(",");
	}
	let text = String(pattern == null ? "" : pattern).toLowerCase();
	if (!text || text === "solid") return "";
	if (text === "dashed") return "10,5";
	if (text === "dotted") return "2,4";
	return text;
}

function stylePlotLegendLineSamples(chartDiv, plot, seriesSettings, maxSeries) {
	if (!chartDiv || !plot) return;
	let rows = Array.from(chartDiv.querySelectorAll("table.jqplot-table-legend tr"));
	let visible = [];
	for (let i = 0; i < (seriesSettings || []).length; i++) {
		let settings = seriesSettings[i] || {};
		if (settings.showLabel === false || !settings.label) continue;
		visible.push({ settings, series: plot.series && plot.series[i] ? plot.series[i] : null });
		if (maxSeries && visible.length >= maxSeries) break;
	}
	for (let i = 0; i < Math.min(rows.length, visible.length); i++) {
		let cell = rows[i].querySelector("td.jqplot-table-legend-swatch");
		if (!cell) continue;
		let item = visible[i];
		let color = (item.series && item.series.color) || item.settings.color || "#000000";
		let width = Number(item.settings.lineWidth || (item.series && item.series.lineWidth) || 2);
		let dash = normalizeLegendDashPattern(item.settings.linePattern || (item.series && item.series.linePattern));
		cell.innerHTML = "";
		let hostDocument = cell.ownerDocument || document;
		let svg = hostDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", "28"); svg.setAttribute("height", "10");
		svg.setAttribute("viewBox", "0 0 28 10"); svg.style.display = "block";
		let line = hostDocument.createElementNS("http://www.w3.org/2000/svg", "line");
		line.setAttribute("x1", "1"); line.setAttribute("x2", "27"); line.setAttribute("y1", "5"); line.setAttribute("y2", "5");
		line.setAttribute("stroke", color); line.setAttribute("stroke-width", String(Math.max(1, width)));
		if (dash) line.setAttribute("stroke-dasharray", dash);
		svg.appendChild(line); cell.appendChild(svg);
	}
}

function plotBottomLegendOptions(show = true) {
	let options = {
		show: Boolean(show),
		location: "s"
	};
	// jqPlot 1.0.8 throws while drawing a hidden legend when outsideGrid is
	// requested because there is no legend element to detach. Only visible
	// legends should reserve space outside the plotting grid.
	if (options.show) {
		return { ...options, placement: "outsideGrid", marginTop: "8px" };
	}
	return options;
}

let systemikaDetachedPlotStageCounter = 0;
function renderSystemikaJqPlot(chartDiv, series, options) {
	if (!chartDiv || !chartDiv.id) throw new Error("No Systemika plot target specified");
	// jqPlot 1.0.8 resolves string target IDs against the JavaScript realm's
	// global document. Once the live Output panel has been adopted into the
	// detached window, that lookup still points at the main editor document and
	// jqPlot aborts with "No plot target specified". Render into an off-screen
	// target in the main document, then adopt the finished live canvases into the
	// detached chart. Event handlers are attached to those same DOM nodes and
	// therefore remain interactive after adoption.
	if (!chartDiv.ownerDocument || chartDiv.ownerDocument === document) {
		return $.jqplot(chartDiv.id, series, options);
	}

	let stage = document.createElement("div");
	stage.id = `${chartDiv.id}_systemika_stage_${++systemikaDetachedPlotStageCounter}`;
	stage.style.position = "absolute";
	stage.style.left = "-100000px";
	stage.style.top = "0";
	stage.style.visibility = "hidden";
	stage.style.width = chartDiv.style.width || `${Math.max(1, chartDiv.clientWidth || 1)}px`;
	stage.style.height = chartDiv.style.height || `${Math.max(1, chartDiv.clientHeight || 1)}px`;
	document.body.appendChild(stage);

	try {
		let plot = $.jqplot(stage.id, series, options);
		chartDiv.replaceChildren();
		while (stage.firstChild) chartDiv.appendChild(stage.firstChild);
		chartDiv.classList.add("jqplot-target");
		chartDiv.style.position = "relative";
		if (plot) {
			plot.target = $(chartDiv);
			plot.targetId = `#${chartDiv.id}`;
			plot.target.data("jqplot", plot);
		}
		return plot;
	} finally {
		stage.remove();
	}
}

function spacePlotLegendFromGrid(chartDiv, gapPixels = 8) {
	if (!chartDiv) return;
	let legend = chartDiv.querySelector("table.jqplot-table-legend");
	if (!legend) return;
	legend.style.marginLeft = "0px";
	legend.style.marginTop = `${Math.max(0, Number(gapPixels) || 0)}px`;
	legend.style.transform = "none";
}

function graphExportBaseName() {
	let base = (fileManager && typeof fileManager.defaultExportBaseName === "function") ? fileManager.defaultExportBaseName() : "Systemika-Graph";
	return String(base || "Systemika-Graph").replace(/\.[^.]+$/, "");
}

function graphXmlEscape(value) {
	return String(value == null ? "" : value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function graphPlainText(value) {
	let text = String(value == null ? "" : value);
	if (typeof document === "undefined") return text.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
	let div = document.createElement("div");
	div.innerHTML = text;
	return (div.textContent || div.innerText || "").replace(/\u00a0/g, " ").trim();
}

function graphFinite(value, fallback = 0) {
	let number = Number(value);
	return Number.isFinite(number) ? number : fallback;
}

function graphExportDimensions(visual) {
	let chartDiv = visual && visual.chartDiv;
	if (!chartDiv) return { width: 1, height: 1 };
	let rect = chartDiv.getBoundingClientRect ? chartDiv.getBoundingClientRect() : { width: 0, height: 0 };
	return {
		width: Math.max(1, Math.ceil(rect.width || parseFloat(chartDiv.style.width) || chartDiv.offsetWidth || 1)),
		height: Math.max(1, Math.ceil(rect.height || parseFloat(chartDiv.style.height) || chartDiv.offsetHeight || 1))
	};
}

const GRAPH_EXPORT_RASTER_SCALE = 3;
const GRAPH_EXPORT_EDGE_PADDING = 10;
const GRAPH_EXPORT_LEGEND_GAP = 11;

function graphLegendMetrics(plot, availableWidth = 1000) {
	if (!plot || !plot.legend || !plot.legend.show || !Array.isArray(plot.series)) return null;
	let series = plot.series.filter(item => item && item.show !== false && item.showLabel !== false && item.label);
	if (!series.length) return null;
	let legendWidth = Math.min(
		Math.max(90, ...series.map(item => graphPlainText(item.label).length * 6.5 + 48)),
		Math.max(90, availableWidth - (GRAPH_EXPORT_EDGE_PADDING * 2))
	);
	return { series, width: legendWidth, height: 8 + series.length * 20 };
}

function graphAxisTicksSvg(axis, orientation, grid, width, height) {
	if (!axis || axis.show === false) return "";
	let chunks = [];
	let ticks = Array.isArray(axis._ticks) ? axis._ticks : [];
	for (let tick of ticks) {
		if (!tick || tick.show === false || tick.showLabel === false) continue;
		let value = Number(tick.value);
		if (!Number.isFinite(value) || typeof axis.u2p !== "function") continue;
		let pos = axis.u2p(value);
		if (!Number.isFinite(pos)) continue;
		let label = graphPlainText(tick.label == null ? tick.value : tick.label);
		if (!label) continue;
		if (orientation === "x") {
			if (pos < grid.left - 1 || pos > grid.right + 1) continue;
			chunks.push(`<line x1="${pos}" y1="${grid.top}" x2="${pos}" y2="${grid.bottom}" stroke="#e6e6e6" stroke-width="1"/>`);
			chunks.push(`<text x="${pos}" y="${Math.min(height - 3, grid.bottom + 16)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#222">${graphXmlEscape(label)}</text>`);
		} else if (orientation === "y") {
			if (pos < grid.top - 1 || pos > grid.bottom + 1) continue;
			chunks.push(`<line x1="${grid.left}" y1="${pos}" x2="${grid.right}" y2="${pos}" stroke="#e6e6e6" stroke-width="1"/>`);
			chunks.push(`<text x="${Math.max(2, grid.left - 7)}" y="${pos + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="#222">${graphXmlEscape(label)}</text>`);
		} else if (orientation === "y2") {
			if (pos < grid.top - 1 || pos > grid.bottom + 1) continue;
			chunks.push(`<text x="${Math.min(width - 2, grid.right + 7)}" y="${pos + 4}" text-anchor="start" font-family="Arial, sans-serif" font-size="11" fill="#222">${graphXmlEscape(label)}</text>`);
		}
	}
	return chunks.join("");
}

function graphSeriesPoints(series) {
	if (!series || !Array.isArray(series.data) || !series._xaxis || !series._yaxis) return [];
	let points = [];
	for (let row of series.data) {
		if (!row || row.length < 2) continue;
		let x = Number(row[0]), y = Number(row[1]);
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
		let px = series._xaxis.u2p(x), py = series._yaxis.u2p(y);
		if (Number.isFinite(px) && Number.isFinite(py)) points.push([px, py]);
	}
	return points;
}

function graphSeriesPath(points, stepped) {
	if (!points.length) return "";
	let path = `M ${points[0][0]} ${points[0][1]}`;
	for (let i = 1; i < points.length; i++) {
		let previous = points[i - 1], current = points[i];
		if (stepped) path += ` L ${current[0]} ${previous[1]} L ${current[0]} ${current[1]}`;
		else path += ` L ${current[0]} ${current[1]}`;
	}
	return path;
}

function graphSeriesSvg(plot) {
	if (!plot || !Array.isArray(plot.series)) return "";
	let chunks = [];
	for (let series of plot.series) {
		if (!series || series.show === false) continue;
		let points = graphSeriesPoints(series);
		if (!points.length) continue;
		let color = series.color || "#000000";
		let lineWidth = Math.max(0.5, graphFinite(series.lineWidth, 2));
		let dash = normalizeLegendDashPattern(series.linePattern);
		let stepped = !!series.step;
		let path = graphSeriesPath(points, stepped);
		let showLine = series.showLine !== false;
		let fill = !!series.fill;
		if (fill && series._yaxis && typeof series._yaxis.u2p === "function") {
			let baseline = series._yaxis.u2p(0);
			if (!Number.isFinite(baseline)) baseline = Math.max(...points.map(point => point[1]));
			let fillColor = series.fillColor || color;
			let fillOpacity = series.fillAlpha != null ? Math.max(0, Math.min(1, Number(series.fillAlpha))) : 0.35;
			let fillPath = `${path} L ${points[points.length - 1][0]} ${baseline} L ${points[0][0]} ${baseline} Z`;
			chunks.push(`<path d="${fillPath}" fill="${graphXmlEscape(fillColor)}" fill-opacity="${Number.isFinite(fillOpacity) ? fillOpacity : 0.35}" stroke="none"/>`);
		}
		if (showLine) {
			chunks.push(`<path d="${path}" fill="none" stroke="${graphXmlEscape(color)}" stroke-width="${lineWidth}"${dash ? ` stroke-dasharray="${graphXmlEscape(dash)}"` : ""} stroke-linejoin="round" stroke-linecap="round"/>`);
		}
		if (series.showMarker) {
			let marker = series.markerOptions || {};
			let size = Math.max(3, graphFinite(marker.size, 6));
			for (let point of points) {
				if (String(marker.style || "").toLowerCase().includes("square")) {
					chunks.push(`<rect x="${point[0] - size / 2}" y="${point[1] - size / 2}" width="${size}" height="${size}" fill="${graphXmlEscape(color)}"/>`);
				} else chunks.push(`<circle cx="${point[0]}" cy="${point[1]}" r="${size / 2}" fill="${graphXmlEscape(color)}"/>`);
			}
		}
	}
	return chunks.join("");
}

function graphCurveNumberPlacements(series) {
	let points = graphSeriesPoints(series);
	if (!points.length) return [];
	if (points.length === 1) return [{ x: points[0][0], y: points[0][1] }];

	let cumulative = [0];
	let totalLength = 0;
	for (let i = 1; i < points.length; i++) {
		let dx = points[i][0] - points[i - 1][0];
		let dy = points[i][1] - points[i - 1][1];
		let segmentLength = Math.hypot(dx, dy);
		if (!Number.isFinite(segmentLength)) segmentLength = 0;
		totalLength += segmentLength;
		cumulative.push(totalLength);
	}

	if (!(totalLength > 1)) {
		let point = points[Math.floor((points.length - 1) / 2)];
		return [{ x: point[0], y: point[1] }];
	}

	// Aim for roughly one repeated run number per 90 screen pixels of curve.
	// Very short curves still receive one label; very long curves are capped to
	// avoid turning the plot into a field of numbers.
	let labelCount = Math.max(1, Math.min(8, Math.round(totalLength / 90)));
	let placements = [];
	let segmentIndex = 1;
	for (let labelIndex = 1; labelIndex <= labelCount; labelIndex++) {
		let targetLength = totalLength * labelIndex / (labelCount + 1);
		while (segmentIndex < cumulative.length - 1 && cumulative[segmentIndex] < targetLength) segmentIndex++;
		let previousLength = cumulative[segmentIndex - 1];
		let currentLength = cumulative[segmentIndex];
		let denominator = currentLength - previousLength;
		let fraction = denominator > 0 ? (targetLength - previousLength) / denominator : 0;
		let a = points[segmentIndex - 1];
		let b = points[segmentIndex];
		placements.push({
			x: a[0] + (b[0] - a[0]) * fraction,
			y: a[1] + (b[1] - a[1]) * fraction
		});
	}
	return placements;
}

function renderXyCurveNumbers(visual) {
	if (!visual || !visual.chartDiv || !visual.plot) return;
	Array.from(visual.chartDiv.querySelectorAll(".systemika-xy-curve-number")).forEach(node => node.remove());
	if (!visual.primitive || visual.primitive.getAttribute("ShowNumber") !== "true") return;
	let count = Math.min(visual.mainRunSeriesCount || 0, visual.plot.series ? visual.plot.series.length : 0);
	for (let i = 0; i < count; i++) {
		let series = visual.plot.series[i];
		let points = graphCurveNumberPlacements(series);
		for (let point of points) {
			let label = (visual.chartDiv.ownerDocument || document).createElement("div");
			label.className = "systemika-xy-curve-number";
			label.textContent = String(i + 1);
			label.style.position = "absolute";
			label.style.left = `${point.x}px`;
			label.style.top = `${point.y}px`;
			label.style.transform = "translate(-50%, -50%)";
			label.style.pointerEvents = "none";
			label.style.zIndex = "8";
			label.style.fontFamily = "Arial, sans-serif";
			label.style.fontSize = "13px";
			label.style.fontWeight = "bold";
			label.style.lineHeight = "1";
			label.style.color = (series && series.color) || "#000000";
			label.style.textShadow = "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 3px #fff";
			visual.chartDiv.appendChild(label);
		}
	}
}

function graphXyNumbersSvg(visual) {
	if (!(visual instanceof XyPlotVisual) || !visual.plot || visual.primitive.getAttribute("ShowNumber") !== "true") return "";
	let chunks = [];
	let count = Math.min(visual.mainRunSeriesCount || 0, visual.plot.series ? visual.plot.series.length : 0);
	for (let i = 0; i < count; i++) {
		let series = visual.plot.series[i];
		let color = series.color || "#000000";
		for (let point of graphCurveNumberPlacements(series)) {
			chunks.push(`<text x="${point.x}" y="${point.y + 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="${graphXmlEscape(color)}" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${i + 1}</text>`);
		}
	}
	return chunks.join("");
}

function graphLegendSvg(plot, width, legendTop) {
	let metrics = graphLegendMetrics(plot, width);
	if (!metrics) return "";
	let { series, width: legendWidth, height } = metrics;
	let fontSize = 11;
	let x = Math.max(GRAPH_EXPORT_EDGE_PADDING, (width - legendWidth) / 2);
	let rowHeight = 20;
	let y = Math.max(GRAPH_EXPORT_EDGE_PADDING, Number(legendTop) || GRAPH_EXPORT_EDGE_PADDING);
	let chunks = [`<g class="systemika-export-legend"><rect x="${x}" y="${y}" width="${legendWidth}" height="${height}" rx="2" ry="2" fill="#ffffff" fill-opacity="0.65" stroke="#cccccc"/>`];
	for (let i = 0; i < series.length; i++) {
		let item = series[i], cy = y + 15 + i * rowHeight;
		let color = item.color || "#000000";
		let dash = normalizeLegendDashPattern(item.linePattern);
		let lineWidth = Math.max(1, graphFinite(item.lineWidth, 2));
		chunks.push(`<line x1="${x + 8}" y1="${cy - 3}" x2="${x + 34}" y2="${cy - 3}" stroke="${graphXmlEscape(color)}" stroke-width="${lineWidth}"${dash ? ` stroke-dasharray="${graphXmlEscape(dash)}"` : ""}/>`);
		chunks.push(`<text x="${x + 41}" y="${cy}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#222">${graphXmlEscape(graphPlainText(item.label))}</text>`);
	}
	chunks.push("</g>");
	return chunks.join("");
}

function graphHistogramNotesSvg(visual, width, height) {
	if (!(visual instanceof HistoPlotVisual) || !visual.chartDiv) return "";
	let chunks = [];
	for (let suffix of ["_histoBelow", "_histoAbove"]) {
		let node = visual.chartDiv.querySelector(`[id$="${suffix}"]`);
		if (!node) continue;
		let lines = String(node.innerText || node.textContent || "").split(/\r?\n/).filter(Boolean);
		let anchor = suffix.includes("Above") ? "end" : "start";
		let x = suffix.includes("Above") ? width - 8 : 8;
		let startY = Math.max(12, height - 8 - (lines.length - 1) * 13);
		lines.forEach((line, index) => chunks.push(`<text x="${x}" y="${startY + index * 13}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="10" fill="#333">${graphXmlEscape(line)}</text>`));
	}
	return chunks.join("");
}

function buildGraphSvgPayload(visual) {
	if (!visual || !visual.chartDiv || !visual.plot) throw new Error("The graph is not currently rendered.");
	let plot = visual.plot;
	let logical = graphExportDimensions(visual);
	let width = logical.width;
	let height = logical.height;
	let padding = plot._gridPadding || {};
	let grid = {
		left: graphFinite(padding.left, 45),
		right: width - graphFinite(padding.right, 18),
		top: graphFinite(padding.top, 28),
		bottom: height - graphFinite(padding.bottom, 38)
	};
	let legend = graphLegendMetrics(plot, width);
	let exportWidth = width + GRAPH_EXPORT_EDGE_PADDING;
	if (legend) exportWidth = Math.max(exportWidth, legend.width + (GRAPH_EXPORT_EDGE_PADDING * 2));
	// jqPlot's outside-bottom legend already reserves vertical grid padding. Reuse
	// that space in exports rather than adding a second empty legend band.
	let legendTop = legend
		? Math.max(grid.bottom + 30, height - legend.height - GRAPH_EXPORT_EDGE_PADDING)
		: null;
	let exportHeight = Math.max(
		height + GRAPH_EXPORT_EDGE_PADDING,
		legend ? legendTop + legend.height + GRAPH_EXPORT_EDGE_PADDING : 0
	);
	let chunks = [`<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}">`];
	// Intentionally no background rectangle: exported SVG, PNG, and clipboard images remain transparent.
	chunks.push(graphAxisTicksSvg(plot.axes && plot.axes.xaxis, "x", grid, width, height));
	chunks.push(graphAxisTicksSvg(plot.axes && plot.axes.yaxis, "y", grid, width, height));
	chunks.push(graphAxisTicksSvg(plot.axes && plot.axes.y2axis, "y2", grid, width, height));
	chunks.push(`<rect x="${grid.left}" y="${grid.top}" width="${Math.max(0, grid.right - grid.left)}" height="${Math.max(0, grid.bottom - grid.top)}" fill="none" stroke="#b8b8b8" stroke-width="1"/>`);
	chunks.push(graphSeriesSvg(plot));
	chunks.push(graphXyNumbersSvg(visual));
	let title = graphPlainText(plot.title && plot.title.text);
	if (title) chunks.push(`<text x="${(grid.left + grid.right) / 2}" y="17" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#111">${graphXmlEscape(title)}</text>`);
	let xLabel = graphPlainText(plot.axes && plot.axes.xaxis && plot.axes.xaxis.label);
	let xLabelY = legend ? Math.min(legendTop - 8, grid.bottom + 26) : height - 4;
	if (xLabel) chunks.push(`<text x="${(grid.left + grid.right) / 2}" y="${xLabelY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#111">${graphXmlEscape(xLabel)}</text>`);
	let yLabel = graphPlainText(plot.axes && plot.axes.yaxis && plot.axes.yaxis.label);
	if (yLabel) chunks.push(`<text x="13" y="${(grid.top + grid.bottom) / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#111" transform="rotate(-90 13 ${(grid.top + grid.bottom) / 2})">${graphXmlEscape(yLabel)}</text>`);
	let y2Label = graphPlainText(plot.axes && plot.axes.y2axis && plot.axes.y2axis.label);
	if (y2Label) chunks.push(`<text x="${width - 13}" y="${(grid.top + grid.bottom) / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#111" transform="rotate(90 ${width - 13} ${(grid.top + grid.bottom) / 2})">${graphXmlEscape(y2Label)}</text>`);
	chunks.push(graphLegendSvg(plot, exportWidth, legendTop));
	chunks.push(graphHistogramNotesSvg(visual, width, legend ? legendTop - 4 : height));
	chunks.push("</svg>");
	return { svg: chunks.join(""), width: exportWidth, height: exportHeight };
}

function chartDivToSvg(visual) {
	return buildGraphSvgPayload(visual).svg;
}

function downloadDataUrl(filename, dataUrl) {
	let link = document.createElement("a");
	link.style.display = "none"; link.href = dataUrl; link.download = filename;
	document.body.appendChild(link); link.click();
	setTimeout(() => link.remove(), 0);
}

function cleanSvgToPngDataUrl(svg, width, height, scale = GRAPH_EXPORT_RASTER_SCALE) {
	return new Promise((resolve, reject) => {
		let blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
		let url = URL.createObjectURL(blob);
		let image = new Image();
		image.onload = () => {
			try {
				let rasterScale = Math.max(1, Number(scale) || 1);
				let canvas = document.createElement("canvas");
				canvas.width = Math.max(1, Math.ceil(width * rasterScale));
				canvas.height = Math.max(1, Math.ceil(height * rasterScale));
				let ctx = canvas.getContext("2d", { alpha: true });
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = "high";
				ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL("image/png"));
			} catch (error) { reject(error); }
			finally { URL.revokeObjectURL(url); }
		};
		image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unable to rasterize the SVG graph.")); };
		image.src = url;
	});
}

async function graphPngDataUrl(visual) {
	let payload = buildGraphSvgPayload(visual);
	return cleanSvgToPngDataUrl(payload.svg, payload.width, payload.height, GRAPH_EXPORT_RASTER_SCALE);
}

async function copyGraphVisualToClipboard(visual) {
	try {
		if (!visual || !visual.chartDiv || !visual.plot) throw new Error("The graph is not currently available to copy.");
		let dataUrl = await graphPngDataUrl(visual);
		let base64 = dataUrl.split(",")[1] || "";
		let api = typeof getElectronAPI === "function" ? getElectronAPI() : null;
		if (api && typeof api.copyPngToClipboard === "function") {
			await api.copyPngToClipboard(base64);
			return true;
		}
		if (typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined") {
			let response = await fetch(dataUrl);
			let blob = await response.blob();
			await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
			return true;
		}
		throw new Error("Image clipboard access is not available in this environment.");
	} catch (error) {
		xAlert(`Unable to copy figure.<br/><br/>${htmlEscape(error.message || String(error))}`);
		return false;
	}
}

function getSelectedGraphVisual() {
	let selected = Object.values(get_selected_root_objects()).filter(Boolean);
	if (selected.length === 1) {
		let visual = selected[0];
		if (["timeplot", "compareplot", "xyplot", "histoplot"].includes(String(visual.type || "").toLowerCase()) && visual && visual.plot) return visual;
	}
	let dockVisual = window.SystemikaOutputDock ? SystemikaOutputDock.activeVisual : null;
	return dockVisual && dockVisual instanceof PlotVisual && dockVisual.plot ? dockVisual : null;
}

async function copySelectedGraphImageToSystemClipboard() {
	let visual = getSelectedGraphVisual();
	if (!visual) return false;
	return copyGraphVisualToClipboard(visual);
}

async function copySelectionWithFigureImage() {
	let selectedGraph = getSelectedGraphVisual();
	let selectedRoots = Object.values(get_selected_root_objects()).filter(Boolean);
	// Docked outputs are intentionally not selected on the modeling canvas. Capture
	// the active output directly so toolbar/keyboard Copy does not show the old
	// "select an object" warning and Systemika Paste still duplicates the output.
	if (selectedGraph && !selectedRoots.length) {
		let copied = Clipboard.captureIds([selectedGraph.id], "copy");
		await copyGraphVisualToClipboard(selectedGraph);
		return copied;
	}
	let copied = Clipboard.copy();
	if (selectedGraph) await copyGraphVisualToClipboard(selectedGraph);
	return copied;
}

async function cutSelectionWithFigureImage() {
	let selectedGraph = getSelectedGraphVisual();
	let selectedRoots = Object.values(get_selected_root_objects()).filter(Boolean);
	if (selectedGraph && !selectedRoots.length) {
		if (RunResults.isAdvanceActive()) {
			runOverlay.requestAdvanceTermination(
				"Cutting an output will terminate the current Advance simulation.",
				() => cutSelectionWithFigureImage()
			);
			return false;
		}
		await copyGraphVisualToClipboard(selectedGraph);
		if (!Clipboard.captureIds([selectedGraph.id], "cut")) return false;
		tool_deletePrimitive(String(selectedGraph.id));
		History.storeUndoState();
		InfoBar.update();
		return true;
	}
	// Render/copy a selected canvas Figure before Clipboard.cut() removes it.
	if (selectedGraph) await copyGraphVisualToClipboard(selectedGraph);
	return Clipboard.cut();
}

function plotCsvCell(value) {
	if (value === null || value === undefined) return "";
	let text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function plotCsvFromRows(headers, rows) {
	return [headers].concat(rows || [])
		.map(row => (row || []).map(plotCsvCell).join(","))
		.join("\n") + "\n";
}

function plottedTimeSeriesCsv(visual) {
	let ids = getDisplayIds(visual.primitive);
	let names = ids.map(id => {
		let primitive = findID(id);
		return primitive ? getName(primitive) : String(id);
	});
	let rows = visual.data && Array.isArray(visual.data.results) ? visual.data.results : [];
	if (!rows.length) throw new Error("No plotted data is currently available.");
	let runLabel = getDisplayRunName(visual.primitive) || getCurrentRunSourceName() || "Current";
	let headers = ["Time"].concat(names.map(name => `${name} [${runLabel}]`));
	return plotCsvFromRows(headers, rows.map(row => [row[0]].concat(row.slice(1, ids.length + 1))));
}

function plottedCompareSeriesCsv(visual) {
	let ids = getDisplayIds(visual.primitive);
	let gens = visual.gens;
	if (!gens || !Array.isArray(gens.resultGen) || !gens.resultGen.length) throw new Error("No plotted data is currently available.");
	let columns = [];
	for (let id of ids) {
		for (let runIndex = 0; runIndex < gens.idGen.length; runIndex++) {
			let variableIndex = gens.idGen[runIndex].indexOf(id);
			if (variableIndex === -1) continue;
			let primitive = findID(id);
			let variableName = primitive ? getName(primitive) : String(id);
			let runLabel = gens.runLabelGen[runIndex] || `Run ${runIndex + 1}`;
			columns.push({ runIndex, variableIndex, header: `${variableName} [${runLabel}]` });
		}
	}
	if (!columns.length) throw new Error("No plotted data is currently available.");
	let byTime = new Map();
	for (let runIndex = 0; runIndex < gens.resultGen.length; runIndex++) {
		for (let sourceRow of gens.resultGen[runIndex] || []) {
			let key = String(sourceRow[0]);
			if (!byTime.has(key)) byTime.set(key, { time: sourceRow[0], values: new Array(columns.length).fill("") });
			let target = byTime.get(key);
			for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
				let column = columns[columnIndex];
				if (column.runIndex !== runIndex) continue;
				target.values[columnIndex] = sourceRow[column.variableIndex + 1] ?? "";
			}
		}
	}
	let rows = Array.from(byTime.values())
		.sort((a, b) => {
			let av = Number(a.time), bv = Number(b.time);
			if (Number.isFinite(av) && Number.isFinite(bv)) return av - bv;
			return String(a.time).localeCompare(String(b.time));
		})
		.map(item => [item.time].concat(item.values));
	return plotCsvFromRows(["Time"].concat(columns.map(column => column.header)), rows);
}

function plottedXyCsv(visual) {
	let count = Math.min(Number(visual.mainRunSeriesCount) || 0, Array.isArray(visual.serieArray) ? visual.serieArray.length : 0);
	if (!count) throw new Error("No plotted data is currently available.");
	let runLabels = Array.isArray(visual.seriesRunLabels) ? visual.seriesRunLabels : [];
	let rows = [];
	for (let i = 0; i < count; i++) {
		let runLabel = runLabels[i] || `Run ${i + 1}`;
		for (let point of visual.serieArray[i] || []) {
			if (!point || point.length < 2) continue;
			rows.push([runLabel, point.length > 2 ? point[2] : "", point[0], point[1]]);
		}
	}
	return plotCsvFromRows(["Run", "Time", visual.serieXName || "X", visual.serieYName || "Y"], rows);
}

function plottedHistogramCsv(visual) {
	if (!Array.isArray(visual.histograms) || !visual.histograms.length) throw new Error("No plotted data is currently available.");
	let variableId = getDisplayIds(visual.primitive)[0];
	let variable = variableId ? findID(variableId) : null;
	let variableName = variable ? getName(variable) : "Value";
	let rows = [];
	for (let i = 0; i < visual.histograms.length; i++) {
		let histogram = visual.histograms[i];
		let runLabel = (visual.runLabels && visual.runLabels[i]) || `Run ${i + 1}`;
		for (let bar of histogram.bars || []) rows.push([runLabel, bar.lowerLimit, bar.upperLimit, bar.data ? bar.data.length : 0]);
	}
	return plotCsvFromRows(["Run", `${variableName} bin lower`, `${variableName} bin upper`, "Count"], rows);
}

function exportPlotDataCsv(visual) {
	try {
		let csv;
		if (visual instanceof ComparePlotVisual) csv = plottedCompareSeriesCsv(visual);
		else if (visual instanceof TimePlotVisual) csv = plottedTimeSeriesCsv(visual);
		else if (visual instanceof XyPlotVisual) csv = plottedXyCsv(visual);
		else if (visual instanceof HistoPlotVisual) csv = plottedHistogramCsv(visual);
		else throw new Error("CSV export is not available for this plot type.");
		fileManager.exportFile(csv, ".csv");
	} catch (error) {
		xAlert(`Unable to export plotted data as CSV.<br/><br/>${htmlEscape(error.message || String(error))}`);
	}
}

async function exportGraphVisual(visual, format) {
	try {
		if (!visual || !visual.chartDiv || !visual.plot) throw new Error("The graph is not currently available for export.");
		let payload = buildGraphSvgPayload(visual);
		if (format === "svg") {
			await fileManager.exportFile(payload.svg, ".svg");
			return;
		}
		let dataUrl = await cleanSvgToPngDataUrl(payload.svg, payload.width, payload.height, GRAPH_EXPORT_RASTER_SCALE);
		let api = typeof getElectronAPI === "function" ? getElectronAPI() : null;
		if (api && api.writeBase64File && api.showSaveDialog) {
			let suggested = `${graphExportBaseName()}.png`;
			let filePath = await api.showSaveDialog(suggested, ".png");
			if (filePath) {
				if (!/\.png$/i.test(filePath)) filePath += ".png";
				await api.writeBase64File(filePath, dataUrl.split(",")[1] || "");
			}
		} else downloadDataUrl(`${graphExportBaseName()}.png`, dataUrl);
	} catch (error) {
		xAlert(`Unable to export ${String(format || "graph").toUpperCase()}.<br/><br/>${htmlEscape(error.message || String(error))}`);
	}
}

class PlotVisual extends HtmlOverlayTwoPointer {
	getTicks(min, max, dimention = "width") {
		let length = max - min;

		// Calculate minTimeSubDivision
		let tickSubDivStep = (10 ** Math.floor(Math.log10(length))) / 10;

		// Measure in pixels
		let pxWidth = parseInt(this.chartDiv.style[dimention]) - 80;
		let minPxStep = 50;
		let maxSteps = Math.floor(pxWidth / minPxStep);

		let viableMultiples = [1, 2, 5, 10, 20, 50];
		let stepSizeList = viableMultiples.map(muliple => {
			return muliple * tickSubDivStep;
		})
		let okStepSize = stepSizeList.find(step => {
			return maxSteps >= length / step;
		});

		let ticks = [`${min}`, `${max}`];
		if (okStepSize !== undefined) {
			let tickStep = okStepSize;

			let decimals = Number.isInteger(okStepSize) ? 0 : undefined;

			ticks = [];
			let lowerIndex = Math.ceil(min / tickStep);
			let upperIndex = Math.floor(max / tickStep);

			if (tickStep * lowerIndex !== min) {
				// Add empty tick if min is not included
				// ticks can be formated as 2D array [[val,label],[val,label],...]
				// see reference: http://www.music.mcgill.ca/~ich/classes/mumt301_11/js/jqPlot/docs/files/jqplot-core-js.html#Axis.ticks
				ticks.push([min, ""]);
			}

			for (let i = lowerIndex; i <= upperIndex; i++) {
				let currentTick = tickStep * i;
				ticks.push([currentTick, format_number(currentTick, { decimals })]);
			}

			if (tickStep * upperIndex !== max) {
				ticks.push([max, ""]);
			}
		}

		return ticks;
	}
	syncPageState() {
		if (window.SystemikaPlotPages && SystemikaPlotPages.isPagedPrimitive(this.primitive)) {
			SystemikaPlotPages.persistCurrentPage(this.primitive);
			this.updatePageControls();
		}
	}
	updatePageControls() {
		if (!this.pageNavDiv || !window.SystemikaPlotPages) return;
		let info = SystemikaPlotPages.getInfo(this.primitive);
		let label = info.name || `Page ${info.index + 1}`;
		let shortLabel = `${label}  ${info.index + 1}/${info.count}`;
		$(this.pageNavDiv).find(".plot-page-label").text(shortLabel).attr("title", `${label} — Page ${info.index + 1} of ${info.count}`);
		$(this.pageNavDiv).find(".plot-page-prev").prop("disabled", info.index <= 0);
		$(this.pageNavDiv).find(".plot-page-next").prop("disabled", info.index >= info.count - 1);
		$(this.pageNavDiv).find(".plot-page-delete").prop("disabled", info.count <= 1);
	}
	refreshForCurrentPage() {
		if (this.dialog && typeof this.dialog.refreshDockedSettings === "function") this.dialog.refreshDockedSettings();
		if (typeof this.refreshRunSources === "function") this.refreshRunSources();
		else this.render();
	}
	flushPageSettings() {
		if (this.dialog && typeof this.dialog.flushLiveApply === "function") return this.dialog.flushLiveApply();
		return true;
	}
	changePage(index) {
		if (!window.SystemikaPlotPages) return;
		if (this.flushPageSettings() === false) return;
		SystemikaPlotPages.selectPage(this.primitive, index);
		this.updatePageControls();
		this.refreshForCurrentPage();
	}
	addPage() {
		if (!window.SystemikaPlotPages) return;
		if (this.flushPageSettings() === false) return;
		SystemikaPlotPages.addPage(this.primitive);
		this.updatePageControls();
		this.refreshForCurrentPage();
		History.storeUndoState();
	}
	deletePage() {
		if (!window.SystemikaPlotPages) return;
		if (this.flushPageSettings() === false) return;
		let info = SystemikaPlotPages.getInfo(this.primitive);
		if (info.count <= 1) return;
		SystemikaPlotPages.deletePage(this.primitive);
		this.updatePageControls();
		this.refreshForCurrentPage();
		History.storeUndoState();
	}
	updateDockedGraphics() {
		let view = SystemikaOutputDock.view();
		if (!view || !this.chartDiv || !this.targetElement) return;
		let width = Math.max(220, view.clientWidth || 220);
		let height = Math.max(160, view.clientHeight || 160);
		this.targetElement.style.width = `${width}px`;
		this.targetElement.style.height = `${height}px`;
		this.targetElement.style.left = "0px";
		this.targetElement.style.top = "0px";
		this.targetElement.style.transform = "none";
		let newWidth = `${Math.max(120, width - 10)}px`;
		let newHeight = `${Math.max(90, height - 38)}px`;
		let changed = this.chartDiv.style.width !== newWidth || this.chartDiv.style.height !== newHeight;
		this.chartDiv.style.width = newWidth;
		this.chartDiv.style.height = newHeight;
		if (changed && typeof this.updateChart === "function") {
			if (this.updateChartTimeOut) clearTimeout(this.updateChartTimeOut);
			this.updateChartTimeOut = setTimeout(() => this.updateChart(), 10);
		}
		this.updatePageControls();
	}
	updateGraphics() {
		if (SystemikaOutputDock.activeVisual === this) {
			this.updateDockedGraphics();
			return;
		}
		super.updateGraphics();
		let newWidth = `${Math.max(40, $(this.targetElement).width() - 10)}px`;
		let newHeight = `${Math.max(30, $(this.targetElement).height() - 38)}px`;
		let oldWidth = this.chartDiv.style.width;
		let oldHeight = this.chartDiv.style.height;
		if (oldWidth !== newWidth || oldHeight !== newHeight) {
			this.chartDiv.style.width = newWidth;
			this.chartDiv.style.height = newHeight;

			// Clear updating chart so only the last updateGraphics updates chart
			// This limits the number of times updateCharts runs (updateChart is an expensive call)
			if (this.updateChartTimeOut) {
				clearTimeout(this.updateChartTimeOut);
				this.updateChartTimeOut = null;
			}
			this.updateChartTimeOut = setTimeout(this.updateChart.bind(this), 10);
		}
		this.updatePageControls();
	}
	makeGraphics() {
		super.makeGraphics();

		this.chartId = this.id + "_chart";
		this.pageNavId = this.id + "_page_nav";
		let html = `<div class="systemika-paged-plot">
			<div id="${this.chartId}" style="width:0px; height:0px; z-index: 100;"></div>
			<div id="${this.pageNavId}" class="systemika-plot-page-nav">
				<button type="button" class="plot-page-prev" title="Previous page">&#8249;</button>
				<span class="plot-page-label" title="Plot page">Page 1  1/1</span>
				<button type="button" class="plot-page-next" title="Next page">&#8250;</button>
				<button type="button" class="plot-page-add" title="Add page" aria-label="Add page">+</button>
				<button type="button" class="plot-page-delete" title="Delete page" aria-label="Delete page">−</button>
			</div>
		</div>`;
		this.updateHTML(html);
		this.chartDiv = document.getElementById(this.chartId);
		this.pageNavDiv = document.getElementById(this.pageNavId);
		// Properties are always visible in the lower Output pane, so plot surfaces
		// do not need a separate Settings button or double-click shortcut.
		$(this.targetElement).off("dblclick contextmenu");
		if (window.SystemikaPlotPages) SystemikaPlotPages.ensure(this.primitive);
		$(this.pageNavDiv).on("mousedown click dblclick", event => event.stopPropagation());
		$(this.pageNavDiv).find(".plot-page-prev").click(() => {
			let info = SystemikaPlotPages.getInfo(this.primitive);
			this.changePage(info.index - 1);
		});
		$(this.pageNavDiv).find(".plot-page-next").click(() => {
			let info = SystemikaPlotPages.getInfo(this.primitive);
			this.changePage(info.index + 1);
		});
		$(this.pageNavDiv).find(".plot-page-add").click(() => this.addPage());
		$(this.pageNavDiv).find(".plot-page-delete").click(() => this.deletePage());
		this.updatePageControls();
	}
	clean() {
		SystemikaOutputDock.unregisterVisual(this);
		super.clean();
	}
	doubleClick() {
		this.dialog.show();
	}
}

class TimePlotVisual extends PlotVisual {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.runHandler = () => {
			this.render();
		}
		RunResults.subscribeRun(id, this.runHandler);
		this.plot = null;
		this.serieArray = null;
		this.namesToDisplay = [];
		this.data = {
			resultIds: [],
			results: []
		}

		this.dialog = new TimePlotDialog(id);
		this.dialog.subscribePool.subscribe(() => {
			this.render();
		});
		SystemikaOutputDock.registerVisual(this);
	}
	removePlotReference(removeId) {
		let result = removeDisplayId(this.primitive, removeId);
		if (result) {
			this.render();
		}
	}
	fetchData() {
		let runName = getDisplayRunName(this.primitive);
		if (!ensureDisplayRunAvailable(this.primitive, () => this.render())) {
			this.data.results = [];
			return false;
		}
		this.fetchedIds = getDisplayIds(this.primitive);

		this.data.resultIds = ["time"].concat(this.fetchedIds);
		// Plot Period is no longer user-configurable. Always render at the
		// selected run's native simulation time step.
		let plot_per = Number(this.dialog.getDefaultPlotPeriod());
		if (!Number.isFinite(plot_per) || plot_per <= 0) plot_per = Number(this.primitive.getAttribute("PlotPer")) || 1;
		this.data.results = RunResults.getFilteredSelectiveIdResults(this.fetchedIds, RunResults.getDataTimeStart(runName), RunResults.getDataTimeLength(runName), plot_per, runName);
	}
	render() {
		this.syncPageState();
		if (this.fetchData() === false) {
			this.setEmptyPlot();
			return;
		}

		let idsToDisplay = getDisplayIds(this.primitive);
		let sides = getDisplaySides(this.primitive);

		this.namesToDisplay = idsToDisplay.map(findID).map(getName);
		this.colorsToDisplay = idsToDisplay.map(findID).map(
			(node) => node.getAttribute("Color")
		);

		// Line style is configured per plotted model entity. All entities share
		// the same solid/2px default until the user customizes them.
		let styleForId = id => typeof getPlotLineStyle === "function"
			? getPlotLineStyle(this.primitive, id)
			: { pattern: [1], width: 2 };
		this.patternsToDisplay = idsToDisplay.map(id => styleForId(id).pattern);
		this.widthsToDisplay = idsToDisplay.map(id => styleForId(id).width);

		if (this.data.results.length == 0) {
			this.setEmptyPlot();
			return;
		}

		let hasNumberedLines = (this.primitive.getAttribute("HasNumberedLines") === "true");

		let makeSerie = (resultColumn, lineCount) => {
			let serie = [];
			let plotPerIdx = Math.floor(this.data.results.length / 4);
			for (let i = 0; i < this.data.results.length; i++) {
				let row = this.data.results[i];
				let time = Number(row[0]);
				let value = Number(row[resultColumn]);
				let showNumHere = i % plotPerIdx === Math.floor((plotPerIdx / 2 + (plotPerIdx * lineCount) / 8) % plotPerIdx);
				if (showNumHere && hasNumberedLines) {
					serie.push([time, value, Math.floor(lineCount).toString()]);
				} else {
					serie.push([time, value, null]);
				}
			}
			return serie;
		}

		// Declare series and settings for series
		this.serieSettingsArray = [];
		this.serieArray = [];

		// Make time series & Settings
		let runName = getDisplayRunName(this.primitive);
		let counter = 0;
		for (let i = 0; i < idsToDisplay.length; i++) {
			counter++;
			let index = this.data.resultIds.indexOf(idsToDisplay[i]);
			if (index === -1) {
				this.serieArray.push([null, null, null]);
			} else {
				this.serieArray.push(makeSerie(index, counter));
			}
			let runLabel = runName || getCurrentRunSourceName() || "Current";
			let axisSuffix = (sides.includes("R") && sides.includes("L")) ? ((sides[i] === "L") ? " - L" : " - R") : "";
			let label = idsToDisplay.length === 1
				? runLabel
				: `${this.namesToDisplay[i]}${axisSuffix} [${runLabel}]`;
			if (hasNumberedLines) label = `${counter}. ${label}`;
			this.serieSettingsArray.push(
				{
					showLabel: true,
					lineWidth: this.widthsToDisplay[i],
					label: label,
					yaxis: (sides[i] === "L") ? "yaxis" : "y2axis",
					linePattern: this.patternsToDisplay[i],
					color: this.primitive.getAttribute("ColorFromPrimitive") === "true" ? this.colorsToDisplay[i] : undefined,
					shadow: false,
					showMarker: false,
					markerOptions: { size: 5 },
					pointLabels: {
						show: true,
						edgeTolerance: 0,
						ypadding: 0,
						location: "n"
					}
				}
			);
		}

		do_global_log("serieArray " + JSON.stringify(this.serieArray));

		do_global_log(JSON.stringify(this.serieSettingsArray));

		// We need to ad a delay and respond to events first to make this work in firefox
		setTimeout(() => {
			this.updateChart();
		}, 200);

	}
	updateChart() {
		// Dont update chart if primitive has been deleted
		// This check needs to be here since updateChart is updated with a timeout
		if (!(this.id in connection_array)) return;

		if (this.serieArray == null || this.serieArray.length == 0) {
			this.setEmptyPlot();
			return;
		}
		$(this.chartDiv).empty();

		let axisLimits = JSON.parse(this.primitive.getAttribute("AxisLimits"));
		let runName = getDisplayRunName(this.primitive);
		let min = Number(axisLimits.timeaxis.auto ? RunResults.getDataTimeStart(runName) : axisLimits.timeaxis.min);
		let max = Number(axisLimits.timeaxis.auto ? RunResults.getDataTimeStart(runName) + RunResults.getDataTimeLength(runName) : axisLimits.timeaxis.max);
		let tickList = this.getTicks(min, max);

		$.jqplot.config.enablePlugins = true;
		this.plot = renderSystemikaJqPlot(this.chartDiv, this.serieArray, {
			title: this.primitive.getAttribute("TitleLabel"),
			series: this.serieSettingsArray,
			grid: {
				background: "transparent",
				shadow: false
			},
			axes: {
				xaxis: {
					labelRenderer: $.jqplot.CanvasAxisLabelRenderer,
					label: timeAxisLabel(),
					min: min,
					max: max,
					ticks: tickList
				},
				yaxis: {
					renderer: (this.primitive.getAttribute("LeftLogScale") === "true") ? $.jqplot.LogAxisRenderer : $.jqplot.LinearAxisRenderer,
					labelRenderer: $.jqplot.CanvasAxisLabelRenderer,
					label: this.primitive.getAttribute("LeftAxisLabel"),
					min: axisLimits.leftaxis.auto ? undefined : axisLimits.leftaxis.min,
					max: axisLimits.leftaxis.auto ? undefined : axisLimits.leftaxis.max
				},
				y2axis: {
					renderer: (this.primitive.getAttribute("RightLogScale") === "true") ? $.jqplot.LogAxisRenderer : $.jqplot.LinearAxisRenderer,
					labelRenderer: $.jqplot.CanvasAxisLabelRenderer,
					label: this.primitive.getAttribute("RightAxisLabel"),
					min: axisLimits.rightaxis.auto ? undefined : axisLimits.rightaxis.min,
					max: axisLimits.rightaxis.auto ? undefined : axisLimits.rightaxis.max,
					tickOptions: {
						showGridline: false
					}
				}
			},
			highlighter: {
				show: this.primitive.getAttribute("ShowHighlighter") === "true",
				sizeAdjust: 1.5,
				tooltipAxes: "xy",
				fadeTooltip: false,
				tooltipLocation: "ne",
				formatString: "Time = %.5p<br/>Value = %.5p",
				useAxesFormatters: false
			},
			legend: plotBottomLegendOptions(true)
		});
		stylePlotLegendLineSamples(this.chartDiv, this.plot, this.serieSettingsArray);
		spacePlotLegendFromGrid(this.chartDiv);
		if (axisLimits.leftaxis.auto && this.serieSettingsArray.map(ss => ss["yaxis"]).includes("yaxis")) {
			if (!isNaN(this.plot.axes.yaxis.min) && !isNaN(this.plot.axes.yaxis.max)) {
				axisLimits.leftaxis.min = this.plot.axes.yaxis.min;
				axisLimits.leftaxis.max = this.plot.axes.yaxis.max;
			}
		}
		if (axisLimits.rightaxis.auto && this.serieSettingsArray.map(ss => ss["yaxis"]).includes("y2axis")) {
			if (!isNaN(this.plot.axes.y2axis.min) && !isNaN(this.plot.axes.y2axis.max)) {
				axisLimits.rightaxis.min = this.plot.axes.y2axis.min;
				axisLimits.rightaxis.max = this.plot.axes.y2axis.max;
			}
		}

		this.primitive.setAttribute("AxisLimits", JSON.stringify(axisLimits));
	}
	setEmptyPlot() {
		$(this.chartDiv).empty();
		let idsToDisplay = getDisplayIds(this.primitive);
		let selected_str = "None selected";
		if (idsToDisplay.length !== 0) {
			selected_str = (`<ul style="margin: 4px;">
				${idsToDisplay.map(id => `<li>${getName(findID(id))}</li>`).join("")}
			</ul>`);
		}
		this.chartDiv.innerHTML = (`
			<div class="empty-plot-header">Time Plot</div>
			${selected_str}
		`);
	}
}


// Hold data for ComparePlots
class DataGenerations {
	constructor() {
		this.reset();
	}
	reset() {
		this.numGenerations = 0;
		this.numLines = 0;
		this.idGen = [];
		this.labelSuffixId = "";
		this.labelGen = [];
		this.runLabelGen = [];
		this.isRandom = [];
		this.primitiveTypeGen = [];
		this.nameGen = [];
		this.colorGen = [];
		this.patternGen = [];
		this.lineWidthGen = [];
		this.resultGen = [];
	}
	setLabel(genIndex, id, label) {
		const index = this.idGen[genIndex] ? this.idGen[genIndex].indexOf(id) : -1
		if (index != -1) {
			this.labelGen[genIndex][index] = label
		}
	}
	removeSim(genIndex, id) {
		const index = this.idGen[genIndex].indexOf(id)
		if (index != -1) {
			this.idGen[genIndex].splice(index, 1)
			this.labelGen[genIndex].splice(index, 1)
			this.nameGen[genIndex].splice(index, 1)
			this.isRandom[genIndex].splice(index, 1)
			this.primitiveTypeGen[genIndex].splice(index, 1)
			this.colorGen[genIndex].splice(index, 1)
			this.patternGen[genIndex].splice(index, 1)
			this.lineWidthGen[genIndex].splice(index, 1)
			this.resultGen[genIndex].map(r => r.splice(index + 1, 1))
			this.numLines--;
		}
		if (this.idGen[genIndex].length == 0) {
			this.numGenerations--;
			this.idGen.splice(genIndex, 1);
			this.labelGen.splice(genIndex, 1)
			this.runLabelGen.splice(genIndex, 1)
			this.nameGen.splice(genIndex, 1)
			this.isRandom.splice(genIndex, 1)
			this.primitiveTypeGen.splice(genIndex, 1)
			this.colorGen.splice(genIndex, 1)
			this.patternGen.splice(genIndex, 1)
			this.lineWidthGen.splice(genIndex, 1)
			this.resultGen.splice(genIndex, 1)
		}
	}
	append(ids, results, plotPrimitive, runLabel, allowStoredRun) {
		if ((!RunResults.simulationDone && !allowStoredRun) || results.length == 0) return;
		this.resultGen.push(results);
		this.numGenerations++;
		this.numLines += ids.length;
		this.idGen.push(ids);
		let suffixPrim = findID(this.labelSuffixId)
		let suffix = suffixPrim ? `, ${getName(suffixPrim)} = ${getValue(suffixPrim)}` : ""
		this.labelGen.push(ids.map(findID).map(p => getName(p) + suffix));
		this.runLabelGen.push(String(runLabel || "Current"));
		this.isRandom.push(ids.map(findID).map(p => hasRandomFunction(getValue(p))));
		this.nameGen.push(ids.map(findID).map(getName));
		this.primitiveTypeGen.push(ids.map(id => getTypeNew(findID(id))));
		this.colorGen.push(ids.map(findID).map(
			node => node.getAttribute('Color') ? node.getAttribute('Color') : defaultStroke
		));
		let styleForId = id => typeof getPlotLineStyle === "function"
			? getPlotLineStyle(plotPrimitive, id)
			: { pattern: [1], width: 2 };
		this.patternGen.push(ids.map(id => styleForId(id).pattern));
		this.lineWidthGen.push(ids.map(id => styleForId(id).width));
	}
	setCurrent(ids, results, plotPrimitive) {
		// Remove last
		if (this.idGen.length !== 0) {
			let removedIds = this.idGen.pop();
			let numRemoved = removedIds.length;
			this.numLines -= numRemoved;
			this.numGenerations--;
			this.labelGen.pop();
			this.runLabelGen.pop();
			this.nameGen.pop();
			this.primitiveTypeGen.pop();
			this.isRandom.pop();
			this.colorGen.pop();
			this.patternGen.pop();
			this.lineWidthGen.pop();
			this.resultGen.pop();
		}

		// Add new
		this.append(ids, results, plotPrimitive);
	}
	iterator() {
		let genIndex = 0;
		let index = -1;
		let iter = {
			next: () => {
				index++;
				let result;
				if (this.idGen[genIndex] && index == this.idGen[genIndex].length) {
					genIndex++;
					index = 0;
				}
				if (genIndex < this.idGen.length && index < this.idGen[genIndex].length) {
					result = {
						value: {
							genIndex,
							index,
							id: this.idGen[genIndex][index],
							name: this.nameGen[genIndex][index],
							label: this.labelGen[genIndex][index],
							isRandom: this.isRandom[genIndex][index],
							type: this.primitiveTypeGen[genIndex][index],
							color: this.colorGen[genIndex][index],
							patern: this.patternGen[genIndex][index],
							lineWidth: this.lineWidthGen[genIndex][index],
						},
						done: false
					}
				} else {
					result = { done: true }
				}
				return result;
			},
		}
		return iter;
	}
	forEach(fn) {
		const it = this.iterator();
		let counter = 0;
		let sim = it.next();
		while (!sim.done) {
			fn(sim.value, counter)
			sim = it.next();
			counter++;
		}
	}
	/**
 	* @param {(
	*   value: {
	*     genIndex: number;
	*     index: number;
	*     id: string;
	*     name: string;
	*     label: string;
	*     isRandom: boolean;
	*     type: any;
	*     color: string;
	*     patern: any;
	*     lineWidth: any;
	*   },
	*   index: number
	* ) => any} fn
	*/
	map(fn) {
		const list = []
		let counter = 0;
		const it = this.iterator();
		let sim = it.next();
		while (!sim.done) {
			list.push(fn(sim.value, counter))
			sim = it.next();
			counter++;
		}
		return list
	}
	getSeriesArray(wantedIds, hasNumberedLines) {
		let seriesArray = [];
		let lineCount = 0;
		// Variable-first ordering keeps all selected runs for one variable together
		// in both the chart and legend before moving to the next variable.
		for (let wantedId of wantedIds) {
			for (let i = 0; i < this.idGen.length; i++) {
				let j = this.idGen[i].indexOf(wantedId);
				if (j === -1) continue;
				let tmpArr = [];
				lineCount++;
				let plotPerIdx = Math.max(1, Math.floor(this.resultGen[i].length / 4));
				for (let k = 0; k < this.resultGen[i].length; k++) {
					let row = this.resultGen[i][k];
					let time = Number(row[0]);
					let value = Number(row[j + 1]);
					let showNumHere = (k % plotPerIdx) === Math.floor((plotPerIdx / 2 + (plotPerIdx * lineCount) / 8) % plotPerIdx);
					tmpArr.push([time, value, showNumHere && hasNumberedLines ? Math.floor(lineCount).toString() : null]);
				}
				seriesArray.push(tmpArr);
			}
		}
		return seriesArray;
	}

	getSeriesSettingsArray(wantedIds, hasNumberedLines, colorFromPrimitive) {
		let seriesSettingsArray = [];
		let countLine = 0;
		for (let wantedId of wantedIds) {
			for (let i = 0; i < this.idGen.length; i++) {
				let j = this.idGen[i].indexOf(wantedId);
				if (j === -1) continue;
				countLine++;
				let runLabel = this.runLabelGen[i] || `Run ${i + 1}`;
				let baseLabel = wantedIds.length === 1 ? runLabel : `${this.labelGen[i][j]} [${runLabel}]`;
				seriesSettingsArray.push({
					showLabel: true,
					lineWidth: this.lineWidthGen[i][j],
					label: `${(hasNumberedLines ? `${countLine}. ` : "")}${baseLabel}`,
					linePattern: this.patternGen[i][j],
					color: (colorFromPrimitive ? this.colorGen[i][j] : undefined),
					shadow: false,
					showMarker: false,
					markerOptions: { size: 5 },
					pointLabels: {
						show: true,
						edgeTolerance: 0,
						ypadding: 0,
						location: "n"
					}
				});
			}
		}
		return seriesSettingsArray;
	}

}

class ComparePlotVisual extends PlotVisual {
	/** @type {DataGenerations} */
	gens;
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.runSourceRequest = 0;
		this.runHandler = () => {
			// A newly completed normal simulation must immediately refresh every
			// Compare Plot that includes Current/latest. Saved-only comparisons are
			// stable, but rebuilding them is harmless and keeps overwritten runs in
			// sync with the in-memory cache.
			this.refreshRunSources();
		}
		RunResults.subscribeRun(id, this.runHandler);
		this.plot = null;
		this.serieArray = null;
		this.gens = new DataGenerations();
		initializeMultiRunSelection(this.primitive);

		this.dialog = new ComparePlotDialog(id);
		this.dialog.subscribePool.subscribe(() => {
			this.refreshRunSources();
		});

		// A Compare Plot can be created after a simulation has already finished.
		// It therefore cannot rely solely on the run-finished subscription event.
		// Populate it from the already available Current/latest dataset now.
		setTimeout(() => this.refreshRunSources(), 0);
		SystemikaOutputDock.registerVisual(this);
	}
	removePlotReference(removeId) {
		let result = removeDisplayId(this.primitive, removeId);
		if (result) this.refreshRunSources();
	}
	clearGenerations() {
		this.gens.reset();
		this.render();
	}
	fetchData() {
		this.refreshRunSources();
		return true;
	}
	async refreshRunSources() {
		this.syncPageState();
		let request = ++this.runSourceRequest;
		let runNames = getCompareRunNames(this.primitive);
		let savedNames = runNames.filter(Boolean);

		try {
			if (window.systemikaSimulationData && systemikaSimulationData.persistenceAvailable()) {
				await Promise.all(savedNames.map(name => systemikaSimulationData.ensureRunLoaded(name)));
			}
		} catch (error) {
			if (request !== this.runSourceRequest) return;
			console.error(error);
			xAlert(`Unable to load Time Plot run data.<br/><br/>${htmlEscape(error.message || String(error))}`);
			return;
		}
		if (request !== this.runSourceRequest) return;

		this.fetchedIds = getDisplayIds(this.primitive);
		// Plot Period is no longer user-configurable. For multi-run plots,
		// use the finest native simulation time step among the selected runs.
		let steps = runNames
			.map(name => Number(RunResults.getTimeStep(name)))
			.filter(value => Number.isFinite(value) && value > 0);
		let plotPer = steps.length ? Math.min(...steps) : Number(this.dialog.getDefaultPlotPeriod());
		if (!Number.isFinite(plotPer) || plotPer <= 0) plotPer = Number(this.primitive.getAttribute("PlotPer")) || 1;

		this.gens.reset();
		for (let runName of runNames) {
			// The unnamed source is the live/current run. During Advance it is
			// intentionally available before simulationDone so plots refresh after
			// every step rather than waiting for the model end time.
			if (!runName && (!RunResults.results || !RunResults.results.length)) continue;
			let start = RunResults.getDataTimeStart(runName);
			let length = RunResults.getDataTimeLength(runName);
			let results = RunResults.getFilteredSelectiveIdResults(this.fetchedIds, start, length, plotPer, runName);
			if (!results || !results.length) continue;
			let label = runName;
			if (!label) {
				let current = window.systemikaSimulationData ? systemikaSimulationData.getCurrentRun() : null;
				label = current && current.runName ? `${current.runName} (current)` : "Current";
			}
			this.gens.append(this.fetchedIds, results, this.primitive, label, true);
		}
		this.render();
	}
	render() {
		let idsToDisplay = getDisplayIds(this.primitive);
		this.primitive.setAttribute("Primitives", idsToDisplay.join(","));

		if (this.gens.numGenerations == 0) {
			this.setEmptyPlot();
			return;
		}

		this.serieSettingsArray = [];
		this.serieArray = [];
		let hasNumberedLines = this.primitive.getAttribute("HasNumberedLines") === "true";
		this.serieArray = this.gens.getSeriesArray(idsToDisplay, hasNumberedLines);
		this.serieSettingsArray = this.gens.getSeriesSettingsArray(
			idsToDisplay,
			hasNumberedLines,
			this.primitive.getAttribute("ColorFromPrimitive") === "true"
		);
		setTimeout(() => this.updateChart(), 200);
	}
	updateChart() {
		if (!(this.id in connection_array)) return;
		if (this.serieArray == null || this.serieArray.length == 0 || this.serieArray[0].length === 0) {
			this.setEmptyPlot();
			return;
		}
		$(this.chartDiv).empty();
		let axisLimits = JSON.parse(this.primitive.getAttribute("AxisLimits"));
		let bounds = getCompareRunBounds(this.primitive);
		let fallbackStart = RunResults.getDataTimeStart();
		let fallbackEnd = fallbackStart + RunResults.getDataTimeLength();
		let min = Number(axisLimits.timeaxis.auto ? (bounds ? bounds.min : fallbackStart) : axisLimits.timeaxis.min);
		let max = Number(axisLimits.timeaxis.auto ? (bounds ? bounds.max : fallbackEnd) : axisLimits.timeaxis.max);
		let tickList = this.getTicks(min, max);

		this.plot = renderSystemikaJqPlot(this.chartDiv, this.serieArray, {
			title: this.primitive.getAttribute("TitleLabel"),
			series: this.serieSettingsArray,
			grid: { background: "transparent", shadow: false },
			axes: {
				xaxis: {
					label: timeAxisLabel(),
					labelRenderer: $.jqplot.CanvasAxisLabelRenderer,
					min: min,
					max: max,
					ticks: tickList,
				},
				yaxis: {
					renderer: (this.primitive.getAttribute("YLogScale") === "true") ? $.jqplot.LogAxisRenderer : $.jqplot.LinearAxisRenderer,
					labelRenderer: $.jqplot.CanvasAxisLabelRenderer,
					label: this.primitive.getAttribute("LeftAxisLabel"),
					min: axisLimits.yaxis.auto ? undefined : axisLimits.yaxis.min,
					max: axisLimits.yaxis.auto ? undefined : axisLimits.yaxis.max
				}
			},
			highlighter: {
				show: this.primitive.getAttribute("ShowHighlighter") === "true",
				sizeAdjust: 1.5,
				tooltipAxes: "xy",
				fadeTooltip: false,
				tooltipLocation: "ne",
				formatString: "Time = %.5p<br/>Value = %.5p",
				useAxesFormatters: false
			},
			legend: plotBottomLegendOptions(true)
		});
		stylePlotLegendLineSamples(this.chartDiv, this.plot, this.serieSettingsArray);
		spacePlotLegendFromGrid(this.chartDiv);
		if (!isNaN(this.plot.axes.yaxis.min) && !isNaN(this.plot.axes.yaxis.max)) {
			axisLimits.yaxis.min = this.plot.axes.yaxis.min;
			axisLimits.yaxis.max = this.plot.axes.yaxis.max;
			this.primitive.setAttribute("AxisLimits", JSON.stringify(axisLimits));
		}
	}
	setEmptyPlot() {
		$(this.chartDiv).empty();
		let idsToDisplay = getDisplayIds(this.primitive);
		let selected_str = "None selected";
		if (idsToDisplay.length !== 0) {
			selected_str = (`<ul style="margin: 4px;">
				${idsToDisplay.map(id => `<li>${getName(findID(id))}</li>`).join("")}
			</ul>`);
		}
		this.chartDiv.innerHTML = (`
			<div class="empty-plot-header">Time Plot</div>
			${selected_str}
		`);
	}
}

class TextAreaVisual extends HtmlTwoPointer {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);

		this.primitive = findID(id);

		this.dialog = new TextAreaDialog(id);
		this.dialog.subscribePool.subscribe(() => {
			this.render();
		});
		this.render();
	}
	updateGraphics() {
		// code for svg foreign
		this.htmlElement.setX(this.getMinX());
		this.htmlElement.setY(this.getMinY());
		this.htmlElement.setWidth(this.getWidth());
		this.htmlElement.setHeight(this.getHeight());

		this.coordRect.x1 = this.startX;
		this.coordRect.y1 = this.startY;
		this.coordRect.x2 = this.endX;
		this.coordRect.y2 = this.endY;
		this.coordRect.update();
	}
	makeGraphics() {
		this.element = SVG.append(SVG.annotationLayer, SVG.rect(this.getMinX(), this.getMinY(), this.getWidth(), this.getHeight(), defaultStroke, "none", "element", ""));

		this.coordRect = new CoordRect();
		this.coordRect.element = this.element;

		this.htmlElement = SVG.append(SVG.annotationLayer, SVG.foreign(this.getMinX(), this.getMinY(), this.getWidth(), this.getHeight(), "Text not renderd yet", "white"));

		$(this.htmlElement.cutDiv).mousedown((event) => {
			// This is an alternative to having the htmlElement in the group
			primitive_mousedown(this.id, event)
			mouseDownHandler(event);
			event.stopPropagation();
		});

		// Emergency solution since double clicking a ComparePlot or XyPlot does not always work.
		$(this.htmlElement.cutDiv).bind("contextmenu", () => {
			this.doubleClick();
		});

		$(this.htmlElement.cutDiv).dblclick((event) => {
			this.doubleClick(event);
		});

		this.group = SVG.append(SVG.annotationLayer, SVG.group([this.element]));
		this.group.setAttribute("node_id", this.id);

		this.element_array = [this.element];
		this.element_array = [this.htmlElement.contentDiv, this.element];
		for (let key in this.element_array) {
			this.element_array[key].setAttribute("node_id", this.id);
		}
	}
	doubleClick(event = null) {
		if (event && routeAnnotationDoubleClick(event)) return;
		this.dialog.show();
	}
	render() {
		let newText = getName(this.primitive);
		let hideFrame = this.primitive.getAttribute("HideFrame") === "true";
		if (hideFrame && removeSpacesAtEnd(newText).length !== 0) {
			this.element.setAttribute("visibility", "hidden");
		} else {
			this.element.setAttribute("visibility", "visible");
		}

		const defaultFontFamily = "Arial, Helvetica, sans-serif";
		const fontFamily = this.primitive.getAttribute("FontFamily") || defaultFontFamily;
		const requestedFontSize = Number(this.primitive.getAttribute("FontSize"));
		const fontSize = Number.isFinite(requestedFontSize) ? Math.max(8, Math.min(96, requestedFontSize)) : 16;
		const fontWeight = this.primitive.getAttribute("FontWeight") === "bold" ? "bold" : "normal";
		const fontStyle = this.primitive.getAttribute("FontStyle") === "italic" ? "italic" : "normal";
		const textDecoration = this.primitive.getAttribute("TextDecoration") === "underline" ? "underline" : "none";
		const requestedAlign = this.primitive.getAttribute("TextAlign");
		const textAlign = ["left", "center", "right"].includes(requestedAlign) ? requestedAlign : "left";

		const content = this.htmlElement.contentDiv;
		content.style.fontFamily = fontFamily;
		content.style.fontSize = `${fontSize}px`;
		content.style.fontWeight = fontWeight;
		content.style.fontStyle = fontStyle;
		content.style.textDecoration = textDecoration;
		content.style.textAlign = textAlign;
		content.style.whiteSpace = "pre-wrap";
		content.style.overflowWrap = "anywhere";
		this.updateHTML(htmlEscape(newText));
	}
	setColor(color) {
		super.setColor(color);
		this.htmlElement.style.color = color;
	}
}

class HistoPlotVisual extends PlotVisual {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.runHandler = () => {
			this.render();
		}
		RunResults.subscribeRun(id, this.runHandler);
		this.plot = null;
		this.histograms = [];
		this.runLabels = [];
		initializeMultiRunSelection(this.primitive);

		this.dialog = new HistoPlotDialog(id);
		this.dialog.subscribePool.subscribe(() => {
			this.render();
		});
		SystemikaOutputDock.registerVisual(this);
	}

	getHistogramSettings(dataSets) {
		let allData = [];
		for (let data of dataSets) allData.push(...data);
		if (!allData.length) return null;

		let min;
		let max;
		if (this.primitive.getAttribute("LowerBoundAuto") === "true") {
			min = Math.min.apply(null, allData);
			this.primitive.setAttribute("LowerBound", min);
		} else {
			min = Number(this.primitive.getAttribute("LowerBound"));
		}
		if (this.primitive.getAttribute("UpperBoundAuto") === "true") {
			max = Math.max.apply(null, allData);
			this.primitive.setAttribute("UpperBound", max);
		} else {
			max = Number(this.primitive.getAttribute("UpperBound"));
		}

		if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
		// A constant series still needs a non-zero bin width. Expand the automatic
		// range symmetrically without changing the data itself.
		if (max <= min) {
			let padding = Math.max(Math.abs(min) * 0.05, 0.5);
			min -= padding;
			max += padding;
			if (this.primitive.getAttribute("LowerBoundAuto") === "true") this.primitive.setAttribute("LowerBound", min);
			if (this.primitive.getAttribute("UpperBoundAuto") === "true") this.primitive.setAttribute("UpperBound", max);
		}

		let numBars;
		if (this.primitive.getAttribute("NumberOfBarsAuto") === "true") {
			numBars = Number(getDefaultAttributeValue("histoplot", "NumberOfBars"));
			this.primitive.setAttribute("NumberOfBars", numBars);
		} else {
			numBars = Number(this.primitive.getAttribute("NumberOfBars"));
		}
		if (!Number.isFinite(numBars) || numBars < 1) numBars = 10;
		numBars = Math.max(1, Math.round(numBars));
		return { min, max, numBars };
	}

	calcHistogram(results, settings) {
		let histogram = {};
		histogram.data = results.map(row => Number(row[1])).filter(Number.isFinite);
		histogram.min = settings.min;
		histogram.max = settings.max;
		histogram.numBars = settings.numBars;
		histogram.intervalWidth = (histogram.max - histogram.min) / histogram.numBars;
		histogram.bars = [];
		histogram.below_data = [];
		histogram.above_data = [];

		for (let i = 0; i < histogram.numBars; i++) {
			histogram.bars.push({
				lowerLimit: histogram.min + i * histogram.intervalWidth,
				upperLimit: histogram.min + (i + 1) * histogram.intervalWidth,
				data: []
			});
		}
		for (let dataPoint of histogram.data) {
			let pos = Math.floor((dataPoint - histogram.min) / histogram.intervalWidth);
			// Include an observation exactly equal to the upper bound in the final bin.
			if (dataPoint === histogram.max) pos = histogram.numBars - 1;
			if (0 <= pos && pos < histogram.numBars) {
				histogram.bars[pos].data.push(dataPoint);
			} else if (dataPoint < histogram.min) {
				histogram.below_data.push(dataPoint);
			} else {
				histogram.above_data.push(dataPoint);
			}
		}
		return histogram;
	}

	getRunLabel(runName) {
		if (runName) return runName;
		let current = window.systemikaSimulationData ? systemikaSimulationData.getCurrentRun() : null;
		return current && current.runName ? `${current.runName} (current)` : "Current";
	}

	render() {
		this.syncPageState();
		if (!ensureDisplayRunsAvailable(this.primitive, () => this.render())) {
			this.setEmptyPlot();
			return;
		}
		let idsToDisplay = getDisplayIds(this.primitive);
		this.primitive.setAttribute("Primitives", idsToDisplay.join(","));
		if (idsToDisplay.length !== 1) {
			this.setEmptyPlot();
			return;
		}

		let runNames = getCompareRunNames(this.primitive);
		if (!runNames.length) runNames = [""];
		let runResults = [];
		for (let runName of runNames) {
			let results = RunResults.getSelectiveIdResults(idsToDisplay, runName);
			// A single current run can be represented in the display selection by its
			// user-facing label (for example "Base") even while the authoritative
			// data source is still the live/current run. Fall back to that live source
			// when the labels match so a one-run histogram never renders empty.
			if ((!results || !results.length) && runName && runName === getCurrentRunSourceName() && hasCurrentRunSource()) {
				results = RunResults.getSelectiveIdResults(idsToDisplay, "");
			}
			if (!results || !results.length) continue;
			runResults.push({ runName, label: this.getRunLabel(runName), results });
		}
		// Defensive fallback: if the comparison selection is temporarily empty or
		// stale but a current run exists, display that run rather than a blank chart.
		if (!runResults.length && hasCurrentRunSource()) {
			let results = RunResults.getSelectiveIdResults(idsToDisplay, "");
			if (results && results.length) {
				runResults.push({ runName: "", label: this.getRunLabel(""), results });
			}
		}
		if (!runResults.length) {
			this.setEmptyPlot();
			return;
		}

		let dataSets = runResults.map(item => item.results.map(row => Number(row[1])).filter(Number.isFinite));
		let settings = this.getHistogramSettings(dataSets);
		if (!settings) {
			this.setEmptyPlot();
			return;
		}

		this.serieArray = [];
		this.serieSettingsArray = [];
		this.histograms = [];
		this.runLabels = [];
		this.ticks = [];
		let tickDecimal = Number.isInteger((settings.max - settings.min) / settings.numBars) ? 0 : 2;
		let multipleRuns = runResults.length > 1;

		for (let runIndex = 0; runIndex < runResults.length; runIndex++) {
			let item = runResults[runIndex];
			let histogram = this.calcHistogram(item.results, settings);
			this.histograms.push(histogram);
			this.runLabels.push(item.label);
			let labels = [];
			let serie = [];
			for (let i = 0; i < histogram.bars.length; i++) {
				let bar = histogram.bars[i];
				let barValue = bar.data.length;
				serie.push([bar.lowerLimit, barValue]);
				labels.push("");
				serie.push([(bar.lowerLimit + bar.upperLimit) / 2, barValue]);
				labels.push(barValue.toString());
				serie.push([bar.upperLimit, barValue]);
				labels.push("");
			}
			serie.push([histogram.max, 0]);
			labels.push("");
			this.serieArray.push(serie);
			// Keep the original proven jqPlot configuration for a single histogram.
			// Comparative histograms need a few extra line/fill settings for overlays,
			// but applying those settings to the one-series path caused jqPlot 1.0.8
			// to render an empty chart on some launches.
			let seriesSettings;
			if (multipleRuns) {
				seriesSettings = {
					label: item.label,
					shadow: false,
					lineWidth: 2,
					fillAndStroke: true,
					showMarker: false,
					fillAlpha: 0.32,
					pointLabels: { show: false, labels: labels }
				};
			} else {
				seriesSettings = {
					// Single-run histograms use a neutral classroom/print-friendly style.
					// Keep the fill light while preserving a clear black bin outline.
					color: "#000000",
					fillColor: "#d9d9d9",
					lineWidth: 1.5,
					shadow: false,
					showMarker: false,
					pointLabels: {
						show: true,
						labels: labels
					}
				};
			}
			this.serieSettingsArray.push(seriesSettings);
		}

		for (let i = 0; i < settings.numBars; i++) {
			this.ticks.push((settings.min + i * ((settings.max - settings.min) / settings.numBars)).toFixed(tickDecimal));
		}
		this.ticks.push(settings.max.toFixed(tickDecimal));

		setTimeout(() => {
			this.updateChart();
		}, 200);
	}

	updateChart() {
		if (!(this.id in connection_array)) return;
		if (!this.serieArray || !this.serieArray.length || !this.histograms.length) {
			this.setEmptyPlot();
			return;
		}
		if (getDisplayIds(this.primitive).length !== 1) {
			this.setEmptyPlot();
			return;
		}
		$(this.chartDiv).empty();

		let histogram = this.histograms[0];
		let width = parseInt(this.chartDiv.style.width);
		let widthPerTick = width / histogram.numBars;
		let tempTick = this.ticks;
		let minTickWidth = Number.isInteger(histogram.intervalWidth) ? 30 : 40;
		if (widthPerTick < minTickWidth) {
			let tickIndexSkip = Math.ceil(minTickWidth / widthPerTick);
			tempTick = this.ticks.filter((_, index) => index % tickIndexSkip === 0 || index === this.ticks.length - 1);
		}

		let targetPrimName = `${getName(findID(getDisplayIds(this.primitive)[0]))}`;
		let multipleRuns = this.serieArray.length > 1;

		$.jqplot.config.enablePlugins = true;
		this.plot = renderSystemikaJqPlot(this.chartDiv, this.serieArray, {
			series: this.serieSettingsArray,
			title: `Histogram of ${targetPrimName}`,
			sortData: false,
			grid: {
				background: "transparent",
				shadow: false
			},
			seriesDefaults: multipleRuns ? {
				step: true,
				fill: true,
				fillAndStroke: true,
				showMarker: false
			} : {
				// This mirrors the pre-comparison (0.9.3) histogram renderer, which is
				// known to render one run reliably. showMarker=false is the only visual
				// change, removing the three marker dots per bar.
				step: true,
				fill: true,
				showMarker: false
			},
			axes: {
				xaxis: {
					label: "&nbsp;",
					pad: 0,
					ticks: tempTick
				},
				yaxis: {
					min: 0
				}
			},
			highlighter: {
				show: false
			},
			legend: plotBottomLegendOptions(multipleRuns)
		});
		spacePlotLegendFromGrid(this.chartDiv);

		// Keep single-run histograms visually neutral and print-friendly without
		// re-enabling jqPlot's fragile one-series fillAndStroke path. jqPlot fills
		// the bars light gray above; draw crisp black bin borders directly on the
		// series canvas after the plot has been constructed.
		if (!multipleRuns && this.plot && this.plot.series && this.plot.series[0]) {
			let ctx = this.plot.series[0].canvas && this.plot.series[0].canvas._ctx;
			let xAxis = this.plot.axes && this.plot.axes.xaxis;
			let yAxis = this.plot.axes && this.plot.axes.yaxis;
			if (ctx && xAxis && yAxis) {
				let yBase = yAxis.series_u2p(0);
				ctx.save();
				ctx.strokeStyle = "#000000";
				ctx.lineWidth = 1;
				for (let bar of histogram.bars) {
					let barValue = bar.data.length;
					if (barValue <= 0) continue;
					let x1 = xAxis.series_u2p(bar.lowerLimit);
					let x2 = xAxis.series_u2p(bar.upperLimit);
					let yTop = yAxis.series_u2p(barValue);
					ctx.strokeRect(x1, yTop, x2 - x1, yBase - yTop);
				}
				ctx.restore();
			}
		}

		let belowLines = [];
		let aboveLines = [];
		for (let i = 0; i < this.histograms.length; i++) {
			let label = this.runLabels[i] || `Run ${i + 1}`;
			belowLines.push(`${htmlEscape(label)}: ${this.histograms[i].below_data.length}`);
			aboveLines.push(`${htmlEscape(label)}: ${this.histograms[i].above_data.length}`);
		}
		let outsideLimitInfoID = [`${getID(this.primitive)}_histoBelow`, `${getID(this.primitive)}_histoAbove`];
		$(this.chartDiv).append(`<div id="${outsideLimitInfoID[0]}">${multipleRuns ? "Below bound<br/>" + belowLines.join("<br/>") : `${histogram.below_data.length} values &lt; ${Number(this.primitive.getAttribute("LowerBound")).toFixed(2)}`}</div>`);
		$(this.chartDiv).append(`<div id="${outsideLimitInfoID[1]}">${multipleRuns ? "Above bound<br/>" + aboveLines.join("<br/>") : `${histogram.above_data.length} values &geq; ${Number(this.primitive.getAttribute("UpperBound")).toFixed(2)}`}</div>`);
		let belowInfo = this.chartDiv.querySelector(`#${outsideLimitInfoID[0]}`);
		let aboveInfo = this.chartDiv.querySelector(`#${outsideLimitInfoID[1]}`);
		if (belowInfo) $(belowInfo).css("left", "8px");
		if (aboveInfo) $(aboveInfo).css("right", "8px");
		let legendNode = multipleRuns ? this.chartDiv.querySelector("table.jqplot-table-legend") : null;
		let legendClearance = legendNode
			? Math.max(0, Math.ceil(legendNode.getBoundingClientRect().height) + 8)
			: 0;
		for (let infoNode of [belowInfo, aboveInfo]) {
			if (!infoNode) continue;
			$(infoNode).css("z-index", "9999");
			$(infoNode).css("position", "absolute");
			$(infoNode).css("padding", "4px 8px");
			$(infoNode).css("bottom", `${legendClearance}px`);
			$(infoNode).css("background", "rgba(240,240,240,0.88)");
			$(infoNode).css("font-size", multipleRuns ? "11px" : "inherit");
		}
	}
	setEmptyPlot() {
		$(this.chartDiv).empty();
		let idsToDisplay = getDisplayIds(this.primitive);
		let selected_str = "None selected";
		if (idsToDisplay.length !== 0) {
			selected_str = (`<ul style="margin: 4px;">
				${idsToDisplay.map(id => `<li>${getName(findID(id))}</li>`).join("")}
			</ul>`);
		}
		if (idsToDisplay.length > 1) {
			selected_str += warningHtml("<br/>Exactly one model entity must be selected", false);
		}
		this.chartDiv.innerHTML = (`
			<div class="empty-plot-header">Histogram Plot</div>
			${selected_str}
		`);
	}
}

// Resolve a run into finite XY points. The filtered path is preferred, but
// saved/stepped runs can have metadata bounds that do not exactly match their
// available rows. Falling back to the actual rows keeps a valid single-run XY
// plot visible instead of treating it as empty.
function getXyRunSeries(idsToDisplay, runName, plotPer) {
	let start = RunResults.getDataTimeStart(runName);
	let length = RunResults.getDataTimeLength(runName);
	let allResults = RunResults.getSelectiveIdResults(idsToDisplay, runName) || [];
	let filtered = RunResults.getFilteredSelectiveIdResults(idsToDisplay, start, length, plotPer, runName) || [];
	let rows = filtered.length ? filtered : allResults;
	let toPoints = values => values
		.map(row => [Number(row[1]), Number(row[2]), Number(row[0])])
		.filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]) && Number.isFinite(point[2]));
	let points = toPoints(rows);
	if (!points.length && rows !== allResults) points = toPoints(allResults);
	return points;
}

class XyPlotVisual extends PlotVisual {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.runHandler = () => this.render();
		RunResults.subscribeRun(id, this.runHandler);
		this.plot = null;
		this.serieArray = null;
		this.serieSettingsArray = [];
		this.namesToDisplay = [];
		this.mainRunSeriesCount = 0;
		this.seriesRunLabels = [];

		this.xAxisColor = defaultStroke;
		this.yAxisColor = defaultStroke;
		this.minXValue = 0;
		this.maxXValue = 0;
		this.minYValue = 0;
		this.maxYValue = 0;

		initializeMultiRunSelection(this.primitive);
		this.dialog = new XyPlotDialog(id);
		this.dialog.subscribePool.subscribe(() => this.render());
		setTimeout(() => this.render(), 0);
		SystemikaOutputDock.registerVisual(this);
	}
	removePlotReference(removeId) {
		let result = removeDisplayId(this.primitive, removeId);
		if (result) this.render();
	}
	render() {
		this.syncPageState();
		let runNames = getCompareRunNames(this.primitive);
		if (!ensureDisplayRunsAvailable(this.primitive, () => this.render())) {
			this.setEmptyPlot();
			return;
		}

		let idsToDisplay = getDisplayIds(this.primitive);
		this.primitive.setAttribute("Primitives", idsToDisplay.join(","));
		this.namesToDisplay = idsToDisplay.map(findID).map(getName);
		if (idsToDisplay.length !== 2) {
			this.setEmptyPlot();
			return;
		}

		// Plot Period is no longer user-configurable. For multi-run plots,
		// use the finest native simulation time step among the selected runs.
		let steps = runNames
			.map(name => Number(RunResults.getTimeStep(name)))
			.filter(value => Number.isFinite(value) && value > 0);
		let plotPer = steps.length ? Math.min(...steps) : Number(this.dialog.getDefaultPlotPeriod());
		if (!Number.isFinite(plotPer) || plotPer <= 0) plotPer = Number(this.primitive.getAttribute("PlotPer")) || 1;

		this.serieXName = this.namesToDisplay[0];
		this.serieYName = this.namesToDisplay[1];
		this.serieArray = [];
		this.serieSettingsArray = [];
		this.mainRunSeriesCount = 0;
		this.seriesRunLabels = [];
		let markerSeries = [];

		this.singleRunMode = runNames.length === 1;
		for (let runName of runNames) {
			let dataSerie = getXyRunSeries(idsToDisplay, runName, plotPer);
			if (!dataSerie.length) continue;

			let label = runName || getCurrentRunSourceName() || "Current";
			this.seriesRunLabels.push(label);
			let showLine = this.primitive.getAttribute("ShowLine") === "true";
			let showNumber = this.primitive.getAttribute("ShowNumber") === "true";
			// Systemika uses curve numbers rather than generic point markers. A lone
			// point still gets an automatic marker so an otherwise valid one-point run is visible.
			let showMarker = dataSerie.length === 1;
			let seriesNumber = this.mainRunSeriesCount + 1;
			this.serieArray.push(dataSerie);
			// Preserve the original StochSD single-series jqPlot configuration when
			// only one run is selected. The multi-run rewrite added comparison label
			// options to every series; on some jqPlot/Electron combinations that path
			// can leave a lone XY series unpainted. Multiple runs still use labels
			// and jqPlot's normal series palette for comparison.
			let curveStyle = typeof getPlotLineStyle === "function"
				? getPlotLineStyle(this.primitive, idsToDisplay[1])
				: { pattern: [1], width: 2 };
			let settings = {
				lineWidth: curveStyle.width,
				linePattern: curveStyle.pattern,
				shadow: false,
				showLine,
				showMarker,
				markerOptions: { shadow: false, size: 5 },
				pointLabels: { show: false }
			};
			if (this.singleRunMode) settings.color = "black";
			settings.label = `${showNumber ? `${seriesNumber}. ` : ""}${label}`;
			settings.showLabel = !this.singleRunMode || showNumber;
			this.serieSettingsArray.push(settings);
			this.mainRunSeriesCount++;

			if (this.primitive.getAttribute("MarkStart") === "true") {
				markerSeries.push({
					data: [dataSerie[0]],
					settings: {
						showLabel: false,
						color: "#ff4444",
						showLine: false,
						showMarker: true,
						markerOptions: { shadow: false },
						pointLabels: { show: false }
					}
				});
			}
			if (this.primitive.getAttribute("MarkEnd") === "true") {
				markerSeries.push({
					data: [dataSerie[dataSerie.length - 1]],
					settings: {
						showLabel: false,
						color: "#00aa00",
						showLine: false,
						showMarker: true,
						markerOptions: { style: "filledSquare", shadow: false },
						pointLabels: { show: false }
					}
				});
			}
		}

		for (let marker of markerSeries) {
			this.serieArray.push(marker.data);
			this.serieSettingsArray.push(marker.settings);
		}

		if (!this.mainRunSeriesCount) {
			this.setEmptyPlot();
			return;
		}
		setTimeout(() => this.updateChart(), 200);
	}

	updateChart() {
		if (!(this.id in connection_array)) return;
		if (this.serieArray == null || this.mainRunSeriesCount === 0) {
			this.setEmptyPlot();
			return;
		}
		if (getDisplayIds(this.primitive).length != 2) {
			this.setEmptyPlot();
			return;
		}
		$(this.chartDiv).empty();
		let axisLimits = JSON.parse(this.primitive.getAttribute("AxisLimits"));
		let plotOptions = {
			series: this.serieSettingsArray,
			title: this.primitive.getAttribute("TitleLabel"),
			grid: { background: "transparent", shadow: false },
			sortData: false,
			axesDefaults: { labelRenderer: $.jqplot.CanvasAxisLabelRenderer },
			axes: {
				xaxis: {
					label: this.serieXName,
					renderer: (this.primitive.getAttribute("XLogScale") === "true") ? $.jqplot.LogAxisRenderer : $.jqplot.LinearAxisRenderer,
					min: axisLimits.xaxis.auto ? undefined : axisLimits.xaxis.min,
					max: axisLimits.xaxis.auto ? undefined : axisLimits.xaxis.max,
					ticks: axisLimits.xaxis.auto ? undefined : this.getTicks(Number(axisLimits.xaxis.min), Number(axisLimits.xaxis.max)),
				},
				yaxis: {
					label: this.serieYName,
					renderer: (this.primitive.getAttribute("YLogScale") === "true") ? $.jqplot.LogAxisRenderer : $.jqplot.LinearAxisRenderer,
					min: axisLimits.yaxis.auto ? undefined : axisLimits.yaxis.min,
					max: axisLimits.yaxis.auto ? undefined : axisLimits.yaxis.max,
					ticks: axisLimits.yaxis.auto ? undefined : this.getTicks(Number(axisLimits.yaxis.min), Number(axisLimits.yaxis.max), "height"),
				}
			},
			highlighter: {
				show: this.primitive.getAttribute("ShowHighlighter") === "true",
				sizeAdjust: 1.5,
				yvalues: 2,
				fadeTooltip: false,
				tooltipLocation: "ne",
				formatString: (`
					<table class="jqplot-highlighter" style="color: black;">
						<tr><td>Time </td><td> = </td><td>%3$.3p</td></tr>
        				<tr><td>${this.serieXName} </td><td> = </td><td>%1$.3p</td></tr>
						<tr><td>${this.serieYName} </td><td> = </td><td>%2$.3p</td></tr>
					</table>
				`),
				useAxesFormatters: false
			},
		};
		// Keep the one-run path as close as possible to the original XY Plot:
		// no comparison legend configuration is installed at all.
		let showNumbers = this.primitive.getAttribute("ShowNumber") === "true";
		if (!this.singleRunMode || showNumbers) {
			plotOptions.legend = plotBottomLegendOptions(this.mainRunSeriesCount > 1 || showNumbers);
		}
		this.plot = renderSystemikaJqPlot(this.chartDiv, this.serieArray, plotOptions);
		stylePlotLegendLineSamples(this.chartDiv, this.plot, this.serieSettingsArray, this.mainRunSeriesCount);
		spacePlotLegendFromGrid(this.chartDiv);
		renderXyCurveNumbers(this);
		if (axisLimits.xaxis.auto) {
			axisLimits.xaxis.min = this.plot.axes.xaxis.min;
			axisLimits.xaxis.max = this.plot.axes.xaxis.max;
		}
		if (axisLimits.yaxis.auto) {
			axisLimits.yaxis.min = this.plot.axes.yaxis.min;
			axisLimits.yaxis.max = this.plot.axes.yaxis.max;
		}
		this.primitive.setAttribute("AxisLimits", JSON.stringify(axisLimits));
	}
	setEmptyPlot() {
		$(this.chartDiv).empty();
		let idsToDisplay = getDisplayIds(this.primitive);
		let selected_str = "None selected<br/>";
		if (idsToDisplay.length !== 0) {
			selected_str = (`<ul style="margin: 4px;">
				${idsToDisplay.map(id => `<li>${getName(findID(id))}</li>`).join("")}
			</ul>`);
		}
		if (idsToDisplay.length !== 2) selected_str += warningHtml("<br/>Exactly two model entities must be selected!");
		this.chartDiv.innerHTML = (`
			<div class="empty-plot-header">XY Plot</div>
			${selected_str}
		`);
	}
}

class LineVisual extends TwoPointer {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);
		this.dialog = new LineDialog(this.id);
		this.dialog.subscribePool.subscribe(() => {
			this.updateGraphics();
		});
	}
	makeGraphics() {
		this.line = SVG.line(this.startX, this.startY, this.endX, this.endY, defaultStroke, defaultFill, "element");
		this.clickLine = SVG.line(this.startX, this.startY, this.endX, this.endY, "transparent", "none", "element", { "stroke-width": "10" });
		this.arrowHeadStart = SVG.arrowHead(defaultStroke, defaultStroke, { "class": "element" });
		this.arrowHeadEnd = SVG.arrowHead(defaultStroke, defaultStroke, { "class": "element" });
		let arrowPathPoints = [[8, 0], [13, -5], [0, 0], [13, 5]];
		this.arrowHeadStart.setTemplatePoints(arrowPathPoints);
		this.arrowHeadEnd.setTemplatePoints(arrowPathPoints);

		this.group = SVG.append(SVG.annotationLayer,
			SVG.group([this.line, this.arrowHeadStart, this.arrowHeadEnd, this.clickLine])
		);
		this.group.setAttribute("node_id", this.id);
		this.element_array = [this.line, this.arrowHeadStart, this.arrowHeadEnd];
		for (let key in this.element_array) {
			this.element_array[key].setAttribute("node_id", this.id);
		}
		$(this.group).dblclick((event) => {
			this.doubleClick(event);
		});
	}
	doubleClick(event = null) {
		if (event && routeAnnotationDoubleClick(event)) return;
		this.dialog.show();
	}
	updateGraphics() {
		this.line.setAttribute("stroke-width", this.primitive.getAttribute("StrokeWidth"));
		this.line.setAttribute("stroke-dasharray", this.primitive.getAttribute("StrokeDashArray"));

		let lineStartPos = [this.startX, this.startY];
		let lineEndPos = [this.endX, this.endY];
		let arrowHeadStart = this.primitive.getAttribute("ArrowHeadStart") === "true";
		let arrowHeadEnd = this.primitive.getAttribute("ArrowHeadEnd") === "true";
		this.arrowHeadStart.setAttribute("visibility", arrowHeadStart ? "visible" : "hidden");
		this.arrowHeadEnd.setAttribute("visibility", arrowHeadEnd ? "visible" : "hidden");
		if (arrowHeadStart || arrowHeadEnd) {
			/* Shorten line as not to go past arrowHeadEnd */
			let shortenAmount = 8;
			let sine = sin([this.endX, this.endY], [this.startX, this.startY]);
			let cosine = cos([this.endX, this.endY], [this.startX, this.startY]);
			let endOffset = rotate([shortenAmount, 0], sine, cosine);
			if (arrowHeadStart) {
				lineStartPos = translate(neg(endOffset), [this.startX, this.startY]);
				this.arrowHeadStart.setPosition([this.startX, this.startY], [this.endX - this.startX, this.endY - this.startY]);
				this.arrowHeadStart.update();
			}
			if (arrowHeadEnd) {
				lineEndPos = translate(endOffset, [this.endX, this.endY]);
				this.arrowHeadEnd.setPosition([this.endX, this.endY], [this.startX - this.endX, this.startY - this.endY]);
				this.arrowHeadEnd.update();
			}
		}

		this.line.setAttribute("x1", lineStartPos[0]);
		this.line.setAttribute("y1", lineStartPos[1]);
		this.line.setAttribute("x2", lineEndPos[0]);
		this.line.setAttribute("y2", lineEndPos[1]);
		this.clickLine.setAttribute("x1", this.startX);
		this.clickLine.setAttribute("y1", this.startY);
		this.clickLine.setAttribute("x2", this.endX);
		this.clickLine.setAttribute("y2", this.endY);
	}
	setColor(color) {
		super.setColor(color);
		this.arrowHeadStart.setAttribute("fill", color);
		this.arrowHeadEnd.setAttribute("fill", color);
	}
}

let informationLinksVisible = true;

function updateInformationLinksMenuButton() {
	let button = document.getElementById("btn_toggle_information_links");
	if (!button) return;
	button.textContent = informationLinksVisible ? "Hide Information Links" : "Show Information Links";
	button.setAttribute("aria-pressed", informationLinksVisible ? "false" : "true");
}

function setInformationLinksVisible(visible) {
	informationLinksVisible = Boolean(visible);
	for (let id in connection_array) {
		let connection = connection_array[id];
		if (connection instanceof LinkVisual) connection.updateInformationLinkPresentation();
	}
	updateInformationLinksMenuButton();
}

class LinkVisual extends BaseConnection {
	constructor(id, type, pos0, pos1) {
		super(id, type, pos0, pos1);

		// reload image of anchor to make sure anchor is ontop
		this.b1_anchor.reloadImage();
		this.b2_anchor.reloadImage();
	}

	createInitialAnchors(pos0, pos1) {
		// Used to keep a local coordinate system between start- and endAnchor
		// startLocal = [0,0], endLocal = [1,0]
		this.b1Local = [0.3, 0.0];
		this.b2Local = [0.7, 0.0];
		super.createInitialAnchors(pos0, pos1);
		this.b1_anchor = new AnchorPoint(this.id + ".b1_anchor", "dummy_anchor", [0, 0], "bezier1");
		this.b2_anchor = new AnchorPoint(this.id + ".b2_anchor", "dummy_anchor", [0, 0], "bezier2");
		this.keepRelativeHandlePositions();
		this.b1_anchor.makeSquare();
		this.b2_anchor.makeSquare();
	}

	getAnchors() {
		return [this.start_anchor, this.b1_anchor, this.b2_anchor, this.end_anchor];
	}

	worldToLocal(worldPos) {
		// localPos(worldPos) = inv(S)*inv(R)*inv(T)*worldPos
		let origoWorld = this.start_anchor.getPos();
		let oneZeroWorld = this.end_anchor.getPos();
		let scaleFactor = distance(origoWorld, oneZeroWorld);
		let sine = sin(origoWorld, oneZeroWorld);
		let cosine = cos(origoWorld, oneZeroWorld);
		let S_pWorld = translate(worldPos, neg(origoWorld));
		let RS_pWorld = rotate(S_pWorld, -sine, cosine);
		let posWorld = scale(RS_pWorld, [0, 0], 1 / scaleFactor);
		return posWorld;
	}
	localToWorld(localPos) {
		// worldPos(localPos) = T*R*S*localPos
		let origoWorld = this.start_anchor.getPos();
		let oneZeroWorld = this.end_anchor.getPos();
		let scaleFactor = distance(origoWorld, oneZeroWorld);
		let sine = sin(origoWorld, oneZeroWorld);
		let cosine = cos(origoWorld, oneZeroWorld);
		let S_pLocal = scale(localPos, [0, 0], scaleFactor);
		let RS_pLocal = rotate(S_pLocal, sine, cosine);
		let posWorld = translate(RS_pLocal, origoWorld);
		return posWorld;
	}
	unselect() {
		this.selected = false;
		if (hasSelectedChildren(this.id)) {
			for (let i in this.highlight_on_select) {
				this.highlight_on_select[i].setAttribute("stroke", "black");
			}
		} else {
			let children = getChildren(this.id);
			for (let id in children) {
				let object = get_object(id);
				if ('setVisible' in object) {
					object.setVisible(false);
				}
			}
		}

		// Hide beizer lines
		for (let element of this.showOnlyOnSelect) {
			element.setAttribute("visibility", "hidden");
		}
		refreshSelectionStacking();
	}
	select(selectChildren = true) {
		this.selected = true;
		let children = getChildren(this.id);
		for (let id in children) {
			let object = get_object(id);
			if ('setVisible' in object) {
				object.setVisible(true);
			}
		}
		for (let i in this.highlight_on_select) {
			this.highlight_on_select[i].setAttribute("stroke", "red");
		}

		if (selectChildren) {
			// This for loop is partly redundant and should be integrated in later code
			for (let anchor of this.getAnchors()) {
				anchor.select();
				anchor.setVisible(true);
			}
		}

		// Show beizer lines
		for (let element of this.showOnlyOnSelect) {
			element.setAttribute("visibility", "visible");
		}
		refreshSelectionStacking();
	}
	updateClickArea() {
		this.click_area.x1 = this.curve.x1;
		this.click_area.y1 = this.curve.y1;
		this.click_area.x2 = this.curve.x2;
		this.click_area.y2 = this.curve.y2;
		this.click_area.x3 = this.curve.x3;
		this.click_area.y3 = this.curve.y3;
		this.click_area.x4 = this.curve.x4;
		this.click_area.y4 = this.curve.y4;
		this.click_area.update();
	}

	isAcceptableStartAttach(attachVisual) {
		let okAttachTypes = ["stock", "variable", "constant", "converter", "flow"];
		if (!okAttachTypes.includes(attachVisual.getType())) return false;
		let end = this.getEndAttach();
		if (end && directedLinkExists(attachVisual.id, end.id, this.id)) return false;
		return true;
	}

	isAcceptableEndAttach(attachVisual) {
		let okAttachTypes = ["stock", "variable", "constant", "converter", "flow"];
		if (attachVisual.getType() === "converter") {
			// A Lookup has exactly zero or one incoming Link. Outgoing Links do not
			// consume that input slot. Ignore this Link itself when an existing
			// endpoint is being moved/re-attached.
			let existingIncoming = primitives("Link").filter((link) => {
				return String(getID(link)) !== String(this.id) &&
					link.target && String(link.target.id) === String(attachVisual.id);
			});
			let start = this.getStartAttach();
			let duplicate = start && directedLinkExists(start.id, attachVisual.id, this.id);
			return existingIncoming.length === 0 && !duplicate && attachVisual.is_ghost !== true;
		}
		if (!okAttachTypes.includes(attachVisual.getType()) || attachVisual.is_ghost === true) return false;
		let start = this.getStartAttach();
		if (start && directedLinkExists(start.id, attachVisual.id, this.id)) return false;
		return true;
	}

	setStartAttach(new_start_attach) {
		let attached = super.setStartAttach(new_start_attach);
		if (attached === false) return false;
		if (this._end_attach) {
			this._end_attach.updateDefinitionError();
			this._end_attach.update();
		}
		return true;
	}
	setEndAttach(new_end_attach) {
		let old_end_attach = this._end_attach;
		let attached = super.setEndAttach(new_end_attach);
		if (attached === false) return false;
		this.updateInformationLinkPresentation();
		if (old_end_attach) {
			old_end_attach.updateDefinitionError();
			old_end_attach.update();
		}
		if (new_end_attach) {
			new_end_attach.updateDefinitionError();
			new_end_attach.update();
		}
		return true;
	}

	clean() {
		// remove end_attach to make sure end_attach value error is updated
		this.setEndAttach(null);
		super.clean();
	}
	clearImage() {
		super.clearImage();
		// curve must be removed seperatly since it is not part of any group
		this.curve.remove();
	}

	setColor(color) {
		this.color = color;
		this.primitive.setAttribute("Color", this.color);
		this.curve.setAttribute("stroke", color);
		this.arrowPath.setAttribute("stroke", color);
		if (this.polarityLabel) this.polarityLabel.setAttribute("fill", color);
		this.start_anchor.setColor(color);
		this.end_anchor.setColor(color);
		this.b1_anchor.setColor(color);
		this.b2_anchor.setColor(color);
		this.b1_line.setAttribute("stroke", color);
		this.b2_line.setAttribute("stroke", color);
	}

	makeGraphics() {
		let [x1, y1] = this.start_anchor.getPos();
		let [x2, y2] = this.b1_anchor.getPos();
		let [x3, y3] = this.b2_anchor.getPos();
		let [x4, y4] = this.end_anchor.getPos();

		this.arrowPath = SVG.fromString(`<path d="M0,0 -4,12 4,12 Z" stroke="black" fill="white"/>`);
		this.arrowHead = SVG.group([this.arrowPath]);
		SVG.translate(this.arrowHead, x4, y4);
		this.polarityLabel = SVG.text(0, 0, "", "link-polarity", {
			"fill": this.color,
			"font-size": "15px",
			"font-weight": "bold",
			"dominant-baseline": "middle",
			"pointer-events": "none"
		});

		this.click_area = SVG.curve("twoway",x1, y1, x2, y2, x3, y3, x4, y4, { "pointer-events": "all", "stroke": "transparent", "stroke-width": "10" });
		this.curve = SVG.append(SVG.linkLayer,
			SVG.curve("oneway", x1, y1, x2, y2, x3, y3, x4, y4, { "stroke": "black", "stroke-width": "1" })
		);
		this.click_area.draggable = false;
		this.curve.draggable = false;

		// curve is not included in group since it is one-way and will therefore span an area
		// The area will be clickable if included in the group
		this.group = SVG.append(SVG.linkLayer,
			SVG.group([this.click_area, this.arrowHead, this.polarityLabel])
		);
		this.group.setAttribute("node_id", this.id);
		$(this.group).dblclick((event) => {
			event.preventDefault();
			event.stopPropagation();
			this.doubleClick();
		});

		this.b1_line = SVG.append(SVG.linkLayer, SVG.line(x1, y1, x2, y2, "black", "black", "", { "stroke-dasharray": "5 5" }));
		this.b2_line = SVG.append(SVG.linkLayer, SVG.line(x4, y4, x3, y3, "black", "black", "", { "stroke-dasharray": "5 5" }));

		this.showOnlyOnSelect = [this.b1_line, this.b2_line];

		this.element_array = this.element_array.concat([this.b1_line, this.b2_line]);
	}
	doubleClick() {
		if (linkPropertiesDialog) linkPropertiesDialog.open(this.id);
	}
	updatePolarityLabel() {
		if (!this.polarityLabel || !this.primitive) return;
		let polarity = this.primitive.getAttribute("Polarity") || "";
		this.polarityLabel.textContent = polarity === "+" ? "+" : (polarity === "-" ? "−" : "");

		let b2pos = this.b2_anchor.getPos();
		let dx = this.endX - b2pos[0];
		let dy = this.endY - b2pos[1];
		let length = Math.hypot(dx, dy);
		if (!Number.isFinite(length) || length < 0.001) {
			this.polarityLabel.setAttribute("x", this.endX - 14);
			this.polarityLabel.setAttribute("y", this.endY - 10);
			return;
		}
		let ux = dx / length;
		let uy = dy / length;
		let nx = -uy;
		let ny = ux;
		this.polarityLabel.setAttribute("x", this.endX - ux * 18 + nx * 10);
		this.polarityLabel.setAttribute("y", this.endY - uy * 18 + ny * 10);
	}
	isInformationLink() {
		let end = this.getEndAttach();
		return end != null && ["stock", "constant"].includes(end.getType());
	}
	setInformationLinkVisible(visible) {
		let shouldShow = Boolean(visible);
		if (!shouldShow && this.selected) this.unselect();
		for (let element of [this.curve, this.group, this.b1_line, this.b2_line]) {
			if (!element) continue;
			if (shouldShow) element.removeAttribute("display");
			else element.setAttribute("display", "none");
		}
		if (!shouldShow) {
			for (let anchor of this.getAnchors()) anchor.setVisible(false);
		}
	}
	updateInformationLinkPresentation() {
		let informationLink = this.isInformationLink();
		if (informationLink) this.dashLine();
		else this.undashLine();
		this.setInformationLinkVisible(!informationLink || informationLinksVisible);
	}
	dashLine() {
		this.curve.setAttribute("stroke-dasharray", "6 4");
	}
	undashLine() {
		this.curve.setAttribute("stroke-dasharray", "");
	}
	resetBezierPoints() {
		let obj1 = this.getStartAttach();
		let obj2 = this.getEndAttach();
		if (!obj1 || !obj2) {
			return;
		}
		this.start_anchor.setPos(obj1.getLinkMountPos(obj2.getPos()));
		this.end_anchor.setPos(obj2.getLinkMountPos(obj1.getPos()));
		this.resetBezier1();
		this.resetBezier2();
		this.update();
	}
	resetBezier1() {
		this.b1Local = [0.3, 0];
	}
	resetBezier2() {
		this.b2Local = [0.7, 0];
	}
	syncAnchorToPrimitive(anchorType) {
		super.syncAnchorToPrimitive(anchorType);

		let startpos = this.start_anchor.getPos();
		let endpos = this.end_anchor.getPos();
		let b1pos = this.b1_anchor.getPos();
		let b2pos = this.b2_anchor.getPos();

		switch (anchorType) {
			case "start":
				this.curve.x1 = startpos[0];
				this.curve.y1 = startpos[1];
				this.curve.update();

				this.b1_line.setAttribute("x1", startpos[0]);
				this.b1_line.setAttribute("y1", startpos[1]);
				break;
			case "end":
				this.curve.x4 = endpos[0];
				this.curve.y4 = endpos[1];
				this.curve.update();


				this.b2_line.setAttribute("x1", endpos[0]);
				this.b2_line.setAttribute("y1", endpos[1]);
				break;
			case "bezier1":
					this.curve.x2 = b1pos[0];
					this.curve.y2 = b1pos[1];
					this.curve.update();

					this.b1_line.setAttribute("x2", b1pos[0]);
					this.b1_line.setAttribute("y2", b1pos[1]);

					this.primitive.setAttribute("b1x", b1pos[0]);
					this.primitive.setAttribute("b1y", b1pos[1]);
				break;
			case "bezier2":
					this.curve.x3 = b2pos[0];
					this.curve.y3 = b2pos[1];
					this.curve.update();

					this.b2_line.setAttribute("x2", b2pos[0]);
					this.b2_line.setAttribute("y2", b2pos[1]);

					this.primitive.setAttribute("b2x", b2pos[0]);
					this.primitive.setAttribute("b2y", b2pos[1]);
				break;
		}
		this.updateClickArea();
	}
	updateGraphics() {
		// The arrow is pointed from the second bezier point to the end
		let b2pos = this.b2_anchor.getPos();

		let xdiff = this.endX - b2pos[0];
		let ydiff = this.endY - b2pos[1];
		let angle = Math.atan2(xdiff, -ydiff) * (180 / Math.PI);
		SVG.transform(this.arrowHead, this.endX, this.endY, angle, 1);

		// Update end position so that we get the drawing effect when link is created
		this.curve.x4 = this.endX;
		this.curve.y4 = this.endY;
		this.curve.update();
		this.updatePolarityLabel();
	}
	update() {
		// This function is similar to TwoPointer::update but it takes attachments into account

		// Get start position from attach
		// _start_anchor is null if we are currently creating the connection
		// _start_attach is null if we are not attached to anything

		if (this.getStartAttach() != null && this.start_anchor != null) {
			if (this.getStartAttach().getPos) {
				let oldPos = this.start_anchor.getPos();
				let newPos = this.getStartAttach().getLinkMountPos(this.b1_anchor.getPos());
				// If start point have moved reset b1
				if (oldPos[0] != newPos[0] || oldPos[1] != newPos[1]) {
					this.start_anchor.setPos(newPos);
				}
			}
		}
		if (this.getEndAttach() != null && this.end_anchor != null) {
			if (this.getEndAttach().getPos) {
				let oldPos = this.end_anchor.getPos();
				let newPos = this.getEndAttach().getLinkMountPos(this.b2_anchor.getPos());
				// If end point have moved reset b2
				if (oldPos[0] != newPos[0] || oldPos[1] != newPos[1]) {
					this.end_anchor.setPos(newPos);
				}
			}
		}
		this.keepRelativeHandlePositions();
		// update anchors
		this.getAnchors().map(anchor => anchor.updatePosition());
		this.updateGraphics();
		this.updateInformationLinkPresentation();
	}
	keepRelativeHandlePositions() {
		this.b1_anchor.setPos(this.localToWorld(this.b1Local));
		this.b2_anchor.setPos(this.localToWorld(this.b2Local));
	}
	setHandle1Pos(newPos) {
		this.b1Local = this.worldToLocal(newPos);
	}
	setHandle2Pos(newPos) {
		this.b2Local = this.worldToLocal(newPos);
	}
}

class BaseTool {
	static init() {
		this.middleDownX = 0;
		this.middleDownY = 0;
		this.downScrollPosX = 0;
		this.downScrollPosY = 0;
	}
	static leftMouseDown(x, y) {
		// Is triggered when mouse goes down for this tool
	}
	static mouseMove(x, y, shiftKey) {
		// Is triggered when mouse moves
	}
	static leftMouseUp(x, y, shiftKey) {
		// Is triggered when mouse goes up for this tool
	}
	static rightMouseDown(x, y) {
		// Is triggered when right mouse is clicked for this tool
	}
	static enterTool(mouseButton) {
		// Is triggered when the tool is selected
	}
	static leaveTool() {
		// Is triggered when the tool is deselected
	}
}
BaseTool.init();

class ClearTool extends BaseTool {
	static enterTool() {
		SystemikaOutputDevices.clearAll();
		ToolBox.setTool("mouse");
	}
}

class RunTool extends BaseTool {
	static async enterTool() {
		if (typeof RunResults !== "undefined" && RunResults.isAdvanceActive()) {
			runOverlay.requestAdvanceTermination(
				"A simulation is currently paused in Advance mode. Starting a new run will terminate the current simulation.",
				() => RunTool.enterTool()
			);
			return;
		}
		/* Check that all primitives are defined */
		let definitionErrorPrims = DefinitionError.getAllPrims();
		if (definitionErrorPrims.length !== 0) {
			let prim = definitionErrorPrims[0];
			let name = prim.getAttribute("name");
			let color = prim.getAttribute("Color");
			let alert = new XAlertDialog(`
				Definition Error in <b style="color:${color};">${name}</b>: <br/><br/>
				&nbsp &nbsp ${DefinitionError.getMessage(prim)}
			`, () => {
				get_object(getID(prim)).doubleClick();
			});
			alert.setTitle("Unable to Simulate");
			alert.show();
			unselect_all();
			(object_array[prim.id] ?? connection_array[prim.id]).select();
			InfoBar.update();
			ToolBox.setTool("mouse");
			return;
		}

		// Pause/resume an already-running simulation without doing a new run-file
		// overwrite check. Only a new normal user run enters persistence setup.
		if (RunResults.runState === "running" || RunResults.runState === "paused") {
			RunResults.runPauseSimulation();
			ToolBox.setTool("mouse");
			return;
		}

		if (window.SystemikaRunManager && SystemikaRunManager.isBusy()) {
			xAlert("Systemika is still preparing or saving the previous simulation run.");
			ToolBox.setTool("mouse");
			return;
		}

		try {
			let decision = window.SystemikaRunManager
				? await SystemikaRunManager.prepareUserRun()
				: { proceed: true, persist: false, runName: "Base", overwrite: false };
			if (!decision.proceed) {
				ToolBox.setTool("mouse");
				return;
			}
			RunResults.systemikaRunDecision = decision;
			RunResults.runPauseSimulation();
		} catch (error) {
			console.error(error);
			xAlert(`Unable to prepare the simulation run.<br/><br/>${error.message || error}`);
		}
		ToolBox.setTool("mouse");
	}
}

// Stable bridge for the Run Name input and other UI modules loaded before
// editor.js.  Keeping the actual RunTool private to the editor avoids exposing
// all toolbar implementation details while still giving text controls one
// intentional way to start/pause a run.
if (typeof window !== "undefined") {
	window.systemikaRunModel = () => RunTool.enterTool();
}

class StepTool extends BaseTool {
	static async enterTool() {
		if (RunResults.isAdvanceActive()) {
			RunResults.stepSimulation();
			ToolBox.setTool("mouse");
			return;
		}
		try {
			let decision = window.SystemikaRunManager
				? await SystemikaRunManager.prepareUserRun()
				: { proceed: true, persist: false, runName: "Base", overwrite: false };
			if (!decision.proceed) { ToolBox.setTool("mouse"); return; }
			RunResults.systemikaAdvanceDecision = decision;
			RunResults.stepSimulation();
		} catch (error) {
			console.error(error);
			xAlert(`Unable to prepare the Advance run.<br/><br/>${htmlEscape(error.message || String(error))}`);
		}
		ToolBox.setTool("mouse");
	}
}

class FinishTool extends BaseTool {
	static enterTool() {
		RunResults.finishAdvanceSimulation();
		ToolBox.setTool("mouse");
	}
}

class DeleteTool extends BaseTool {
	static enterTool() {
		// A selected Flow elbow is a routing handle, not a model entity. Delete it
		// without deleting the entire Flow. This also gives users a conventional
		// keyboard alternative to right-clicking an elbow.
		let selectedAnchor = get_only_selected_anchor_id();
		if (selectedAnchor) {
			let parent = connection_array[selectedAnchor.parent_id];
			let anchor = object_array[selectedAnchor.child_id];
			if (parent && parent.getType && parent.getType() === "flow" &&
				anchor && anchor.getAnchorType() === "orthoMiddle") {
				let elbowIndex = parent.middleAnchors.indexOf(anchor);
				if (parent.removeMiddleAnchorPoint(elbowIndex)) {
					parent.update();
					unselect_all();
					parent.select();
					History.storeUndoState();
					InfoBar.update();
					ToolBox.setTool("mouse");
					return;
				}
			}
		}

		if (RunResults.isAdvanceActive()) {
			runOverlay.requestAdvanceFinish(
				"Deleting model entities during Advance changes the model structure. Finish the current Advance run to the end, then apply the deletion?",
				() => DeleteTool.enterTool()
			);
			return;
		}
		let selected_ids = Object.keys(get_selected_root_objects());
		if (selected_ids.length == 0) {
			// Outputs no longer live on the modeling canvas.  Treat the currently
			// active docked plot/table as the Delete target when there is no model
			// selection, preserving the old ability to remove an output object.
			let dockOutput = window.SystemikaOutputDock ? SystemikaOutputDock.activeVisual : null;
			if (dockOutput && SystemikaOutputDock.isOutputVisual(dockOutput)) {
				tool_deletePrimitive(String(dockOutput.id));
				History.storeUndoState();
				InfoBar.update();
				ToolBox.setTool("mouse");
				return;
			}
			xAlert("You must select at least one model entity or activate an output to delete");
			ToolBox.setTool("mouse");
			return;
		}
		delete_selected_objects();
		History.storeUndoState();
		InfoBar.update();
		ToolBox.setTool("mouse");
	}
}
DeleteTool.init();

class UndoTool extends BaseTool {
	static enterTool() {
		if (RunResults.isAdvanceActive()) {
			runOverlay.requestAdvanceTermination(
				"Undo will terminate the current Advance simulation.",
				() => UndoTool.enterTool()
			);
			return;
		}
		History.doUndo();
		ToolBox.setTool("mouse");
	}
}
UndoTool.init();

class RedoTool extends BaseTool {
	static enterTool() {
		if (RunResults.isAdvanceActive()) {
			runOverlay.requestAdvanceTermination(
				"Redo will terminate the current Advance simulation.",
				() => RedoTool.enterTool()
			);
			return;
		}
		History.doRedo();
		ToolBox.setTool("mouse");
	}
}
RedoTool.init();

function advanceStructureIds() {
	return new Set(getPrimitiveList().map(primitive => String(getID(primitive))));
}

function applyAdvanceStructureAddition(previousIds, label = "model entity") {
	if (!RunResults.isAdvanceActive()) return true;
	let result = RunResults.recompileAdvanceModel();
	if (result.applied) return true;

	// If the new structure cannot be compiled, remove only the entities created
	// by this action and leave the paused trajectory/model exactly as before.
	let before = previousIds instanceof Set ? previousIds : new Set();
	let added = getPrimitiveList().map(primitive => String(getID(primitive))).filter(id => !before.has(id));
	for (let id of added) {
		try { tool_deletePrimitive(id); } catch (error) { console.error(error); }
	}
	let detail = result.error ? htmlEscape(result.error.message || String(result.error)) : "Unknown compilation error.";
	xAlert(`Systemika could not add this ${htmlEscape(label)} to the active Advance simulation.<br/><br/>${detail}`);
	return false;
}

class OnePointCreateTool extends BaseTool {
	constructor() {
		this.rightClickMode = false;
	}
	static enterTool(mouseButton) {
		this.rightClickMode = (mouseButton === mouse.right);
	}
	static create(x, y) {
		// This function should be over written
	}
	static leftMouseDown(x, y) {
		unselect_all();
		let beforeIds = RunResults.isAdvanceActive() ? advanceStructureIds() : null;
		this.create(x, y);
		update_relevant_objects([]);
		InfoBar.update();
		if (beforeIds && ["StockTool", "ConverterTool", "VariableTool", "ConstantTool"].includes(this.name)) {
			applyAdvanceStructureAddition(beforeIds, "model entity");
		}
	}
	static leftMouseUp(x, y) {
		if (!this.rightClickMode) {
			ToolBox.setTool("mouse");
		}
	}
	static rightMouseDown(x, y) {
		unselect_all();
		ToolBox.setTool("mouse");
		InfoBar.update();
	}
}

class NumberboxTool extends OnePointCreateTool {
	static init() {
		this.targetPrimitive = null;
		this.numberboxable_primitives = ["stock", "variable", "constant", "converter", "flow"];
	}
	static create(x, y) {
		// The right place to  create primitives and elements is in the tools-layers
		let primitive_name = findFreeName(type_basename["text"]);
		let size = type_size["text"];

		this.primitive = createPrimitive(name, "Numberbox", [x, y], [0, 0]);
		this.primitive.setAttribute("Target", this.targetPrimitive);
	}
	static enterTool() {
		let selected_ids = Object.keys(get_selected_root_objects());
		if (selected_ids.length != 1) {
			if (selected_ids.length == 0) {
				xAlert("You must first select a model entity for the Number Box.");
			} else {
				xAlert("You must first select exactly one model entity for the Number Box.");
			}
			ToolBox.setTool("mouse");
			return;
		}

		let selected_object = get_object(selected_ids[0]);
		if (this.numberboxable_primitives.indexOf(selected_object.type) == -1) {
			xAlert("This model entity cannot have a Number Box");
			ToolBox.setTool("mouse");
			return;
		}
		if (isPrimitiveGhost(findID(selected_ids[0]))) {
			this.targetPrimitive = findID(selected_ids[0]).getAttribute("Source");
		} else {
			this.targetPrimitive = selected_ids[0];
		}
	}
}
NumberboxTool.init();


class StockTool extends OnePointCreateTool {
	static create(x, y) {
		// The right place to  create primitives and elements is in the tools-layers
		let primitive_name = findFreeName(type_basename["stock"]);
		let size = type_size["stock"];
		let new_stock = createPrimitive(primitive_name, "Stock", [x - size[0] / 2, y - size[1] / 2], size);
	}
}

class RotateNameTool extends BaseTool {
	static enterTool() {
		let selection = get_selected_objects();
		for (let node_id in selection) {
			rotate_name(node_id);
		}
		ToolBox.setTool("mouse");
	}
	static leaveTool() {
		History.storeUndoState();
	}
}

class MoveValveTool extends BaseTool {
	static enterTool() {
		let selection = get_selected_objects();
		for (let node_id in selection) {
			let obj = get_object(node_id);
			if (obj.type == "flow") {
				obj.moveValve();
			}
		}
		ToolBox.setTool("mouse");
	}
}

class StraightenLinkTool extends BaseTool {
	static enterTool() {
		for (let node_id in get_selected_objects()) {
			let key = get_parent_id(node_id);
			let obj = get_object(key);
			if (obj.type == "link") {
				obj.resetBezierPoints();
			}
		}
		ToolBox.setTool("mouse");
	}

}

class GhostTool extends OnePointCreateTool {
	static init() {
		this.id_to_ghost = null;
		this.ghostable_primitives = ["stock", "variable", "constant", "converter", "flow"];
	}
	static createFromSource(source, x, y) {
		if (!source) {
			xAlert("Please select an item to ghost.");
			return null;
		}
		let ghost = makeGhost(source, [x, y]);
		if (!ghost) return null;
		ghost.setAttribute("RotateName", "0");
		syncVisual(ghost);
		let DIM_ghost = get_object(ghost.getAttribute("id"));
		if (DIM_ghost && typeof source.subscribeAttribute === "function") {
			source.subscribeAttribute(DIM_ghost.changeAttributeHandler);
		}
		return ghost;
	}
	static create(x, y) {
		let source = this.id_to_ghost ? findID(this.id_to_ghost) : null;
		if (source) {
			this.createFromSource(source, x, y);
			return;
		}

		// No primitive was pre-selected. The canvas click defines where the ghost
		// will be placed; an in-app chooser then lets the user select its source.
		// This avoids browser-native prompt/alert dialogs, which are unreliable in
		// the Electron editor iframe on some Linux window managers.
		let chooser = new GhostSourceDialog(x, y);
		chooser.show();
	}
	static enterTool() {
		this.id_to_ghost = null;
		let selectedIds = get_selected_ids();
		// filter out non root object, e.g. anchors
		let selectedObjects = selectedIds.filter(id => !id.includes(".")).map(get_object);
		if (selectedObjects.length === 0) {
			// Allow the user to place first and choose the source afterward.
			return;
		}
		if (selectedObjects.length != 1) {
			xAlert("You must first select exactly one model entity to ghost");
			ToolBox.setTool("mouse");
			return;
		}
		let selectedObject = selectedObjects[0];
		if (selectedObject.is_ghost) {
			xAlert("You cannot ghost a ghost");
			ToolBox.setTool("mouse");
			return;
		}
		if (this.ghostable_primitives.indexOf(selectedObject.type) == -1) {
			xAlert(`This model entity cannot be ghosted`);
			ToolBox.setTool("mouse");
			return;
		}
		this.id_to_ghost = selectedObjects[0].id;
	}
}
GhostTool.init();

class ConverterTool extends OnePointCreateTool {
	static create(x, y) {
		// The right place to  create primitives and elements is in the tools-layers
		let primitive_name = findFreeName(type_basename["converter"]);
		let size = type_size["converter"];
		let new_converter = createPrimitive(primitive_name, "Converter", [x - size[0] / 2, y - size[1] / 2], size);
	}
}

class VariableTool extends OnePointCreateTool {
	static create(x, y) {
		// The right place to  create primitives and elements is in the tools-layers
		let primitive_name = findFreeName(type_basename["variable"]);
		let size = type_size["variable"];
		let newVariable = createPrimitive(
			primitive_name,
			"Variable",
			[x - size[0] / 2, y - size[1] / 2],
			size,
			{ "isConstant": false }
		);
	}
}

class ConstantTool extends OnePointCreateTool {
	static create(x, y) {
		let primitiveName = findFreeName(type_basename["constant"]);
		let size = type_size["variable"];
		let newConstant = createPrimitive(
			primitiveName,
			"Variable",
			[x - size[0] / 2, y - size[1] / 2],
			size,
			{ "isConstant": true }
		);
	}
}

function get_only_selected_anchor_id() {
	// returns null if more is selected than one anchor is selected, else returns object {parent_id: ... , child_id: ... }
	let selection = get_selected_objects();
	let keys = [];
	for (let key in selection) {
		keys.push(key);
	}
	if (keys.length === 1 && selection[keys[0]].getType() === "dummy_anchor") {
		// only one anchor in selection
		return { "parent_id": get_parent_id(keys[0]), "child_id": keys[0] };
	} else if (keys.length === 2) {
		if (get_object(keys[0]).getType() === "dummy_anchor" && get_object(keys[1]).getType() === "dummy_anchor") {
			// both anchors are dummies
			return null;
		} else if (get_parent_id(keys[0]) === get_parent_id(keys[1])) {
			// one anchor and parent object selected
			let parent_id = null;
			let child_id = null;
			if (get_parent_id(keys[0]) === keys[0]) {
				child_id = keys[1];
				parent_id = keys[0];
			} else {
				child_id = keys[0];
				parent_id = keys[1];
			}
			return { "parent_id": parent_id, "child_id": child_id };
		}
	}
	return null;
}

function get_single_primitive_id_selected() {
	// will give object { "parent_id": ..., "children_ids": [...] } or null if more objects selected
	let selection = get_selected_objects();
	let keys = [];
	for (let key in selection) {
		keys.push(key);
	}
	let object_ids = { "children_ids": [] };
	if (keys.length > 0) {
		object_ids["parent_id"] = get_parent_id(keys[0]);
		for (let key of keys) {
			if (get_parent_id(key) !== object_ids["parent_id"]) {
				return null;
			} else if (get_parent_id(key) !== key) {
				object_ids["children_ids"].push(key);
			}
		}
		return object_ids;
	}
	return null;
}

function get_only_link_selected() {
	let object_ids = get_single_primitive_id_selected();
	if (object_ids !== null && get_object(object_ids["parent_id"]).getType() === "link") {
		return object_ids;
	}
	return null;
}

function get_only_flow_selected() {
	let roots = Object.values(get_selected_root_objects()).filter(Boolean);
	return roots.length === 1 && roots[0].getType && roots[0].getType() === "flow" ? roots[0] : null;
}

class MouseTool extends BaseTool {
	static leftMouseDown(x, y) {
		mouse.downX = x;
		mouse.downY = y;
		do_global_log("mouse.clickedOnObject " + mouse.clickedOnObject);
		if (!mouse.clickedOnObject) {
			mouse.emptyClickDown = true;
			RectSelector.start(mouse.downX, mouse.downY);
		}

		let selected_anchor = get_only_selected_anchor_id();
		// Only one anchor is selected AND that that anchor has attaching capabilities
		if (selected_anchor && connection_array[selected_anchor.parent_id].getStartAttach) {
			let parent = connection_array[selected_anchor.parent_id];
			// Detach anchor
			switch (object_array[selected_anchor.child_id].getAnchorType()) {
				case "start":
					parent.setStartAttach(null);
					break;
				case "end":
					parent.setEndAttach(null);
					break;
			}
		}

		// Reset it for use next time
		mouse.clickedOnObject = false
	}
	static mouseMove(x, y, shiftKey) {
		let diff_x = x - mouse.downX;
		let diff_y = y - mouse.downY;
		mouse.downX = x;
		mouse.downY = y;

		if (mouse.emptyClickDown) {
			RectSelector.move(mouse.downX, mouse.downY);
			return;
		}
		// We only come here if some object is being dragged
		// Otherwise we will trigger mouse.emptyClickDown
		let only_selected_anchor = get_only_selected_anchor_id();
		let only_selected_link = get_only_link_selected();
		if (only_selected_anchor) {
			// Use equivalent tool type
			// 	RectangleVisual => RectangleTool
			// 	LinkVisual => LinkTool
			let parent = connection_array[only_selected_anchor["parent_id"]];
			let tool = ToolBox.tools[parent.type];
			tool.mouseMoveSingleAnchor(x, y, shiftKey, only_selected_anchor["child_id"]);
			parent.update();
		} else if (only_selected_link) {
			// special exeption for links of links is being draged directly
			LinkTool.mouseRelativeMoveSingleAnchor(diff_x, diff_y, shiftKey, only_selected_link["parent_id"] + ".b1_anchor");
			LinkTool.mouseRelativeMoveSingleAnchor(diff_x, diff_y, shiftKey, only_selected_link["parent_id"] + ".b2_anchor");
			let parent = connection_array[only_selected_link["parent_id"]];
			parent.update();
		} else {
			let move_array = get_selected_objects();
			this.defaultRelativeMove(move_array, diff_x, diff_y);
		}
	}
	static defaultRelativeMove(move_objects, diff_x, diff_y) {
		let objectMoved = false;
		for (let key in move_objects) {
			if (move_objects[key].draggable == undefined) {
				continue;
			}
			if (move_objects[key].draggable == false) {
				do_global_log("skipping because of no draggable");
				continue;
			}

			objectMoved = true;
			// This code is not very optimised. If we want to optimise it we should just find the objects that needs to be updated recursivly
			rel_move(key, diff_x, diff_y);
		}
		if (objectMoved) {
			// TwoPointer objects depent on OnePointer object (e.g. AnchorPoint, Stock, Auxiliary etc.)
			// Therefore they must be updated seprately
			let ids = [];
			for (let key in move_objects) {
				ids.push(move_objects[key].id);
			}
			update_relevant_objects(ids);
		}
	}
	static leftMouseUp(x, y) {
		// Check if we selected only 1 anchor element and in that case detach it;
		let selected_anchor = get_only_selected_anchor_id();

		if (selected_anchor && connection_array[selected_anchor.parent_id].getStartAttach) {
			let parent = connection_array[selected_anchor.parent_id];
			let tool = ToolBox.tools[parent.getType()];
			tool.mouseUpSingleAnchor(x, y, false, selected_anchor.child_id);
		}

		if (mouse.emptyClickDown) {
			RectSelector.stop();
			mouse.emptyClickDown = false;
		}
	}
	static rightMouseDown(x, y) {
		let flow = get_only_flow_selected();
		if (!flow) return;

		let point = [x, y];
		let elbowIndex = flow.middleAnchorNear(point, 12);
		if (elbowIndex >= 0) {
			flow.removeMiddleAnchorPoint(elbowIndex);
			flow.update();
			unselect_all();
			flow.select();
			InfoBar.update();
			History.storeUndoState();
			return;
		}

		// Right-clicking a selected pipe adds an elbow handle at the nearest point
		// on that segment. Avoid endpoints and the valve/variable controls so their
		// normal interactions cannot accidentally create bends.
		let anchors = flow.getAnchors();
		let nearEndpoint = distance(point, anchors[0].getPos()) <= 13 ||
			distance(point, anchors[anchors.length - 1].getPos()) <= 13;
		let nearValve = distance(point, flow.getValvePos()) <= 14;
		let nearVariable = distance(point, flow.getVariablePos()) <= flow.getRadius() + 3;
		if (nearEndpoint || nearValve || nearVariable) return;

		let segment = flow.closestPipeSegment(point, 10);
		if (!segment) return;
		let newAnchor = flow.createMiddleAnchorPoint(segment.point[0], segment.point[1], segment.segmentIndex);
		flow.update();
		unselect_all_other_anchors(flow.id, newAnchor.id);
		InfoBar.update();
		History.storeUndoState();
	}
}

class TwoPointerTool extends BaseTool {
	static init() {
		this.primitive = null; // The model primitive being created
		this.current_connection = null; // The visual we are working on right now
		this.type = "flow";
		this.rightClickMode = false;
	}
	static enterTool(mouseButton) {
		this.rightClickMode = (mouseButton === mouse.right);
	}
	static getType() {
		return "none";
	}
	static createTwoPointer(x, y, name) {
		// Override this and do a for example:
		// Example: this.primitive = createConnector(name, "Flow", null,null);
		// Example: this.current_connection = new FlowVisual(this.primitive.id,this.getType(),[x,y]);
	}
	static leftMouseDown(x, y) {
		unselect_all();
		this.advanceBeforeIds = RunResults.isAdvanceActive() ? advanceStructureIds() : null;

		// Looks for element under mouse.
		let start_element = find_element_under(x, y);

		// Finds free name for primitive. e.g. "stock1", "stock2", "variable1" etc. (Visible to the user)
		let primitive_name = findFreeName(type_basename[this.getType()]);
		this.createTwoPointer(x, y, primitive_name);

		// subscribes to stored model-position changes so they can be saved
		this.primitive.subscribePosition(this.current_connection.positionUpdateHandler);
		if (start_element != null && this.current_connection.getStartAttach) {
			this.current_connection.setStartAttach(get_parent(start_element));
		}
		this.current_connection.setName(primitive_name);

		// make sure start anchor is synced with primitive
		this.current_connection.syncAnchorToPrimitive("start");
	}
	static mouseMove(x, y, shiftKey) {
		// Function used during creation of twopointer
		if (this.current_connection == null) {
			return;
		}
		this.current_connection.select();
		let move_node_id = `${this.current_connection.id}.end_anchor`;
		this.mouseMoveSingleAnchor(x, y, shiftKey, move_node_id);
	}
	static mouseMoveSingleAnchor(x, y, shiftKey, node_id) {
		// Function used both during creation and later moving of anchor point
		let moveObject = get_object(node_id);
		let parent = get_parent(moveObject);
		if (shiftKey) {
			let [oppositeX, oppositeY] = [parent.startX, parent.startY];
			if (parent.start_anchor.id === node_id) {
				[oppositeX, oppositeY] = [parent.endX, parent.endY];
			}
			let sideX = x - oppositeX;
			let sideY = y - oppositeY;
			let shortSideLength = Math.min(Math.abs(sideX), Math.abs(sideY));
			let signX = Math.sign(sideX);
			let signY = Math.sign(sideY);
			moveObject.setPos([oppositeX + signX * shortSideLength, oppositeY + signY * shortSideLength]);
		} else {
			moveObject.setPos([x, y]);
		}
		parent.update();
		object_array[node_id].updatePosition();
	}
	static leftMouseUp(x, y, shiftKey) {
		this.current_connection.update();
		this.current_connection = null;
		mouse.lastClickedPrimitive = null;
		if (this.rightClickMode === false) {
			ToolBox.setTool("mouse");
		}
	}
	static rightMouseDown(x, y) {
		ToolBox.setTool("mouse");
	}
	static leaveTool() {
		mouse.lastClickedPrimitive = null;
	}
}

class FlowTool extends TwoPointerTool {
	static init() {
		super.init();
		// Is to prevent error if rightdown happens before leftdown
		// can be either "x" or "y"
		this.direction = "";
		// Shift can insert an elbow while an endpoint is being dragged. Keep
		// gesture state so one held Shift key creates one elbow rather than one
		// elbow for every mousemove event. Releasing and pressing Shift again can
		// deliberately add another elbow during the same drag.
		this.shiftElbowAnchorId = null;
		this.shiftElbowWasDown = false;
	}
	static resetShiftElbowGesture(anchor_id = null) {
		this.shiftElbowAnchorId = anchor_id;
		this.shiftElbowWasDown = false;
	}
	static maybeCreateShiftElbow(parent, mainAnchor, shiftKey) {
		if (this.shiftElbowAnchorId !== mainAnchor.id) {
			this.resetShiftElbowGesture(mainAnchor.id);
		}
		if (!shiftKey) {
			this.shiftElbowWasDown = false;
			return false;
		}
		if (this.shiftElbowWasDown) return false;

		let anchorType = mainAnchor.getAnchorType();
		if (anchorType !== "start" && anchorType !== "end") {
			this.shiftElbowWasDown = true;
			return false;
		}

		let neighbour = anchorType === "start"
			? parent.getNextAnchor(mainAnchor.id)
			: parent.getPreviousAnchor(mainAnchor.id);
		let anchorPos = mainAnchor.getPos();
		// During the first pixels of a newly-created Flow the endpoints overlap.
		// Do not consume the Shift gesture until there is enough pipe to bend.
		if (!neighbour || distance(anchorPos, neighbour.getPos()) < 10) return false;

		let insertIndex = anchorType === "start" ? 0 : parent.middleAnchors.length;
		parent.createMiddleAnchorPoint(anchorPos[0], anchorPos[1], insertIndex);
		this.shiftElbowWasDown = true;
		return true;
	}
	static getDraggedEndpoint() {
		if (!mouse.isLeftDown) return null;

		// While a new Flow is being created the moving endpoint belongs to the
		// temporary current connection.  For a completed Flow, MouseTool keeps the
		// endpoint anchor selected while it is being dragged.
		if (this.current_connection && this.current_connection.end_anchor) {
			return { parent: this.current_connection, anchor: this.current_connection.end_anchor };
		}

		let selected = get_only_selected_anchor_id();
		if (!selected) return null;
		let parent = connection_array[selected.parent_id];
		let anchor = object_array[selected.child_id];
		if (!parent || !anchor || parent.getType() !== "flow") return null;
		let anchorType = anchor.getAnchorType();
		if (anchorType !== "start" && anchorType !== "end") return null;
		return { parent, anchor };
	}
	static handleShiftKeyDown() {
		let dragged = this.getDraggedEndpoint();
		if (!dragged) return false;
		return this.maybeCreateShiftElbow(dragged.parent, dragged.anchor, true);
	}
	static handleShiftKeyUp() {
		// A physical Shift release re-arms elbow creation even when the mouse did
		// not move between key presses.  Therefore every new Shift press during a
		// single endpoint drag can create one more elbow, with no elbow-count limit.
		this.shiftElbowWasDown = false;
	}
	static leftMouseDown(x, y) {
	  isDrawingFlow = true;
	}
	static mouseMove(x, y, shiftKey) {
		if (this.current_connection) {
			this.mouseMoveSingleAnchor(x, y, shiftKey, this.current_connection.end_anchor.id);
		} else {
			// First time moving mouse
			this.firstLeftMouseMove(x, y);
		}
		currentMousePos = [x, y];
	}
	static firstLeftMouseMove(x, y) {
		// does not create anything until the first leftMouseMove have been triggered
		super.leftMouseDown(x, y);
	}
	static mouseMoveSingleAnchor(x, y, shiftKey, anchor_id) {
		// Function used both during creation and later moving of anchor point
		let mainAnchor = get_object(anchor_id);
		let parent = get_parent(mainAnchor);

		// Editing an existing attached Flow should behave like grabbing the visible
		// endpoint and pulling it away from the Stock.  Do not keep the endpoint
		// clamped to the Stock while the drag is in progress; detach first, then let
		// mouse-up attach it again if it is released over a Stock.
		if (mainAnchor.getAnchorType() === "start" && parent.getStartAttach && parent.getStartAttach()) {
			parent.setStartAttach(null);
		} else if (mainAnchor.getAnchorType() === "end" && parent.getEndAttach && parent.getEndAttach()) {
			parent.setEndAttach(null);
		}

		// Preserve the long-standing Shift-to-elbow workflow during creation and
		// extend it to completed Flows: while dragging either endpoint, a Shift
		// press inserts a new middle anchor at the endpoint's previous position.
		// requestNewAnchorPos then keeps the resulting pipe orthogonal.
		this.maybeCreateShiftElbow(parent, mainAnchor, shiftKey);
		parent.requestNewAnchorPos([x, y], anchor_id);
		parent.update();
		// update connecting links
		find_connections(parent).map(conn => conn.update());
	}
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "Flow", null, null);

		this.current_connection = new FlowVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
		this.current_connection.name_pos = Number(this.primitive.getAttribute("RotateName"));

		unselect_all_other_anchors(this.current_connection.id, this.current_connection.end_anchor.id);
		update_name_pos(this.primitive.id);
	}
	static rightMouseDown(x, y) {
		if (mouse.isLeftDown) {
			let only_selected_anchor = get_only_selected_anchor_id();
			if (only_selected_anchor) {
				let parent = connection_array[only_selected_anchor["parent_id"]];
				let child = object_array[only_selected_anchor["child_id"]];
				if (parent.getType() === "flow" && child.getAnchorType() === "end") {
					let prevAnchorPos = parent.getPreviousAnchor(child.id).getPos();
					if (distance(prevAnchorPos, [x, y]) < 10) {
						if (parent.middleAnchors.length > 0) {
							// remove last middle anchor
							parent.removeLastMiddleAnchorPoint();
						}
					} else {
						// Add middle anchor
						parent.createMiddleAnchorPoint(x, y);
						unselect_all_other_anchors(parent.id, child.id);
					}
				}
			}
		} else {
			// bugfix: unselect to not unattach on next empty click
			unselect_all();
			ToolBox.setTool("mouse");
		}
	}
	static leftMouseUp(x, y, shiftKey) {
	  isDrawingFlow = false;
		currentMousePos = [undefined, undefined];

		if (this.current_connection) {
			this.mouseUpSingleAnchor(x, y, shiftKey, this.current_connection.end_anchor.id);
			if (this.advanceBeforeIds) applyAdvanceStructureAddition(this.advanceBeforeIds, "flow");
			this.advanceBeforeIds = null;
			this.current_connection = null;
			mouse.lastClickedPrimitive = null;

			if (this.rightClickMode === false) {
				// bugfix: unselect to not unattach on next empty click
				unselect_all();
				ToolBox.setTool("mouse");
			}
		}
	}
	static mouseUpSingleAnchor(x, y, shiftKey, node_id) {
		attach_anchor(object_array[node_id]);
		this.resetShiftElbowGesture();
	}
	static getType() {
		return "flow";
	}
}
FlowTool.init();


function cleanUnconnectedLinks() {
	let allLinks = primitives("Link");
	for (let link of allLinks) {
		let ends = getEnds(link);
		if ((ends[0] == null) || (ends[1] == null)) {
			removePrimitive(link);
		}
	}
}


class TextAreaTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		let primitive_name = findFreeName(type_basename["text"]);
		this.primitive = createConnector(primitive_name, "TextArea", null, null);
		this.current_connection = new TextAreaVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static init() {
		this.initialSelectedIds = [];
		super.init();
	}
	static getType() {
		return "text";
	}
}

class RectangleTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "Rectangle", null, null);
		this.current_connection = new RectangleVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static getType() {
		return "rectangle";
	}
}
RectangleTool.init();


class EllipseTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "Ellipse", null, null);
		this.current_connection = new EllipseVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static getType() {
		return "ellipse";
	}
}

class LineTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "Line", null, null);
		this.current_connection = new LineVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static getType() {
		return "line";
	}
	static mouseMoveSingleAnchor(x, y, shiftKey, node_id) {
		// Function used both during creation and later moving of anchor point
		let moveObject = get_object(node_id);
		let parent = get_parent(moveObject);
		if (shiftKey) {
			let [oppositeX, oppositeY] = [parent.startX, parent.startY];
			if (parent.start_anchor.id === node_id) {
				[oppositeX, oppositeY] = [parent.endX, parent.endY];
			}
			let sideX = x - oppositeX;
			let sideY = y - oppositeY;
			let shortSideLength = Math.min(Math.abs(sideX), Math.abs(sideY));
			let longSideLength = Math.max(Math.abs(sideX), Math.abs(sideY));
			if (3 * shortSideLength < longSideLength) {
				// Place Horizontal or vertical
				if (Math.abs(sideX) < Math.abs(sideY)) {
					// place vertical |
					moveObject.setPos([oppositeX, y]);
				} else {
					// place Horizontal -
					moveObject.setPos([x, oppositeY]);
				}
			} else {
				// place at 45 degree angle
				let signX = Math.sign(sideX);
				let signY = Math.sign(sideY);
				moveObject.setPos([oppositeX + signX * shortSideLength, oppositeY + signY * shortSideLength]);
			}
		} else {
			moveObject.setPos([x, y]);
		}
		parent.update();
		object_array[node_id].updatePosition();
	}
}
LineTool.init();

class TableTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "Table", null, null);
		this.current_connection = new TableVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static init() {
		this.initialSelectedIds = [];
		super.init();
	}
	static leftMouseDown(x, y) {
		this.initialSelectedIds = Object.keys(get_selected_root_objects());
		super.leftMouseDown(x, y);
		setDisplayIds(this.primitive, this.initialSelectedIds);
		this.current_connection.render();
	}
	static getType() {
		return "table";
	}
}
TableTool.init();

class TimePlotTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "TimePlot", null, null);
		this.current_connection = new TimePlotVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static init() {
		this.initialSelectedIds = [];
		super.init();
	}
	static leftMouseDown(x, y) {
		this.initialSelectedIds = Object.keys(get_selected_root_objects());
		let sides = this.initialSelectedIds.map(() => "L");
		super.leftMouseDown(x, y);
		setDisplayIds(this.primitive, this.initialSelectedIds, sides);
		this.current_connection.render();
	}
	static getType() {
		return "timeplot";
	}
}

class ComparePlotTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "ComparePlot", null, null);
		this.current_connection = new ComparePlotVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static init() {
		this.initialSelectedIds = [];
		super.init();
	}
	static leftMouseDown(x, y) {
		this.initialSelectedIds = Object.keys(get_selected_root_objects());
		super.leftMouseDown(x, y)
		setDisplayIds(this.primitive, this.initialSelectedIds);
		this.current_connection.render();
	}
	static getType() {
		return "compareplot";
	}
}
ComparePlotTool.init();

class XyPlotTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "XyPlot", null, null);
		this.current_connection = new XyPlotVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static init() {
		this.initialSelectedIds = [];
		super.init();
	}
	static leftMouseDown(x, y) {
		this.initialSelectedIds = Object.keys(get_selected_root_objects());
		super.leftMouseDown(x, y)
		setDisplayIds(this.primitive, this.initialSelectedIds);
		this.current_connection.render();
	}
	static getType() {
		return "xyplot";
	}
}
XyPlotTool.init();


class HistoPlotTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "HistoPlot", null, null);
		this.current_connection = new HistoPlotVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static init() {
		this.initialSelectedIds = [];
		super.init();
	}
	static leftMouseDown(x, y) {
		this.initialSelectedIds = Object.keys(get_selected_root_objects());
		super.leftMouseDown(x, y);
		setDisplayIds(this.primitive, this.initialSelectedIds);
		this.current_connection.render();
	}
	static getType() {
		return "histoplot";
	}
}

class LinkTool extends TwoPointerTool {
	static createTwoPointer(x, y, name) {
		this.primitive = createConnector(name, "Link", null, null);
		this.current_connection = new LinkVisual(this.primitive.id, this.getType(), [x, y], [x + 1, y + 1]);
	}
	static mouseMoveSingleAnchor(x, y, shiftKey, node_id) {
		let anchor_type = node_id.split(".")[1];
		if (anchor_type === "start_anchor" || anchor_type === "end_anchor") {
			let moveObject = get_object(node_id);
			let parent = get_parent(moveObject);
			moveObject.setPos([x, y]);
			parent.update();
		} else if (anchor_type === "b1_anchor") {
			let parent = connection_array[get_parent_id(node_id)];
			parent.setHandle1Pos([x, y]);
			parent.update();
		} else if (anchor_type === "b2_anchor") {
			let parent = connection_array[get_parent_id(node_id)];
			parent.setHandle2Pos([x, y]);
			parent.update();
		}
	}
	static mouseRelativeMoveSingleAnchor(diff_x, diff_y, shiftKey, move_node_id) {
		let start_pos = get_object(move_node_id).getPos();
		this.mouseMoveSingleAnchor(start_pos[0] + diff_x, start_pos[1] + diff_y, shiftKey, move_node_id);
	}
	static mouseUpSingleAnchor(x, y, shiftKey, node_id) {
		this.mouseMoveSingleAnchor(x, y, shiftKey, node_id);
		/** @type {AnchorPoint} */
		const anchor = object_array[node_id];
		/** @type {BaseConnection} */
		const parent = get_parent(anchor);
		if (anchor.getAnchorType() === "start" || anchor.getAnchorType() === "end") {
			attach_anchor(anchor);
			parent.update();
			if (parent.getStartAttach() === null || parent.getEndAttach() === null) {
				// An incomplete Link is invalid model state. Delete this Link explicitly
				// rather than relying on selection state, so releasing an endpoint on
				// empty canvas can never leave a hanging Link behind.
				tool_deletePrimitive(parent.id);
			}
		} else if (anchor.getAnchorType() === "bezier1" || anchor.getAnchorType() === "bezier2") {
			parent.update();
		}
	}
	static leftMouseUp(x, y, shiftKey) {
		this.mouseUpSingleAnchor(x, y, shiftKey, this.current_connection.end_anchor.id);

		this.current_connection = null;
		mouse.lastClickedPrimitive = null;
		if (this.rightClickMode === false) {
			ToolBox.setTool("mouse");
		}
	}
	static getType() {
		return "link";
	}
}
LinkTool.init();

function attach_anchor(anchor) {
	[x, y] = anchor.getPos();
	let parentConnection = get_parent(anchor);

	let elements_under = find_elements_under(x, y);
	let anchor_element = null;
	let attach_to = null;


	// Find unselected stock element
	for (let i = 0; i < elements_under.length; i++) {
		let element = elements_under[i];

		let elemIsNotSelected = !element.isSelected();
		let elemIsNotParentOfAnchor = element[i] != parentConnection;
		if (elemIsNotSelected && elemIsNotParentOfAnchor) {
			attach_to = element;
			break;
		}
	}
	if (attach_to == null) {
		return false;
	}

	let attached = false;
	switch (anchor.getAnchorType()) {
		case "start":
			attached = parentConnection.setStartAttach(attach_to) !== false;
			break;
		case "end":
			attached = parentConnection.setEndAttach(attach_to) !== false;
			break;
	}

	parentConnection.update();
	return attached;
}

let currentTool = MouseTool;
let isDrawingFlow = false;
let lastTool = undefined;
let currentMousePos = [undefined, undefined];

class CoordRect {
	constructor() {
		this.x1 = 0;
		this.y1 = 0;
		this.x2 = 0;
		this.y2 = 0;
		this.element = null; // This is set at page ready
	}
	setVisible(new_visible) {
		this.element.setAttribute("visibility", new_visible ? "visible" : "hidden");
	}
	xmin() {
		return this.x1 < this.x2 ? this.x1 : this.x2;
	}
	ymin() {
		return this.y1 < this.y2 ? this.y1 : this.y2;
	}
	width() {
		return Math.abs(this.x2 - this.x1);
	}
	height() {
		return Math.abs(this.y2 - this.y1);
	}
	update() {
		this.element.setAttribute("x", this.xmin());
		this.element.setAttribute("y", this.ymin());

		this.element.setAttribute("width", this.width());
		this.element.setAttribute("height", this.height());
	}
}

class RectSelector {
	/** @type {CoordRect} coordRect */
	static coordRect;
	static init() {
		RectSelector.coordRect = new CoordRect();
		RectSelector.coordRect.element = SVG.append(SVG.svgElement, SVG.rect(-30, -30, 60, 60, "black", "none", "rect-selector"));
		RectSelector.coordRect.element.setAttribute("stroke-dasharray", "4 4");
		RectSelector.coordRect.setVisible(false);
	}
	/**
	 * @param {number} x
	 * @param {number} y
	*/
	static start(x, y) {
		unselect_all();
		RectSelector.coordRect.setVisible(true);
		RectSelector.coordRect.x1 = x;
		RectSelector.coordRect.y1 = y;
		RectSelector.coordRect.x2 = x;
		RectSelector.coordRect.y2 = y;
		RectSelector.coordRect.update();
	}
	/**
	 * @param {number} x
	 * @param {number} y
	*/
	static move(x, y) {
		RectSelector.coordRect.x2 = x;
		RectSelector.coordRect.y2 = y;
		RectSelector.coordRect.update();
		unselect_all();
		let select_array = RectSelector.getObjectsWithin();
		for (let key in select_array) {
			let parent = get_parent(select_array[key]);
			parent.select(false); // We also select the parent but not all of its anchors
			select_array[key].select();
		}
	}
	static stop() {
		RectSelector.coordRect.setVisible(false);
		let select_array = RectSelector.getObjectsWithin();
		for (let key in select_array) {
			select_array[key].select();
		}
	}
	static getObjectsWithin() {
		let return_array = {};
		for (let key in object_array) {
			if (RectSelector.isWithin(key)) {
				return_array[key] = object_array[key];
			}
		}
		return return_array;
	}
	/** @param {string} nodeId  */
	static isWithin(nodeId) {
		return (
			object_array[nodeId].pos[0] >= this.coordRect.xmin() &&
			object_array[nodeId].pos[1] >= this.coordRect.ymin() &&
			object_array[nodeId].pos[0] <= this.coordRect.xmin() + this.coordRect.width() &&
			object_array[nodeId].pos[1] <= this.coordRect.ymin() + this.coordRect.height()
		);
	}
}

function tool_deletePrimitive(id) {
	let primitive = findID(id);

	removePrimitive(primitive);

	// Delete ghosts
	let ghostIDs = findGhostsOfID(id);
	for (let i in ghostIDs) {
		tool_deletePrimitive(ghostIDs[i]);
	}
	cleanUnconnectedLinks();
	detachFlows(id);
	RunResults.removeResultsForId(id);
}

function detachFlows(id) {
	for (let key in connection_array) {
		let connection = connection_array[key];
		if (connection.type == "flow") {
			if (connection.getStartAttach() && connection.getStartAttach().id == id) {
				connection.setStartAttach(null);
				connection.update();
			}
			if (connection.getEndAttach() && connection.getEndAttach().id == id) {
				connection.setEndAttach(null);
				connection.update();
			}
		}
	}
}

function get_selected_root_objects() {
	let result = {};
	let all_objects = get_all_objects();
	for (let key in all_objects) {
		let parent = get_parent(all_objects[key]);

		// If any element is selected we add its parent
		if (all_objects[key].isSelected()) {
			result[parent.id] = parent;
		}
	}
	return result;
}

function get_root_objects() {
	let result = {};
	let all_objects = get_all_objects();
	for (let key in all_objects) {
		if (key.indexOf(".") == -1) {
			result[key] = all_objects[key];
		}
	}
	return result;
}

function delete_selected_objects() {
	// Delete all objects that are selected
	let selection = get_selected_root_objects();
	for (let key in selection) {
		// check if object not already deleted
		// e.i. link gets deleted automatically if any of it's attachments gets deleted
		if (get_object(key)) {
			tool_deletePrimitive(key);
		}
	}
}

function get_selected_objects() {
	let return_array = {};
	for (let key in object_array) {
		if (object_array[key].isSelected()) {
			return_array[key] = object_array[key];
		}
	}
	for (let key in connection_array) {
		if (connection_array[key].isSelected()) {
			return_array[key] = connection_array[key];
		}
	}
	return return_array;
}

function get_selected_ids() {
	return Object.keys(get_selected_objects());
}

function delete_connection(key) {
	if (!(key in connection_array)) {
		return;
	}
	let start_anchor = connection_array[key].start_anchor;
	let end_anchor = connection_array[key].end_anchor;
	let auxiliary = connection_array[key].auxiliary;
	connection_array[key].group.remove();
	delete connection_array[key];

	// Must be done last otherwise the anchors will respawn
	delete_object(start_anchor.id);
	delete_object(end_anchor.id);
	delete_object(auxiliary.id);
}
function delete_object(node_id) {
	let object_to_delete = object_array[node_id];

	// Delete all references to the object in the connections
	if (object_to_delete.hasOwnProperty("parent_id")) {
		delete_connection(object_to_delete.parent_id);
	}

	for (let i in object_to_delete.selector_array) {
		object_to_delete.selector_array[i].remove();
	}
	for (let key in object_to_delete.element_array) {
		object_to_delete.element_array[key].remove();
	}
	object_to_delete.group.remove();
	delete object_array[node_id];
}
function primitive_mousedown(node_id, event, new_primitive) {
	mouse.lastClickedPrimitive = get_object(node_id);
	// If we left click directly on the anchors we dont want anything but them selected
	if (event.which === mouse.left) {
		if (mouse.lastClickedPrimitive.type == "dummy_anchor") {
			let elementId = get_parent_id(mouse.lastClickedPrimitive.id);
			let parentConnection = connection_array[elementId];
			let attachedStock = null;
			if (parentConnection && parentConnection.getType && parentConnection.getType() === "flow") {
				let anchorType = mouse.lastClickedPrimitive.getAnchorType();
				attachedStock = anchorType === "start" ? parentConnection.getStartAttach() :
					(anchorType === "end" ? parentConnection.getEndAttach() : null);
			}
			// Attached flow endpoints can lie inside a Stock.  Do not let that hidden
			// endpoint steal the Stock's first click.  The flow must already be selected
			// (normally by clicking its valve) before an attached endpoint becomes
			// directly selectable for detaching/repositioning.
			if (attachedStock && attachedStock.getType && attachedStock.getType() === "stock" &&
				parentConnection && !parentConnection.isSelected()) {
				unselect_all();
				attachedStock.select();
				mouse.lastClickedPrimitive = attachedStock;
				mouse.clickedOnObject = true;
				refreshSelectionStacking();
				event.stopPropagation();
				return;
			}
			unselect_all_but(elementId);
		} else if (get_only_selected_anchor_id()) {
			unselect_all();
		}
		if (mouse.lastClickedPrimitive.isSelected()) {
			if (event.shiftKey) {
				mouse.lastClickedPrimitive.unselect();
			}
		} else {
			if (!event.shiftKey) {
				// We don't want to unselect an eventual parent
				// As that will hide other anchors
				let parent_id = get_parent_id(node_id);
				unselect_all_but(parent_id);
			}
			mouse.lastClickedPrimitive.select();
		}
		mouse.clickedOnObject = true
		refreshSelectionStacking();
	}
}

// only updates diagrams, tables, and XyPlots if needed
function update_relevant_objects(ids) {
	for (let key in object_array) {
		// dont update dummy_anchors, the twopointer parent of the dummy anchor has responsibility of the dummy_anchors
		if (object_array[key].type !== "dummy_anchor") {
			object_array[key].update();
		}
	}
	update_twopointer_objects(ids);
}

// only updates diagrams, tables, and XyPlots if needed
function update_twopointer_objects(ids) {
	for (let key in connection_array) {
		let onlyIfRelevant = ["timeplot", "xyplot", "compareplot", "histoplot", "table"];
		if (onlyIfRelevant.includes(connection_array[key].type)) {
			if (ids.includes(key)) {
				connection_array[key].update();
			}
		} else {
			connection_array[key].update();
		}
	}
}

function update_all_objects() {
	for (let key in object_array) {
		object_array[key].update();
	}
	for (let key in connection_array) {
		connection_array[key].update();
	}
}

function get_all_objects() {
	/** @type {{[id: string]: BaseObject }} */
	let result = {}
	for (let key in object_array) {
		result[key] = object_array[key];
	}
	for (let key in connection_array) {
		result[key] = connection_array[key];
	}
	return result;
}

function get_object(id) {
	if (typeof object_array[id] != "undefined") {
		return object_array[id];
	}
	if (typeof connection_array[id] != "undefined") {
		return connection_array[id];
	}
	return false;
}

/** @param {string} id @param {string} new_name */
function set_name(id, new_name) {
	let tobject = get_object(id);
	if (!tobject) {
		return;
	}
	tobject.setName(new_name);
	tobject.afterNameChange();
}
/** @param {string} node_id @param {number} diff_x @param {number} diff_y */
function rel_move(node_id, diff_x, diff_y) {
	let primitive = findID(node_id);
	if (primitive != null) {
		// If its a real primitive (stoch, variable etc) update it in the engine
		let oldPos = getCenterPosition(primitive);
		let newPos = [oldPos[0] + diff_x, oldPos[1] + diff_y];
		setCenterPosition(primitive, newPos);
	} else {
		// If its not a real primtiive but rather an anchor point updated the position only graphically
		object_array[node_id].pos[0] += diff_x;
		object_array[node_id].pos[1] += diff_y;
	}
	object_array[node_id].updatePosition();
	object_array[node_id].afterMove(diff_x, diff_y);
}

function positionToModel() {

}


function unselect_all_other_anchors(parent_id, child_id_to_select) {
	unselect_all();
	let parent = connection_array[parent_id];
	parent.select();
	for (let anchor of parent.getAnchors()) {
		if (anchor.id !== child_id_to_select) {
			anchor.unselect();
		}
	}
}

function unselect_all() {
	for (let key in object_array) {
		object_array[key].unselect();
	}
	for (let key in connection_array) {
		connection_array[key].unselect();
	}
	refreshSelectionStacking();
}

function unselect_all_but(dont_unselect_id) {
	for (let key in object_array) {
		if (key != dont_unselect_id) {
			object_array[key].unselect();
		}
	}
	for (let key in connection_array) {
		if (key != dont_unselect_id) {
			connection_array[key].unselect();
		}
	}
	refreshSelectionStacking();
}

function rotate_name(node_id) {
	let object = get_object(node_id);
	if (object.name_pos < 3) {
		object.name_pos++;
	} else {
		object.name_pos = 0;
	}
	update_name_pos(node_id);
}

function update_name_pos(node_id) {
	let object = get_object(node_id);
	let name_element = object.name_element;
	// Some objects does not have name element
	if (name_element == null) {
		return;
	}
	// For fixed names (used only by text element)
	if (object.name_centered) {
		name_element.setAttribute("x", 0); //Set path's data
		name_element.setAttribute("y", 0); //Set path's data
		name_element.setAttribute("text-anchor", "middle");
		object.updateStockNameBackground();
		return;
	}

	let visualObject = get_object(node_id);
	let pos = visualObject.namePosList[visualObject.name_pos];
	name_element.setAttribute("x", pos[0]); //Set path's data
	name_element.setAttribute("y", pos[1]); //Set path's data

	switch (get_object(node_id).name_pos) {
		case 0:
			// Below
			name_element.setAttribute("text-anchor", "middle");
			break;
		case 1:
			// To the right
			name_element.setAttribute("text-anchor", "start");
			break;
		case 2:
			// Above
			name_element.setAttribute("text-anchor", "middle");
			break;
		case 3:
			// To the left
			name_element.setAttribute("text-anchor", "end");
			break;
	}
	object.updateStockNameBackground();
}

// Canvas zoom.
//
// The svg is drawn at CANVAS_WIDTH x CANVAS_HEIGHT inside a scrolling
// container. Zooming scales the svg element while a viewBox keeps the drawing
// mapped onto it, so the existing scrolling and panning keep working and one
// canvas unit is simply `level` screen pixels.
class Zoom {
	static level = 1;
	static STEP = 1.1;
	// Far enough in to work on a single primitive; past this it is not useful.
	static MAX = 4;

	static init() {
		// Without a viewBox, resizing the element would crop rather than scale.
		SVG.svgElement.setAttribute("viewBox", `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);
		this.apply();
		// A wider window can show the whole canvas at a smaller level than before.
		$(window).on("resize", () => this.setLevel(this.level));

		// Ctrl + mouse wheel / trackpad scroll zooms the model canvas. Prevent the
		// browser/Electron page-zoom gesture and keep the canvas point under the
		// pointer stationary, which makes repeated wheel zooming feel predictable.
		this.view.addEventListener("wheel", (event) => {
			if (!event.ctrlKey || event.deltaY === 0) return;
			event.preventDefault();
			event.stopPropagation();
			let factor = event.deltaY < 0 ? this.STEP : 1 / this.STEP;
			// If one or more canvas entities are selected, keep the selection as
			// the zoom focal point. Otherwise preserve the existing pointer-centred
			// Ctrl+wheel behavior.
			let selectionAnchor = this.getSelectionAnchorClient();
			if (selectionAnchor) this.setLevelAt(this.level * factor, selectionAnchor.x, selectionAnchor.y);
			else this.setLevelAt(this.level * factor, event.clientX, event.clientY);
		}, { passive: false });
	}

	static get view() {
		return SVG.svgElement.parentElement;
	}

	// The level at which the whole canvas is visible. Zooming out stops here.
	static minLevel() {
		let view = this.view;
		if (!view || view.clientWidth === 0) {
			return 1;
		}
		return Math.min(view.clientWidth / CANVAS_WIDTH, view.clientHeight / CANVAS_HEIGHT);
	}

	// Screen position of the centre of the current canvas selection. Multiple
	// selected entities use their centroid. Returning null preserves the normal
	// viewport/pointer-centred zoom behavior when nothing is selected.
	static getSelectionAnchorClient() {
		if (typeof get_selected_root_objects !== "function") return null;
		let selected = Object.values(get_selected_root_objects() || {}).filter(Boolean);
		let positions = selected.map((item) => {
			try { return typeof item.getPos === "function" ? item.getPos() : null; } catch (_) { return null; }
		}).filter((pos) => Array.isArray(pos) && Number.isFinite(pos[0]) && Number.isFinite(pos[1]));
		if (!positions.length) return null;

		let canvasX = positions.reduce((sum, pos) => sum + pos[0], 0) / positions.length;
		let canvasY = positions.reduce((sum, pos) => sum + pos[1], 0) / positions.length;
		let view = this.view;
		let rect = view.getBoundingClientRect();
		return {
			x: rect.left + canvasX * this.level - view.scrollLeft,
			y: rect.top + canvasY * this.level - view.scrollTop
		};
	}

	static zoomIn() {
		let anchor = this.getSelectionAnchorClient();
		if (anchor) this.setLevelAt(this.level * this.STEP, anchor.x, anchor.y);
		else this.setLevel(this.level * this.STEP);
	}
	static zoomOut() {
		let anchor = this.getSelectionAnchorClient();
		if (anchor) this.setLevelAt(this.level / this.STEP, anchor.x, anchor.y);
		else this.setLevel(this.level / this.STEP);
	}
	static zoomReset() {
		let anchor = this.getSelectionAnchorClient();
		if (anchor) this.setLevelAt(1, anchor.x, anchor.y);
		else this.setLevel(1);
	}

	// Zoom around a screen point (used by Ctrl+wheel).
	static setLevelAt(newLevel, clientX, clientY) {
		let view = this.view;
		if (!view) return;
		let level = Math.min(Math.max(newLevel, this.minLevel()), this.MAX);
		if (level === this.level) return;

		let rect = view.getBoundingClientRect();
		let pointerX = Number.isFinite(clientX) ? clientX - rect.left : view.clientWidth / 2;
		let pointerY = Number.isFinite(clientY) ? clientY - rect.top : view.clientHeight / 2;
		let canvasX = (view.scrollLeft + pointerX) / this.level;
		let canvasY = (view.scrollTop + pointerY) / this.level;

		this.level = level;
		this.apply();
		view.scrollLeft = canvasX * level - pointerX;
		view.scrollTop = canvasY * level - pointerY;
	}

	// Keeps whatever is in the middle of the view in the middle of the view.
	static setLevel(newLevel) {
		let view = this.view;
		let level = Math.min(Math.max(newLevel, this.minLevel()), this.MAX);
		if (level === this.level) {
			return;
		}

		// Canvas point currently at the centre of the visible area.
		let centreX = (view.scrollLeft + view.clientWidth / 2) / this.level;
		let centreY = (view.scrollTop + view.clientHeight / 2) / this.level;

		this.level = level;
		this.apply();

		view.scrollLeft = centreX * level - view.clientWidth / 2;
		view.scrollTop = centreY * level - view.clientHeight / 2;
	}

	static apply() {
		SVG.svgElement.setAttribute("width", CANVAS_WIDTH * this.level);
		SVG.svgElement.setAttribute("height", CANVAS_HEIGHT * this.level);

		// Plot contents are HTML overlays positioned above the SVG, while their
		// borders live inside the SVG. Scale and reposition those overlays by the
		// same canvas zoom so axes, labels, legends, and plotted series zoom with
		// the border instead of remaining at a fixed screen size.
		document.querySelectorAll(".canvas-scaled-html-overlay").forEach((element) => {
			let left = Number(element.dataset.canvasLeft);
			let top = Number(element.dataset.canvasTop);
			if (Number.isFinite(left)) element.style.left = (left * this.level) + "px";
			if (Number.isFinite(top)) element.style.top = (top * this.level) + "px";
			element.style.transformOrigin = "0 0";
			element.style.transform = `scale(${this.level})`;
		});
	}

	// Screen pixels measured from the svg's top left, to canvas coordinates.
	static toCanvas(pixels) {
		return pixels / this.level;
	}
}

class MousePan {
	/** @type {{x: number, y: number}} */
	static downAt;
	static middleIsDown;
	static init() {
		document.body.addEventListener("mouseleave", () => MousePan.end())
	}
	static start(x, y) {
		this.downAt = {x, y};
		this.middleIsDown = true;
		SVG.svgElement.classList.add("panning")
	}
	static move(x, y) {
		// downAt and the incoming position are canvas coordinates; scrolling is
		// in screen pixels. scrollBy is relative to the current scroll position,
		// so the reference point must walk forward each call or the same delta
		// gets re-applied on top of itself every event.
		SVG.svgElement.parentElement.scrollBy(
			(this.downAt.x - x) * Zoom.level,
			(this.downAt.y - y) * Zoom.level
		);
		this.downAt = {x, y};
	}
	static end() {
		SVG.svgElement.classList.remove("panning")
		this.middleIsDown = false;
	}
 }

// Pointer position in canvas coordinates, which is what every tool works in.
function mousePosition(event) {
	// clientX/clientY + getBoundingClientRect are both viewport-relative, so
	// this is correct regardless of whether the page itself is scrolled —
	// pageX/offset() would also need window.scrollX/Y to stay in lockstep.
	let rect = SVG.svgElement.getBoundingClientRect();
	return {
		x: Zoom.toCanvas(event.clientX - rect.left),
		y: Zoom.toCanvas(event.clientY - rect.top)
	};
}

function mouseDownHandler(event) {
	do_global_log("mouseDownHandler");
	if (!isTimeUnitOk(getTimeUnits()) && Preferences.get("forceTimeUnit")) {
		event.preventDefault();
		timeUnitDialog.show();
		return;
	}
	let { x, y } = mousePosition(event);
	do_global_log("x:" + x + " y:" + y);
	switch (event.which) {
		case mouse.left:
			// if left mouse button down
			mouse.isLeftDown = true;
			currentTool.leftMouseDown(x, y);
			break;
		case mouse.middle:
			event.preventDefault()
			MousePan.start(x, y)
			break;
		case mouse.right:
			// if right mouse button down
			currentTool.rightMouseDown(x, y);
			break;
	}
}
function mouseMoveHandler(event) {
	let { x, y } = mousePosition(event);

	mouse.x = x;
	mouse.y = y;
	let rect = SVG.svgElement.getBoundingClientRect();
	if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
		mouse.lastCanvasX = x;
		mouse.lastCanvasY = y;
	}

  if (mouse.isLeftDown) {
    currentTool.mouseMove(x, y, event.shiftKey);
  } if (MousePan.middleIsDown) {
		event.preventDefault()
		MousePan.move(x, y)
	}

}
function mouseUpHandler(event) {
	if (event.which === mouse.left) {
		if (!mouse.isLeftDown) {
			return;
		}
		// does not work to store UndoState here, because mouseUpHandler happens even when we are outside the svg (click buttons etc)
		do_global_log("mouseUpHandler");
		let { x, y } = mousePosition(event);

		// A click/selection rectangle on empty canvas is UI state only.  It must not
		// create a model undo snapshot or trigger the Unsaved Changes indicator.
		let wasBlankCanvasInteraction = currentTool === MouseTool && mouse.emptyClickDown;
		currentTool.leftMouseUp(x, y, event.shiftKey);
		mouse.isLeftDown = false;
		InfoBar.update();
		if (!wasBlankCanvasInteraction) History.storeUndoState();
	} else if (event.which == mouse.middle) {
		event.preventDefault()
		MousePan.end()
	}
}

function find_elements_under(x, y) {
	let found_array = [];
	let objects = get_all_objects();
	// Having "flow" in this list causes a bug with flows that does not place properly
	//~ let attachable_object_types = ["flow", "stock", "variable"];
	let attachable_object_types = ["flow", "stock", "constant", "variable", "converter"];
	for (key in objects) {
		if (objects[key].type == "dummy_anchor") {
			// We are only intressted in primitive-objects. not dummy_anchors
			continue;
		}
		if (attachable_object_types.indexOf(objects[key].type) == -1) {
			// We skip if the object is not attachable
			continue;
		}
		let rect = objects[key].getBoundRect();
		if (isInLimits(rect.minX, x, rect.maxX) && isInLimits(rect.minY, y, rect.maxY)) {
			found_array.push(objects[key]);
		}
	}
	do_global_log("found array(" + found_array.length + ") " + found_array.map((x) => x.id).join(","));
	return found_array;
}

function find_element_under(x, y) {
	elements_under = find_elements_under(x, y);
	if (elements_under.length > 0) {
		do_global_log("find_element_under choose " + elements_under[0].id);
		return elements_under[0];
	} else {
		return null;
	}
}

function stochsd_clear_sync() {
	let root_object_array = get_root_objects();
	for (let id in root_object_array) {
		if (findID(id) == null) {
			stochsd_delete_primitive(id);
		}
	}
}

class ToolBox {
	static init() {
		this.tools = {
			"mouse": MouseTool,
			"delete": DeleteTool,
			"undo": UndoTool,
			"redo": RedoTool,
			"stock": StockTool,
			"converter": ConverterTool,
			"variable": VariableTool,
			"constant": ConstantTool,
			"flow": FlowTool,
			"link": LinkTool,
			"rotatename": RotateNameTool,
			"movevalve": MoveValveTool,
			"straightenlink": StraightenLinkTool,
			"ghost": GhostTool,
			"text": TextAreaTool,
			"rectangle": RectangleTool,
			"ellipse": EllipseTool,
			"line": LineTool,
			"table": TableTool,
			"timeplot": TimePlotTool,
			"compareplot": ComparePlotTool,
			"xyplot": XyPlotTool,
			"histoplot": HistoPlotTool,
			"clear": ClearTool,
			"run": RunTool,
			"step": StepTool,
			"finish": FinishTool
		};
	}
	static setTool(toolName, whichMouseButton) {
		// During a paused Advance run, result exploration remains available but
		// tools that mutate the model or simulation state require termination.
		// Display-creation tools are allowed so users can investigate partial
		// results while stepping through a run.
		let advanceSafeTools = [
			"mouse", "step", "finish", "clear", "delete",
			"stock", "converter", "variable", "constant", "flow", "link",
			"table", "timeplot", "compareplot", "xyplot", "histoplot"
		];
		// RunResults is declared later in this classic script. `typeof RunResults`
		// still throws while that lexical class binding is in its temporal dead
		// zone, which can happen during early toolbar initialization. Probe it
		// defensively so startup never depends on script timing.
		let runResultsReady = false;
		try {
			runResultsReady = typeof RunResults !== "undefined";
		} catch (_error) {
			runResultsReady = false;
		}
		if (runResultsReady && RunResults.isAdvanceActive() && !advanceSafeTools.includes(toolName)) {
			let message = toolName === "run"
				? "A simulation is currently paused in Advance mode. Starting a new run will terminate the current simulation."
				: "The active Advance simulation has compiled the current model structure. Structural changes require ending the stepped simulation. Terminate it now and apply the change?";
			runOverlay.requestAdvanceTermination(message, () => this.setTool(toolName, whichMouseButton));
			return;
		}
		if (toolName in this.tools) {
			$(".tool-button").removeClass("pressed");
			$("#btn_" + toolName).addClass("pressed");

			currentTool.leaveTool();
			currentTool = this.tools[toolName];
      currentTool.enterTool(whichMouseButton);
      if ([
        "stock",
  			"converter",
  			"variable",
  			"constant",
  			"flow",
  			"link",
  			"ghost",
  			"text",
  			"rectangle",
  			"ellipse",
  			"line",
  			"table",
  			"timeplot",
  			"compareplot",
        ].includes(toolName)) lastTool = toolName;
		} else {
			errorPopUp("The tool " + toolName + " does not exist");
		}
	}
	static getTool() {

	}
}
ToolBox.init();

function translateCopiedConnectorGeometry(primitive, delta) {
	if (!primitive || !primitive.value || !Array.isArray(delta)) return;
	let dx = Number(delta[0]);
	let dy = Number(delta[1]);
	if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
	let type = String(getType(primitive) || "").toLowerCase();

	if (type === "link") {
		// Link Bezier handles are persisted as absolute canvas coordinates. The
		// connector endpoints move with setCenterPosition(), but these attributes
		// otherwise stay at the source location, which changes the copied curve's
		// shape and can make the handles appear randomly placed.
		for (let [xAttr, yAttr] of [["b1x", "b1y"], ["b2x", "b2y"]]) {
			let rawX = primitive.getAttribute(xAttr);
			let rawY = primitive.getAttribute(yAttr);
			if (rawX == null || rawY == null || String(rawX).trim() === "" || String(rawY).trim() === "") continue;
			let x = Number(rawX);
			let y = Number(rawY);
			if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
			primitive.value.setAttribute(xAttr, x + dx);
			primitive.value.setAttribute(yAttr, y + dy);
		}
	}

	if (type === "flow") {
		// Flow bend points use the same absolute-coordinate convention. Preserve
		// their geometry as part of the copied structure as well.
		let middlePoints = String(primitive.getAttribute("MiddlePoints") || "").trim();
		if (middlePoints) {
			let shifted = middlePoints.split(/\s+/).map(token => {
				let parts = token.split(",");
				if (parts.length !== 2) return token;
				let x = Number(parts[0]);
				let y = Number(parts[1]);
				return Number.isFinite(x) && Number.isFinite(y) ? `${x + dx},${y + dy}` : token;
			});
			primitive.value.setAttribute("MiddlePoints", shifted.join(" "));
		}
	}
}

class Clipboard {
	static init() {
		this.items = [];
		this.mode = "copy";
		this.selectionCenter = null;
		this.pasteCount = 0;
		this.updateButtons();
	}
	static updateButtons() {
		let pasteButton = typeof document !== "undefined" ? document.getElementById("btn_paste") : null;
		if (pasteButton) pasteButton.disabled = this.items.length === 0;
	}
	static getSelectionRootIds() {
		let selected = get_selected_root_objects();
		let ids = Object.keys(selected);
		let idSet = new Set(ids.map(String));

		// When both ends of a Flow or Link are selected, include the connector even
		// if the user selected the structure by its nodes rather than the line itself.
		// This makes copying a stock-flow structure behave as one coherent object.
		for (let id in connection_array) {
			let connection = connection_array[id];
			if (!connection || !["flow", "link"].includes(connection.type)) continue;
			let start = connection.getStartAttach ? connection.getStartAttach() : null;
			let end = connection.getEndAttach ? connection.getEndAttach() : null;
			if (!start || !end) continue;
			let startId = String(get_parent_id(start.id));
			let endId = String(get_parent_id(end.id));
			if (idSet.has(startId) && idSet.has(endId) && !idSet.has(String(id))) {
				ids.push(String(id));
				idSet.add(String(id));
			}
		}
		return ids;
	}
	static snapshotPrimitive(id) {
		let primitive = findID(id);
		let visual = get_object(id);
		if (!primitive || !visual || !primitive.value) return null;
		let position = typeof visual.getPos === "function" ? visual.getPos() : getCenterPosition(primitive);
		let ends = (primitive.source || primitive.target) ? getEnds(primitive) : [null, null];
		return {
			oldId: String(id),
			type: getType(primitive) || "",
			name: getName(primitive) || "",
			value: primitive.value.cloneNode(true),
			position: Array.isArray(position) ? [Number(position[0]), Number(position[1])] : [0, 0],
			sourceId: ends[0] ? String(ends[0].id) : null,
			targetId: ends[1] ? String(ends[1].id) : null
		};
	}
	static captureIds(ids, mode = "copy") {
		let normalizedIds = Array.from(ids || []).map(String).filter(Boolean);
		if (!normalizedIds.length) return false;
		let items = normalizedIds.map(id => this.snapshotPrimitive(id)).filter(Boolean);
		if (!items.length) return false;
		this.items = items;
		this.mode = mode;
		this.selectionCenter = centerCoordinates(items.map(item => item.position));
		this.pasteCount = 0;
		this.updateButtons();
		return true;
	}
	static capture(mode = "copy") {
		return this.captureIds(this.getSelectionRootIds(), mode);
	}
	static copy() {
		if (!this.capture("copy")) {
			if (typeof xAlert === "function") xAlert("Select at least one model object to copy.");
			return false;
		}
		return true;
	}
	static cut() {
		if (RunResults.isAdvanceActive()) {
			runOverlay.requestAdvanceTermination(
				"Cutting model objects will terminate the current Advance simulation.",
				() => Clipboard.cut()
			);
			return false;
		}
		if (!this.capture("cut")) {
			if (typeof xAlert === "function") xAlert("Select at least one model object to cut.");
			return false;
		}
		delete_selected_objects();
		History.storeUndoState();
		InfoBar.update();
		return true;
	}
	static freeCopyName(originalName, reservedNames) {
		let base = String(originalName || "Copy").trim() || "Copy";
		let counter = 1;
		let candidate = `${base}_${counter}`;
		while (findName(candidate) != null || reservedNames.has(candidate.toLowerCase())) {
			counter++;
			candidate = `${base}_${counter}`;
		}
		reservedNames.add(candidate.toLowerCase());
		return candidate;
	}
	static replaceFormulaNames(value, nameMap) {
		if (typeof value !== "string" || !nameMap || nameMap.size === 0) return value;

		// Systemika's canonical equation syntax uses bare identifier references
		// (for example Population * BirthRate). Older .ssd models can still
		// contain [Population] references, so support both forms. Build one
		// case-insensitive lookup and replace identifier tokens in a single pass
		// to avoid chained substitutions when several copied names overlap.
		let replacements = new Map();
		for (let [oldName, newName] of nameMap.entries()) {
			let oldKey = String(oldName || "").trim();
			let newValue = String(newName || "").trim();
			if (!oldKey || !newValue || oldKey.toLowerCase() === newValue.toLowerCase()) continue;
			replacements.set(oldKey.toLowerCase(), newValue);
		}
		if (!replacements.size) return value;

		let remapCode = code => code.replace(/\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*\]|[A-Za-z_][A-Za-z0-9_]*/g,
			(match, bracketName, offset, source) => {
				let tokenName = bracketName == null ? match : bracketName;
				let replacement = replacements.get(String(tokenName).toLowerCase());
				if (!replacement) return match;

				if (bracketName != null) return `[${replacement}]`;

				// An identifier followed by '(' is a function name in Systemika's
				// expression grammar, not a model-entity reference. Do not rename
				// function calls even if an entity happens to share that spelling.
				let next = offset + match.length;
				while (next < source.length && /\s/.test(source[next])) next++;
				if (source[next] === "(") return match;

				return replacement;
			});

		// Keep equation comments exactly as written. remapFormulaAttributes() uses
		// getValue() for model equations, so stored "\\n" sequences have already
		// been decoded to real logical lines before this pass.
		return value.split("\n").map(line => {
			let hash = line.indexOf("#");
			if (hash === -1) return remapCode(line);
			return remapCode(line.slice(0, hash)) + line.slice(hash);
		}).join("\n");
	}
	static remapFormulaAttributes(primitive, nameMap) {
		let type = String(getType(primitive) || "");
		if (["Stock", "Flow", "Variable"].includes(type)) {
			let value = getValue(primitive);
			let remapped = this.replaceFormulaNames(String(value), nameMap);
			if (remapped !== value) setValue(primitive, remapped);
			return;
		}

		const formulaAttributes = ["Value", "Function", "Action", "Size"];
		for (let attribute of formulaAttributes) {
			let value = primitive.getAttribute(attribute);
			if (value == null || value === "") continue;
			let remapped = this.replaceFormulaNames(String(value), nameMap);
			if (remapped !== value) primitive.value.setAttribute(attribute, remapped);
		}
	}
	static remapIdAttributes(primitive, idMap) {
		for (let attribute of ["Source", "Target"]) {
			let oldValue = primitive.getAttribute(attribute);
			if (oldValue != null && idMap.has(String(oldValue))) {
				primitive.value.setAttribute(attribute, String(idMap.get(String(oldValue)).id));
			}
		}
		let primitivesValue = primitive.getAttribute("Primitives");
		if (primitivesValue) {
			let ids = String(primitivesValue).split(",").map(id => id.trim()).filter(Boolean);
			let remapped = ids.map(id => idMap.has(id) ? String(idMap.get(id).id) : id);
			primitive.value.setAttribute("Primitives", remapped.join(","));
		}
	}
	static getPasteTarget() {
		let source = this.selectionCenter || [0, 0];
		let lastCanvas = [mouse.lastCanvasX, mouse.lastCanvasY];
		let hasCanvasPoint = Number.isFinite(lastCanvas[0]) && Number.isFinite(lastCanvas[1]);
		if (hasCanvasPoint) {
			let dx = lastCanvas[0] - source[0];
			let dy = lastCanvas[1] - source[1];
			if (Math.sqrt(dx * dx + dy * dy) >= 24) return lastCanvas;
		}
		let offset = 40 * (this.pasteCount + 1);
		return [source[0] + offset, source[1] + offset];
	}
	static paste() {
		if (!this.items.length) return false;
		if (RunResults.isAdvanceActive()) {
			runOverlay.requestAdvanceTermination(
				"Pasting model objects will terminate the current Advance simulation.",
				() => Clipboard.paste()
			);
			return false;
		}

		let parent = graph.children[0].children[0];
		let idMap = new Map();
		let newItems = [];
		let reservedNames = new Set();
		let nameMap = new Map();
		let preserveNames = this.mode === "cut";

		// Decide all names first so formulas inside one copied primitive can safely
		// refer to another copied primitive regardless of clone order.
		for (let item of this.items) {
			let isStaticText = String(item.type).toLowerCase() === "textarea" || String(item.type).toLowerCase() === "text";
			item.pasteName = isStaticText
				? item.name
				: (preserveNames && findName(item.name) == null
					? item.name
					: this.freeCopyName(item.name, reservedNames));
			if (!isStaticText) nameMap.set(item.name, item.pasteName);
		}

		for (let item of this.items) {
			let sourceNode = { value: item.value };
			let clone = simpleCloneNode2(sourceNode, parent);
			clearPrimitiveCache();
			idMap.set(item.oldId, clone);
			newItems.push({ item, clone });
			setName(clone, item.pasteName);
		}

		for (let entry of newItems) {
			let { item, clone } = entry;
			this.remapIdAttributes(clone, idMap);
			this.remapFormulaAttributes(clone, nameMap);
			if (item.sourceId || item.targetId) {
				let source = item.sourceId && idMap.has(item.sourceId) ? idMap.get(item.sourceId) : (item.sourceId ? findID(item.sourceId) : null);
				let target = item.targetId && idMap.has(item.targetId) ? idMap.get(item.targetId) : (item.targetId ? findID(item.targetId) : null);
				// Pasting a Link by itself must not bypass the same duplicate-link rule
				// enforced by interactive drawing. If both endpoints were copied too,
				// source/target resolve to the new clones and the connection remains valid.
				if (String(getType(clone)).toLowerCase() === "link" && source && target &&
					directedLinkExists(source.id, target.id, clone.id)) {
					removePrimitive(clone);
					idMap.delete(item.oldId);
					entry.skip = true;
					continue;
				}
				setEnds(clone, [source || null, target || null]);
			}
		}

		let targetCenter = this.getPasteTarget();
		let sourceCenter = this.selectionCenter || [0, 0];
		let delta = [targetCenter[0] - sourceCenter[0], targetCenter[1] - sourceCenter[1]];
		for (let entry of newItems) {
			if (entry.skip) continue;
			let pos = entry.item.position;
			setCenterPosition(entry.clone, [pos[0] + delta[0], pos[1] + delta[1]]);
			translateCopiedConnectorGeometry(entry.clone, delta);
		}

		clearPrimitiveCache();
		syncAllVisuals();
		unselect_all();
		for (let entry of newItems) {
			if (entry.skip) continue;
			let visual = get_object(String(entry.clone.id));
			if (visual) visual.select(false);
		}
		InfoBar.update();
		History.storeUndoState();
		this.pasteCount++;
		// A cut is a move only on its first paste. Further pastes are copies and
		// therefore require unique names.
		if (this.mode === "cut") this.mode = "copy";
		return true;
	}
}
Clipboard.init();

function showDebug() {
	$("#btn_debug").show();
}

function hashUpdate() {
	if (location.hash == "#debug") {
		showDebug();
	}
}

function checkBeforeClose(event) {
  event.preventDefault()
}

// https://stackoverflow.com/questions/7083693/detect-if-page-has-finished-loading
// Initilzing without everything load = $(document).ready caused bugs. $(window).load solves this
$(window).load(function () {
	$("a").click((e) => {
		// Important to use "currentTarget" instead of "target", because sometimes
		// the <a> element is outside a <button>
		// .currentTarget will point to the <a> but .target will point to the <button>
		let url = e.currentTarget.href;
		if (environment.openLink(url)) {
			e.preventDefault();
		}
	});
	DragAndDrop.init();
	SVG.init()
	MousePan.init()
	Zoom.init()
	RectSelector.init();
	Preferences.setup();
	if (window.SystemikaRunManager) {
		SystemikaRunManager.initControls();
	}

	$(".tool-button").mousedown(function (event) {
		if ($(this).closest(".output-actions").length && window.SystemikaOutputDock) {
			event.preventDefault();
			SystemikaOutputDock.openType($(this).attr("data-tool"));
			return;
		}
		if ($(this).attr("data-action") === "toggle-question-marks") {
			event.preventDefault();
			DefinitionQuestionMarks.toggle();
			return;
		}
		let toolName = $(this).attr("data-tool");
		ToolBox.setTool(toolName, event.which);
	});

	$(window).bind('hashchange', hashUpdate);
	hashUpdate();

	if (Settings.showDebug) {
		showDebug();
	}

	$(document).keydown(function (event) {
		// Editor shortcuts apply only to the modeling workspace. Text entry in any
		// input/select/textarea/contenteditable field must remain ordinary text.
		// The toolbar Run Name field handles its own intentional Enter/Ctrl+Run
		// exceptions before the event can reach this document handler.
		let eventTarget = event.target;
		let commandModifier = (!isMac && event.ctrlKey) || (isMac && event.metaKey);
		// Find is an application-level command, so Ctrl/Cmd+F should open the
		// variable finder even when focus is in a non-dialog text field such as
		// Run Name. Other editor shortcuts remain disabled while typing.
		if (commandModifier && String(event.key || "").toLowerCase() === "f" && !jqDialog.blockingDialogOpen) {
			event.preventDefault();
			if (findVariableDialog) findVariableDialog.show();
			return;
		}
		if (commandModifier && String(event.key || "").toLowerCase() === "g" && !jqDialog.blockingDialogOpen) {
			event.preventDefault();
			findNextGhostOfSelection();
			return;
		}
		let editableTarget = eventTarget && (
			/^(INPUT|TEXTAREA|SELECT)$/.test(String(eventTarget.tagName || "").toUpperCase()) ||
			eventTarget.isContentEditable || $(eventTarget).closest("[contenteditable='true']").length
		);
		if (editableTarget) return;
		// Only works if no dialog is open
		if (jqDialog.blockingDialogOpen) {
			return;
		}
		// Each physical Shift press while a Flow endpoint is being dragged adds at
		// most one elbow.  Key-up below re-arms the gesture, so users can press
		// Shift repeatedly during the same drag to add as many elbows as needed.
		if (event.key === "Shift" && mouse.isLeftDown) {
			if (FlowTool.handleShiftKeyDown()) event.preventDefault();
		}
		if (event.key == "Delete" || event.key === "Backspace") {
		  if(get_selected_ids().length > 0)
				DeleteTool.enterTool();
		}
		// Canvas navigation shortcuts. Shift+Page Up/Down scroll horizontally by
		// roughly one visible page; Ctrl+Home returns to the canvas origin.
		if (event.shiftKey && !event.ctrlKey && !event.metaKey && (event.key === "PageUp" || event.key === "PageDown")) {
			event.preventDefault();
			let view = Zoom.view;
			let amount = Math.max(1, Math.floor(view.clientWidth * 0.9));
			view.scrollLeft += event.key === "PageDown" ? amount : -amount;
			return;
		}
		if (((!isMac && event.ctrlKey) || (isMac && event.metaKey)) && event.key === "Home") {
			event.preventDefault();
			let view = Zoom.view;
			view.scrollLeft = 0;
			view.scrollTop = 0;
			return;
		}

		let moveSize = 2;
		if (event.shiftKey) {
			moveSize = 16;
    }
		if (event.key == "ArrowLeft") {
			MouseTool.mouseMove(mouse.downX - moveSize, mouse.downY, false);
			event.preventDefault();
		}
		if (event.key == "ArrowUp") {
			MouseTool.mouseMove(mouse.downX, mouse.downY - moveSize, false);
			event.preventDefault();
		}
		if (event.key == "ArrowRight") {
			MouseTool.mouseMove(mouse.downX + moveSize, mouse.downY, false);
			event.preventDefault();
		}
		if (event.key == "ArrowDown") {
			MouseTool.mouseMove(mouse.downX, mouse.downY + moveSize, false);
			event.preventDefault();
    }
		if ((!isMac && event.ctrlKey) || (isMac && event.metaKey)) {
			// Canvas zoom, replacing the browser's own page zoom. "=" and "_" are
			// the unshifted keys that carry "+" and "-" on most layouts.
			if (event.key === "+" || event.key === "=") {
				event.preventDefault();
				Zoom.zoomIn();
				return;
			}
			if (event.key === "-" || event.key === "_") {
				event.preventDefault();
				Zoom.zoomOut();
				return;
			}
			if (event.key === "0") {
				event.preventDefault();
				ClearTool.enterTool();
				return;
			}
			if (event.key == "1" || event.key.toLowerCase() == "r") {
				event.preventDefault();
				RunTool.enterTool();
			}
			if (event.key == "2") {
				event.preventDefault();
				StepTool.enterTool();
			}
			if (event.key == "3") {
				event.preventDefault();
				FinishTool.enterTool();
			}
			if (event.key.toLowerCase() == "n") {
				event.preventDefault();
				$("#btn_new").click();
			}
			if (event.key.toLowerCase() == "o") {
				event.preventDefault();
				$("#btn_load").click();
			}
			if (event.key.toLowerCase() == "s") {
				event.preventDefault();
				if (event.shiftKey && fileManager.hasSaveAs()) $("#btn_save_as").click();
				else $("#btn_save").click();
			}
			if (event.key.toLowerCase() == "a") {
				if (RunResults.isAdvanceActive()) {
					unselect_all();
					for (let id in connection_array) {
						let item = connection_array[id];
						if (["table", "timeplot", "compareplot", "xyplot", "histoplot"].includes(item.type)) item.select();
					}
				} else {
					for (let id in object_array) { object_array[id].select(); }
					for (let id in connection_array) { connection_array[id].select(); }
				}
				refreshSelectionStacking();
			}
			if (event.key.toLowerCase() == "z") {
				UndoTool.enterTool();
      }
			if (event.key.toLowerCase() == "y") {
				RedoTool.enterTool();
			}
			if (event.key.toLowerCase() == "c") {
				event.preventDefault();
				void copySelectionWithFigureImage();
			}
			if (event.key.toLowerCase() == "x") {
				event.preventDefault();
				void cutSelectionWithFigureImage();
			}
			if (event.key.toLowerCase() == "v") {
				event.preventDefault();
				Clipboard.paste();
			}
		} else if(!isDrawingFlow) {
			let key = String(event.key || "").toLowerCase();
			{
				if (event.key === "Enter") {
					let selectedRoots = Object.values(get_selected_root_objects()).filter(Boolean);
					if (selectedRoots.length === 1) {
						let selected = selectedRoots[0];
						let primitive = findID(selected.id);
						if (primitive && ["Stock", "Flow", "Variable", "Converter"].includes(getType(primitive))) {
							event.preventDefault();
							openPrimitiveDialog(selected.id, "value");
							return;
						}
					}
				}
				if (key === "m") {
					event.preventDefault();
					ToolBox.setTool("mouse");
					return;
				}
				// Single-key creation shortcuts. L is the one contextual exception:
				// when exactly one Link is selected it opens Link Properties; otherwise
				// it starts Link creation. Dialogs/text inputs stop propagation.
				const toolShortcuts = {
					e: "equations",
					s: "stock",
					f: "flow",
					a: "variable",
					c: "constant",
					k: "converter",
					g: "ghost",
					p: "compareplot",
					t: "table",
					x: "xyplot",
					h: "histoplot",
					r: "rotatename"
				};
				if (key === "q") {
					event.preventDefault();
					DefinitionQuestionMarks.toggle();
				} else if (key === "l") {
					let selectedRoots = Object.values(get_selected_root_objects()).filter(Boolean);
					if (selectedRoots.length === 1 && selectedRoots[0].type === "link") {
						event.preventDefault();
						selectedRoots[0].doubleClick();
					} else {
						ToolBox.setTool("link");
					}
				} else if (["e", "p", "t", "x", "h"].includes(key) && window.SystemikaOutputDock) {
					event.preventDefault();
					SystemikaOutputDock.toggleType(toolShortcuts[key]);
				} else if (toolShortcuts[key]) ToolBox.setTool(toolShortcuts[key]);
				else if (key === "z") ToolBox.setTool(lastTool);
			}
		}
		environment.keyDown(event);
	});
	$(document).keyup(function (event) {
		if (event.key === "Shift") FlowTool.handleShiftKeyUp();
	});

	$(SVG.svgElement).mousedown(mouseDownHandler);
	$("#svgplanebackground").mousedown(function(event) {
		if (event.target === this) mouseDownHandler(event);
	});
	SVG.svgElement.addEventListener('contextmenu', function (event) {
		event.preventDefault();
		return false;
	}, false);
	// the mousemove and mouseup event needs to be attached to the html to allow swipping the mouse outside
	$("html").mousemove(mouseMoveHandler);
	$("html").mouseup(mouseUpHandler);
	ToolBox.setTool("mouse");
	$("#btn_file").click(async function () {
		await updateRecentsMenu();
	});
	$("#btn_new").click(function () {
		saveChangedAlert(function () {
			fileManager.newModel();
		});
	});
	$("#btn_load").click(function () {
		saveChangedAlert(function () {
			fileManager.loadModel();
		});
	});
  $("#btn_save").click(function () {
    // Why was this here?
		// History.storeUndoState();
    // The unsaved marker is cleared by markModelSaved() once the save actually
    // goes through — a cancelled save must leave it showing.
    fileManager.saveModel();
	});
	$("#btn_save_as").click(function () {
		History.storeUndoState();
		fileManager.saveModelAs();
	});
	$("#unsaved_changes").click(function () {
		showUnsavedSaveChoice();
	});
	$("#btn_import").click(function () {
		saveChangedAlert(function () {
			fileManager.importModel();
		});
	});
	$("#btn_export").click(function () {
		fileManager.exportModel();
	});
	$("#btn_recent_clear").click(function () {
		yesNoAlert("Are you sure you want to clear Recent List?", (answer) => {
			if (answer === "yes") {
				fileManager.clearRecent();
			}
		});
	});
	let openSimulationSettings = () => {
		// Simulation Settings remains available during Advance. In that state the
		// dialog locks settings that would invalidate the compiled run, but keeps
		// Advance By editable so users can change the next interactive jump.
		simulationSettings.show();
	};
	$("#btn_simulation_settings").click(openSimulationSettings);
	// A single click on the simulation status/progress control opens Simulation
	// Settings. This replaces the old double-click-only interaction, which was
	// unnecessarily difficult to discover and inconsistent with toolbar controls.
	$("#progress-bar").click(openSimulationSettings)
	$("#btn_copy").click(function () { void copySelectionWithFigureImage(); });
	$("#btn_cut").click(function () { void cutSelectionWithFigureImage(); });
	$("#btn_paste").click(function () { Clipboard.paste(); });
	$("#btn_find_variable").click(function () {
		if (findVariableDialog) findVariableDialog.show();
	});
	$("#btn_find_ghosts").click(function () {
		findNextGhostOfSelection();
	});
	updateFindGhostsButtonState();
	let closeColourPicker = () => {
		let picker = document.getElementById("toolbar-colour-picker");
		let button = document.getElementById("btn_colour");
		if (picker) picker.hidden = true;
		if (button) button.setAttribute("aria-expanded", "false");
	};
	$("#btn_colour").click(function (event) {
		event.stopPropagation();
		let picker = document.getElementById("toolbar-colour-picker");
		if (!picker) return;
		picker.hidden = !picker.hidden;
		this.setAttribute("aria-expanded", picker.hidden ? "false" : "true");
	});
	$("#toolbar-colour-picker").click(function (event) { event.stopPropagation(); });
	$(document).click(function () { closeColourPicker(); });
	$("#btn_black").click(function () {
		setColorToSelection("black");
	});
	$("#btn_grey").click(function () {
		setColorToSelection("silver");
	});
	$("#btn_red").click(function () {
		setColorToSelection("red");
	});
	$("#btn_deeppink").click(function () {
		setColorToSelection("deeppink");
	});
	$("#btn_brown").click(function () {
		setColorToSelection("brown");
	});
	$("#btn_orange").click(function () {
		setColorToSelection("orange");
	});
	$("#btn_gold").click(function () {
		setColorToSelection("gold");
	});
	$("#btn_olive").click(function () {
		setColorToSelection("olive");
	});
	$("#btn_green").click(function () {
		setColorToSelection("green");
	});
	$("#btn_teal").click(function () {
		setColorToSelection("teal");
	});
	$("#btn_blue").click(function () {
		setColorToSelection("blue");
	});
	$("#btn_purple").click(function () {
		setColorToSelection("purple");
	});
	$("#btn_magenta").click(function () {
		setColorToSelection("magenta");
	});
	$("#btn_debug").click(function () {
		debugDialog.show();
	});
	$("#btn_getting_started").click(function () {
		gettingStartedDialog.show();
	});
	$("#btn_shortcuts").click(function () {
		keyboardShortcutsDialog.show();
	});
	$("#btn_functions_help").click(function () {
		functionsAndEquationsDialog.show();
	});
	$("#btn_units_help").click(function () {
		unitsHelpDialog.show();
	});
	$("#btn_about").click(function () {
		aboutDialog.show();
	});
	$("#btn_preferences").click(function () {
		preferencesDialog.show();
	});
	$("#btn_directory").click(function () {
		directoryDialog.show();
	});
	$("#btn_browser_models").click(function () {
		browserModelsDialog.show();
	});
	$("#btn_license").click(function () {
		licenseDialog.show();
	});
	$("#btn_thirdparty").click(function () {
		thirdPartyLicensesDialog.show();
	});
	$("#btn_timeunit").click(function () {
		if (RunResults.isAdvanceActive()) {
			runOverlay.requestAdvanceTermination(
				"The current Advance simulation must be terminated before changing simulation time settings.",
				() => timeUnitDialog.show()
			);
			return;
		}
		timeUnitDialog.show();
  })
  $("#btn_check_units").click(function () {
		if (unitCheckDialog) unitCheckDialog.show();
  })
	$("#btn_zoom_in").click(function () {
		Zoom.zoomIn();
	});
	$("#btn_zoom_out").click(function () {
		Zoom.zoomOut();
	});
	$("#btn_zoom_reset").click(function () {
		Zoom.zoomReset();
	});
	$("#btn_toggle_information_links").click(function () {
		setInformationLinksVisible(!informationLinksVisible);
	});
	updateInformationLinksMenuButton();

	applyPlatformShortcutLabels();
	if (fileManager.hasSaveAs()) {
		$("#btn_save_as").show();
	}
	if (fileManager.usesBrowserStorage()) {
		// Save and Open work on browser storage here, so files are reached through
		// Import and Export instead.
		$("#btn_import").show();
		$("#btn_export").show();
	} else if (environment instanceof WebEnvironment) {
		// Files are already what Save and Open mean, so browser storage is offered
		// as a second place to keep models rather than as the default. Desktop
		// (Electron) has no use for browser storage at all — it has real files —
		// so this stays hidden there.
		$("#btn_browser_models").show();
	}
	if (fileManager.hasRecentFiles()) {
		for (let i = 0; i < Settings.MaxRecentFiles; i++) {
			$(`#btn_recent_${i}`).click(async function (event) {
				saveChangedAlert(async function () {
					let recentIndex = parseInt(event.currentTarget.getAttribute("data-recent-index"));
					await fileManager.loadRecentByIndex(recentIndex);
					setTimeout(() => {
						updateTimeUnitButton();
						InfoBar.update();
					}, 200);
				});
			});
		}
	}
	definitionEditor = new DefinitionEditor();
	converterDialog = new ConverterDialog();
	linkPropertiesDialog = new LinkPropertiesDialog();
	preferencesDialog = new PreferencesDialog();
	simulationSettings = new SimulationSettings();
	timeUnitDialog = new TimeUnitDialog();
	equationList = new EquationListDialog();
	unitCheckDialog = new UnitCheckDialog();
	debugDialog = new DebugDialog();
	aboutDialog = new AboutDialog();
	gettingStartedDialog = new GettingStartedDialog();
	findVariableDialog = new FindVariableDialog();
	keyboardShortcutsDialog = new KeyboardShortcutsDialog();
	functionsAndEquationsDialog = new FunctionsAndEquationsDialog();
	unitsHelpDialog = new UnitsHelpDialog();
	thirdPartyLicensesDialog = new ThirdPartyLicensesDialog();
	licenseDialog = new LicenseDialog();
	directoryDialog = new DirectoryDialog();
	browserModelsDialog = new BrowserModelsDialog();
	if (window.SystemikaOutputDock) {
		SystemikaOutputDock.init();
		SystemikaOutputDock.onModelSynced();
	}

	// When the program is fully loaded we create a new model
	//~ fileManager.newModel();

	environment.ready();
	fileManager.ready();
	restoreAfterRestart();
	RunResults.updateProgressBar();
	updateTimeUnitButton();

	// Establish a clean baseline for a fresh/new model. Restored models already
	// carry their savedState through History.fromLocalStorage(). Keeping an XML
	// baseline here also means the very first edit can be undone all the way
	// back to the original clean model.
	if (History.savedState == null) {
		let baseline = createModelFileData();
		if (History.undoStates.length === 0) History.forceCustomUndoState(baseline);
		else {
			History.savedState = baseline;
			History.updateUnsavedState();
		}
	} else {
		// A file loaded from disk/browser storage may not use Systemika's canonical
		// XML formatting. Normalize a genuinely clean loaded baseline once the model
		// has been parsed so later harmless clicks compare model state to model state,
		// not normalized XML text to the original file's formatting.
		if (!History.normalizeCleanBaseline()) History.updateUnsavedState();
	}
	InfoBar.init();
});

function updateTimeUnitButton() {
	if (isTimeUnitOk(getTimeUnits())) {
		$("#timeunit-value").html(getTimeUnits());
	} else {
		$("#timeunit-value").html(warningHtml("None", false));
	}
}

function find_connections(visual) {
	return find_start_connections(visual).concat(find_end_connections(visual));
}

function find_start_connections(visual) {
	let connections_array = Array(0);
	for (key in connection_array) {
		if (connection_array[key].getStartAttach && connection_array[key].getStartAttach() == visual) {
			connections_array.push(connection_array[key]);
		}
	}
	return connections_array;
}

function find_end_connections(visual) {
	let connections_array = Array(0);
	for (key in connection_array) {
		if (connection_array[key].getEndAttach && connection_array[key].getEndAttach() == visual) {
			connections_array.push(connection_array[key]);
		}
	}
	return connections_array;
}


function removePlotReferences(id) {
	for (let plotId in connection_array) {
		let visual = connection_array[plotId];
		let type = visual.type;
		if (["timeplot", "compareplot", "xyplot", "histoplot"].includes(type)
			&& window.SystemikaPlotPages && visual.primitive) {
			let changed = SystemikaPlotPages.removeReference(visual.primitive, id);
			if (changed) {
				visual.updatePageControls && visual.updatePageControls();
				visual.refreshForCurrentPage ? visual.refreshForCurrentPage() : visual.render();
			}
			continue;
		}
		if (type === "table" && visual.removePlotReference) visual.removePlotReference(id);
	}
}

function stochsd_delete_primitive_and_references(id) {
	let numboxes = primitives("Numberbox").filter(n => n.getAttribute("Target") == id);
	removePlotReferences(id);

	/** Deleting visual object */
	stochsd_delete_primitive(id);

	numboxes.map(removePrimitive);
}

function stochsd_delete_primitive(id) {
	let stochsd_object = get_object(id);
	if (stochsd_object) {
		stochsd_object.clean();
	}

	if (object_array[id]) {
		delete object_array[id];
	} else if (connection_array[id]) {
		delete connection_array[id];
	} else {
		do_global_log("primitive with id " + id + " does not exist");
	}
}

function isLocal() {
	return true; // Expose additional debugging and error messages
}

function export_txt(fileName, data) {
	// Create Blob and attach it to ObjectURL
	let blob = new Blob([data], { type: "octet/stream" }),
		url = window.URL.createObjectURL(blob);

	// Create download link and click it
	let a = document.createElement("a");
	a.style.display = "none";
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();

	// The setTimeout is a fix to make it work in Firefox
	// Without it, the objectURL is removed before the click-event is triggered
	// And the download does not work
	setTimeout(function () {
		window.URL.revokeObjectURL(url);
		a.remove();
	}, 1);
};

function export_model() {
	export_txt("a.txt", blankGraphTemplate);
}
var blankGraphTemplate = `<SystemikaModel>
<root>
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
<Display name="Default Display" Note="" Type="Time Series" xAxis="Time (%u)" yAxis="" yAxis2="" showMarkers="false" showLines="true" showArea="false" ThreeDimensional="false" Primitives="" Primitives2="" AutoAddPrimitives="false" ScatterplotOrder="X Primitive, Y Primitive" Image="Display" FlipHorizontal="false" FlipVertical="false" LabelPosition="Bottom" legendPosition="Automatic" id="43">
<mxCell style="display" parent="1" vertex="1" visible="0">
<mxGeometry x="10" y="10" width="64" height="64" as="geometry"/>
</mxCell>
</Display>
<Setting Note="" Version="36" TimeLength="100" TimeStart="0" TimeStep="0.25" AdvanceBy="1" TimeUnits="" StrictUnits="true" Units="" HiddenUIGroups="Validation,User Interface" SolutionAlgorithm="RK1" BackgroundColor="white" Throttle="-1" Macros="" SensitivityPrimitives="" SensitivityRuns="50" SensitivityBounds="50, 80, 95, 100" SensitivityShowRuns="false" article="{&quot;comments&quot;:true, &quot;facebookUID&quot;: &quot;&quot;}" StyleSheet="{}" id="2">
<mxCell parent="1" vertex="1" visible="0">
<mxGeometry x="20" y="20" width="80" height="40" as="geometry"/>
</mxCell>
</Setting>
</root>
</SystemikaModel>`;
loadXML(blankGraphTemplate);

function addMissingPrimitiveAttributes(prim) {
	// default primitive to get missing attributes
	let primitive_type = prim.value.nodeName.toLowerCase();
	let default_primitive = primitiveBank[primitive_type];
	if (default_primitive) {
		for (let attr of default_primitive.attributes) {
			// check fow missing attributes
			if (prim.getAttribute(attr.name) === null) {
				prim.setAttribute(attr.name, attr.value);
			}
		}
	} else {
		console.error(`No default primitive for ${prim.value.nodeName}`);
	}
}

// Take a primitive from the engine(tprimitve) and makes a visual object from it
function syncVisual(tprimitive) {
	let stochsd_object = get_object(tprimitive.id);
	if (stochsd_object != false) {
		return false;
	}

	addMissingPrimitiveAttributes(tprimitive);

	let nodeType = tprimitive.value.nodeName;
	switch (nodeType) {
		case "Numberbox":
			{
				let position = getCenterPosition(tprimitive);
				let visualObject = new NumberboxVisual(tprimitive.id, "numberbox", position);
				visualObject.setColor(tprimitive.getAttribute("Color"));
				visualObject.render();
			}
			break;
		case "Table":
		case "XyPlot":
		case "HistoPlot":
			{
				dimClass = null;
				switch (nodeType) {
					case "Table":
						dimClass = TableVisual;
						break;
					case "XyPlot":
						dimClass = XyPlotVisual;
						break;
					case "HistoPlot":
						dimClass = HistoPlotVisual;
						break;
				}
				let source_pos = getSourcePosition(tprimitive);
				let target_pos = getTargetPosition(tprimitive);

				let connection = new dimClass(tprimitive.id, nodeType.toLowerCase(), source_pos, target_pos);

				connection.setColor(tprimitive.getAttribute("Color"));

				// Insert correct primtives
				let primitivesString = tprimitive.getAttribute("Primitives");
				if (primitivesString !== "") {
					let idsToDisplay = primitivesString.split(",");
					connection.dialog.setIdsToDisplay(idsToDisplay);
				}

				connection.update();
				connection.render();
			}
			break;
		case "Diagram":
		case "TimePlot":
		case "ComparePlot":
			{
				dimClass = null;
				switch (nodeType) {
					case "Diagram":
					case "TimePlot":
						dimClass = TimePlotVisual;
						break;
					case "ComparePlot":
						dimClass = ComparePlotVisual;
						break;
				}
				let source_pos = getSourcePosition(tprimitive);
				let target_pos = getTargetPosition(tprimitive);

				let connection = new dimClass(tprimitive.id, nodeType.toLowerCase(), source_pos, target_pos);

				connection.setColor(tprimitive.getAttribute("Color"));

				// Insert correct primtives
				let primitivesString = tprimitive.getAttribute("Primitives");
				let idsToDisplay = primitivesString.split(",");
				let sidesString = tprimitive.getAttribute("Sides");
				if (primitivesString) {
					if (sidesString) {
						connection.dialog.setIdsToDisplay(idsToDisplay, sidesString.split(","));
					} else {
						connection.dialog.setIdsToDisplay(idsToDisplay);
					}
				}

				connection.update();
				connection.render();
			}
			break;
		case "Line":
		case "Rectangle":
		case "Ellipse":
			{
				dimClass = null;
				switch (nodeType) {
					case "Line":
						dimClass = LineVisual;
						break;
					case "Rectangle":
						dimClass = RectangleVisual;
						break;
					case "Ellipse":
						dimClass = EllipseVisual;
						break;
				}
				let source_pos = getSourcePosition(tprimitive);
				let target_pos = getTargetPosition(tprimitive);

				let connection = new dimClass(tprimitive.id, nodeType.toLowerCase(), source_pos, target_pos);

				connection.setColor(tprimitive.getAttribute("Color"));

				connection.update();
			}
			break;
		case "TextArea":
			{
				let source_pos = getSourcePosition(tprimitive);
				let target_pos = getTargetPosition(tprimitive);

				let connection = new TextAreaVisual(tprimitive.id, "text", source_pos, target_pos);

				connection.setColor(tprimitive.getAttribute("Color"));

				connection.update();
			}
			break;
		case "Stock":
			{
				let position = getCenterPosition(tprimitive);
				let visualObject = new StockVisual(tprimitive.id, "stock", position);
				set_name(tprimitive.id, tprimitive.getAttribute("name"));

				visualObject.setColor(tprimitive.getAttribute("Color"));

				visualObject.name_pos = Number(tprimitive.getAttribute("RotateName"));
				update_name_pos(tprimitive.id);
			}
			break;
		case "Converter":
			{
				let position = getCenterPosition(tprimitive);
				let visualObject = new ConverterVisual(tprimitive.id, "converter", position);
				set_name(tprimitive.id, tprimitive.getAttribute("name"));

				visualObject.setColor(tprimitive.getAttribute("Color"));

				visualObject.name_pos = Number(tprimitive.getAttribute("RotateName"));
				update_name_pos(tprimitive.id);
			}
			break;
		case "Ghost":
			{
				let source_primitive = findID(tprimitive.getAttribute("Source"));
				let source_type = source_primitive.value.nodeName;
				//~ do_global_log("id is "+tprimitive.id);
				let position = getCenterPosition(tprimitive);
				let visualObject = null;
				switch (source_type) {
					case "Converter":
						visualObject = new ConverterVisual(tprimitive.id, "converter", position, { "is_ghost": true });
						break;
					case "Variable":
						if (source_primitive.getAttribute("isConstant") == "true") {
							visualObject = new ConstantVisual(tprimitive.id, "variable", position, { "is_ghost": true });
						} else {
							visualObject = new VariableVisual(tprimitive.id, "variable", position, { "is_ghost": true });
						}
						break;
					case "Stock":
						visualObject = new StockVisual(tprimitive.id, "stock", position, { "is_ghost": true });
						break;
					case "Flow":
						visualObject = new VariableVisual(tprimitive.id, "variable", position, { "is_ghost": true });
						break;
				}
				set_name(tprimitive.id, tprimitive.getAttribute("name"));

				visualObject.setColor(tprimitive.getAttribute("Color"));

				visualObject.name_pos = Number(tprimitive.getAttribute("RotateName"));
				update_name_pos(tprimitive.id);
			}
			break;
		case "Variable":
			{
				//~ do_global_log("VARIABLE id is "+tprimitive.id);
				let position = getCenterPosition(tprimitive);
				let visualObject;
				if (tprimitive.getAttribute("isConstant") == "false") {
					visualObject = new VariableVisual(tprimitive.id, "variable", position);
				} else {
					visualObject = new ConstantVisual(tprimitive.id, "constant", position);
				}
				set_name(tprimitive.id, tprimitive.getAttribute("name"));

				visualObject.setColor(tprimitive.getAttribute("Color"));

				visualObject.name_pos = Number(tprimitive.getAttribute("RotateName"));
				update_name_pos(tprimitive.id);
			}
			break;
		case "Flow":

			let source_pos = getSourcePosition(tprimitive);
			let target_pos = getTargetPosition(tprimitive);

			let connection = new FlowVisual(tprimitive.id, "flow", source_pos, target_pos);

			connection.name_pos = Number(tprimitive.getAttribute("RotateName"));
			update_name_pos(tprimitive.id);

			connection.loadMiddlePoints();

			connection.setColor(tprimitive.getAttribute("Color"));
			connection.valveIndex = parseInt(tprimitive.getAttribute("ValveIndex"));
			connection.variableSide = (tprimitive.getAttribute("VariableSide") === "true");

			if (tprimitive.source != null) {
				// Attach to object
				connection.setStartAttach(get_object(tprimitive.source.getAttribute("id")));
			}
			if (tprimitive.target != null) {
				// Attach to object
				connection.setEndAttach(get_object(tprimitive.target.getAttribute("id")));
			}
			connection.update();

			set_name(tprimitive.id, getName(tprimitive));
			break;
		case "Link":
			{
				let source_pos = getSourcePosition(tprimitive);
				let target_pos = getTargetPosition(tprimitive);

				let connection = new LinkVisual(tprimitive.id, "link", source_pos, target_pos);

				connection.setColor(tprimitive.getAttribute("Color"));

				if (tprimitive.source != null) {
					// Attach to object
					connection.setStartAttach(get_object(tprimitive.source.getAttribute("id")));
				}
				if (tprimitive.target != null) {
					// Attach to object
					connection.setEndAttach(get_object(tprimitive.target.getAttribute("id")));
				}
				let bezierPoints = [
					tprimitive.getAttribute("b1x"),
					tprimitive.getAttribute("b1y"),
					tprimitive.getAttribute("b2x"),
					tprimitive.getAttribute("b2y")
				];

				if (bezierPoints.indexOf(null) == -1) {
					connection.setHandle1Pos([Number(bezierPoints[0]), Number(bezierPoints[1])]);
					connection.setHandle2Pos([Number(bezierPoints[2]), Number(bezierPoints[3])]);
				} else {
					// bezierPoints does not exist. Create them
					connection.resetBezierPoints();
				}
				for (let i = 0; i < 8; i++) {
					// the anchor and the handle are co-dependent
					// This means that moving the handle moves the anchor which moves the handle ... etc.
					// this continues until a stable position is reached.
					// To get around this the Link gets calculated a few times to reach a stable position.
					connection.update();
				}
			}
			break;
	}
}

// This function is important. It takes all the relevant primitives from the engine
// And make visual objects from them
// This is executed after loading a file or loading a whole new state such as after undo
function syncAllVisuals() {
	for (let type of saveblePrimitiveTypes) {
		let primitive_list = primitives(type);
		for (key in primitive_list) {
			try {
				syncVisual(primitive_list[key]);
			} catch (exception) {
				removePrimitive(primitive_list[key]);
				alert("Error while loading a corrupted model entity of type " + type + ". Removing it to avoid propagated errors.");
				//~ alert("Error while loading corrupted primitive of type "+type+". Removing corrupted primitive to avoid propagated errors. \n\nError happened at: "+exception.stack);
				throw exception;
			}
		}
	}
	// Invalid half-connected Links are never part of a valid Systemika model.
	// Remove any such legacy/corrupted records after loading or Undo restore so
	// they cannot poison selection, Delete, or subsequent history operations.
	cleanUnconnectedLinks();
	update_all_objects();
	unselect_all();
	if (window.SystemikaOutputDock && document.getElementById("systemika-output-panel")) SystemikaOutputDock.onModelSynced();
}

function findFreeName(basename) {
	let counter = 0;
	let testname;
	do {
		counter++;
		testname = basename + counter.toString();
	} while (findName(testname) != null)
	return testname;
}

syncAllVisuals();

class SubscribePool {
	constructor() {
		this.subscribers = [];
	}
	subscribe(handler) {
		this.subscribers.push(handler);
	}
	publish(message) {
		for (let i in this.subscribers) {
			this.subscribers[i](message);
		}
	}
}

class runOverlay {
	static init() {
		this.promptOpen = false;
		$(document).ready(() => {
			$("#svgBlockOverlay").mousedown(() => {
				$("#svgBlockOverlay").css("opacity", 0.5);
				yesNoAlert("Do you want to terminate the simulation now to change the model?", function (answer) {
					$("#svgBlockOverlay").css("opacity", 0);
					if (answer == "yes") RunResults.resetSimulation();
				});
			});
		});
	}

	// Ask once before a state-changing action while an Advance simulation is
	// paused. Read-only result exploration never calls this function.
	static requestAdvanceTermination(message, afterTerminate) {
		if (!RunResults.isAdvanceActive()) {
			if (afterTerminate) afterTerminate();
			return false;
		}
		if (this.promptOpen) return true;
		this.promptOpen = true;
		yesNoAlert(message || "The active Advance simulation must end before its compiled model structure can be changed.", (answer) => {
			this.promptOpen = false;
			if (answer === "yes") {
				RunResults.stopSimulation();
				if (afterTerminate) afterTerminate();
			}
		});
		return true;
	}


	static requestAdvanceFinish(message, afterFinish) {
		if (!RunResults.isAdvanceActive()) {
			if (afterFinish) afterFinish();
			return false;
		}
		if (this.promptOpen) return true;
		this.promptOpen = true;
		yesNoAlert(message || "Finish the active Advance simulation before applying this change?", (answer) => {
			this.promptOpen = false;
			if (answer === "yes") RunResults.finishAdvanceSimulation(afterFinish);
		});
		return true;
	}

	static clearModelEditShield() {
		let shield = document.getElementById("simulationModelEditShield");
		if (shield) shield.remove();
		if (SVG.anchorLayer) SVG.anchorLayer.style.pointerEvents = "";
	}

	// Advance mode is intentionally different from a continuously running
	// simulation. A transparent SVG shield sits above model primitives but
	// below the plot/table layer contents. This protects the simulation state
	// while leaving plots, tables, their scrollbars and dialogs interactive.
	static blockModelEditing() {
		unselect_all();
		$("#svgBlockOverlay").hide();
		this.clearModelEditShield();
		// Keep ordinary mouse interaction and primitive property dialogs available
		// during Advance. Structural creation/deletion tools are guarded separately
		// by ToolBox. Anchors stay disabled because reconnecting flow/link endpoints
		// would alter the compiled simulation topology mid-run.
		if (SVG.anchorLayer) SVG.anchorLayer.style.pointerEvents = "none";
	}

	static block() {
		unselect_all();
		this.clearModelEditShield();
		$("#svgBlockOverlay").show();
	}
	static unblock() {
		$("#svgBlockOverlay").hide();
		this.clearModelEditShield();
	}
}
runOverlay.init();

// Not yet implemented
function setColorToSelection(color) {
	let picker = typeof document !== "undefined" ? document.getElementById("toolbar-colour-picker") : null;
	let colourButton = typeof document !== "undefined" ? document.getElementById("btn_colour") : null;
	if (picker) picker.hidden = true;
	if (colourButton) colourButton.setAttribute("aria-expanded", "false");
	let objects = get_selected_objects();
	for (let id in objects) {
		let obj = get_object(id);
		get_parent(obj).setColor(color);
	}
	History.storeUndoState();
}

function printDiagram() {
	unselect_all();
	InfoBar.update();
	// Write filename and date into editor-footer
	let fileName = fileManager.fileName;

	let d = new Date();
	let month = d.getMonth() + 1 < 10 ? `0${d.getMonth() + 1}` : d.getMonth() + 1;
	let day = d.getDate() < 10 ? `0${d.getDate()}` : d.getDate();
	let hours = d.getHours() < 10 ? `0${d.getHours()}` : d.getHours();
	let minutes = d.getMinutes() < 10 ? `0${d.getMinutes()}` : `${d.getMinutes()}`;
	let fullDate = `${d.getFullYear().toString()}-${month}-${day} ${hours}:${minutes} (yyyy-mm-dd hh:mm)`;

	$(".editor-footer").css("display", "block");
	if (fileName.length > 0) {
		$(".editor-footer-filepath").html(fileName);
	} else {
		$(".editor-footer-filepath").html("Unnamed file");
	}

	$(".editor-footer-date").html(fullDate);

	hideAndPrint([$("#topPanel").get(0)]);
	$(".editor-footer").css("display", "none");
}

function removeNewLines(string) {
	let newString = string;
	newString = newString.replace(/\\n/g, " ");
	return newString;
}

function seperateFolderAndFilename(file_path) {
	let seperator = "\\";
	if (file_path.includes("/")) {
		seperator = "/";
	}
	let segments = file_path.split(seperator);
	let path = "";
	for (let i = 0; i < segments.length - 1; i++) {
		path += segments[i] + seperator;
	}
	return { "path": path, "name": segments[segments.length - 1] };
}

async function updateRecentsMenu() {
	if (!fileManager.hasRecentFiles()) {
		return;
	}
	let recent = await fileManager.getRecentDisplayList();
	if (recent.length > 0) {
		$('#recent_title').show();
		$('#btn_recent_clear').show();
	} else {
		$('#recent_title').hide();
		$('#btn_recent_clear').hide();
	}
	for (let i = 0; i < Settings.MaxRecentFiles; i++) {
		if (i < recent.length) {
			$(`#btn_recent_${i}`).show();
			let file = seperateFolderAndFilename(recent[i]);
			$(`#btn_recent_${i}`).html(`<span class="recent-path">${file.path}</span><span class="recent-name">${file.name}</span>`);
			$(`#btn_recent_${i}`).attr("data-recent-index", i.toString());
		} else {
			$(`#btn_recent_${i}`).hide();
		}
	}
}

// Central output-device actions used by Clear, Reset, Finish and the Runs
// manager. Clearing affects only rendered plot/table contents; it does not
// delete display objects, run selections, or saved .sysrun files.
const SystemikaOutputDevices = {
	clearAll() {
		let seen = new Set();
		for (let collection of [object_array, connection_array]) {
			for (let key in (collection || {})) {
				let visual = collection[key];
				if (!visual || seen.has(visual)) continue;
				seen.add(visual);
				if (typeof TableVisual !== "undefined" && visual instanceof TableVisual) {
					if (visual.data) visual.data.results = [];
					visual.updateHTML(`<div class="empty-plot-header">Table</div><div style="padding:8px;">No displayed results.</div>`);
				} else if (typeof PlotVisual !== "undefined" && visual instanceof PlotVisual) {
					if (typeof visual.setEmptyPlot === "function") visual.setEmptyPlot();
				}
			}
		}
	},
	refreshAll() {
		if (typeof RunResults !== "undefined") RunResults.triggerRunFinished();
	}
};
if (typeof window !== "undefined") window.SystemikaOutputDevices = SystemikaOutputDevices;

class RunResults {
	/** @type {"none" | "running" | "stopped" | "stepping" | "paused"} */
	static runState;

	/**
	 * When true, the model is run without validating/converting units,
	 * instead of raising an error whenever a computed value's units
	 * don't match a primitive's declared units. Toggle with
	 * RunResults.setIgnoreUnits(true/false).
	 * @type {boolean}
	 */
	static ignoreUnits = false;

  static setIgnoreUnits(value) {
    if (!!value) console.warn("Ignoring units!")
    else console.info("Units matter again!")
		this.ignoreUnits = !!value;
	}

	static init() {
		this.runState = "none";
		// Is always null if simulation is not running
		// Is a data structure returned from runModel if simulation is running it
		this.simulationController = null;
		this.varnameList = [];
		this.varIdList = [];
		this.results = [];
		this.runSubscribers = {};
		this.updateFrequency = 100;
		this.updateCounter = 0; // Updates everytime updateCounter goes down to zero
		this.simulationTime = 0;
		this.systemikaRunDecision = null;
		this.systemikaAdvanceDecision = null;
		this.lastSimulationStochastic = false;
		this.lastSimulationRandomSeed = null;
		this.advanceActive = false;
		this.advanceFinishRequested = false;
		this.advanceDisplaySelectionSnapshot = null;
		this.advanceAfterFinish = null;
	}
	static isAdvanceActive() {
		return Boolean(this.advanceActive);
	}
	static createHeader() {
		// Get list of primitives that we want to observe from the model
		let primitive_array = getPrimitiveList();

		// Create list of ids, id0 is reserved for time
		this.varIdList = [0].concat(getID(primitive_array)).map(Number);

		// Create list of names
		this.varnameList = ["Time"].concat(getName(primitive_array));

		// Reset results
		this.results = [];
	}
	static toCsv() {
		// Under development
		let out = "";

		//~ let namesToDisplay = IdsToDisplay.map(findID).map(getName);
		let first = true;
		out += "Time"
		for (let id of this.varIdList) {
			let primitive = findID(id);
			if (primitive) {
				out += "," + getName(primitive);
			}
		}
		out += "\n";

		for (let row_index in this.results) {
			//~ for(let column_index in ["Time"].concat(namesToDisplay)) {
			first = true;
			for (let column_index in this.varIdList) {
				if (first) {
					out += stocsd_format(this.results[row_index][column_index], 6);
					first = false;
				} else {
					out += "," + stocsd_format(this.results[row_index][column_index], 6);
				}
			}
			out += "\n";
		}
		return out;
	}
	static storeResults(res) {
		// This method is executed after the simulation is finished
		// res is the result of the simulation
		let index = this.results.length;
		while (index < res.periods) {
			let time = res.times[index];
			this.simulationTime = res.times[index];
			let currentRunResults = [];
			currentRunResults.push(time);
			for (let key in this.varIdList) {
				if (key == 0) {
					// On location 0 we always have time
					continue;
				}
				//~ do_global_log(JSON.stringify(res));
				let value = res.value(findID(this.varIdList[key]))[index];
				currentRunResults.push(value);
			}
			this.push(currentRunResults);
			index++;
		}
		//~ this.triggerRunFinished();
	}
	static removeResultsForId(id) {
		let index = this.varIdList.indexOf(parseInt(id));
		if (index !== -1) {
			// remove id
			this.varIdList.splice(index, 1);


			// remove name
			this.varnameList.splice(index, 1);

			// remove data
			this.results.map(row => {
				row.splice(index, 1);
			});
		}
	}
	static runPauseSimulation() {
		switch (this.runState) {
			case "running":
				this.pauseSimulation();
				break;
			case "paused":
				this.resumeSimulation();
				break;
			default:
				this.runSimulation();
		}
	}
	static resumeSimulation() {
		$("#imgRunPauseTool").attr("src", "graphics/pause.svg");
		this.runState = "running";
		// Simulation controller can only be null if the first pause event has never triggered
		// In such a case it is enought to just change this.runState, otherwise we also have to trigger the controllers resume() function.
		if (this.simulationController != null) {

			this.simulationController.resume();
			// We have a bug that happens some times on resume because simulationController is null
			// Find out when it happens
			//~ console.error(getStackTrace());
		}
	}
	static runSimulation() {
		this.simulationDone = false;
		this.stopSimulation();
		if (window.systemikaSimulationData) systemikaSimulationData.clear();
		$("#imgRunPauseTool").attr("src", "graphics/pause.svg");
		this.createHeader();
		if (getTimeLength() / getTimeStep() < 1000) {
			setPauseInterval(getTimeLength() / 10);
		} else {
			// We can only take 1000 iterations between every update to avoid the feeling of program freezing
			setPauseInterval(getTimeStep() * 1000);
		}
		this.runState = "running";
    runOverlay.block();
		this.simulationController = SystemikaEngine.runCurrentModel({
			rate: -1,
			ignoreUnits: this.ignoreUnits,
			onPause: (res) => {
				// We always need to do this, even if we paused the simulation, otherwise we cannot unpause
				// Here is the only place we can get a handle to the simulationController
				this.simulationController = res;

				// If still running continue with next cycle
				if (this.runState == "running") {
					this.updateProgressBar();
					this.setProgressStatus(false);
					do_global_log("length " + this.results.length)
					if (this.simulationController == null) {
						do_global_log("simulation controller is null")
					}
					this.continueRunSimulation()
				}
			},
			onSuccess: (res) => {
				// Run finished

				// On especially longer simulation onSuccess is called multible times
				// This is a hack to get around that
				if (this.simulationDone === false) {
					this.simulationDone = true;
					this.lastSimulationStochastic = Boolean(res && res.stochastic);
					this.lastSimulationRandomSeed = res && res.randomSeed != null ? res.randomSeed : null;
					// In some cases onPause was never executed and in such cases we need to do store Result directly on res
					this.storeResults(res);
					this.updateProgressBar();
					this.setProgressStatus(true);

					// Capture before notifying plots/tables so the central data manager and
					// the legacy RunResults view describe the same completed run. Saving is
					// asynchronous and compressed in the Electron main process.
					let runDecision = this.systemikaRunDecision;
					this.systemikaRunDecision = null;
					let savePromise = null;
					if (window.SystemikaRunManager && runDecision) {
						try {
							savePromise = SystemikaRunManager.commitUserRun(runDecision);
						} catch (error) {
							console.error(error);
						}
					}

					this.triggerRunFinished();
					this.stopSimulation();

					if (savePromise) {
						savePromise.catch((error) => {
							console.error(error);
							xAlert(`The simulation completed, but Systemika could not save the run file.<br/><br/>${error.message || error}`);
						});
					}
				} else {
					console.log("Extra onSuccess call from IM-engine");
				}
			},
			onError: (res) => {
				if (res && res.error) xAlert(`Simulation error:<br/><br/>${htmlEscape(res.error)}`);
				do_global_log("onError stop simulation");
				this.systemikaRunDecision = null;
				this.stopSimulation();
			}
		});
	}
	static continueRunSimulation() {
		this.storeResults(this.simulationController);
		if (this.updateCounter == 0) {
			this.updateCounter = this.updateFrequency;
		}
		this.updateCounter -= 1;
		this.simulationController.resume();
	}
	static stepSimulation() {
		// If Advance is already active, one click advances by the CURRENT Advance
		// By setting. The engine itself pauses at one-time-unit checkpoints; we
		// automatically pass intermediate checkpoints until this target is reached.
		// This makes Advance By safely editable while a run is paused.
		if (this.advanceActive) {
			if (this.simulationController != null) {
				let advanceBy = (typeof getAdvanceBy === "function") ? getAdvanceBy() : 1;
				let endTime = Number(getTimeStart()) + Number(getTimeLength());
				this.advanceTargetTime = Math.min(endTime, Number(this.simulationTime) + Number(advanceBy));
				this.simulationController.resume();
			}
			return;
		}
		// Else start a new stepped simulation.
		this.stopSimulation();
		this.advanceActive = true;
		this.advanceFinishRequested = false;
		$("#btn_finish").prop("disabled", false);
		if (window.systemikaSimulationData) systemikaSimulationData.clear();
		this.createHeader();
		// Use stable one-time-unit engine checkpoints. Advance By is implemented
		// above these checkpoints so users can change it between Advance clicks
		// without restarting or recompiling the active simulation.
		setPauseInterval(1);
		this.advanceTargetTime = Math.min(
			Number(getTimeStart()) + Number(getTimeLength()),
			Number(getTimeStart()) + Number((typeof getAdvanceBy === "function") ? getAdvanceBy() : 1)
		);
		// Remember exactly what every output device was showing before Advance
		// temporarily selects the stepped run. Reset restores this snapshot.
		this.advanceDisplaySelectionSnapshot = (window.SystemikaDisplayRuns && typeof window.SystemikaDisplayRuns.captureSelections === "function")
			? window.SystemikaDisplayRuns.captureSelections()
			: null;
		// A newly started Advance run should become the active display source in
		// the same way as an ordinary Run. This ensures existing plots/tables and
		// newly created comparison displays default to the stepped run label
		// (Base, Run 1, ...) rather than remaining on an older saved run. The
		// actual partial data is pushed into the live run store on every pause.
		if (window.SystemikaRunManager && window.SystemikaDisplayRuns && typeof window.SystemikaDisplayRuns.selectNewRun === "function") {
			let advanceRunName = SystemikaRunManager.getRunName();
			if (advanceRunName) {
				// Register a zero-row live run before changing display selections. The
				// run-list UI refreshes immediately when the selection changes; without
				// this placeholder it can mistake the new Advance label for a deleted
				// run and prune it before the first pause produces data.
				SystemikaRunManager.captureLiveRun(advanceRunName, true);
				window.SystemikaDisplayRuns.selectNewRun(advanceRunName);
			}
		}
		runOverlay.blockModelEditing();
		this.simulationController = SystemikaEngine.runCurrentModel({
			ignoreUnits: this.ignoreUnits,
			onPause: (res) => {
				this.simulationDone = false;
				this.storeResults(res);
				this.updateProgressBar();
				this.setProgressStatus(false);
				// Keep the central run store synchronized with partial stepping data
				// before notifying plots/tables. This makes every Advance click visible
				// immediately while keeping disk persistence reserved for completed runs.
				if (window.SystemikaRunManager) SystemikaRunManager.captureLiveRun();
				this.triggerRunFinished();
				this.simulationController = res;
				if (this.advanceFinishRequested && res && typeof res.resume === "function") {
					res.resume();
				} else if (res && typeof res.resume === "function" && Number(this.simulationTime) + 1e-10 < Number(this.advanceTargetTime)) {
					// Continue through internal one-unit checkpoints until the user-requested
					// Advance By target has been reached. Plots/tables still refresh at each
					// checkpoint, keeping the interactive trajectory observable.
					res.resume();
				}
			},
			onSuccess: (res) => {
				this.simulationDone = true;
				this.advanceActive = false;
				this.advanceFinishRequested = false;
				$("#btn_finish").prop("disabled", true);
				runOverlay.unblock();
				this.storeResults(res);
				this.updateProgressBar();
				this.setProgressStatus(true);
				let decision = this.systemikaAdvanceDecision;
				this.systemikaAdvanceDecision = null;
				// Completion makes the Advance run a real run, so keep its automatic
				// selection and discard the pre-Advance restoration snapshot.
				this.advanceDisplaySelectionSnapshot = null;
				let savePromise = null;
				if (window.SystemikaRunManager && decision) {
					savePromise = SystemikaRunManager.commitUserRun(decision);
				} else if (window.SystemikaRunManager) {
					SystemikaRunManager.captureLiveRun();
				}
				this.triggerRunFinished();
				let afterFinish = this.advanceAfterFinish;
				this.advanceAfterFinish = null;
				if (typeof afterFinish === "function") setTimeout(() => afterFinish(), 0);
				if (savePromise) savePromise.catch(error => {
					console.error(error);
					xAlert(`The Advance simulation completed, but Systemika could not save the run file.<br/><br/>${htmlEscape(error.message || String(error))}`);
				});
			},
			onError: (res) => {
				if (res && res.error) xAlert(`Simulation error:<br/><br/>${htmlEscape(res.error)}`);
				this.systemikaAdvanceDecision = null;
				if (this.advanceDisplaySelectionSnapshot && window.SystemikaDisplayRuns && typeof window.SystemikaDisplayRuns.restoreSelections === "function") {
					window.SystemikaDisplayRuns.restoreSelections(this.advanceDisplaySelectionSnapshot, window.SystemikaRunManager ? SystemikaRunManager.getRunName() : "");
				}
				this.advanceDisplaySelectionSnapshot = null;
				this.stopSimulation();
			}
		});
	}
	static setProgressStatus(done) {
		done
			? $("#progress-bar").attr("data-done", "")
			: $("#progress-bar").removeAttr("data-done")
	}
	static updateProgressLength() {
		// Completion callbacks are authoritative. In particular, Advance to End can
		// reach onSuccess before the final sampled row has propagated through every
		// display helper, so do not let a stale last-row time leave the green bar
		// visibly short of 100%.
		let progress = this.simulationDone ? 1 : clampValue(this.getRunProgressFraction(), 0, 1);
		$("#progress-bar")[0].style.setProperty("--progress", `${100 * progress}%`)
	}
	static updateProgressText() {
		let number_options = { precision: 3 };
		let currentProgress = this.simulationDone ? this.getRunProgressMax() : this.getRunProgress();
		let currentTime = format_number(currentProgress, number_options);
		let startTime = format_number(this.getRunProgressMin(), number_options);
		let endTime = format_number(this.getRunProgressMax(), number_options);
		let timeStep = this.getTimeStep();
		let alg_str = getAlgorithm() === "RK1" ? "Euler" : "RK4";
		$("#progress-bar-text").html(`${startTime} / ${currentTime} / ${endTime} </br> ${alg_str}(DT = ${timeStep})`);
	}
	static updateProgressBar() {
		this.updateProgressLength()
		this.updateProgressText()
	}
	static pauseSimulation() {
		this.runState = "paused";
		$("#imgRunPauseTool").attr("src", "graphics/run.svg");
	}
	static resetSimulation() {
		this.simulationDone = false;
		// Reset discards only the unfinished Advance trajectory. Other saved runs
		// selected in Compare Plots/Tables must remain visible. If this Advance
		// was going to overwrite an existing saved run, restore that saved package
		// after discarding the transient in-memory version.
		let wasAdvance = Boolean(this.advanceActive || this.systemikaAdvanceDecision);
		let decision = this.systemikaAdvanceDecision;
		let current = window.systemikaSimulationData ? systemikaSimulationData.getCurrentRun() : null;
		let currentRunName = String((current && current.runName) || (decision && decision.runName) || "").trim();
		let restoreSavedRun = Boolean(decision && decision.persist && decision.overwrite && currentRunName);
		let displaySelectionSnapshot = this.advanceDisplaySelectionSnapshot;
		this.advanceDisplaySelectionSnapshot = null;
		this.systemikaAdvanceDecision = null;
		this.stopSimulation();
		if (window.systemikaSimulationData) {
			if (typeof systemikaSimulationData.discardCurrentRun === "function") systemikaSimulationData.discardCurrentRun();
			else systemikaSimulationData.clear();
		}
		this.createHeader();
		this.updateProgressBar();

		// Outside Advance (for example model load/new-model initialization), keep
		// the traditional reset behavior. The selective run cleanup below is only
		// for an unfinished stepped trajectory.
		if (!wasAdvance) {
			SystemikaOutputDevices.clearAll();
			return;
		}

		// Restore the exact pre-Advance selections first. This is essential for
		// ordinary plots, whose single RunName was temporarily replaced by the
		// Advance label when stepping began.
		if (displaySelectionSnapshot && window.SystemikaDisplayRuns && typeof window.SystemikaDisplayRuns.restoreSelections === "function") {
			window.SystemikaDisplayRuns.restoreSelections(displaySelectionSnapshot, currentRunName);
		} else if (currentRunName) {
			// Compatibility fallback for sessions created before selection snapshots.
			removeRunFromDisplaySelections(currentRunName);
		}

		let refresh = () => SystemikaOutputDevices.refreshAll();
		if (restoreSavedRun && window.systemikaSimulationData && systemikaSimulationData.persistenceAvailable()) {
			// Keep the label selected because a valid saved run with that label still
			// exists. Reload it so displays immediately fall back to the pre-Advance
			// data rather than the discarded partial trajectory.
			systemikaSimulationData.ensureRunLoaded(currentRunName)
				.then(refresh)
				.catch((error) => {
					console.error(error);
					removeRunFromDisplaySelections(currentRunName);
					refresh();
				});
		} else {
			refresh();
		}
	}
	static finishAdvanceSimulation(afterFinish = null) {
		if (!this.advanceActive) {
			if (typeof afterFinish === "function") afterFinish();
			return;
		}
		if (typeof afterFinish === "function") this.advanceAfterFinish = afterFinish;
		this.advanceFinishRequested = true;
		if (this.simulationController && typeof this.simulationController.resume === "function") {
			this.simulationController.resume();
		}
	}
	static syncAdvanceHeader(snapshot = null) {
		let primitiveArray = getPrimitiveList();
		let newIds = getID(primitiveArray).map(Number);
		let oldIds = this.varIdList.slice(1).map(Number);
		let oldIndex = new Map(oldIds.map((id, index) => [id, index + 1]));
		this.results = this.results.map(row => {
			let next = [row[0]];
			for (let id of newIds) next.push(oldIndex.has(id) ? row[oldIndex.get(id)] : null);
			return next;
		});
		this.varIdList = [0].concat(newIds);
		this.varnameList = ["Time"].concat(getName(primitiveArray));

		// The engine refreshes the current-time sample after recompilation. Mirror
		// that sample into the legacy RunResults matrix so new variables and changed
		// formulations become visible immediately in plots/tables.
		if (snapshot && this.results.length && snapshot.periods) {
			let rowIndex = this.results.length - 1;
			for (let column = 1; column < this.varIdList.length; column++) {
				let primitive = findID(this.varIdList[column]);
				if (!primitive) continue;
				let values = snapshot.value(primitive);
				if (values && values.length > rowIndex) this.results[rowIndex][column] = values[rowIndex];
			}
		}
	}

	static recompileAdvanceModel() {
		if (!this.advanceActive) return { applied: false, reason: "not-advance" };
		if (!this.simulationController || typeof this.simulationController.recompileCurrentModel !== "function") {
			return { applied: false, reason: "controller-unavailable" };
		}
		try {
			let snapshot = this.simulationController.recompileCurrentModel();
			if (snapshot) this.simulationController = snapshot;
			this.syncAdvanceHeader(snapshot);
			if (window.SystemikaRunManager) SystemikaRunManager.captureLiveRun();
			this.triggerRunFinished();
			return { applied: true, snapshot };
		} catch (error) {
			return { applied: false, reason: "runtime-error", error };
		}
	}

	static applyAdvanceParameterChange(primitive, value) {
		if (!this.advanceActive) return { applied: false, reason: "not-advance" };
		if (!this.simulationController || typeof this.simulationController.setValue !== "function") {
			return { applied: false, reason: "controller-unavailable" };
		}
		try {
			this.simulationController.setValue(primitive, value);
			return { applied: true };
		} catch (error) {
			return { applied: false, reason: "runtime-error", error };
		}
	}
	static stopSimulation() {
		this.advanceActive = false;
		this.advanceFinishRequested = false;
		this.advanceAfterFinish = null;
		runOverlay.unblock();
		if (this.simulationController && typeof this.simulationController.terminate === "function") {
			this.simulationController.terminate();
		}
		this.runState = "stopped";
		this.simulationController = null;
		$("#imgRunPauseTool").attr("src", "graphics/run.svg");
		$("#btn_finish").prop("disabled", true);
		this.updateCounter = 0;
	}
	static subscribeRun(id, handler) {
		this.runSubscribers[id] = handler;
	}
	static push(newRow) {
		this.results.push(newRow);
	}
	static getResults(runName) {
		let storedRun = window.systemikaSimulationData ? systemikaSimulationData.getRun(runName) : null;
		return storedRun ? storedRun.rows : this.results;
	}
	static getLastValue(primitiveId) {
		let lastRow = this.getLastRow();
		if (lastRow == null) {
			//~ alert("early return");
			return null;
		}
		let storedRun = window.systemikaSimulationData ? systemikaSimulationData.getCurrentRun() : null;
		let ids = storedRun && storedRun.ids && storedRun.ids.length ? storedRun.ids : this.varIdList;
		let varIdIndex = ids.indexOf(Number(primitiveId));
		return varIdIndex === -1 ? null : lastRow[varIdIndex];
	}
	static getTimeStep(runName) {
		if (window.systemikaSimulationData) {
			let storedStep = systemikaSimulationData.getRunTimeStep(runName);
			if (storedStep != null && Number.isFinite(Number(storedStep))) return Number(storedStep);
		}
		if (primitives("Setting")[0]) {
			return primitives("Setting")[0].getAttribute("TimeStep");
		} else if (this.results && 1 < this.results.length) {
			return `${this.results[1][0] - this.results[0][0]}`;
		}
		return "0";
	}
	static getDataTimeStart(runName) {
		if (window.systemikaSimulationData) {
			let value = systemikaSimulationData.getRunTimeStart(runName);
			if (value != null && Number.isFinite(Number(value))) return Number(value);
		}
		return getTimeStart();
	}
	static getDataTimeLength(runName) {
		if (window.systemikaSimulationData) {
			let value = systemikaSimulationData.getRunTimeLength(runName);
			if (value != null && Number.isFinite(Number(value))) return Number(value);
		}
		return getTimeLength();
	}
	static getDataTimeUnits(runName) {
		if (window.systemikaSimulationData) {
			let value = systemikaSimulationData.getRunTimeUnits(runName);
			if (value != null) return value;
		}
		return getTimeUnits();
	}
	static getRunProgress() {
		let lastRow = this.getLastRow();
		// If we have no last row return null
		if (lastRow == null && primitives("Setting")[0]) {
			return parseFloat(primitives("Setting")[0].getAttribute("TimeStart"));
		}
		// else return time
		return lastRow[0];
	}
	static getRunProgressFraction() {
		return (this.getRunProgress() - this.getRunProgressMin()) / (this.getRunProgressMax() - this.getRunProgressMin());
	}
	static getRunProgressMax() {
		return getTimeStart() + getTimeLength()
	}
	static getRunProgressMin() {
		return getTimeStart();
	}
	static getLastRow() {
		let rows = this.getResults();
		if (rows.length != 0) {
			return rows[rows.length - 1];
		} else {
			return null;
		}
	}
	static getSelectiveIdResults(varIdList, runName) {
		if (window.systemikaSimulationData) {
			let storedResults = systemikaSimulationData.getSelectiveIdResults(varIdList, runName);
			if (storedResults) return storedResults;
			// A named saved run must never silently fall back to the latest live
			// simulation while it is still loading or if it cannot be found.
			if (runName) return [];
		}

		// Make sure the varIdList stored as numbers and not strings
		varIdList = varIdList.map(Number);

		// Contains the indexes from this.results that we want to return
		let selectedVarIdIndexes = [0]; // The first index is always 0 for time
		for (let i in varIdList) {
			let varIdIndex = this.varIdList.indexOf(varIdList[i]);
			selectedVarIdIndexes.push(varIdIndex);
		}
		do_global_log("this.varIdList " + JSON.stringify(this.varIdList) + " varIdList " + JSON.stringify(varIdList));
		let returnResults = [];
		for (let row_index in this.results) {
			let tmpRow = [];
			for (let column_index in selectedVarIdIndexes) {
				let wantedIndex = selectedVarIdIndexes[column_index];
				if (wantedIndex != -1) {
					tmpRow.push(this.results[row_index][wantedIndex]);
				} else {
					tmpRow.push(null);
				}
			}
			returnResults.push(tmpRow);
		}
		return returnResults;
	}
	static getFilteredSelectiveIdResults(varIdList, start, length, step, runName) {
		let unfilteredResults = this.getSelectiveIdResults(varIdList, runName);
		let filteredResults = [];
		let printInterval = step / this.getTimeStep(runName);
		let printCounter = 1;

		for (let row_index in unfilteredResults) {
			let time = unfilteredResults[row_index][0];
			if (time < start) {
				continue;
			}
			if (time == start) {
				printCounter = printInterval;
			}
			if (time > start + length) {
				// End of loop
				return filteredResults;
			}
			if (printCounter < printInterval) {
				printCounter++;
				continue;
			} else {
				printCounter = 1;
			}
			filteredResults.push(unfilteredResults[row_index]);
		}
		// Make sure last value is added
		if (filteredResults.length !== 0 && unfilteredResults.length !== 0) {
			if (filteredResults[filteredResults.length - 1][0] !== unfilteredResults[unfilteredResults.length - 1][0]) {
				filteredResults.push(unfilteredResults[unfilteredResults.length - 1]);
			}
		}
		return filteredResults;
	}
	static triggerRunFinished() {
		for (let id in this.runSubscribers) {
			if (findID(id)) {
				this.runSubscribers[id]();
			} else {
				delete this.runSubscribers[id];
			}
		}
	}
}
RunResults.init();

class jqDialog {
	static init() {
		// This is a static attribute that prevents delete key etc to be relevant when a dialog is open
		jqDialog.blockingDialogOpen = false;
	}
	constructor(title = null, contentHTML = null, size = null) {
		this.dialog = null;

		this.contentHTML = "Empty dialog";
		this.title = "Title";
		this.size = [600, 400];

		if (contentHTML) {
			this.contentHTML = contentHTML;
		}
		if (title) {
			this.title = title;
		}
		if (size) {
			this.size = size;
		}

		this.visible = false;
		// Decides if we this dialog should lock the background
		this.modal = true;
		let frm_dialog_resize = true;

		this.dialogDiv = document.createElement("div");
		this.dialogDiv.setAttribute("title", this.title);
		this.dialogDiv.setAttribute("style", "font-size: 13px; display: inline-block");
		this.dialogDiv.style.display = "none";

		this.dialogContent = document.createElement("div");
		this.dialogContent.innerHTML = this.contentHTML;

		this.dialogDiv.appendChild(this.dialogContent);
		document.body.appendChild(this.dialogDiv);

		// Escape closes Systemika dialogs even when focus is inside a text field
		// whose own keyboard handler stops propagation (for example Manage Runs).
		this.dialogDiv.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && this.visible) {
				event.preventDefault();
				event.stopPropagation();
				$(this.dialog).dialog("close");
				return;
			}
			// Enter is the consistent keyboard equivalent of the Apply button.
			// Shift+Enter is reserved for inserting a line break in multiline editors.
			// Capture phase makes this work inside CodeMirror and other controls that may
			// otherwise consume Enter. When CodeMirror autocomplete is open, plain Enter
			// is left to the completion widget so the highlighted suggestion can be chosen.
			let autocompleteOpen = document.querySelector(".CodeMirror-hints") !== null;
			if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !autocompleteOpen && this.visible &&
				this.dialogParameters && this.dialogParameters.buttons && typeof this.dialogParameters.buttons["Apply"] === "function") {
				event.preventDefault();
				event.stopPropagation();
				this.applyChanges();
			}
		}, true);

		this.dialogContent.setAttribute("style", "display: inline-block");


		this.dialogParameters = {
			autoOpen: false,
			modal: this.modal, // Adds overlay on background
			resizable: false,
			resize: (event, ui) => {
				this.resize(event, ui);
			},
			resizeStart: (event, ui) => {
				this.resizeStart(event, ui);
			},
			resizeStop: (event, ui) => {
				this.resizeStop(event, ui);
			},
			position: {
				my: "center",
				at: "center",
				of: window
			},
			beforeClose: () => {
				this.beforeClose();
			},
			close: () => {
				this.visible = false;
				jqDialog.blockingDialogOpen = false;
				this.afterClose();
			},
			width: this.size[0],
			height: this.size[1],
			open: (event, ui) => {
				if (this.dialogParameters.modal) {
					jqDialog.blockingDialogOpen = true;
				}

				let windowWidth = $(window).width();
				let windowHeight = $(window).height();
				$(event.target).css("maxWidth", (windowWidth - 50) + "px");
				$(event.target).css("maxHeight", (windowHeight - 50) + "px");
			}
		};
		this.dialogParameters.buttons = {
			"Cancel": () => {
				$(this.dialog).dialog('close');
			},
			"Apply": () => {
				this.applyChanges();
			}
		};
		this.dialogParameters.width = "auto";
		this.dialogParameters.height = "auto";
		this.beforeCreateDialog();
		this.dialog = $(this.dialogDiv).dialog(this.dialogParameters);
	}
	bindEnterApplyEvents() {
		$(this.dialogContent).find(".enter-apply").keydown(event => {
			if (!event.shiftKey) {
				if (event.key === "Enter") {
					event.preventDefault();
					this.applyChanges();
				}
			}
		});
	}
	renderHelpButtonHtml(helpId) {
		return (`<button id="${helpId}" class="help-button enter-apply" tabindex="-1" >
			?
		</button>`);
	}

	setHelpButtonInfo(helpId, title, contentHTML) {
		$(this.dialogContent).find(`#${helpId}`).unbind();
		$(this.dialogContent).find(`.enter-apply#${helpId}`).keydown(event => {
			if (!event.shiftKey) {
				if (event.key === "Enter") {
					event.preventDefault();
					this.applyChanges();
				}
			}
		});
		$(this.dialogContent).find(`#${helpId}`).click(event => {
			let dialog = new XAlertDialog(contentHTML);
			$(dialog.dialogContent).find(".accordion").accordion({
				heightStyle: "content",
				active: false,
				header: "h3",
				collapsible: true
			});
			dialog.setTitle(title);
			dialog.show();
		})
	}

	applyChanges() {
		let applyResult = this.makeApply();
		if (applyResult === false) return;
		$(this.dialog).dialog('close');
		// We add a delay to make sure we closed first

		setTimeout(() => {
			History.storeUndoState();
			InfoBar.update();
		}, 200);
	}
	makeApply() {

	}
	getWidth() {
		return this.dialog.width();
	}
	getHeight() {
		return this.dialog.height();
	}
	resize(event, ui) {

	}
	resizeStart(event, ui) {

	}
	resizeStop(event, ui) {

	}
	beforeCreateDialog() {

	}
	beforeClose() {

	}
	afterClose() {

	}
	beforeShow() {

	}
	afterShow() {

	}
	show() {
		this.beforeShow();
		this.dialog.dialog("open");
		this.visible = true;
		this.afterShow();
	}
	setTitle(newTitle) {
		this.title = newTitle;
		this.dialog.dialog("option", "title", this.title);
	}
	getTitle() {
		return this.title;
	}
	setHtml(newHtml) {
		this.dialogContent.innerHTML = newHtml;
	}
	getHtml() {
		return this.dialogContent.innerHTML;
	}
}
// Needed for the static init of this class
jqDialog.init();




/**
 * @typedef {Object} Primitive
 * @property {string} type - Type of primitive, e.g. "Stock", "Flow", "Variable", "Converter", "Ghost", "Link"
 * @property {string} id - Unique identifier for the primitive
 * @property {Element} value - The XML Element representing the primitive
 * @property {(name: string) => any} getAttribute - Function to get an attribute value by name
 * @property {(name: string, value: any) => void} setAttribute - Function to set an attribute value by name
 * */

/**
 * @returns {Primitive[]} - Returns a list of all primitives of type "Stock", "Flow", "Variable", and "Converter"
 */
function getPrimitiveList() {
	const primitiveList = primitives("Stock").concat(primitives("Flow")).concat(primitives("Variable")).concat(primitives("Converter"));
	return primitiveList;
}

class XAlertDialog extends jqDialog {
	/** @param {string} message @param {() => void} closeHandler */
	constructor(message, closeHandler = null) {
		super();
		this.setTitle("Alert");
		this.message = message;
		this.setHtml(message);
		this.closeHandler = closeHandler;
	}
	show() {
		// The Calibration Sandbox is a separate browser/Electron window. A normal
		// jQuery UI alert belongs to the editor document and can therefore be hidden
		// behind that window. When the sandbox is open, render the alert as a modal
		// overlay in the sandbox itself and focus that window so simulation errors
		// and warnings are always visible to the user.
		if (window.SystemikaCalibrationSandbox &&
			typeof window.SystemikaCalibrationSandbox.showTopAlert === "function" &&
			window.SystemikaCalibrationSandbox.showTopAlert(this.getHtml(), () => { this.visible = false; this.afterClose(); }, this.getTitle())) {
			this.visible = true;
			return;
		}
		super.show();
	}
	afterClose() {
		if (this.closeHandler) {
			this.closeHandler();
		}
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"OK": () => {
				$(this.dialog).dialog('close');
			}
		};
	}
}
function xAlert(message, closeHandler) {
	let dialog = new XAlertDialog(message, closeHandler);
	dialog.show();
}

// Browser-native alert() dialogs can become non-interactive inside Electron's
// nested editor frame on some Linux window managers. Route ordinary alerts
// through the same in-app jQuery UI dialog used elsewhere in Systemika. Keep
// the original function only for debugging/fallback inspection.
if (typeof window !== "undefined" && !window.__systemikaNativeAlert) {
	try {
		window.__systemikaNativeAlert = typeof window.alert === "function" ? window.alert.bind(window) : null;
		window.alert = (message) => {
			let text = String(message == null ? "" : message);
			let safe = (typeof htmlEscape === "function" ? htmlEscape(text) : text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			xAlert(safe.replace(/\r?\n/g, "<br/>"));
		};
	} catch (error) {
		console.warn("Unable to install Systemika in-app alert handler", error);
	}
}

class GhostSourceDialog extends jqDialog {
	constructor(x, y) {
		super();
		this.x = x;
		this.y = y;
		this.setTitle("Select Ghost Source");
	}
	getCandidates() {
		if (typeof getPrimitiveList !== "function") return [];
		let typeLabels = {
			stock: "Stock",
			flow: "Flow",
			variable: "Auxiliary",
			constant: "Constant",
			converter: "Lookup"
		};
		return getPrimitiveList().map(primitive => {
			let id = String(getID(primitive));
			let object = get_object(id);
			let objectType = object && object.type ? String(object.type).toLowerCase() : String(getTypeNew(primitive) || "").toLowerCase();
			return {
				id,
				name: String(getName(primitive) || id),
				type: objectType,
				typeLabel: typeLabels[objectType] || String(getTypeNew(primitive) || objectType)
			};
		}).filter(item => GhostTool.ghostable_primitives.includes(item.type))
			.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
	}
	ghostOptionsHtml(candidates) {
		return candidates.map(item => `<option value="${htmlEscape(item.id)}">${htmlEscape(item.name)} — ${htmlEscape(item.typeLabel)}</option>`).join("");
	}
	filterCandidates() {
		let query = String($(this.dialogContent).find(".ghost-source-filter").val() || "").trim().toLowerCase();
		let filtered = this.candidates.filter(item => !query || item.name.toLowerCase().includes(query) || item.typeLabel.toLowerCase().includes(query));
		let select = $(this.dialogContent).find(".ghost-source-select");
		select.html(this.ghostOptionsHtml(filtered));
		select.prop("disabled", filtered.length === 0);
		if (filtered.length) select.prop("selectedIndex", 0);
		$(this.dialogContent).find(".ghost-source-count").text(filtered.length === this.candidates.length
			? `${filtered.length} item${filtered.length === 1 ? "" : "s"}`
			: `${filtered.length} of ${this.candidates.length} items`);
		$(this.dialogContent).find(".ghost-source-warning").empty();
	}
	beforeShow() {
		this.candidates = this.getCandidates();
		this.setHtml(`
			<div style="min-width:400px; max-width:580px;">
				<div style="margin-bottom:6px;">Select the model item to show as a Ghost:</div>
				<input class="ghost-source-filter" type="search" placeholder="Search model entities…" autocomplete="off" spellcheck="false" style="width:100%; box-sizing:border-box; margin-bottom:6px;"/>
				${this.candidates.length ? `<select class="ghost-source-select" size="12" style="width:100%; box-sizing:border-box;">${this.ghostOptionsHtml(this.candidates)}</select>` : `<div class="ghost-source-empty">There are no ghostable model items.</div>`}
				<div class="ghost-source-count" style="font-size:0.85em; color:#666; margin-top:4px;"></div>
				<div class="ghost-source-warning" style="margin-top:6px;"></div>
			</div>`);
		let select = $(this.dialogContent).find(".ghost-source-select");
		if (select.length) {
			select.prop("selectedIndex", 0);
			select.dblclick(() => this.createGhost());
			select.keydown(event => {
				if (event.key === "Enter") { event.preventDefault(); this.createGhost(); }
			});
			let filter = $(this.dialogContent).find(".ghost-source-filter");
			filter.on("input", () => this.filterCandidates());
			filter.keydown(event => {
				if (event.key === "ArrowDown") { event.preventDefault(); select.focus(); }
				if (event.key === "Enter" && select.find("option").length === 1) { event.preventDefault(); this.createGhost(); }
			});
			this.filterCandidates();
			setTimeout(() => filter.focus(), 0);
		}
	}
	createGhost() {
		let select = $(this.dialogContent).find(".ghost-source-select");
		let id = String(select.val() || "");
		if (!id) {
			$(this.dialogContent).find(".ghost-source-warning").html(warningHtml("Select an item first.", true));
			return;
		}
		let source = findID(id);
		if (!source) {
			$(this.dialogContent).find(".ghost-source-warning").html(warningHtml("The selected item no longer exists.", true));
			return;
		}
		let ghost = GhostTool.createFromSource(source, this.x, this.y);
		if (!ghost) return;
		$(this.dialog).dialog("close");
		update_relevant_objects([]);
		InfoBar.update();
		History.storeUndoState();
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Cancel": () => $(this.dialog).dialog("close"),
			"Create Ghost": () => this.createGhost()
		};
	}
}

class XPromptDialog extends jqDialog {
	constructor(message, defaultValue, closeHandler) {
		super();
		this.setTitle("Input");
		this.message = String(message == null ? "" : message);
		this.defaultValue = defaultValue == null ? "" : String(defaultValue);
		this.closeHandler = closeHandler;
		this.result = null;
	}
	beforeShow() {
		this.setHtml(`<div style="min-width:320px; max-width:520px;">
			<div style="margin-bottom:8px;">${htmlEscape(this.message)}</div>
			<input class="systemika-prompt-input" type="text" style="width:100%; box-sizing:border-box;" value="${htmlEscape(this.defaultValue)}"/>
		</div>`);
		let input = $(this.dialogContent).find(".systemika-prompt-input");
		input.keydown(event => {
			if (event.key === "Enter") { event.preventDefault(); this.accept(); }
		});
	}
	afterShow() {
		setTimeout(() => $(this.dialogContent).find(".systemika-prompt-input").focus().select(), 0);
	}
	accept() {
		this.result = String($(this.dialogContent).find(".systemika-prompt-input").val() || "");
		$(this.dialog).dialog("close");
	}
	afterClose() {
		if (this.closeHandler) this.closeHandler(this.result);
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Cancel": () => { this.result = null; $(this.dialog).dialog("close"); },
			"OK": () => this.accept()
		};
	}
}

function xPrompt(message, defaultValue, closeHandler) {
	let dialog = new XPromptDialog(message, defaultValue, closeHandler);
	dialog.show();
}
if (typeof window !== "undefined") window.xPrompt = xPrompt;

class YesNoDialog extends jqDialog {
	constructor(message, closeHandler) {
		super();
		this.setTitle("");
		this.message = message;
		this.setHtml(message);
		this.closeHandler = closeHandler;
		this.answer = "no";
	}
	afterClose() {
		if (this.closeHandler) {
			this.closeHandler(this.answer);
		}
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Yes": () => {
				this.answer = "yes";
				$(this.dialog).dialog('close');
			},
			"No": () => {
				this.answer = "no";
				$(this.dialog).dialog('close');
			}
		};
	}
}
function yesNoAlert(message, closeHandler) {
	let dialog = new YesNoDialog(message, closeHandler);
	dialog.show();
}

class YesNoCancelDialog extends jqDialog {
	constructor(message, closeHandler) {
		super();
		this.setTitle("");
		this.message = message;
		this.setHtml(message);
		this.closeHandler = closeHandler;
		this.answer = "cancel";
	}
	afterClose() {
		if (this.closeHandler) {
			this.closeHandler(this.answer);
		}
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Yes": () => {
				this.answer = "yes";
				$(this.dialog).dialog('close');
			},
			"No": () => {
				this.answer = "no";
				$(this.dialog).dialog('close');
			},
			"Cancel": () => {
				this.answer = "cancel";
				$(this.dialog).dialog('close');
			}
		};
	}
}
function yesNoCancelAlert(message, closeHandler) {
	let dialog = new YesNoCancelDialog(message, closeHandler);
	dialog.show();
}

class SystemikaRunsManagerDialog extends jqDialog {
	constructor() {
		super();
		this.setTitle("Manage Runs");
		this.selectedRun = "";
		this.setHtml(`
			<div class="systemika-runs-manager">
				<div style="margin-bottom:0.6rem;">Saved simulation runs for the current model.</div>
				<div class="systemika-runs-manager-list" style="min-width:520px; max-height:300px; overflow:auto; border:1px solid #bbb;"></div>
				<div style="display:flex; gap:0.5rem; align-items:center; margin-top:0.75rem;">
					<label for="systemika-runs-manager-name"><b>Name:</b></label>
					<input id="systemika-runs-manager-name" type="text" style="flex:1; min-width:220px;" autocomplete="off" />
				</div>
				<div class="systemika-runs-manager-status" style="min-height:1.4em; margin-top:0.5rem;"></div>
			</div>`);
		this.nameInput = $(this.dialogContent).find("#systemika-runs-manager-name");
		// Run names are ordinary text.  Never let letters typed here bubble to
		// the editor's single-key creation shortcuts.
		this.nameInput.on("keydown keyup keypress", event => event.stopPropagation());
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Rename": () => this.renameSelected(),
			"Delete": () => this.deleteSelected(),
			"Delete All": () => this.deleteAllRuns(),
			"Close": () => $(this.dialog).dialog('close')
		};
	}
	async afterShow() {
		await this.reload();
	}
	afterClose() {
		// Management operations can change which package a display resolves to.
		// Closing the panel is the synchronization point requested by the UI: all
		// figures/tables re-resolve their selected run(s) and redraw.
		SystemikaOutputDevices.refreshAll();
	}
	status(message, isError = false) {
		let node = $(this.dialogContent).find(".systemika-runs-manager-status");
		node.text(message || "");
		node.css("color", isError ? "#b00020" : "");
	}
	async reload() {
		let list = $(this.dialogContent).find(".systemika-runs-manager-list");
		this.status("Loading runs…");
		try {
			let runs = await systemikaSimulationData.listRuns();
			if (!runs.length) {
				list.html(`<div style="padding:0.75rem;">No saved runs.</div>`);
				this.selectedRun = "";
				this.nameInput.val("");
				this.status("");
				return;
			}
			list.html(`<table class="modern-table zebra" style="width:100%;">
				<thead><tr><th></th><th>Run</th><th>Modified</th><th>Size</th></tr></thead>
				<tbody>${runs.map((run, index) => {
					let bytes = Number(run.bytes || 0);
					let size = bytes < 1024 ? `${bytes} B` : bytes < 1024*1024 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1024/1024).toFixed(1)} MB`;
					let modified = run.modified ? new Date(run.modified).toLocaleString() : "";
					return `<tr class="systemika-run-row" data-run="${htmlEscape(run.runName)}">
						<td><input type="radio" name="systemika-run-manager-choice" ${index===0 ? "checked" : ""}></td>
						<td>${htmlEscape(run.runName)}</td><td>${htmlEscape(modified)}</td><td>${htmlEscape(size)}</td>
					</tr>`;
				}).join("")}</tbody></table>`);
			let choose = (row) => {
				let name = String($(row).data("run") || "");
				this.selectedRun = name;
				this.nameInput.val(name);
				$(row).find('input[type="radio"]').prop("checked", true);
			};
			list.find(".systemika-run-row").on("click", function() { choose(this); });
			choose(list.find(".systemika-run-row").get(0));
			this.status("");
		} catch (error) {
			console.error(error);
			this.status(error.message || String(error), true);
		}
	}
	targetName(defaultSuffix = "") {
		let value = String(this.nameInput.val() || "").trim();
		if (defaultSuffix && (!value || value === this.selectedRun)) value = `${this.selectedRun}${defaultSuffix}`;
		return value;
	}
	async renameSelected() {
		if (!this.selectedRun) return this.status("Select a run first.", true);
		let target = this.targetName();
		if (!target || target === this.selectedRun) return this.status("Enter a different run name.", true);
		try {
			this.status("Renaming…");
			await systemikaSimulationData.renameRun(this.selectedRun, target);
			renameRunInDisplaySelections(this.selectedRun, target);
			this.selectedRun = target;
			await this.reload();
		} catch (error) { this.status(error.message || String(error), true); }
	}
	async duplicateSelected() {
		if (!this.selectedRun) return this.status("Select a run first.", true);
		let target = this.targetName(" Copy");
		if (!target || target === this.selectedRun) target = `${this.selectedRun} Copy`;
		try {
			this.status("Duplicating…");
			await systemikaSimulationData.duplicateRun(this.selectedRun, target);
			notifySystemikaRunsChanged({ action: "duplicate", sourceName: this.selectedRun, runName: target });
			await this.reload();
		} catch (error) { this.status(error.message || String(error), true); }
	}
	deleteSelected() {
		if (!this.selectedRun) return this.status("Select a run first.", true);
		let doomed = this.selectedRun;
		yesNoAlert(`Delete saved run <b>${htmlEscape(doomed)}</b>?`, async (answer) => {
			if (answer !== "yes") return;
			try {
				this.status("Deleting…");
				await systemikaSimulationData.deleteRun(doomed);
				removeRunFromDisplaySelections(doomed);
				SystemikaOutputDevices.refreshAll();
				this.selectedRun = "";
				await this.reload();
			} catch (error) { this.status(error.message || String(error), true); }
		});
	}
	async deleteAllRuns() {
		let runs;
		try {
			runs = await systemikaSimulationData.listRuns();
		} catch (error) {
			return this.status(error.message || String(error), true);
		}
		if (!runs.length) return this.status("No saved runs to delete.");
		yesNoAlert(`Delete <b>all ${runs.length} saved run${runs.length === 1 ? "" : "s"}</b> for the current model?`, async (answer) => {
			if (answer !== "yes") return;
			try {
				this.status("Deleting all runs…");
				for (let run of runs) {
					let name = String(run.runName || "");
					if (!name) continue;
					await systemikaSimulationData.deleteRun(name);
					removeRunFromDisplaySelections(name);
				}
				SystemikaOutputDevices.refreshAll();
				this.selectedRun = "";
				this.nameInput.val("");
				await this.reload();
			} catch (error) { this.status(error.message || String(error), true); }
		});
	}
}

let systemikaRunsManagerDialog = null;
function openSystemikaRunsManager() {
	if (!systemikaRunsManagerDialog) systemikaRunsManagerDialog = new SystemikaRunsManagerDialog();
	if (!systemikaRunsManagerDialog.visible) systemikaRunsManagerDialog.show();
}
if (typeof window !== "undefined") window.openSystemikaRunsManager = openSystemikaRunsManager;

class UnsavedSaveChoiceDialog extends jqDialog {
	constructor() {
		super();
		this.setTitle("Unsaved Changes");
		this.setHtml("Choose how to save the current model.");
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Save": () => { $(this.dialog).dialog("close"); fileManager.saveModel(); },
			"Save As...": () => { $(this.dialog).dialog("close"); fileManager.saveModelAs(); },
			"Cancel": () => $(this.dialog).dialog("close")
		};
	}
}
function showUnsavedSaveChoice() {
	let dialog = new UnsavedSaveChoiceDialog();
	dialog.show();
}

function saveChangedAlert(continueHandler) {
	// If we have no unsaved changes we just continue directly
  if (!History.unsavedChanges) {
    
		continueHandler();
		return;
	}
	// Else ask if we want to save first
	yesNoCancelAlert("You have unsaved changes. Do you want to save first?", function (answer) {
		switch (answer) {
			case "yes":
				fileManager.finishedSaveHandler = continueHandler;
				fileManager.saveModel();
				break;
			case "no":
				continueHandler();
				break;
			case "cancel":
				break;
		}
	});
}

class HtmlComponent {
	/** @param {DisplayDialog} parent */
	constructor(parent) {
		this.componentId = "component-" + Math.ceil(Math.random() * (2 ** 32)).toString(16)
		this.parent = parent;
		this.primitive = parent.primitive;
	}
	find(selector) {
		return $(this.parent.dialogContent).find(selector);
	}
	render() { return "<p>EmptyComponent</p>"; }
	bindEvents() { }
	applyChange() { }
}


/**
 * @param labels = [{ text, attribute }]
 */
class LabelTableComponent extends HtmlComponent {
	constructor(parent, labels) {
		super(parent);
		this.labels = labels;
	}
	render() {
		return (`
			<table class="modern-table zebra">
				${this.labels.map(label => {
			return (`<tr>
						<th>${label.text}:</th>
						<td style="padding:1px;" >
							<input style="width: 150px;" class="${label.attribute}-field enter-apply" spellcheck="false" type="text" value="${this.primitive.getAttribute(label.attribute)}"/>
						</td>
					</tr>`);
		}).join("")}
			</table>
		`);
	}
	applyChange() {
		this.labels.forEach(label => {
			let labelChoosen = removeSpacesAtEnd(this.find(`.${label.attribute}-field`).val());
			this.primitive.setAttribute(label.attribute, labelChoosen);
		})
	}
}

/**
 * @param checkboxes = [{ text, attribute }]
 */
// Checkboxhtml
class CheckboxTableComponent extends HtmlComponent {
	constructor(parent, checkboxes) {
		super(parent);
		this.checkboxes = checkboxes;
	}
	render() {
		return (`
			<table class="modern-table zebra">
				${this.checkboxes.map(checkbox => {
			return (`<tr>
						<td>
							<input class="${checkbox.attribute}-checkbox enter-apply" type="checkbox" ${checkedHtml(this.primitive.getAttribute(checkbox.attribute) === "true")}>
						</td>
						<th style="text-align: left;">${checkbox.text}</th>
					</tr>`)
		}).join("")}
			</table>
		`);
	}

	applyChange() {
		this.checkboxes.forEach(checkbox => {
			let boolChosen = this.find(`.${checkbox.attribute}-checkbox`).prop("checked");
			this.primitive.setAttribute(checkbox.attribute, boolChosen);
		})
	}
}

class PrimitiveSelectorComponent extends HtmlComponent {
	constructor(parent, displayLimit) {
		super(parent);
		this.displayIds = [];
		this.displayLimit = displayLimit;
	}
	renderIncludedList() {
		return (`<table id=${this.componentId} class="primitive-selector">
			<tr>
				<th></th>
				<th>Selected Variable(s)</td>
			</tr>
			${this.displayIds.map(id => {
			const primitive = findID(id)
			const type = getTypeNew(primitive).toLowerCase()
			const color = primitive?.getAttribute("Color")
			const isRandom = hasRandomFunction(getValue(primitive))
			const styleSelected = this.styleComponent && this.styleComponent.selectedId === String(id);
			return `<tr class="${this.styleComponent ? "plot-style-target-row" : ""} ${styleSelected ? "plot-style-target-selected" : ""}" data-style-id="${id}" ${this.styleComponent ? 'title="Click to edit this entity\'s line style" style="cursor:pointer;"' : ""}>
					<td style="padding: 0;">
						<button
							class="primitive-remove-button enter-apply"
							data-id="${id}">
							-
						</button>
						</td>
						<td style="width: 100%;">
						<div class="center-vertically-container">
							<div style="width: 1.75rem; padding-right: 0.25rem;">
								${PrimitiveSvgPreview.create(type, { color, dice: isRandom })}
							</div>
							<span class="cm-primitive cm-${color}">
							${getName(primitive)}
							<span>
						</div>
						</td>
				</tr>
			`}).join("")}
		</table>`);
	}
	updateIncludedList() {
		let htmlContent = "No model entities selected";
		if (this.displayIds.length > 0) {
			htmlContent = this.renderIncludedList();
		}
		this.find(".included-list-div").html(htmlContent);
		this.parent.bindEnterApplyEvents();
		this.find(`#${this.componentId} .primitive-remove-button`).click(event => {
			event.stopPropagation();
			this.removeButtonHandler(event);
			if (this.styleComponent) this.styleComponent.handleDisplayIdsChanged();
			this.updateIncludedList();
			this.updateExcludedList();
			this.parent.requestLiveApply(0);
		});
		if (this.styleComponent) {
			this.find(`#${this.componentId} .plot-style-target-row`).click(event => {
				this.styleComponent.selectEntity(String($(event.currentTarget).attr("data-style-id") || ""));
			});
		}
	}
	removeButtonHandler(event) {
		let removeId = $(event.target).attr("data-id");
		let removeIndex = this.displayIds.indexOf(removeId);
		if (removeIndex !== -1) {
			this.displayIds.splice(removeIndex, 1);
		}
	}
	updateExcludedList() {
		let searchWord = this.find(".primitive-filter-input").val();

		let searchLowercase = searchWord.toLowerCase();
		let results = this.getSearchPrimitiveResults(searchLowercase);
		let get_highlight_match = (name, match) => {
			let index = name.toLowerCase().indexOf(match.toLowerCase());
			if (index === -1 || match === "") {
				return name;
			} else {
				return `${name.slice(0, index)}<mark>${name.slice(index, index + match.length)}</mark>${name.slice(index + match.length, name.length)}`
			}
		}
		let htmlContent = "";
		if (results.length > 0) {
			let limitReached = this.displayLimit && this.displayIds.length >= this.displayLimit;
			htmlContent = (`<table class="primitive-selector">
				${results.map(p => {
				const type = getTypeNew(p).toLowerCase()
				const color = p?.getAttribute("Color")
				const isRandom = hasRandomFunction(getValue(p));
				return `<tr>
						<td style="padding: 0;">
							<button class="primitive-add-button enter-apply" data-id="${getID(p)}"
								${limitReached ? "disabled" : ""}
								${limitReached ? `title="Max ${this.displayLimit} model entities selected"` : ""}>
								+
							</button>
						</td>
						<td style="width: 100%;">
						<div class="center-vertically-container">
							<div style="width: 1.75rem; padding-right: 0.25rem;">
								${PrimitiveSvgPreview.create(type.toLowerCase(), { color, dice: isRandom })}
							</div>
							<span class="cm-primitive cm-${color}">${get_highlight_match(getName(p), searchWord)}<span>
						</div>
						</td>
					</tr>
				`}).join("")}
			</table>`);
		} else if (searchLowercase === "") {
			htmlContent = (`<div>No more model entities to add.</div>`);
		} else {
			htmlContent = (noteHtml(`No model entity matches search: <br/><b>${searchWord}</b>`));
		}
		this.find(".excluded-list-div").html(htmlContent);
		this.parent.bindEnterApplyEvents();
		this.find(".primitive-add-button").click((event) => {
			let addedId = String($(event.currentTarget).attr("data-id") || "");
			this.addButtonHandler(event);
			if (this.styleComponent) this.styleComponent.handleDisplayIdsChanged(addedId);
			this.updateIncludedList();
			if (this.styleComponent && addedId) this.styleComponent.selectEntity(addedId);
			this.find(".primitive-filter-input").val("");
			this.updateExcludedList();
			this.parent.requestLiveApply(0);
		});
	}
	addButtonHandler(event) {
		let addId = $(event.target).attr("data-id");
		this.displayIds.push(addId);
	}
	render() {
		this.displayIds = getDisplayIds(this.primitive);

		return (`
			<div class="included-list-div" style="border: 1px solid black;"></div>
			<div class="vertical-space"></div>
			<div class="center-vertically-container">
				<img style="height: 22px; padding: 0px 5px;" src="graphics/exchange.svg"/>
				<input type="text" class="primitive-filter-input enter-apply" placeholder="Find Model Entity ..." style="height: 18px; width: 220px;">
			</div>
			<div class="excluded-list-div" style="max-height: 300px; overflow: auto; border: 1px solid black;"></div>
		`);
	}
	bindEvents() {
		this.find(".primitive-filter-input").keyup(() => {
			this.updateExcludedList();
		});
		this.updateIncludedList();
		this.updateExcludedList();
	}
	getSearchPrimitiveResults(searchLowercase) {
		let prims = this.parent.getAcceptedPrimitiveList();
		let results = [];

		let compareByTypeAndName = (a, b) => { // sort by type and by alphabetical
			let orderDiff = order.indexOf(getTypeNew(a)) - order.indexOf(getTypeNew(b))
			if (orderDiff !== 0) {
				return orderDiff;
			} else { // else sort alphabetically
				return getName(a).toLowerCase() > getName(b).toLowerCase() ? 1 : -1;
			}
		}

		let compareBySearchWord = (a, b) => { // sort by what search word appears first
			let charMatch = getName(a).toLowerCase().indexOf(searchLowercase) - getName(b).toLowerCase().indexOf(searchLowercase);
			if (charMatch !== 0) {
				return charMatch;
			} else { // else sort alphabetically
				return getName(a).toLowerCase() > getName(b).toLowerCase() ? 1 : -1;
			}
		}

		let order = ["Stock", "Flow", "Variable", "Constant", "Converter"];
		results = prims.filter(p => // filter already added primitives
			this.displayIds.includes(getID(p)) === false
		).filter(p => // filter search
			getName(p).toLowerCase().includes(searchLowercase)
		).sort(searchLowercase === "" ? compareByTypeAndName : compareBySearchWord);

		return results;
	}
	applyChange() {
		setDisplayIds(this.primitive, this.displayIds);
	}
}


class PlotVariableSelectorComponent extends PrimitiveSelectorComponent {
	constructor(parent, displayLimit, options = {}) {
		super(parent, displayLimit);
		this.withLineStyle = Boolean(options.lineStyle);
		this.styles = {};
	}
	patternValue(pattern) {
		return JSON.stringify(Array.isArray(pattern) && pattern.length ? pattern : [1]);
	}
	ensureStyle(id) {
		let key = String(id);
		if (!this.styles[key]) this.styles[key] = { pattern: [1], width: 2 };
		return this.styles[key];
	}
	variableIdentityHtml(id) {
		const primitive = findID(id);
		if (!primitive) return `<span class="systemika-variable-name">Missing variable</span>`;
		const type = getTypeNew(primitive).toLowerCase();
		const color = primitive?.getAttribute("Color");
		const isRandom = hasRandomFunction(getValue(primitive));
		return `<div class="systemika-variable-identity">
			<button type="button" class="primitive-remove-button" data-id="${htmlEscape(String(id))}" title="Remove variable" aria-label="Remove ${htmlEscape(getName(primitive))}">−</button>
			<div class="systemika-variable-icon">${PrimitiveSvgPreview.create(type, { color, dice: isRandom })}</div>
			<span class="cm-primitive cm-${color} systemika-variable-name" title="${htmlEscape(getName(primitive))}">${htmlEscape(getName(primitive))}</span>
		</div>`;
	}
	styleControlsHtml(id) {
		if (!this.withLineStyle) return "";
		let style = this.ensureStyle(id);
		let patternValue = this.patternValue(style.pattern);
		return `<select class="line-pattern-select plot-variable-style-select" data-id="${htmlEscape(String(id))}" aria-label="Dash type for ${htmlEscape(findID(id) ? getName(findID(id)) : String(id))}">
			<option value="[1]" ${patternValue === "[1]" ? "selected" : ""}>Solid</option>
			<option value="[10,5]" ${patternValue === "[10,5]" ? "selected" : ""}>Dashed</option>
			<option value="[2,4]" ${patternValue === "[2,4]" ? "selected" : ""}>Dotted</option>
			<option value="[10,4,2,4]" ${patternValue === "[10,4,2,4]" ? "selected" : ""}>Dash-dot</option>
		</select>
		<select class="line-width-select plot-variable-style-select" data-id="${htmlEscape(String(id))}" aria-label="Line width for ${htmlEscape(findID(id) ? getName(findID(id)) : String(id))}">
			<option value="1" ${Number(style.width) === 1 ? "selected" : ""}>1</option>
			<option value="2" ${Number(style.width) === 2 ? "selected" : ""}>2</option>
			<option value="3" ${Number(style.width) === 3 ? "selected" : ""}>3</option>
		</select>`;
	}
	selectedGridClass() {
		return this.withLineStyle ? "systemika-variable-grid systemika-variable-grid-styled" : "systemika-variable-grid systemika-variable-grid-simple";
	}
	renderSelectedColumns() {
		if (!this.withLineStyle) return "";
		return `<div class="${this.selectedGridClass()} systemika-variable-columns" aria-hidden="true">
			<span>Variable</span><span>Dash</span><span>Width</span>
		</div>`;
	}
	renderSelectedRow(id, index) {
		return `<div class="${this.selectedGridClass()} systemika-variable-row" data-id="${htmlEscape(String(id))}">
			${this.variableIdentityHtml(id)}${this.styleControlsHtml(id)}
		</div>`;
	}
	renderSelectedRows() {
		if (!this.displayIds.length) return `<div class="systemika-variable-empty">No variables selected.</div>`;
		return this.displayIds.map((id, index) => this.renderSelectedRow(id, index)).join("");
	}
	renderFinderResults() {
		let searchWord = String(this.find(".primitive-filter-input").val() || "");
		let searchLowercase = searchWord.toLowerCase();
		let results = this.getSearchPrimitiveResults(searchLowercase);
		if (!results.length) {
			if (!searchLowercase) return `<div class="systemika-variable-empty">No more variables available.</div>`;
			return `<div class="systemika-variable-empty">No variable matches <b>${htmlEscape(searchWord)}</b>.</div>`;
		}
		let limitReached = this.displayLimit && this.displayIds.length >= this.displayLimit;
		return results.map(primitive => {
			const id = String(getID(primitive));
			const type = getTypeNew(primitive).toLowerCase();
			const color = primitive?.getAttribute("Color");
			const isRandom = hasRandomFunction(getValue(primitive));
			return `<div class="systemika-variable-finder-row">
				<button type="button" class="primitive-add-button" data-id="${htmlEscape(id)}" ${limitReached ? "disabled" : ""} title="${limitReached ? `Maximum ${this.displayLimit} variable${this.displayLimit === 1 ? "" : "s"} selected` : `Add ${htmlEscape(getName(primitive))}`}">+</button>
				<div class="systemika-variable-icon">${PrimitiveSvgPreview.create(type, { color, dice: isRandom })}</div>
				<span class="cm-primitive cm-${color} systemika-variable-name" title="${htmlEscape(getName(primitive))}">${htmlEscape(getName(primitive))}</span>
			</div>`;
		}).join("");
	}
	render() {
		this.displayIds = getDisplayIds(this.primitive).map(String);
		if (this.withLineStyle) {
			this.styles = getPlotLineStyles(this.primitive);
			this.displayIds.forEach(id => this.ensureStyle(id));
		}
		return `<div class="systemika-plot-variable-selector">
			<div class="systemika-variable-selector-heading">
				<strong>Selected Variable(s)</strong>
				<button type="button" class="systemika-variable-find-button">+ Add Variable</button>
			</div>
			${this.renderSelectedColumns()}
			<div class="systemika-variable-selected-list">${this.renderSelectedRows()}</div>
			<div class="systemika-variable-finder" hidden>
				<div class="systemika-variable-finder-toolbar">
					<input type="text" class="primitive-filter-input" placeholder="Find variable..." aria-label="Find variable">
					<button type="button" class="systemika-variable-finder-close" title="Close variable finder" aria-label="Close variable finder">×</button>
				</div>
				<div class="systemika-variable-finder-results"></div>
			</div>
		</div>`;
	}
	updateSelectedList() {
		this.find(".systemika-variable-selected-list").html(this.renderSelectedRows());
		this.bindSelectedRowEvents();
	}
	updateFinderResults() {
		this.find(".systemika-variable-finder-results").html(this.renderFinderResults());
		this.find(".systemika-variable-finder-results .primitive-add-button").click(event => {
			event.preventDefault();
			let id = String($(event.currentTarget).attr("data-id") || "");
			if (!id || this.displayIds.includes(id)) return;
			this.addButtonHandler(event);
			if (this.withLineStyle) this.ensureStyle(id);
			this.updateSelectedList();
			this.find(".primitive-filter-input").val("");
			this.updateFinderResults();
			this.parent.requestLiveApply(0);
		});
	}
	bindSelectedRowEvents() {
		this.find(".systemika-variable-selected-list .primitive-remove-button").click(event => {
			event.preventDefault();
			let id = String($(event.currentTarget).attr("data-id") || "");
			this.removeButtonHandler(event);
			if (this.withLineStyle) delete this.styles[id];
			this.updateSelectedList();
			this.updateFinderResults();
			this.parent.requestLiveApply(0);
		});
		this.find(".systemika-variable-selected-list .line-pattern-select").change(event => {
			event.stopPropagation();
			let field = $(event.currentTarget);
			let id = String(field.attr("data-id") || "");
			let pattern;
			try { pattern = JSON.parse(String(field.val() || "[1]")); } catch (_error) { pattern = [1]; }
			let style = this.ensureStyle(id);
			style.pattern = pattern;
			this.parent.requestLiveApply(0);
		});
		this.find(".systemika-variable-selected-list .line-width-select").change(event => {
			event.stopPropagation();
			let field = $(event.currentTarget);
			let id = String(field.attr("data-id") || "");
			let width = Number(field.val());
			let style = this.ensureStyle(id);
			style.width = Number.isFinite(width) && width > 0 ? width : 2;
			this.parent.requestLiveApply(0);
		});
		this.bindPlotSpecificRowEvents();
	}
	bindPlotSpecificRowEvents() { }
	bindEvents() {
		this.bindSelectedRowEvents();
		this.updateFinderResults();
		this.find(".systemika-variable-find-button").click(event => {
			event.preventDefault();
			let finder = this.find(".systemika-variable-finder");
			let opening = Boolean(finder.prop("hidden"));
			finder.prop("hidden", !opening);
			if (opening) {
				this.updateFinderResults();
				this.find(".primitive-filter-input").trigger("focus");
			}
		});
		this.find(".systemika-variable-finder-close").click(event => {
			event.preventDefault();
			this.find(".systemika-variable-finder").prop("hidden", true);
		});
		this.find(".primitive-filter-input").on("input keyup", () => this.updateFinderResults());
	}
	removeButtonHandler(event) {
		let removeId = String($(event.currentTarget).attr("data-id") || "");
		let removeIndex = this.displayIds.indexOf(removeId);
		if (removeIndex !== -1) this.displayIds.splice(removeIndex, 1);
	}
	addButtonHandler(event) {
		let addId = String($(event.currentTarget).attr("data-id") || "");
		if (addId && !this.displayIds.includes(addId)) this.displayIds.push(addId);
	}
	applyChange() {
		setDisplayIds(this.primitive, this.displayIds);
		if (this.withLineStyle) {
			let activeStyles = {};
			this.displayIds.forEach(id => { activeStyles[String(id)] = this.ensureStyle(id); });
			setPlotLineStyles(this.primitive, activeStyles);
		}
	}
}

// Persistent run selected by an individual plot/table. An empty RunName
// means "use the current/latest simulation in memory".
function getDisplayRunName(primitive) {
	if (!primitive) return "";
	return String(primitive.getAttribute("RunName") || "").trim();
}

// The live/current source remains represented internally by an empty run name,
// but users see only its real run label (Base, Run 1, ...). This avoids the
// redundant "Current / latest (Base)" entry while retaining the ability to
// distinguish live stepping data from persisted packages internally.
function getCurrentRunSourceName() {
	let current = window.systemikaSimulationData ? systemikaSimulationData.getCurrentRun() : null;
	if (current && current.runName) return String(current.runName);
	if (RunResults && RunResults.results && RunResults.results.length && window.SystemikaRunManager) {
		return String(SystemikaRunManager.getRunName() || "Base");
	}
	return "";
}

function hasCurrentRunSource() {
	if (window.systemikaSimulationData && systemikaSimulationData.getCurrentRun()) return true;
	return Boolean(RunResults && RunResults.results && RunResults.results.length);
}

// Multi-run displays can intentionally read several run
// datasets at once. An empty string is the special "current/latest" source;
// named strings refer to persisted .sysrun files. RunNames is JSON so labels
// can safely contain spaces and punctuation. Old models with only RunName are
// migrated lazily the first time they are opened.
function getCompareRunNames(primitive) {
	if (!primitive) return [""];
	let raw = String(primitive.getAttribute("RunNames") || "").trim();
	if (raw) {
		try {
			let parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				let unique = [];
				for (let value of parsed) {
					let name = String(value == null ? "" : value).trim();
					if (!unique.includes(name)) unique.push(name);
				}
				if (unique.length) return unique;
			}
		} catch (error) {
			console.warn("Invalid Compare Plot RunNames attribute", error);
		}
	}
	let legacy = getDisplayRunName(primitive);
	return [legacy];
}

function setCompareRunNames(primitive, names) {
	if (!primitive) return;
	let unique = [];
	for (let value of (Array.isArray(names) ? names : [])) {
		let name = String(value == null ? "" : value).trim();
		if (!unique.includes(name)) unique.push(name);
	}
	primitive.setAttribute("RunNames", JSON.stringify(unique));
	// Multi-run displays no longer use the single-run attribute. Clearing it avoids
	// old single-run code accidentally overriding the multi-selection.
	primitive.setAttribute("RunName", "");
}

function initializeMultiRunSelection(primitive) {
	if (!primitive) return;
	let raw = String(primitive.getAttribute("RunNames") || "").trim();
	let legacy = getDisplayRunName(primitive);
	if (raw || legacy) return;
	let currentName = hasCurrentRunSource() ? getCurrentRunSourceName() : "";
	if (currentName) setCompareRunNames(primitive, [currentName]);
}

// A newly completed named run becomes the active source for ordinary plots and
// is appended to multi-run displays (Compare Plot and Table). Existing
// comparison selections are preserved, so running Policy A after Base
// automatically produces a Base + Policy A comparison rather than requiring
// users to reopen every display and tick the new run manually.
function notifySystemikaRunsChanged(detail = {}) {
	if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof CustomEvent !== "function") return;
	window.dispatchEvent(new CustomEvent("systemika:runs-changed", { detail }));
}

function renameRunInDisplaySelections(oldName, newName) {
	if (typeof primitives !== "function") return;
	let from = String(oldName || "");
	let to = String(newName || "");
	for (let type of ["TimePlot"]) {
		for (let primitive of (primitives(type) || [])) {
			if (getDisplayRunName(primitive) === from) primitive.setAttribute("RunName", to);
		}
	}
	for (let type of ["ComparePlot", "Table", "XyPlot", "HistoPlot"]) {
		for (let primitive of (primitives(type) || [])) {
			setCompareRunNames(primitive, getCompareRunNames(primitive).map(name => name === from ? to : name));
		}
	}
	notifySystemikaRunsChanged({ action: "rename", oldName: from, newName: to });
}

function removeRunFromDisplaySelections(runName) {
	if (typeof primitives !== "function") return;
	let doomed = String(runName || "");
	for (let type of ["TimePlot"]) {
		for (let primitive of (primitives(type) || [])) {
			if (getDisplayRunName(primitive) === doomed) primitive.setAttribute("RunName", "");
		}
	}
	for (let type of ["ComparePlot", "Table", "XyPlot", "HistoPlot"]) {
		for (let primitive of (primitives(type) || [])) {
			setCompareRunNames(primitive, getCompareRunNames(primitive).filter(name => name !== doomed));
		}
	}
	notifySystemikaRunsChanged({ action: "remove", runName: doomed });
}

// Preserve display run selections while an Advance run temporarily becomes
// the active source. Reset restores this snapshot so only the unfinished
// Advance trajectory disappears; every previously displayed saved run remains
// exactly where the user had it.
function captureDisplayRunSelections() {
	if (typeof primitives !== "function") return [];
	let snapshot = [];
	for (let type of ["TimePlot"]) {
		for (let primitive of (primitives(type) || [])) {
			snapshot.push({ id: String(getID(primitive)), type, runName: getDisplayRunName(primitive) });
		}
	}
	for (let type of ["ComparePlot", "Table", "XyPlot", "HistoPlot"]) {
		for (let primitive of (primitives(type) || [])) {
			snapshot.push({ id: String(getID(primitive)), type, runNames: getCompareRunNames(primitive).slice() });
		}
	}
	return snapshot;
}

function restoreDisplayRunSelections(snapshot, transientRunName = "") {
	if (!Array.isArray(snapshot) || typeof findID !== "function") return;
	let restoredIds = new Set();
	for (let entry of snapshot) {
		let primitive = findID(entry.id);
		if (!primitive) continue;
		restoredIds.add(String(entry.id));
		if (Array.isArray(entry.runNames)) setCompareRunNames(primitive, entry.runNames);
		else primitive.setAttribute("RunName", String(entry.runName || ""));
	}

	// Displays created while Advance was running have no pre-Advance snapshot.
	// Remove only the discarded transient run from those displays while leaving
	// any saved runs the user selected during exploration untouched.
	let doomed = String(transientRunName || "").trim();
	if (doomed && typeof primitives === "function") {
		for (let type of ["TimePlot"]) {
			for (let primitive of (primitives(type) || [])) {
				if (restoredIds.has(String(getID(primitive)))) continue;
				if (getDisplayRunName(primitive) === doomed) primitive.setAttribute("RunName", "");
			}
		}
		for (let type of ["ComparePlot", "Table", "XyPlot", "HistoPlot"]) {
			for (let primitive of (primitives(type) || [])) {
				if (restoredIds.has(String(getID(primitive)))) continue;
				setCompareRunNames(primitive, getCompareRunNames(primitive).filter(name => name !== doomed));
			}
		}
	}
	notifySystemikaRunsChanged({ action: "restore-advance-selections" });
}

function selectNewRunForDisplays(runName) {
	let name = String(runName || "").trim();
	if (!name || typeof primitives !== "function") return;

	for (let type of ["TimePlot"]) {
		for (let primitive of (primitives(type) || [])) primitive.setAttribute("RunName", name);
	}

	for (let type of ["ComparePlot", "Table", "XyPlot", "HistoPlot"]) {
		for (let primitive of (primitives(type) || [])) {
			let selected = getCompareRunNames(primitive).filter(Boolean);
			if (!selected.includes(name)) selected.push(name);
			setCompareRunNames(primitive, selected);
		}
	}

	if (typeof window !== "undefined") {
		window.SystemikaDisplayRuns = window.SystemikaDisplayRuns || {};
		window.SystemikaDisplayRuns.lastSelectedRun = name;
		if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
			window.dispatchEvent(new CustomEvent("systemika:new-run-selected", { detail: { runName: name } }));
		}
	}
}

if (typeof window !== "undefined") {
	window.SystemikaDisplayRuns = window.SystemikaDisplayRuns || {};
	window.SystemikaDisplayRuns.selectNewRun = selectNewRunForDisplays;
	window.SystemikaDisplayRuns.captureSelections = captureDisplayRunSelections;
	window.SystemikaDisplayRuns.restoreSelections = restoreDisplayRunSelections;
	window.SystemikaDisplayRuns.removeRun = removeRunFromDisplaySelections;
	window.SystemikaDisplayRuns.renameRun = renameRunInDisplaySelections;
	window.SystemikaDisplayRuns.notifyChanged = notifySystemikaRunsChanged;
}

function getCompareRunBounds(primitive) {
	let min = Infinity;
	let max = -Infinity;
	for (let runName of getCompareRunNames(primitive)) {
		let rows = null;
		if (window.systemikaSimulationData) {
			let run = systemikaSimulationData.getRun(runName);
			if (run) rows = run.rows;
		}
		if (!rows && !runName && RunResults.results) rows = RunResults.results;
		if (!rows || !rows.length) continue;
		let first = Number(rows[0][0]);
		let last = Number(rows[rows.length - 1][0]);
		if (Number.isFinite(first)) min = Math.min(min, first);
		if (Number.isFinite(last)) max = Math.max(max, last);
	}
	return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

function ensureDisplayRunAvailable(primitive, onLoaded) {
	let runName = getDisplayRunName(primitive);
	if (!runName) return true;
	if (!window.systemikaSimulationData) return false;
	if (systemikaSimulationData.hasRun(runName)) return true;
	if (!systemikaSimulationData.persistenceAvailable()) return false;

	systemikaSimulationData.ensureRunLoaded(runName).then(() => {
		if (typeof onLoaded === "function") onLoaded();
	}).catch((error) => {
		console.error(error);
		xAlert(`Unable to load saved run <b>${htmlEscape(runName)}</b>.<br/><br/>${htmlEscape(error.message || String(error))}`);
	});
	return false;
}

function ensureDisplayRunsAvailable(primitive, onLoaded) {
	let runNames = getCompareRunNames(primitive);
	let savedNames = runNames.filter(Boolean);
	if (!savedNames.length) return true;
	if (!window.systemikaSimulationData) return false;
	let missing = savedNames.filter(name => !systemikaSimulationData.hasRun(name));
	if (!missing.length) return true;
	if (!systemikaSimulationData.persistenceAvailable()) return false;

	Promise.all(missing.map(name => systemikaSimulationData.ensureRunLoaded(name))).then(() => {
		if (typeof onLoaded === "function") onLoaded();
	}).catch((error) => {
		console.error(error);
		xAlert(`Unable to load saved run data.<br/><br/>${htmlEscape(error.message || String(error))}`);
	});
	return false;
}

function systemikaFirefoxLimitedRunMode() {
	return window.fileManager
		&& typeof fileManager.shouldSuppressRunManagerUnavailableAlert === "function"
		&& fileManager.shouldSuppressRunManagerUnavailableAlert();
}

class CompareRunsSelectorComponent extends HtmlComponent {
	static get CURRENT_TOKEN() { return "__systemika_current__"; }

	constructor(parent, heading = "Runs to compare") {
		super(parent);
		this.heading = heading;
		this.runOrder = [];
	}

	render() {
		return (`<table class="modern-table zebra systemika-compare-runs-table" style="width:100%;">
			<tr><th>${htmlEscape(this.heading)}</th></tr>
			<tr><td>
				<div class="systemika-compare-run-combined">
					<div class="systemika-compare-run-columns" aria-hidden="true">
						<span>Run</span>
						<span>Display order</span>
					</div>
					<div class="systemika-compare-run-options">Loading runs…</div>
				</div>
				<div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
					<button type="button" class="systemika-compare-runs-toggle-all" style="min-width:132px;">Select / Deselect All</button>
					<button type="button" class="systemika-compare-runs-refresh">Refresh</button>
					<button type="button" class="systemika-compare-runs-folder">Manage Runs</button>
				</div>
				<div class="systemika-compare-runs-status" style="font-size:0.85em; margin-top:4px;"></div>
			</td></tr>
		</table>`);
	}

	optionHtml(value, label, checked, unavailable = false) {
		return `<div class="systemika-compare-run-row" data-run="${htmlEscape(value)}" style="${unavailable ? "opacity:0.65;" : ""}">
			<label class="systemika-compare-run-label">
				<input type="checkbox" class="systemika-compare-run-source" value="${htmlEscape(value)}" ${checked ? "checked" : ""} ${unavailable ? "disabled" : ""}/>
				<span class="systemika-compare-run-name">${htmlEscape(label)}${unavailable ? " (unavailable)" : ""}</span>
			</label>
			<div class="systemika-compare-run-row-order" aria-label="Display order"></div>
		</div>`;
	}

	normalizePersistedOrder(selected, currentName = "") {
		let order = [];
		for (let raw of (Array.isArray(selected) ? selected : [])) {
			let name = String(raw == null ? "" : raw).trim();
			if (!name && currentName) name = currentName;
			if (name && !order.includes(name)) order.push(name);
		}
		this.runOrder = order;
	}

	syncOrderWithChecked() {
		let checked = [];
		this.find(".systemika-compare-run-source:checked").each((index, element) => {
			let name = String($(element).val() || "").trim();
			if (name && !checked.includes(name)) checked.push(name);
		});
		this.runOrder = this.runOrder.filter(name => checked.includes(name));
		for (let name of checked) if (!this.runOrder.includes(name)) this.runOrder.push(name);
		return this.runOrder.slice();
	}

	renderOrderList() {
		let names = this.syncOrderWithChecked();
		let orderByName = new Map(names.map((name, index) => [name, index]));
		this.find(".systemika-compare-run-row").each((rowIndex, element) => {
			let row = $(element);
			let name = String(row.attr("data-run") || "").trim();
			let target = row.find(".systemika-compare-run-row-order");
			if (!orderByName.has(name)) {
				target.html(`<span class="systemika-run-order-empty">—</span>`);
				return;
			}
			let index = orderByName.get(name);
			target.html(`<span class="systemika-run-order-number">${index + 1}</span>
				<button type="button" class="systemika-run-order-up" data-index="${index}" title="Move run up" ${index === 0 ? "disabled" : ""}>↑</button>
				<button type="button" class="systemika-run-order-down" data-index="${index}" title="Move run down" ${index === names.length - 1 ? "disabled" : ""}>↓</button>`);
		});
	}

	moveRun(index, delta) {
		this.syncOrderWithChecked();
		let target = index + delta;
		if (index < 0 || target < 0 || index >= this.runOrder.length || target >= this.runOrder.length) return;
		[this.runOrder[index], this.runOrder[target]] = [this.runOrder[target], this.runOrder[index]];
		this.renderOrderList();
		this.applySelection();
	}

	updateToggleAllLabel() {
		let boxes = this.find(".systemika-compare-run-source:not(:disabled)");
		let checked = boxes.filter(":checked").length;
		let button = this.find(".systemika-compare-runs-toggle-all");
		button.prop("disabled", boxes.length === 0);
		// Keep one stable label/width so the properties dialog does not resize
		// when the toggle changes state. The tooltip still describes the next
		// action for accessibility.
		button.text("Select / Deselect All");
		button.attr("title", boxes.length > 0 && checked === boxes.length ? "Deselect all runs" : "Select all runs");
	}

	async refreshOptions() {
		let options = this.find(".systemika-compare-run-options");
		let status = this.find(".systemika-compare-runs-status");
		let selected = getCompareRunNames(this.primitive);
		let currentName = hasCurrentRunSource() ? getCurrentRunSourceName() : "";
		this.normalizePersistedOrder(selected, currentName);
		let currentChecked = Boolean(currentName) && (selected.includes("") || selected.includes(currentName));
		let html = currentName
			? this.optionHtml(currentName, currentName, currentChecked)
			: "";

		if (!window.systemikaSimulationData || !systemikaSimulationData.persistenceAvailable()) {
			for (let name of selected.filter(Boolean)) {
				if (name !== currentName) html += this.optionHtml(name, name, true, true);
			}
			options.html(html || `<div style="padding:2px 0;">No run data available.</div>`);
			this.updateToggleAllLabel();
			this.renderOrderList();
			let supportedWebStore = window.systemikaBrowserRuns
				&& (!window.systemikaBrowserRuns.isSupported || window.systemikaBrowserRuns.isSupported());
			let fallbackStatus = "Only the current in-memory run is available in Browser Storage Mode. Full run comparison requires project-folder access.";
			if (window.fileManager && typeof fileManager.getProjectStorageUnavailableShortMessage === "function") {
				fallbackStatus = fileManager.getProjectStorageUnavailableShortMessage();
			}
			status.text(supportedWebStore
				? "Persistent run storage is not connected yet. Use Run or Manage Runs to authorize the model's project folder."
				: fallbackStatus);
			return;
		}

		try {
			let runs = await systemikaSimulationData.listRuns();
			let names = runs.map(run => run.runName);
			// A run that no longer exists must not remain checked. This covers both
			// Manage Runs deletions and files removed externally between refreshes.
			let available = new Set(names);
			if (currentName) available.add(currentName);
			let prunedSelected = selected.filter(name => !name || available.has(name));
			if (prunedSelected.length !== selected.length) {
				setCompareRunNames(this.primitive, prunedSelected);
				selected = prunedSelected;
			}
			for (let name of names) {
				// If the live run and saved package have the same label, expose one
				// user-facing item. The live source wins until the run completes.
				if (currentName && name === currentName) continue;
				html += this.optionHtml(name, name, selected.includes(name));
			}
			// Missing saved runs were pruned from the selection above.
			options.html(html || `<div style="padding:2px 0;">No saved runs yet.</div>`);
			this.normalizePersistedOrder(selected, currentName);
			this.updateToggleAllLabel();
			this.renderOrderList();
			this.updateStatus();
		} catch (error) {
			console.error(error);
			options.html(html || `<div style="padding:2px 0;">No run data available.</div>`);
			this.updateToggleAllLabel();
			this.renderOrderList();
			status.text(`Unable to list saved runs: ${error.message || error}`);
		}
	}

	selectedFromUi() {
		return this.syncOrderWithChecked();
	}

	updateStatus() {
		let names = this.selectedFromUi();
		let status = this.find(".systemika-compare-runs-status");
		if (!names.length) status.text("No run selected. Select one or more runs to display.");
		else if (names.length === 1) status.text("1 run selected.");
		else status.text(`${names.length} runs selected for comparison.`);
	}

	async applySelection() {
		let names = this.selectedFromUi();
		let savedNames = names.filter(Boolean);
		let status = this.find(".systemika-compare-runs-status");
		try {
			if (savedNames.length && window.systemikaSimulationData) {
				status.text("Loading selected runs…");
				await Promise.all(savedNames.map(name => systemikaSimulationData.ensureRunLoaded(name)));
			}
			setCompareRunNames(this.primitive, names);
			this.updateStatus();
			this.parent.subscribePool.publish("run sources changed");
		} catch (error) {
			console.error(error);
			xAlert(`Unable to load selected run.<br/><br/>${htmlEscape(error.message || String(error))}`);
			await this.refreshOptions();
		}
	}

	bindEvents() {
		this.refreshOptions();
		let manageRunsButton = this.find(".systemika-compare-runs-folder");
		if (systemikaFirefoxLimitedRunMode()) {
			manageRunsButton.prop("disabled", true);
			manageRunsButton.attr("title", "Manage Runs requires a Chromium-based browser");
		}
		if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
			window.addEventListener("systemika:new-run-selected", () => this.refreshOptions());
			window.addEventListener("systemika:runs-changed", () => this.refreshOptions());
		}
		this.find(".systemika-compare-run-options").on("change", ".systemika-compare-run-source", () => {
			this.updateToggleAllLabel();
			this.renderOrderList();
			this.applySelection();
		});
		this.find(".systemika-compare-runs-toggle-all").click((event) => {
			event.preventDefault();
			let boxes = this.find(".systemika-compare-run-source:not(:disabled)");
			let shouldSelect = boxes.length > 0 && boxes.filter(":checked").length !== boxes.length;
			boxes.prop("checked", shouldSelect);
			this.updateToggleAllLabel();
			this.renderOrderList();
			this.applySelection();
		});
		this.find(".systemika-compare-run-options").on("click", ".systemika-run-order-up, .systemika-run-order-down", (event) => {
			event.preventDefault();
			let button = $(event.currentTarget);
			let index = Number(button.attr("data-index"));
			this.moveRun(index, button.hasClass("systemika-run-order-up") ? -1 : 1);
		});
		this.find(".systemika-compare-runs-refresh").click((event) => {
			event.preventDefault();
			this.refreshOptions();
		});
		this.find(".systemika-compare-runs-folder").click(async (event) => {
			event.preventDefault();
			if (systemikaFirefoxLimitedRunMode()) return;
			try {
				if (window.SystemikaRunManager) await SystemikaRunManager.openRunsFolder();
			} catch (error) {
				console.error(error);
				xAlert(`Unable to open the Runs manager.<br/><br/>${htmlEscape(error.message || String(error))}`);
			}
		});
	}

	applyChange() {
		setCompareRunNames(this.primitive, this.selectedFromUi());
	}
}

class RunSelectorComponent extends HtmlComponent {
	render() {
		return (`<table class="modern-table zebra systemika-run-source-table" style="width:100%;">
			<tr><th>Run data</th></tr>
			<tr><td>
				<select class="systemika-run-source enter-apply" style="width:100%;">
					<option value="">Loading runs…</option>
				</select>
				<div style="display:flex; gap:4px; margin-top:4px;">
					<button type="button" class="systemika-run-source-refresh">Refresh</button>
					<button type="button" class="systemika-run-source-folder">Manage Runs</button>
				</div>
				<div class="systemika-run-source-status" style="font-size:0.85em; margin-top:4px;">Loading saved runs…</div>
			</td></tr>
		</table>`);
	}

	async refreshOptions() {
		let select = this.find(".systemika-run-source");
		let status = this.find(".systemika-run-source-status");
		let selected = getDisplayRunName(this.primitive);
		let currentName = hasCurrentRunSource() ? getCurrentRunSourceName() : "";
		let effectiveSelected = currentName && (selected === "" || selected === currentName) ? currentName : selected;

		if (!window.systemikaSimulationData || !systemikaSimulationData.persistenceAvailable()) {
			let html = currentName
				? `<option value="${htmlEscape(currentName)}">${htmlEscape(currentName)}</option>`
				: `<option value="">No run data available</option>`;
			if (selected && selected !== currentName) html += `<option value="${htmlEscape(selected)}">${htmlEscape(selected)} (unavailable)</option>`;
			select.html(html);
			select.val(effectiveSelected);
			let supportedWebStore = window.systemikaBrowserRuns
				&& (!window.systemikaBrowserRuns.isSupported || window.systemikaBrowserRuns.isSupported());
			status.text(supportedWebStore
				? "Persistent run storage is not connected yet. Use Run or Manage Runs to authorize the model's project folder."
				: "Persistent project-local run storage is unavailable in this browser.");
			return;
		}

		try {
			let runs = await systemikaSimulationData.listRuns();
			let names = runs.map(run => run.runName);
			let html = currentName ? `<option value="${htmlEscape(currentName)}">${htmlEscape(currentName)}</option>` : "";
			for (let name of names) {
				if (currentName && name === currentName) continue;
				html += `<option value="${htmlEscape(name)}">${htmlEscape(name)}</option>`;
			}
			if (selected && selected !== currentName && !names.includes(selected)) {
				html += `<option value="${htmlEscape(selected)}">${htmlEscape(selected)} (missing)</option>`;
			}

			// If there is no live run yet, make an existing saved run immediately
			// useful instead of exposing a synthetic Current/latest option.
			if (!currentName && !effectiveSelected && names.length) {
				effectiveSelected = names.includes("Base") ? "Base" : names[0];
				this.primitive.setAttribute("RunName", effectiveSelected);
				await systemikaSimulationData.ensureRunLoaded(effectiveSelected);
			}
			if (!html) html = `<option value="">No saved runs yet</option>`;
			select.html(html);
			select.val(effectiveSelected);
			let visibleCount = names.length + (currentName && !names.includes(currentName) ? 1 : 0);
			status.text(visibleCount ? `${visibleCount} run${visibleCount === 1 ? "" : "s"} available.` : "No saved runs yet.");
		} catch (error) {
			console.error(error);
			status.text(`Unable to list saved runs: ${error.message || error}`);
		}
	}

	bindEvents() {
		this.refreshOptions();
		let manageRunsButton = this.find(".systemika-run-source-folder");
		if (systemikaFirefoxLimitedRunMode()) {
			manageRunsButton.prop("disabled", true);
			manageRunsButton.attr("title", "Manage Runs requires a Chromium-based browser");
		}
		if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
			window.addEventListener("systemika:new-run-selected", () => this.refreshOptions());
			window.addEventListener("systemika:runs-changed", () => this.refreshOptions());
		}
		this.find(".systemika-run-source-refresh").click((event) => {
			event.preventDefault();
			this.refreshOptions();
		});
		this.find(".systemika-run-source-folder").click(async (event) => {
			event.preventDefault();
			if (systemikaFirefoxLimitedRunMode()) return;
			try {
				if (window.SystemikaRunManager) await SystemikaRunManager.openRunsFolder();
			} catch (error) {
				console.error(error);
				xAlert(`Unable to open the Runs manager.<br/><br/>${htmlEscape(error.message || String(error))}`);
			}
		});
		this.find(".systemika-run-source").change(async (event) => {
			let select = $(event.currentTarget);
			let status = this.find(".systemika-run-source-status");
			let runName = String(select.val() || "");
			select.prop("disabled", true);
			try {
				if (runName) {
					status.text(`Loading ${runName}…`);
					await systemikaSimulationData.ensureRunLoaded(runName);
				}
				this.primitive.setAttribute("RunName", runName);
				let displayName = runName || getCurrentRunSourceName();
				status.text(displayName ? `Using run: ${displayName}` : "No run data selected.");
				this.parent.subscribePool.publish("run source changed");
			} catch (error) {
				console.error(error);
				xAlert(`Unable to load saved run.<br/><br/>${htmlEscape(error.message || String(error))}`);
				select.val(getDisplayRunName(this.primitive));
			} finally {
				select.prop("disabled", false);
			}
		});
	}

	applyChange() {
		let value = String(this.find(".systemika-run-source").val() || "");
		this.primitive.setAttribute("RunName", value);
	}
}

// This is the super class for ComparePlotDialog and TableDialog
class DisplayDialog extends jqDialog {
	constructor(id) {
		super();
		this._dialogOwnedContent = this.dialogContent;
		this._dockMounted = false;
		this.primitive = findID(id);
		this.displayIdList = [];
		this.subscribePool = new SubscribePool();
		this.acceptedPrimitveTypes = ["Stock", "Flow", "Variable", "Converter"];
		this.displayLimit = undefined;
		this.components = [];
		this.topComponents = [];
		this._liveApplyTimer = null;
	}
	bindEnterApplyEvents() {
		// The docked settings panel is live; Enter should behave naturally inside
		// controls rather than invoking the hidden legacy modal dialog's Apply.
		if (this._dockMounted) return;
		return jqDialog.prototype.bindEnterApplyEvents.call(this);
	}
	getSelectedRunName() {
		return getDisplayRunName(this.primitive);
	}
	getDefaultPlotPeriod() {
		return RunResults.getTimeStep(this.getSelectedRunName());
	}
	getDataTimeStart() {
		return RunResults.getDataTimeStart(this.getSelectedRunName());
	}
	getDataTimeLength() {
		return RunResults.getDataTimeLength(this.getSelectedRunName());
	}
	clearRemovedIds() {
		for (let id of this.displayIdList) {
			if (findID(id) == null) {
				this.setDisplayId(id, false);
			}
		}
	}
	getAcceptedPrimitiveList() {
		let results = [];
		let primitiveList = getPrimitiveList();
		for (let primitive of primitiveList) {
			this.acceptsId(primitive.id) && results.push(primitive);
		}
		return results;
	}
	acceptsId(id) {
		let type = getType(findID(id));
		return (this.acceptedPrimitveTypes.indexOf(type) != -1);
	}
	removeIdToDisplay(id) {
		let idxToRemove = this.displayIdList.indexOf(id);
		idxToRemove !== -1 && this.displayIdList.splice(idxToRemove, 1);
	}
	addIdToDisplay(id) {
		let index = this.displayIdList.indexOf(id)
		index === -1 && this.displayIdList.push(id)
	}
	setDisplayId(id, value) {
		let oldIdIndex = this.displayIdList.indexOf(id);
		switch (value) {
			case true:
				// Check that the id can be added
				if (!this.acceptsId(id)) {
					return;
				}
				// Check if id already in this.displayIdList
				if (oldIdIndex != -1) {
					return;
				}
				// Add the value
				this.displayIdList.push(id.toString());

				break;
			case false:
				// Check if id is not in the list
				if (oldIdIndex == -1) {
					return;
				}
				this.displayIdList.splice(oldIdIndex, 1);
				break;
		}
	}
	getDisplayId(id) {
		id = id.toString();
		return this.displayIdList.indexOf(id) != -1
	}
	setIdsToDisplay(idList) {
		this.displayIdList = [];
		idList.forEach((id) => this.setDisplayId(id, true))
	}
	getIdsToDisplay() {
		this.clearRemovedIds();
		return this.displayIdList;
	}
	mountInDock(container) {
		if (!container) return;
		this.dialogContent = container;
		this._dockMounted = true;
		this.beforeShow();
		// Docked output settings are live. There is deliberately no Apply footer:
		// each edit updates the model/output as soon as the control changes. Search
		// fields are excluded because they filter the selector UI only.
		$(container).off(".systemikaLiveSettings").on(
			"input.systemikaLiveSettings change.systemikaLiveSettings",
			"input, select, textarea",
			(event) => {
				if ($(event.target).hasClass("primitive-filter-input")) return;
				this.requestLiveApply();
			}
		);
	}

	requestLiveApply(delay = 80) {
		if (!this._dockMounted) return;
		if (this._liveApplyTimer) clearTimeout(this._liveApplyTimer);
		this._liveApplyTimer = setTimeout(() => {
			this._liveApplyTimer = null;
			let result = this.makeApply();
			if (result === false) return;
			if (window.SystemikaPlotPages && SystemikaPlotPages.isPagedPrimitive(this.primitive)) SystemikaPlotPages.persistCurrentPage(this.primitive);
			this.subscribePool.publish("dock live change");
			History.storeUndoState();
			InfoBar.update();
		}, Math.max(0, Number(delay) || 0));
	}
	flushLiveApply() {
		if (this._liveApplyTimer) {
			clearTimeout(this._liveApplyTimer);
			this._liveApplyTimer = null;
		}
		if (!this._dockMounted) return;
		let result = this.makeApply();
		if (result === false) return false;
		return true;
	}
	refreshDockedSettings() {
		if (!this._dockMounted) return;
		this.beforeShow();
	}
	unmountFromDock() {
		if (!this._dockMounted) return;
		this._dockMounted = false;
		this.dialogContent = this._dialogOwnedContent;
	}
	show() {
		let visual = connection_array[String(getID(this.primitive))];
		if (window.SystemikaOutputDock && visual && SystemikaOutputDock.isOutputVisual(visual)) {
			SystemikaOutputDock.activateVisual(visual);
			return;
		}
		super.show();
	}
	afterClose() {
		this.subscribePool.publish("window closed");
	}
	makeApply() {
		this.topComponents.forEach(component => component.applyChange());
		this.components.forEach(column => column.forEach(component => component.applyChange()));
		if (window.SystemikaPlotPages && SystemikaPlotPages.isPagedPrimitive(this.primitive)) {
			SystemikaPlotPages.persistCurrentPage(this.primitive);
		}
	}
	beforeShow() {
		let wrapComponent = component => `<div class="systemika-output-setting-box">${component.render()}</div>`;
		let topHtml = this.topComponents.length
			? `<div class="systemika-output-primary-selector">${this.topComponents.map(wrapComponent).join(`<div class="vertical-space"></div>`)}</div><div class="vertical-space"></div>`
			: "";
		this.setHtml(`${topHtml}<div class="table">
			<div class="table-row">
				${this.components.map(column => `<div class="table-cell">
					${column.map(wrapComponent).join(`<div class="vertical-space"></div>`)}
				</div>`).join("")}
			</div>
		</div>`);
		this.topComponents.forEach(component => component.bindEvents());
		this.components.forEach(column => column.forEach(component => component.bindEvents()));
		this.bindEnterApplyEvents();
	}
}

/**
 * @param axisOptions [{text, key, isTimeAxis}]
 */
class AxisLimitsComponent extends HtmlComponent {
	constructor(parent, axisOptions) {
		super(parent);
		this.axisOptions = axisOptions;
	}
	render() {
		let axisLimits = JSON.parse(this.primitive.getAttribute("AxisLimits"));
		return (`
		<table class="modern-table zebra">
			<tr>
				${["Axis", "Min", "Max", "Auto"].map(title => `<th>${title}</th>`).join("")}
			</tr>
			${this.axisOptions.map(axis => {
			let limit = axisLimits[axis.key];
			let min = axis.isTimeAxis && limit.auto ? this.parent.getDataTimeStart() : limit.min;
			let max = axis.isTimeAxis && limit.auto ? this.parent.getDataTimeStart() + this.parent.getDataTimeLength() : limit.max;
			return (`<tr>
					<td style="text-align:center; padding:0px 6px">${axis.text}</td>
					<td style="padding:1px;">
						<input class="${axis.key}-min-field limit-input enter-apply" type="number" ${limit.auto ? "disabled" : ""} value="${min}">
					</td>
					<td style="padding:1px;">
						<input class="${axis.key}-max-field limit-input enter-apply" type="number" ${limit.auto ? "disabled" : ""} value="${max}">
					</td>
					<td>
						<input class="${axis.key}-checkbox limit-input enter-apply" type="checkbox" ${checkedHtml(limit.auto)}>
					</td>
				</tr>`);
		}).join("")}
		</table>
		<div class="axis-limits-warning-div" ></div>`);
	}
	bindEvents() {
		let axisLimits = JSON.parse(this.primitive.getAttribute("AxisLimits"));
		this.axisOptions.forEach(axis => {
			let limit = axisLimits[axis.key];
			this.find(`.${axis.key}-checkbox`).change(event => {
				let checkboxAuto = $(event.target).prop("checked");
				// Disable/enable input boxes
				this.find(`.${axis.key}-min-field, .${axis.key}-max-field`).prop("disabled", checkboxAuto);

				// Set input values
				let min = axis.isTimeAxis && checkboxAuto ? this.parent.getDataTimeStart() : limit.min;
				let max = axis.isTimeAxis && checkboxAuto ? this.parent.getDataTimeStart() + this.parent.getDataTimeLength() : limit.max;
				this.find(`.${axis.key}-min-field`).val(min);
				this.find(`.${axis.key}-max-field`).val(max);

				this.checkValidAxisLimits();
			});
		});

		this.find("input[type='text'].limit-input").keyup(() => {
			this.checkValidAxisLimits();
		});
	}

	checkValidAxisLimits() {
		let warningDiv = this.find(".axis-limits-warning-div");

		let hasFaultReduce = (acc, axis) => {
			let min = this.find(`.${axis.key}-min-field`).val();
			let max = this.find(`.${axis.key}-max-field`).val();
			return acc || isNaN(min) || isNaN(max);
		}

		let shouldWarn = this.axisOptions.reduce(hasFaultReduce, false);
		if (shouldWarn) {
			warningDiv.html(warningHtml(`Axis limits must be decimal numbers`, true));
			return false;
		} else {
			warningDiv.html("");
			return true;
		}
	}

	applyChange() {
		if (this.checkValidAxisLimits()) {
			let axisLimits = JSON.parse(this.parent.primitive.getAttribute("AxisLimits"));
			this.axisOptions.forEach(axis => {
				axisLimits[axis.key].auto = this.find(`.${axis.key}-checkbox`).prop("checked");
				axisLimits[axis.key].min = Number(this.find(`.${axis.key}-min-field`).val());
				axisLimits[axis.key].max = Number(this.find(`.${axis.key}-max-field`).val());
			});
			this.primitive.setAttribute("AxisLimits", JSON.stringify(axisLimits));
		}
	}
}

class TimePlotSelectorComponent extends PlotVariableSelectorComponent {
	constructor(parent) {
		super(parent, undefined, { lineStyle: true });
		this.sides = [];
	}
	selectedGridClass() {
		return "systemika-variable-grid systemika-variable-grid-time";
	}
	renderSelectedColumns() {
		return `<div class="${this.selectedGridClass()} systemika-variable-columns" aria-hidden="true">
			<span>Variable</span><span>Dash</span><span>Width</span><span>Axis</span>
		</div>`;
	}
	renderSelectedRow(id, index) {
		let selectedSide = this.sides[index] === "R" ? "R" : "L";
		return `<div class="${this.selectedGridClass()} systemika-variable-row" data-id="${htmlEscape(String(id))}">
			${this.variableIdentityHtml(id)}
			${this.styleControlsHtml(id)}
			<select class="plot-variable-axis-select" data-id="${htmlEscape(String(id))}" aria-label="Axis for ${htmlEscape(findID(id) ? getName(findID(id)) : String(id))}">
				<option value="L" ${selectedSide === "L" ? "selected" : ""}>Left</option>
				<option value="R" ${selectedSide === "R" ? "selected" : ""}>Right</option>
			</select>
		</div>`;
	}
	bindPlotSpecificRowEvents() {
		this.find(".systemika-variable-selected-list .plot-variable-axis-select").change(event => {
			event.stopPropagation();
			let field = $(event.currentTarget);
			let id = String(field.attr("data-id") || "");
			let index = this.displayIds.indexOf(id);
			if (index !== -1) this.sides[index] = String(field.val() || "L") === "R" ? "R" : "L";
			this.parent.requestLiveApply(0);
		});
	}
	removeButtonHandler(event) {
		let removeId = String($(event.currentTarget).attr("data-id") || "");
		let removeIndex = this.displayIds.indexOf(removeId);
		if (removeIndex !== -1) {
			this.displayIds.splice(removeIndex, 1);
			this.sides.splice(removeIndex, 1);
		}
	}
	addButtonHandler(event) {
		let addId = String($(event.currentTarget).attr("data-id") || "");
		if (addId && !this.displayIds.includes(addId)) {
			this.displayIds.push(addId);
			this.sides.push("L");
		}
	}
	render() {
		this.sides = getDisplaySides(this.primitive);
		return super.render();
	}
	applyChange() {
		setDisplayIds(this.primitive, this.displayIds, this.sides);
		let activeStyles = {};
		this.displayIds.forEach(id => { activeStyles[String(id)] = this.ensureStyle(id); });
		setPlotLineStyles(this.primitive, activeStyles);
	}
}

class TimePlotDialog extends DisplayDialog {
	constructor(id) {
		super(id);
		this.setTitle("Time Plot Properties");
		let entitySelector = new TimePlotSelectorComponent(this);
		this.topComponents = [entitySelector];
		this.components = [
			[new RunSelectorComponent(this)],
			[
				new AxisLimitsComponent(this, [
					{ text: "Time", key: "timeaxis", isTimeAxis: true },
					{ text: "Left", key: "leftaxis" },
					{ text: "Right", key: "rightaxis" },
				]),
				new LabelTableComponent(this, [
					{ text: "Title", attribute: "TitleLabel" },
					{ text: "Left", attribute: "LeftAxisLabel" },
					{ text: "Right", attribute: "RightAxisLabel" }
				])
			]
		];
	}
}

class GenerationsComponent extends HtmlComponent {
	/** @type {DataGenerations} */
	gens;
	/**
	 * @param {DataGenerations} gens
	 */
	constructor(parent, gens) {
		super(parent)
		this.gens = gens
	}
	render() {
		const result = (`<div id=${this.componentId} style="max-height: 300px; overflow-x: auto;">
			${this.renderTable()}
		</div>`);
		return result;
	}
	renderTable() {
		const generationsHtml = `<table class="modern-table" style="width: 100%;">
			<tr>
				<th>#</th><th>Model Entity</th><th>Label</th><th></th>
			</tr>
			${this.gens.map((value, index) => `
			${value.index == 0 && value.genIndex != 0 ? `<tr style="background-color: #ccc;"><td colspan="4"></td></tr>` : ""}
			<tr>
				<td>${index + 1}</td>
				<td>
					<div class="center-vertically-container">
						<div style="width: 1.75rem; padding-right: 0.25rem;">
							${PrimitiveSvgPreview.create(value.type.toLowerCase(), { color: value.color, dice: value.isRandom })}
						</div>
						<span class="cm-primitive cm-${value.color}">${value.name}</span>
					</div>
				</td>
				<td>
					<input type="text" class="sim-label enter-apply" style="width: 100%; text-align: left;" data-gen-index="${value.genIndex}" data-id="${value.id}" value="${value.label}"/>
				</td>
				<td style="padding:0;" >
					<button class="primitive-remove-button enter-apply" title="Delete Simulation" data-gen-index="${value.genIndex}" data-id="${value.id}">X</button>
				</td>
			</tr>`).join("")}
		</table>`
		const clearButtonHtml = `<table class="modern-table zebra" style="width:100%; text-align:center;"><tr><td>
			<button class="clear-button enter-apply">Clear Results</button>
		</td></tr></table>`
		return `<div id="${this.componentId}">
			${this.gens.idGen.length != 0 ? generationsHtml : ""}
			${clearButtonHtml}
		</div>`
	}
	applyChange() {
		let fields = this.find(`#${this.componentId} input[type="text"].sim-label`);
		this.find(`#${this.componentId} input[type="text"].sim-label`).each((index) => {
			const elem = $(fields[index]);
			const genIndex = elem.attr("data-gen-index");
			const id = elem.attr("data-id");
			const value = elem.val();
			this.gens.setLabel(genIndex, id, value);
		});
	}
	bindEvents() {
		this.find(`#${this.componentId} .primitive-remove-button`).click(event => {
			const button = $(event.currentTarget);
			this.gens.removeSim(button.attr("data-gen-index"), button.attr("data-id"));
			// re-render table
			this.find(`#${this.componentId}`).html(this.renderTable());
			this.bindEvents();
		})
		this.find(".clear-button").click((event) => {
			$(event.currentTarget).prop("disabled", true);
			let id = getID(this.primitive);
			let parentVisual = connection_array[id];
			parentVisual.clearGenerations();
			this.find(`#${this.componentId}`).html(this.renderTable());
			this.bindEvents();
		});
	}
}

class ComparePlotDialog extends DisplayDialog {
	constructor(id) {
		super(id);
		this.setTitle("Time Plot Properties");

		let entitySelector = new PlotVariableSelectorComponent(this, undefined, { lineStyle: true });
		this.topComponents = [entitySelector];
		this.components = [
			[new CompareRunsSelectorComponent(this)],
			[
				new AxisLimitsComponent(this, [
					{ text: "Time", key: "timeaxis", isTimeAxis: true },
					{ text: "Y-Axis", key: "yaxis" }
				]),
				new LabelTableComponent(this, [
					{ text: "Title", attribute: "TitleLabel" },
					{ text: "Y-Axis Label", attribute: "LeftAxisLabel" }
				])
			]
		];
	}
	getDefaultPlotPeriod() {
		let steps = getCompareRunNames(this.primitive)
			.map(name => Number(RunResults.getTimeStep(name)))
			.filter(value => Number.isFinite(value) && value > 0);
		return steps.length ? Math.min(...steps) : super.getDefaultPlotPeriod();
	}
	getDataTimeStart() {
		let bounds = getCompareRunBounds(this.primitive);
		return bounds ? bounds.min : super.getDataTimeStart();
	}
	getDataTimeLength() {
		let bounds = getCompareRunBounds(this.primitive);
		return bounds ? bounds.max - bounds.min : super.getDataTimeLength();
	}
}

class HistogramOptionsComponent extends HtmlComponent {
	constructor(parent) {
		super(parent);
		this.tableData = {
			headers: ["", "Value", "Auto"],
			rows: [
				{ label: "Upper Bound", classPrefix: "upper-bound", attribute: "UpperBound" },
				{ label: "Lower Bound", classPrefix: "lower-bound", attribute: "LowerBound" },
				{ label: "No. Bars", classPrefix: "num-bars", attribute: "NumberOfBars" }
			]
		};
	}
	render() {
		return (`<table class="modern-table zebra">
			<tr>
				${this.tableData.headers.map(header => `<th>${header}</th>`).join("")}
			</tr>
			${this.tableData.rows.map(row => {
			let value = this.primitive.getAttribute(row.attribute);
			let auto = this.primitive.getAttribute(`${row.attribute}Auto`) === "true";
			return (`<tr>
				<td><b>${row.label}:</b></td>
				<td><input class="${row.classPrefix}-field enter-apply" type="number" value=${value} ${auto ? "disabled" : ""} /></td>
				<td><input class="${row.classPrefix}-auto-checkbox enter-apply" type="checkbox" ${checkedHtml(auto)} /></td>
			</tr>`)
		}).join("")}
		</table>`);
	}
	bindEvents() {
		this.tableData.rows.forEach(row => {
			let valueField = this.find(`.${row.classPrefix}-field`);
			let checkbox = this.find(`.${row.classPrefix}-auto-checkbox`);

			checkbox.click(event => {
				let auto = $(event.currentTarget).prop("checked");
				valueField.prop("disabled", auto);
			});
		});
	}
	applyChange() {
		this.tableData.rows.forEach(row => {
			let value = this.find(`.${row.classPrefix}-field`).val();
			let auto = this.find(`.${row.classPrefix}-auto-checkbox`).prop("checked");
			this.primitive.setAttribute(`${row.attribute}Auto`, auto);
			if (!auto && !isNaN(value)) {
				this.primitive.setAttribute(row.attribute, value);
			}
		});
	}
}

class HistoPlotDialog extends DisplayDialog {
	constructor(id) {
		super(id);
		this.setTitle("Histogram Plot Properties");
		this.displayLimit = 1;

		let entitySelector = new PlotVariableSelectorComponent(this, 1);
		this.topComponents = [entitySelector];
		this.components = [
			[new CompareRunsSelectorComponent(this)],
			[
				new HistogramOptionsComponent(this)
			]
		];
	}
}

class XySelectorComponent extends PlotVariableSelectorComponent {
	constructor(parent, displayLimit = 2) {
		super(parent, displayLimit, { lineStyle: true });
	}
	selectedGridClass() {
		return "systemika-variable-grid systemika-variable-grid-xy";
	}
	renderSelectedColumns() {
		return `<div class="${this.selectedGridClass()} systemika-variable-columns" aria-hidden="true">
			<span>Variable</span><span>Axis</span><span>Dash</span><span>Width</span>
		</div>`;
	}
	renderSelectedRow(id, index) {
		let axis = index === 0 ? "X" : "Y";
		let styleHtml = index === 1
			? this.styleControlsHtml(id)
			: `<span class="systemika-variable-style-na" title="XY curve style is controlled by the Y variable">—</span><span class="systemika-variable-style-na">—</span>`;
		return `<div class="${this.selectedGridClass()} systemika-variable-row" data-id="${htmlEscape(String(id))}">
			${this.variableIdentityHtml(id)}
			<span class="systemika-variable-axis-label">${axis}</span>
			${styleHtml}
		</div>`;
	}
}

class XyPlotDialog extends DisplayDialog {
	constructor(id) {
		super(id);
		this.setTitle("XY Plot Properties");

		let entitySelector = new XySelectorComponent(this, 2);
		this.topComponents = [entitySelector];
		this.components = [
			[new CompareRunsSelectorComponent(this)],
			[
				new AxisLimitsComponent(this, [
					{ text: "X-Axis", key: "xaxis" },
					{ text: "Y-Axis", key: "yaxis" }
				]),
				new CheckboxTableComponent(this, [
					{ text: "Show Line", attribute: "ShowLine" },
					{ text: "Show Number", attribute: "ShowNumber" },
					{ text: "Mark Start (🔴)", attribute: "MarkStart" },
					{ text: "Mark End (🟩)", attribute: "MarkEnd" },
				]),
				new LabelTableComponent(this, [{ text: "Title", attribute: "TitleLabel" }])
			]
		];
	}
	getDefaultPlotPeriod() {
		let steps = getCompareRunNames(this.primitive)
			.map(name => Number(RunResults.getTimeStep(name)))
			.filter(value => Number.isFinite(value) && value > 0);
		return steps.length ? Math.min(...steps) : super.getDefaultPlotPeriod();
	}
}

const SYSTEMIKA_TABLE_DEFAULT_DECIMALS = 2;
const SYSTEMIKA_TABLE_MAX_DECIMALS = 12;

function normalizeTableDecimal(value, fallback = SYSTEMIKA_TABLE_DEFAULT_DECIMALS) {
	let number = Number(value);
	if (!Number.isInteger(number) || number < 0 || number > SYSTEMIKA_TABLE_MAX_DECIMALS) return fallback;
	return number;
}

function getLegacyTableDecimal(primitive) {
	try {
		let numberLength = JSON.parse(primitive.getAttribute("NumberLength") || "{}");
		return normalizeTableDecimal(numberLength.decimal, SYSTEMIKA_TABLE_DEFAULT_DECIMALS);
	} catch (error) {
		return SYSTEMIKA_TABLE_DEFAULT_DECIMALS;
	}
}

function getTableDecimals(primitive) {
	let result = {};
	try {
		let parsed = JSON.parse(primitive.getAttribute("TableDecimals") || "{}");
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			for (let [id, value] of Object.entries(parsed)) {
				let number = Number(value);
				if (Number.isInteger(number) && number >= 0 && number <= SYSTEMIKA_TABLE_MAX_DECIMALS) result[String(id)] = number;
			}
		}
	} catch (error) {
		console.warn("Invalid TableDecimals attribute", error);
	}
	return result;
}

function getTableDecimalForId(primitive, id, settings = null) {
	let decimals = settings || getTableDecimals(primitive);
	let key = String(id);
	if (Object.prototype.hasOwnProperty.call(decimals, key)) return normalizeTableDecimal(decimals[key]);
	return getLegacyTableDecimal(primitive);
}

class TableSelectorComponent extends PlotVariableSelectorComponent {
	constructor(parent) {
		super(parent);
		this.decimals = {};
	}
	ensureDecimal(id) {
		let key = String(id);
		if (!Object.prototype.hasOwnProperty.call(this.decimals, key)) {
			this.decimals[key] = getTableDecimalForId(this.primitive, key, this.decimals);
		}
		return this.decimals[key];
	}
	selectedGridClass() {
		return "systemika-variable-grid systemika-variable-grid-table";
	}
	renderSelectedColumns() {
		return `<div class="${this.selectedGridClass()} systemika-variable-columns" aria-hidden="true">
			<span>Variable</span><span>Decimal</span>
		</div>`;
	}
	renderSelectedRow(id) {
		let decimal = this.ensureDecimal(id);
		return `<div class="${this.selectedGridClass()} systemika-variable-row" data-id="${htmlEscape(String(id))}">
			${this.variableIdentityHtml(id)}
			<input type="number" class="table-decimal-field enter-apply" data-id="${htmlEscape(String(id))}" min="0" max="${SYSTEMIKA_TABLE_MAX_DECIMALS}" step="1" value="${decimal}" aria-label="Decimal places for ${htmlEscape(findID(id) ? getName(findID(id)) : String(id))}" />
		</div>`;
	}
	renderSelectedRows() {
		return `${super.renderSelectedRows()}<div class="table-decimal-warning warning" style="min-height:1.2em;"></div>`;
	}
	bindPlotSpecificRowEvents() {
		this.find(".systemika-variable-selected-list .table-decimal-field").on("input change", event => {
			let field = $(event.currentTarget);
			let id = String(field.attr("data-id") || "");
			let raw = String(field.val() ?? "").trim();
			let number = Number(raw);
			if (raw === "" || !Number.isInteger(number) || number < 0 || number > SYSTEMIKA_TABLE_MAX_DECIMALS) {
				this.find(".table-decimal-warning").html(warningHtml(`Decimal must be an integer from 0 to ${SYSTEMIKA_TABLE_MAX_DECIMALS}.`, true));
				return;
			}
			this.decimals[id] = number;
			this.find(".table-decimal-warning").html("");
		});
	}
	removeButtonHandler(event) {
		let removeId = String($(event.currentTarget).attr("data-id") || "");
		super.removeButtonHandler(event);
		delete this.decimals[removeId];
	}
	addButtonHandler(event) {
		let addId = String($(event.currentTarget).attr("data-id") || "");
		super.addButtonHandler(event);
		if (addId && !Object.prototype.hasOwnProperty.call(this.decimals, addId)) this.decimals[addId] = getLegacyTableDecimal(this.primitive);
	}
	render() {
		this.decimals = getTableDecimals(this.primitive);
		return super.render();
	}
	applyChange() {
		for (let field of this.find(".table-decimal-field").toArray()) {
			let jqField = $(field);
			let id = String(jqField.attr("data-id") || "");
			let value = Number(jqField.val());
			if (Number.isInteger(value) && value >= 0 && value <= SYSTEMIKA_TABLE_MAX_DECIMALS) this.decimals[id] = value;
			else this.decimals[id] = getTableDecimalForId(this.primitive, id, this.decimals);
		}
		let active = new Set(this.displayIds.map(String));
		let persisted = {};
		for (let id of active) persisted[id] = getTableDecimalForId(this.primitive, id, this.decimals);
		this.primitive.setAttribute("TableDecimals", JSON.stringify(persisted));
		setDisplayIds(this.primitive, this.displayIds);
	}
}

class TableData {
	constructor() {
		this.namesToDisplay = [];
		this.results = [];
		this.runNames = [];
	}
	exportCSV() {
		let string = this.getAsString(",");
		fileManager.exportFile(string, ".csv");
	}
	getAsString(seperator) {
		let headers = ["Time"];
		if (this.runNames.length > 1) {
			for (let name of this.namesToDisplay) {
				for (let runName of this.runNames) headers.push(`${name} [${runName}]`);
			}
		} else {
			headers = headers.concat(this.namesToDisplay);
		}
		let str = headers.join(seperator) + "\n";
		for (let row of this.results) {
			for (let i = 0; i < row.length; i++) {
				let value = row[i];
				if (value !== null && value !== undefined) str += value.toString();
				if (i !== row.length - 1) str += seperator;
			}
			str += "\n";
		}
		return str;
	}
}

class TableLimitsComponent extends HtmlComponent {
	render() {
		let limits = JSON.parse(this.primitive.getAttribute("TableLimits"));
		let startValue = limits.start.auto ? this.parent.getDataTimeStart() : limits.start.value;
		let endValue = limits.end.auto ? this.parent.getDataTimeStart() + this.parent.getDataTimeLength() : limits.end.value;
		let stepValue = limits.step.auto ? this.parent.getDefaultPlotPeriod() : limits.step.value;
		return (`
		<table class="modern-table zebra">
			${["", "Value", "Auto"].map(header => `<th>${header}</th>`).join("")}
			<tr>
				<th>From</th>
				<td style="padding:1px;">
					<input class="limit-input start-field enter-apply" ${limits.start.auto ? "disabled" : ""} value="${startValue}" type="number">
				</td>
				<td><input class="limit-input start-auto-checkbox enter-apply" type="checkbox"  ${checkedHtml(limits.start.auto)}/></td>
			</tr><tr>
				<th>To</th>
				<td style="padding:1px;">
					<input class="limit-input end-field enter-apply" ${limits.end.auto ? "disabled" : ""} value="${endValue}" type="number">
				</td>
				<td><input class="limit-input end-auto-checkbox enter-apply" type="checkbox" ${checkedHtml(limits.end.auto)}/>
				</td>
			</tr><tr title="Step &#8805; DT should hold">
				<th>Step</th>
				<td style="padding:1px;">
					<input class="limit-input step-field enter-apply" ${limits.step.auto ? "disabled" : ""} value="${stepValue}" type="number">
				</td>
				<td><input class="limit-input step-auto-checkbox enter-apply" type="checkbox" ${checkedHtml(limits.step.auto)}/></td>
			</tr>
		</table>
		<div class="limits-warning-div warning"></div>`);
	}
	bindEvents() {
		let limits = JSON.parse(this.primitive.getAttribute("TableLimits"));
		this.find(".start-auto-checkbox").change(event => {
			let startAuto = $(event.target).prop("checked");
			this.find(".start-field").prop("disabled", startAuto);
			this.find(".start-field").val(startAuto ? this.parent.getDataTimeStart() : limits.start.value);
		});
		this.find(".end-auto-checkbox").change(event => {
			let endAuto = $(event.target).prop("checked");
			this.find(".end-field").prop("disabled", endAuto);
			this.find(".end-field").val(endAuto ? this.parent.getDataTimeStart() + this.parent.getDataTimeLength() : limits.end.value);
		});
		this.find(".step-auto-checkbox").change(event => {
			let stepAuto = $(event.target).prop("checked");
			this.find(".step-field").prop("disabled", stepAuto);
			this.find(".step-field").val(stepAuto ? this.parent.getDefaultPlotPeriod() : limits.step.value);
		});
		this.find("input[type='text'].limit-input").keyup(event => {
			this.checkValidTableLimits();
		});
	}
	checkValidTableLimits() {
		let warningDiv = this.find(".limits-warning-div");
		let startStr = this.find(".start-field").val();
		let endStr = this.find(".end-field").val();
		let stepStr = this.find(".step-field").val();
		if (isNaN(startStr) || startStr === "") {
			warningDiv.html(warningHtml(`"From" must be a decimal number`, true));
			return false;
		} else if (isNaN(endStr) || endStr === "") {
			warningDiv.html(warningHtml(`"To" must be a decimal number`, true));
			return false;
		} else if (isNaN(stepStr) || stepStr === "") {
			warningDiv.html(warningHtml(`"Step" must be a decimal number`, true));
			return false;
		} else if (Number(stepStr) <= 0) {
			warningDiv.html(warningHtml(`"Step" must be &gt;0`, true));
			return false;
		}
		warningDiv.html("");
		return true;
	}
	applyChange() {
		if (this.checkValidTableLimits()) {
			let limits = JSON.parse(this.primitive.getAttribute("TableLimits"));

			limits.start.value = Number(this.find(".start-field").val());
			limits.end.value = Number(this.find(".end-field").val());
			limits.step.value = Number(this.find(".step-field").val());

			limits.start.auto = this.find(".start-auto-checkbox").prop("checked");
			limits.end.auto = this.find(".end-auto-checkbox").prop("checked");
			limits.step.auto = this.find(".step-auto-checkbox").prop("checked");
			this.primitive.setAttribute("TableLimits", JSON.stringify(limits));
		}
	}
}

class ArithmeticPrecisionComponent extends HtmlComponent {
	render() {
		let numLength = JSON.parse(this.primitive.getAttribute("NumberLength"));
		let options = [{ key: "precision", label: "Precision" }, { key: "decimal", label: "Decimal" }];
		return (`<table class="modern-table zebra">
			${options.map(option => {
			let key = option.key;
			let isChecked = numLength.usePrecision === (option.key === "precision");
			let disabled = isChecked ? "" : "disabled";
			return (`<tr>
					<td>
						<input class="num-len-radio enter-apply" type="radio" id="${key}" name="num-len" value="${key}" ${checkedHtml(isChecked)}>
					</td>
					<td>
						<label for="${key}" >${option.label}</label>
					</td>
					<td>
						<input class="${key}-field enter-apply" type="number" ${disabled} value="${numLength[key]}">
					</td>
				</tr>`);
		}).join("")}

		</table>
		<div class="num-len-warn-div"></div>`);
	}
	bindEvents() {
		this.find(".num-len-radio[name='num-len']").change(event => {
			let selectedKey = event.target.value;
			let otherKey = (selectedKey === "precision") ? "decimal" : "precision";

			let selectedField = this.find(`.${selectedKey}-field`);
			let otherField = this.find(`.${otherKey}-field`);

			selectedField.prop("disabled", false);
			otherField.prop("disabled", true);

			this.checkValidNumberLength(selectedField.val());
		});
		this.find(".precision-field, .decimal-field").keyup(event => {
			this.checkValidNumberLength(event.target.value);
		});
	}

	checkValidNumberLength(value) {
		if (isNaN(value)) {
			$(".num-len-warn-div").html(warningHtml(`${value} is not a decimal number.`, true));
			return false;
		} else if (Number.isInteger(parseFloat(value)) === false) {
			$(".num-len-warn-div").html(warningHtml(`${value} is not an integer.`, true));
			return false;
		} else if (parseInt(value) < 0) {
			$(".num-len-warn-div").html(warningHtml(`${value} is negative.`, true));
			return false;
		} else if (parseInt(value) >= 12) {
			$(".num-len-warn-div").html(warningHtml(`${value} is above the limit of 12.`, true));
			return false;
		} else {
			$(".num-len-warn-div").html("");
			return true;
		}
	}
	applyChange() {
		let numLength = JSON.parse(this.primitive.getAttribute("NumberLength"));
		let selected = this.find("input[name='num-len']:checked").val();
		let usePrecision = selected === "precision";

		let value = this.find(`.${selected}-field`).val();
		if (this.checkValidNumberLength(value)) {
			numLength[selected] = parseInt(value);
			numLength.usePrecision = usePrecision;
			this.primitive.setAttribute("NumberLength", JSON.stringify(numLength));
		}
	}
}

class RoundToZeroComponent extends HtmlComponent {
	render() {
		let roundToZero = this.primitive.getAttribute("RoundToZero") === "true";
		let roundToZeroAtValue = this.primitive.getAttribute("RoundToZeroAtValue");
		let disabled = roundToZero ? "" : "disabled";
		return (`
			<table class="modern-table zebra">
				<tr>
					<td>
						<input class="round-to-zero-checkbox enter-apply" type="checkbox" ${checkedHtml(roundToZero)} />
						Show <b>0</b> when <i>abs(value) &lt;</i>
						<input class="round-to-zero-field enter-apply" type="number" value="${roundToZeroAtValue}" ${disabled}/>
					</td>
				</tr>
				<tr>
					<td style="text-align: center;">
						<button class="default-round-to-zero-button enter-apply">Reset to Default</button>
					</td>
				</tr>
			</table>
			<span class="round-to-zero-warning-div warning" style="margin: 5px 0px;"></span>
		`);
	}
	bindEvents() {
		let roundToZeroCheckbox = this.find(".round-to-zero-checkbox");
		let roundToZeroField = this.find(".round-to-zero-field");

		// set default button listener
		this.find(".default-round-to-zero-button").click(() => {
			// fetches default for numberbox, but this is also used for table
			// Should be fixes so it fetches default for the type of object the dialog belongs to
			this.setRoundToZero(getDefaultAttributeValue("numberbox", "RoundToZero") === "true");
			roundToZeroField.val(getDefaultAttributeValue("numberbox", "RoundToZeroAtValue"));
			this.checkValidRoundAtZeroAtField();
		});

		roundToZeroCheckbox.click(() => {
			this.setRoundToZero(roundToZeroCheckbox.prop("checked"));
		});

		roundToZeroField.keyup((event) => {
			this.checkValidRoundAtZeroAtField();
		});
	}
	setRoundToZero(roundToZero) {
		this.find(".round-to-zero-checkbox").prop("checked", roundToZero);
		this.find(".round-to-zero-field").prop("disabled", !roundToZero);
		this.checkValidRoundAtZeroAtField();
	}

	checkValidRoundAtZeroAtField() {
		let roundToZeroFieldValue = this.find(".round-to-zero-field").val();
		if (this.find(".round-to-zero-checkbox").prop("checked")) {
			if (isNaN(roundToZeroFieldValue)) {
				this.setNumberboxWarning(true, `<b>${roundToZeroFieldValue}</b> is not a decimal number.`);
				return false;
			} else if (roundToZeroFieldValue == "") {
				this.setNumberboxWarning(true, "No value choosen.");
				return false;
			} else if (Number(roundToZeroFieldValue) >= 1) {
				this.setNumberboxWarning(true, "Value must be less then 1.");
				return false;
			} else if (Number(roundToZeroFieldValue) <= 0) {
				this.setNumberboxWarning(true, "Value must be strictly positive.");
				return false;
			} else {
				this.setNumberboxWarning(false);
				return true;
			}
		} else {
			this.setNumberboxWarning(false);
			return false;
		}
	}

	setNumberboxWarning(isVisible, htmlMessage) {
		let message = isVisible ? warningHtml(htmlMessage, true) : "";
		let visibility = isVisible ? "visible" : "hidden";
		this.find(".round-to-zero-warning-div").html(message);
		this.find(".round-to-zero-warning-div").css("visibility", visibility);
	}

	applyChange() {
		if (this.primitive) {
			let roundToZero = this.find(".round-to-zero-checkbox").prop("checked");
			this.primitive.setAttribute("RoundToZero", roundToZero);

			if (this.checkValidRoundAtZeroAtField()) {
				let roundToZeroAtValue = this.find(".round-to-zero-field").val();
				this.primitive.setAttribute("RoundToZeroAtValue", roundToZeroAtValue);
			}
		}
	}
}

class TableDialog extends DisplayDialog {
	constructor(id) {
		super(id);
		this.setTitle("Table Properties");

		let entitySelector = new TableSelectorComponent(this);
		this.topComponents = [entitySelector];
		this.components = [
			[new CompareRunsSelectorComponent(this, "Runs to include")],
			[
				new TableLimitsComponent(this),
				new RoundToZeroComponent(this)
			]
		];
	}
	getDefaultPlotPeriod() {
		let steps = getCompareRunNames(this.primitive)
			.map(name => Number(RunResults.getTimeStep(name)))
			.filter(value => Number.isFinite(value) && value > 0);
		return steps.length ? Math.min(...steps) : super.getDefaultPlotPeriod();
	}
	getDataTimeStart() {
		let bounds = getCompareRunBounds(this.primitive);
		return bounds ? bounds.min : super.getDataTimeStart();
	}
	getDataTimeLength() {
		let bounds = getCompareRunBounds(this.primitive);
		return bounds ? bounds.max - bounds.min : super.getDataTimeLength();
	}
}


class NewModelDialog extends jqDialog {
	// This dialog is not used.
	// At start TimeUnitDialog is used instead
	constructor() {
		super();
		this.setTitle("New model");
	}
	beforeShow() {
		this.setHtml(`
		<table class="modern-table zebra">
		<tr>
			<td>Time units</td>
			<td style="padding:1px;">
				<input class="input-timeunits enter-apply" name="length" style="width:100px;" value="" type="text">
				<!--
				<button class="input-timeunits-default-value" data-default-value="Years">Years</button>
				<button class="input-timeunits-default-value" data-default-value="Minutes">Minutes</button>
				-->
			</td>
		</tr>
		</table>
		`);
		this.bindEnterApplyEvents();

		$(this.dialogContent).find(".input-timeunits-default-value").click((event) => {
			let selectedUnit = $(event.target).data("default-value");
			$(this.dialogContent).find(".input-timeunits").val(selectedUnit);
			this.makeApply();
		});
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Create": () => {
				this.makeApply();
			}
		};
	}
	beforeClose() {
		// If the users closes the window without choosing anything
		// We currently does not use default values for this
		// if($(this.dialogContent).find(".input-timeunits").val().trim()=="") {
		// 	setTimeUnits("tu");
		//	updateTimeUnitButton();
		//}
	}
	makeApply() {
		let timeUnits = $(this.dialogContent).find(".input-timeunits").val();
		if (!isTimeUnitOk(timeUnits.trim())) {
			xAlert("You have to enter a time unit for the model, e.g. Years or Minutes");
			return;
		}
		setTimeUnits(timeUnits);
		updateTimeUnitButton();

		$(this.dialog).dialog('close');
	}
}


class PreferencesDialog extends jqDialog {
	constructor() {
		super();
		this.setTitle("Preferences");
	}
	beforeShow() {
		const preferences = Preferences.get()
		this.setHtml(`<div class="preferences">${Object.entries(preferencesTemplate).map(([key, info]) => {
			const id = "preference-" + key
			return `<div class="preference">
				<div style="display: flex; justify-content: space-between;">
					<span class="title">${info.title}</span>
					<button class="btn_reset" id="reset-${key}" >Reset</button>
				</div>
				${info.type == "boolean"
					? `<div>
					<input id="${id}" name="${key}" type="checkbox" ${checkedHtml(preferences[key])}>
					<label for="${id}">${info.description}<label/>
				</div>`
					: ""}
				${info.image ? `<img src="${info.image}"/>` : ""}
			</div>`
		}).join("")}`)
		Object.entries(preferencesTemplate).forEach(([key, info]) => {
			$(this.dialogContent).find(`#reset-${key}`).on("click", () => {
				if (info.type == "boolean")
					$(this.dialogContent).find("#preference-" + key).prop("checked", info.default)
			})
		})
	}
	makeApply() {
		const preferences = Preferences.get()
		Object.entries(preferencesTemplate).forEach(([key, info]) => {
			const element = $(this.dialogContent).find("#preference-" + key)
			const value = info.type == "boolean" ? element.is(":checked") : undefined
			preferences[key] = value
		})
		Preferences.store(preferences)
	}
}

class SimulationSettings extends jqDialog {
	constructor() {
		super();
		this.setTitle("Simulation Settings");
	}
	beforeShow() {
		let start = getTimeStart();
		let length = getTimeLength();
		let step = getTimeStep();
		let advanceBy = (typeof getAdvanceBy === "function") ? getAdvanceBy() : 1;
		let timeUnit = getTimeUnits();
		this.setHtml(`
		<table class="modern-table zebra">
		<tr>
			<td>Start Time</td>
			<td style="padding:1px;">
				<input class="input-start enter-apply" name="start" style="width:100px;" value="${start}" type="number">
				&nbsp ${timeUnit} &nbsp
			</td>
		</tr><tr>
			<td>Length</td>
			<td style="padding:1px;">
				<input class="input-length enter-apply" name="length" style="width:100px;" value="${length}" type="number">
				&nbsp ${timeUnit} &nbsp
			</td>
		</tr><tr>
			<td>Time Step (DT)</td>
			<td style="padding:1px;">
				<input class="input-step enter-apply" name="step" style="width:100px;" value="${step}" type="number">
				&nbsp ${timeUnit} &nbsp
			</td>
		</tr><tr>
			<td>Advance By</td>
			<td style="padding:1px;">
				<input class="input-advance-by enter-apply" name="advanceBy" style="width:100px;" value="${advanceBy}" type="number" min="1" step="1">
				&nbsp ${timeUnit} &nbsp
			</td>
		</tr><tr>
			<td>Method</td>
			<td style="padding:1px;"><select class="input-method enter-apply" style="width:104px">
			<option value="RK1" ${(getAlgorithm() == "RK1") ? "selected" : ""}>Euler</option>
			<option value="RK4" ${(getAlgorithm() == "RK4") ? "selected" : ""}>RK4</option>
			</select></td>
		</tr>
		</table>
		<div class="simulation-settings-warning"></div>
		`);

		this.bindEnterApplyEvents();

		this.start_field = $(this.dialogContent).find(".input-start");
		this.length_field = $(this.dialogContent).find(".input-length");
		this.step_field = $(this.dialogContent).find(".input-step");
		this.advance_by_field = $(this.dialogContent).find(".input-advance-by");
		this.warning_div = $(this.dialogContent).find(".simulation-settings-warning");
		this.method_select = $(this.dialogContent).find(".input-method");
		this.advanceMode = Boolean(typeof RunResults !== "undefined" && RunResults.isAdvanceActive());
		if (this.advanceMode) {
			// Start/Length/DT/solver are compiled into the active simulation. Changing
			// them mid-run would invalidate its solver/task state. Advance By, on the
			// other hand, is a UI stepping preference and is safe to change live.
			this.start_field.prop("disabled", true);
			this.length_field.prop("disabled", true);
			this.step_field.prop("disabled", true);
			this.method_select.prop("disabled", true);
		}

		this.start_field.keyup(() => this.checkValidTimeSettings());
		this.length_field.keyup(() => this.checkValidTimeSettings());
		this.step_field.keyup(() => this.checkValidTimeSettings());
		this.advance_by_field.keyup(() => this.checkValidTimeSettings());
		this.advance_by_field.change(() => this.checkValidTimeSettings());
		this.method_select.change(() => this.checkValidTimeSettings());

		this.checkValidTimeSettings();
	}

	checkValidTimeSettings() {
		if (this.advanceMode) {
			let value = Number(this.advance_by_field.val());
			if (this.advance_by_field.val().trim() === "" || !Number.isInteger(value) || value < 1) {
				this.warning_div.html(warningHtml("Advance By must be a whole number greater than or equal to 1.", true));
				return false;
			}
			this.warning_div.html("");
			return true;
		}
		if (isNaN(this.start_field.val()) || this.start_field.val().trim() === "") {
			this.warning_div.html(warningHtml(`Start <b>${this.start_field.val()}</b> is not a decimal number.`, true));
			return false;
		} else if (isNaN(this.length_field.val()) || this.length_field.val().trim() === "") {
			this.warning_div.html(warningHtml(`Length <b>${this.length_field.val()}</b> is not a decimal number.`, true));
			return false;
		} else if (isNaN(this.step_field.val()) || this.step_field.val().trim() === "") {
			this.warning_div.html(warningHtml(`Step <b>${this.step_field.val()}</b> is not a decimal number.`, true));
			return false;
		} else if (this.advance_by_field.val().trim() === "" || !Number.isInteger(Number(this.advance_by_field.val())) || Number(this.advance_by_field.val()) < 1) {
			this.warning_div.html(warningHtml(`Advance By must be a whole number greater than or equal to 1.`, true));
			return false;
		} else if (Number(this.length_field.val()) <= 0) {
			this.warning_div.html(warningHtml(`Length must be &gt;0`, true));
			return false;
		} else if (Number(this.step_field.val()) <= 0) {
			this.warning_div.html(warningHtml(`Step must be &gt;0`, true));
			return false;
		} else if (Settings.limitSimulationSteps && Number(this.length_field.val()) / Number(this.step_field.val()) > 1e5) {
			let iterations = Math.ceil(Number(this.length_field.val()) / Number(this.step_field.val()));
			let iters_str = format_number(iterations, { use_e_format_upper_limit: 1e5, precision: 3 });
			this.warning_div.html(warningHtml(`
				This Length requires ${iters_str} time steps. <br/>
				The limit is 10<sup>5</sup> time steps per simulation.
			`, true));
			return false;

		} else if (Settings.limitSimulationSteps && Number(this.length_field.val()) / Number(this.step_field.val()) > 1e4) {
			let iterations = Math.ceil(Number(this.length_field.val()) / Number(this.step_field.val()));
			let iters_str = format_number(iterations, { use_e_format_upper_limit: 1e4, precision: 3 });
			this.warning_div.html(noteHtml(`
				This Length requires ${iters_str} time steps. <br/>
				More than 10<sup>4</sup> time steps per simulation <br/>
				may significantly slow down the simulation.`
			));
			return true;
		} else if ($(this.method_select).find(":selected").val() === "RK4") {
			this.warning_div.html(noteHtml(`
				Do not use RK4 without a good reason, <br/>
				and avoid it when the model contains abrupt discontinuities <br/>
				(e.g. a sudden switch created with <b>IfThenElse</b>).
			`));
			return true;
		}

		this.warning_div.html("");
		return true;
	}

	makeApply() {
		if (this.advanceMode) {
			let value = Number(this.advance_by_field.val());
			if (!Number.isInteger(value) || value < 1) {
				this.warning_div.html(warningHtml("Advance By must be a whole number greater than or equal to 1.", true));
				return false;
			}
			if (typeof setAdvanceBy === "function") setAdvanceBy(value);
			return true;
		}

		let validSettings = this.checkValidTimeSettings();
		if (validSettings) {
			setTimeStart(this.start_field.val());
			setTimeLength(this.length_field.val());
			setTimeStep(this.step_field.val());
			if (typeof setAdvanceBy === "function") setAdvanceBy(Number(this.advance_by_field.val()));
			let method = $(".input-method :selected").val();
			setAlgorithm(method);
		}
	}
}

class TimeUnitDialog extends jqDialog {
	constructor() {
		super();
		this.validName = false;
		this.setTitle("Set Time Unit");
		this.setHtml(`
			<div style="min-height: 70px; margin: 8px 0px;">
				Specify the Time Unit to enable model building.</br></br>
				<div style="display: flex; justify-content: space-between; width: 100%; align-items: baseline;">
					<b>Time Unit:</b><span>${this.renderHelpButtonHtml("timeunit-help")}</span>
				</div>
				<input class="timeunit-field enter-apply" style="width:100%; box-sizing: border-box;" type="text"/>
				<div style="margin-top: 4px;" class="complain-div"></div>
			</div>
		`);

		this.setHelpButtonInfo("timeunit-help", "Time Unit Help", `<div style="max-width: 400px;">
			<p>It is crucial to be consistent and choose one, and only one, time unit across the model. The time unit can e.g. be second, minute, hour, day, week, month, year, century, or whatever you choose. For a generic model you can specify it as e.g. "Time Unit", "t.u." or "tu".</p>
			<b>Key bindings:</b>
			<ul style="margin: 0.5em 0;">
				<li>${keyHtml("Esc")} &rarr; Cancels changes</li>
				<li>${keyHtml("Enter")} &rarr; Applies changes</li>
			</ul>
		</div>
		`)

		$(this.dialogContent).find(".timeunit-field").keyup((event) => {
			this.showComplain(this.checkValid());
		});
	}
	beforeShow() {
		$(this.dialogContent).find(".timeunit-field").val(getTimeUnits());
	}
	centerOnFullCanvas() {
		// The Output workspace starts closed. Center the startup prompt against
		// the full modeling canvas width (from the canvas left edge to the right
		// edge of the workspace), rather than any previously reserved output width.
		let workspace = document.querySelector(".workspace-row");
		let canvas = document.getElementById("svgplanebackground");
		let widget = this.dialog && this.dialog.dialog("widget");
		if (!workspace || !canvas || !widget || !widget.length) return;
		let workspaceRect = workspace.getBoundingClientRect();
		let canvasRect = canvas.getBoundingClientRect();
		let width = widget.outerWidth();
		let height = widget.outerHeight();
		let centerX = (canvasRect.left + workspaceRect.right) / 2 + window.pageXOffset;
		let centerY = (canvasRect.top + canvasRect.bottom) / 2 + window.pageYOffset;
		let left = Math.max(window.pageXOffset + 8, centerX - width / 2);
		let top = Math.max(window.pageYOffset + 8, centerY - height / 2);
		widget.css({ left: `${left}px`, top: `${top}px` });
	}
	afterShow() {
		$(this.dialog).find(".timeunit-field").get(0).focus();
		// Wait for the startup workspace layout to settle before centering.
		requestAnimationFrame(() => requestAnimationFrame(() => this.centerOnFullCanvas()));
	}
	checkValid() {
		let value = $(this.dialogContent).find(".timeunit-field").val();
		return isTimeUnitOk(value);
	}
	showComplain(ok) {
		let complainDiv = $(this.dialogContent).find(".complain-div");
		if (ok) {
			complainDiv.html("");
		} else {
			complainDiv.html(warningHtml(`Time Unit must contain character A-Z or a-z.`));
		}
	}
	makeApply() {
		if (!this.checkValid()) {
			this.showComplain(false);
			return false;
		}
		let timeUnit = $(this.dialogContent).find(".timeunit-field").val();
		setTimeUnits(timeUnit);
		$("#timeunit-value").html(timeUnit);
		return true;
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Apply": () => this.applyChanges()
		};
	}
}


class GeometryDialog extends DisplayDialog {
	renderStrokeHtml() {
		let strokeWidths = ["1", "2", "3", "4", "5", "6"];
		let primWidth = this.primitive.getAttribute("StrokeWidth");
		return (`
			<table class="modern-table zebra">
				<tr>
					<td>Line Width: </td>
					<td>
						<select class="width-select enter-apply">
						${strokeWidths.map(w => (`
							<option value="${w}" ${primWidth === w ? "selected" : ""}>${w}</option>
						`))}
						</select>
					</td>
				</tr>
				<tr>
					<td>Dashes: </td>
					<td>
						<select class="dash-select enter-apply">
						<option value="" 	${this.primitive.getAttribute("StrokeDashArray") === "" ? "selected" : ""}	 >––––––</option>
						<option value="8 4" ${this.primitive.getAttribute("StrokeDashArray") === "8 4" ? "selected" : ""}>– – – –</option>
						</select>
					</td>
				</tr>
			</table>
		`);
	}

	beforeShow() {
		this.setHtml(`<div>${this.renderStrokeHtml()}</div>`);
		this.bindEnterApplyEvents();
	}
	makeApply() {
		let dashArray = $(this.dialogContent).find(".dash-select :selected").val();
		let strokeWidth = $(this.dialogContent).find(".width-select :selected").val();
		this.primitive.setAttribute("StrokeDashArray", dashArray);
		this.primitive.setAttribute("StrokeWidth", strokeWidth);
	}
}

class RectangleDialog extends GeometryDialog {
	beforeShow() {
		this.setTitle("Rectangle Properties");
		super.beforeShow();
	}
}

class EllipseDialog extends GeometryDialog {
	beforeShow() {
		this.setTitle("Ellipse Properties");
		super.beforeShow();
	}
}

class LineDialog extends GeometryDialog {
	renderArrowCheckboxHtml() {
		let arrowStart = this.primitive.getAttribute("ArrowHeadStart") === "true";
		let arrowEnd = this.primitive.getAttribute("ArrowHeadEnd") === "true";
		return (`
			<table class="modern-table zebra">
				<tr>
					<td>Arrow head at start point:</td>
					<td><input class="arrow-start-checkbox enter-apply" type="checkbox" ${checkedHtml(arrowStart)} /></td>
				</tr>
				<tr>
					<td>Arrow head at end point:</td>
					<td><input class="arrow-end-checkbox enter-apply" type="checkbox" ${checkedHtml(arrowEnd)} /></td>
				</tr>
			</table>
		`);
	}
	beforeShow() {
		this.setTitle("Arrow/Line Properties");
		this.setHtml(`<div>
			${this.renderArrowCheckboxHtml()}
			<div class="vertical-space"></div>
			${this.renderStrokeHtml()}
		</div>`);
		this.bindEnterApplyEvents();
	}
	makeApply() {
		this.primitive.setAttribute("ArrowHeadStart", $(this.dialogContent).find(".arrow-start-checkbox").prop("checked"));
		this.primitive.setAttribute("ArrowHeadEnd", $(this.dialogContent).find(".arrow-end-checkbox").prop("checked"));
		super.makeApply();
	}
}

class NumberboxDialog extends DisplayDialog {
	constructor(id) {
		super(id);
		this.setTitle("Number Box Properties");

		this.components = [
			new ArithmeticPrecisionComponent(this),
			new RoundToZeroComponent(this),
			new CheckboxTableComponent(this, [{ text: "Hide Frame", attribute: "HideFrame" }])
		];
	}
	beforeShow() {
		this.targetPrimitive = findID(this.primitive.getAttribute("Target"));
		if (this.targetPrimitive) {
			let primitiveName = makePrimitiveName(getName(this.targetPrimitive));
			this.setHtml(`
				<div>
					<p>Value of ${primitiveName}</p>
					${this.components.map(comp => comp.render()).join('<div class="vertical-space"></div>')}
				</div>
			`);
			this.components.forEach(comp => comp.bindEvents());
		} else {
			this.setHtml(`
				Target primitive not found
			`);
		}
		this.bindEnterApplyEvents();
	}
	makeApply() {
		this.components.forEach(comp => comp.applyChange());
	}
}

class LinkPropertiesDialog extends jqDialog {
	constructor() {
		super();
		this.primitive = null;
		this.setTitle("Link Properties");
		this.setHtml(`
			<div style="min-width: 280px; padding: 0.5rem;">
				<label for="link-polarity-field"><b>Polarity:</b></label><br/>
				<select id="link-polarity-field" class="polarity-field enter-apply" style="width: 100%; margin-top: 0.5rem;">
					<option value="">Unspecified</option>
					<option value="+">Positive (+)</option>
					<option value="-">Negative (−)</option>
				</select>
				<p style="margin: 0.9rem 0 0; max-width: 320px;">Polarity is a causal annotation. It does not change the simulation equations.</p>
			</div>
		`);
		this.polarityField = $(this.dialogContent).find(".polarity-field").get(0);
		this.bindEnterApplyEvents();
	}
	open(id) {
		if (jqDialog.blockingDialogOpen) return;
		this.primitive = findID(id);
		if (!this.primitive || this.primitive.value.nodeName !== "Link") return;
		this.show();
	}
	beforeShow() {
		if (!this.primitive) return;
		let polarity = this.primitive.getAttribute("Polarity") || "";
		this.polarityField.value = polarity === "+" || polarity === "-" ? polarity : "";
	}
	afterShow() {
		this.polarityField.focus();
	}
	makeApply() {
		if (!this.primitive) return false;
		let polarity = this.polarityField.value;
		if (!["", "+", "-"].includes(polarity)) return false;
		this.primitive.setAttribute("Polarity", polarity);
		let visual = get_object(getID(this.primitive));
		if (visual && typeof visual.update === "function") visual.update();
	}
}

class ConverterDialog extends jqDialog {
	constructor() {
		super();
		// [number,number][]
		this.currentValues = [];
		this.setHtml(`
			<div style="display: grid; grid-template-columns: auto auto; grid-gap: 1rem; max-height: 80vh;">
				<div class="primitive-settings" style="padding: 1rem 0;">
						<b>Name:</b><br/>
						<input class="name-field" style="width: 100%;" type="text" value=""><br/><br/>
						<div style="display: flex; justify-content: space-between; width: 100%; align-items: baseline;">
							<b>Definition:</b><span>${this.renderHelpButtonHtml("converter-help")}</span>
						</div>
						<textarea class="value-field" style="width: 300px; height: 200px;"></textarea><br/><br/>
						<b>Unit:</b><br/>
						<input class="unit-field enter-apply" style="width: 300px; box-sizing: border-box;" type="text" value=""><br/><br/>
						<b>Comment:</b><br/>
						<textarea class="comment-field" rows="3" style="width:300px; box-sizing:border-box; resize:vertical;" placeholder="Optional documentation comment"></textarea>
						<p class="in-link" style="font-weight:bold; margin:5px 0px">Ingoing Link </p>
					</div>
					<div id="converter-plot-div" style="">
						<!-- Add plot here with code -->
					</div>
				</div>
			</div>
		`);

		this.setHelpButtonInfo("converter-help", "Lookup Help", `<div style="max-width: 400px;">
			<p>The lookup maps input values X<sub>i</sub> from the linked-in model entity to output values Y<sub>i</sub> using a lookup table.</p>
			<p><b>Unit:</b> declares the unit of the lookup output. A lookup is treated as a black-box transformation, so its input unit does not constrain its output unit. The declared output unit is still used when checking equations that use the lookup.</p>
			<p>
				<b>Definition:</b></br>
				&nbsp &nbsp <span style="font-family: monospace;" >
				${["1", "2", undefined, "n"].map(e => e ? `<span class="cm-x">X<sub>${e}</sub></span>,<span class="cm-y">Y<sub>${e}</sub></span>` : "...").join("; ")}
				</span>
				&nbsp &nbsp &nbsp (Often <span>X is time)
				</br>
				</br>
				<b>Example:</b></br>
				&nbsp &nbsp <span style="font-family: monospace;" >
				${[[0, 0], [1, 1], [2, 4], [3, 9]].map(e => `<span class="cm-x">${e[0]}</span>,<span class="cm-y">${e[1]}</span>`).join("; ")}
				</span>
			</p>
			<p>Lookup points may be kept on one line or placed on separate lines after each semicolon. Two spreadsheet columns can be pasted directly into this field.</p>
			<b>Key bindings:</b>
			<ul style="margin: 0.5em 0;">
				<li>${keyHtml("Esc")} &rarr; Cancels changes</li>
				<li>${keyHtml("Enter")} &rarr; Applies changes</li>
				<li>${keyHtml(["Shift", "Enter"])} &rarr; Adds new line</li>
				<li>${keyHtml([modifierKey, "v"])} &rarr; Paste (you can paste two columns from spreadsheet program)</li>
			</ul>
			${noteHtml("Use the separate Comment field for documentation notes. The lookup definition itself should contain only lookup data.")}
		</div>
		`)

		this.inLinkParagraph = $(this.dialogContent).find(".in-link").get(0);
		this.valueField = $(this.dialogContent).find(".value-field").get(0);
		this.cmValueField = new CodeMirror.fromTextArea(this.valueField,
			{
				mode: "convertermode",
				theme: "stochsdtheme oneline",
				lineWrapping: true,
				lineNumbers: false,
				extraKeys: {
					"Esc": () => {
						this.dialogParameters.buttons["Cancel"]();
					},
					"Enter": () => {
						this.dialogParameters.buttons["Apply"]();
					},
					"Tab": () => {
						if (this.commentField) this.commentField.focus();
					},
					"Shift-Tab": () => {
						this.nameField.focus();
					}
				}
			}
		);
		this.cmValueField.setSize($(this.valueField).width(), $(this.valueField).height());
		// $(this.dialogContent).find(".CodeMirror").css("max-height", "50vh");
		// $(this.dialogContent).find(".CodeMirror").resizable({
		// 	resize: function() {
		// 		this.cmValueField.setSize(null, $(this).height());
		// 	}
		// });
		this.cmValueField.on("keyup", (cm) => {
			this.updateValues(cm.getValue())
			this.updatePlot()
		})
		this.cmValueField.on("inputRead", (cm, event) => {
			if (event.origin == "paste") {
				let columnWidth = 1
				/** @type {[string, string][]} */
				const data = event.text.map(row => row.split("\t"))
					.filter(row => {
						const isValidRow = row.length === 2 && this.isValidCellValue(row[0]) && this.isValidCellValue(row[1])
						if (isValidRow && columnWidth < row[0].length)
							columnWidth = row[0].length
						return isValidRow
					});
				if (data.length >= 1) {
					cm.setValue(data.map(d => `${d[0]},`.padEnd(columnWidth+2, " ")+d[1]).join(";\n"))
					this.updatePlot()
				}
			}
		})
		this.nameField = $(this.dialogContent).find(".name-field").get(0);
		this.unitField = $(this.dialogContent).find(".unit-field").get(0);
		this.commentField = $(this.dialogContent).find(".comment-field").get(0);
		$(this.nameField).keydown((event) => {
			if (event.key === "Tab" && !event.shiftKey) {
				event.preventDefault();
				this.cmValueField.focus();
			} else if (event.key == "Enter") {
				this.applyChanges();
			}
		});
		$(this.commentField).keydown((event) => {
			if (event.key === "Tab" && event.shiftKey) {
				event.preventDefault();
				this.cmValueField.focus();
			}
		});
	}
	isValidCellValue(strValue) {
		return !(strValue.trim() === "" || isNaN(strValue))
	}
	open(id, defaultFocusSelector = null) {
		if (jqDialog.blockingDialogOpen) {
			// We can't open a new dialog while one is already open
			return;
		}
		this.primitive = findID(id);
		if (this.primitive == null) {
			alert("Model entity with id " + id + " does not exist");
			return;
		}
		this.show();
		let linkedIn = findLinkedInPrimitives(id);
		if (linkedIn.length === 1) {
			this.inLinkParagraph.innerHTML = `Ingoing Link: ${getName(linkedIn[0])}`;
		} else if (linkedIn.length === 0) {
			this.inLinkParagraph.innerHTML = warningHtml("No Ingoing Link", false);
		} else {
			this.inLinkParagraph.innerHTML = warningHtml("More Then One Ingoing Link", false);
		}

		this.defaultFocusSelector = defaultFocusSelector;

		let oldValue = getValue(this.primitive);
		oldValue = oldValue.replace(/\\n/g, "\n");
		this.updateValues(oldValue)
		this.updatePlot()

		let oldName = getName(this.primitive);
		let oldNameBrackets = makePrimitiveName(oldName);

		this.setTitle(`${oldNameBrackets} properties`);

		$(this.nameField).val(oldNameBrackets);
		$(this.unitField).val(getUnits(this.primitive));
		$(this.commentField).val(this.primitive.getAttribute("Note") || "");
		this.cmValueField.setValue(oldValue);

		if (this.defaultFocusSelector) {
			let valueFieldDom = $(this.dialogContent).find(this.defaultFocusSelector).get(0);
			valueFieldDom.focus();
		}
	}
	updateValues(str) {
		this.currentValues = str.split("#")[0].split(";").map(row => row.split(",").map(Number))
	}
	updatePlot() {
		$(this.dialogContent).find("#converter-plot-div").empty()
		if (!Preferences.get("showConverterPlotPreview")) return;
		let serieArray = [];
		for (let row of this.currentValues) {
			if (row[0] !== undefined && row[1] !== undefined)
				serieArray.push([Number(row[0]), Number(row[1])]);
		}
		$(this.dialogContent).find("#converter-plot-div").empty()
		if (serieArray.length < 2) {
			$(this.dialogContent).find("#converter-plot-div").html(`
				<div style="padding: 1rem 2rem;">
					<h1>Plot Preview</h1>
					<p style="font-size: 1rem;">Plot Preview will be shown here when at least two points are defined</p>
				</div>
			`);
		} else {
			// TODO: Add before and after series with dashed lines
			const start = serieArray[0][0]
			const end = serieArray.at(-1)[0]
			const xDist = end - start
			const beforeSeries = [
				[start - 0.3 * xDist, serieArray[0][1]],
				serieArray[0]
			]
			const afterSeries = [
				serieArray.at(-1),
				[end + 0.3 * xDist, serieArray.at(-1)[1]]
			]
			const color = this.primitive.getAttribute("Color")
			const beforeAfterSeries = {
				color: color,
				showLine: true,
				showMarker: false,
				linePattern: "dashed",
				shadow: false,
			}
			$.jqplot("converter-plot-div", [serieArray, beforeSeries, afterSeries], {
				series: [
					{
						color: color,
						showLine: true,
						showMarker: true,
						markerOptions: {
							size: 5,
							shadow: false,
							pointLabels: { show: false }
						}
					},
					beforeAfterSeries,
					beforeAfterSeries
				],
				grid: {
					background: "transparent",
					shadow: false
				},
				axesDefaults: {
					labelRenderer: $.jqplot.CanvasAxisLabelRenderer
				},
				axes: {
					xaxis: {
						label: "Input",
						min: start - 0.2 * xDist,
						max: end + 0.2 * xDist,
					},
					yaxis: {
						label: "Output"
					}
				},
				highlighter: {
					show: true,
					sizeAdjust: 1.5
				},
			});
		}
	}
	afterShow() {
		let field = $(this.dialogContent).find(".name-field").get(0);
		let inputLength = field.value.length;
		field.setSelectionRange(0, inputLength);
	}
	makeApply() {
		if (this.primitive) {
			// Handle value
			let value = this.cmValueField.getValue();
			setValue2(this.primitive, value);
			setUnits(this.primitive, this.unitField ? this.unitField.value.trim() : "");
			this.primitive.setAttribute("Note", this.commentField ? this.commentField.value : "");

			// handle name
			let oldName = getName(this.primitive);
			let newName = stripBrackets($(this.dialogContent).find(".name-field").val());
			if (oldName != newName) {
				if (isNameFree(newName)) {
					setName(this.primitive, newName);
					changeReferencesToName(this.primitive.id, oldName, newName);
				} else {
					xAlert(`The name <b>${newName}</b> is already a taken name. \nName was not changed.`);
				}
			}
			// Update visual object to add/remove "?" icon
			let visualObject = object_array[this.primitive.id];
			if (visualObject) {
				visualObject.update();
			}
		}
	}
}

function global_log_update() {
	let log = "";
	log += "<br/>";
	log += global_log + "<br/>";
	$(".log").html(log);
}

function do_global_log(line) {
	if (Settings.showDebug) {
		global_log = line + "; " + (new Date()).getMilliseconds() + "<br/>" + global_log;
		global_log_update();
	}
}

class DebugDialog extends jqDialog {
	constructor() {
		super();
		this.nameField = null;
		this.setTitle("Debug");
		this.setHtml(`
			<div id="log_panel" style="z-index: 10; position: absolute; left: 0px; top: 0px; height: 90%; overflow-x: visible">
				This window is intended for Systemika development and troubleshooting.<br/>
				<button class="btn_clear_log">clear</button>
				<div class="log" style="width: 100%; height: 90%; overflow-y: scroll;">
				</div>
			</div>
		`);

		$(this.dialogContent).find(".btn_clear_log").click((event) => {
			global_log = "";
			global_log_update();
		});
	}
	beforeCreateDialog() {
		this.dialogParameters.modal = false;
		this.dialogParameters.width = 600;
		this.dialogParameters.height = 400;
	}
}

class CloseDialog extends jqDialog {
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Close": () => {
				$(this.dialog).dialog('close');
			}
		};
	}
}

class GettingStartedDialog extends CloseDialog {
	constructor() {
		super();
		this.setTitle("Getting Started");
		this.setHtml(`
		<div style="min-width: 420px; max-width: 760px; line-height: 1.45;">
			<p><b>Systemika</b> is designed for building and teaching stock-and-flow models. A typical workflow is:</p>
			<ol>
				<li><b>Set simulation time.</b> Use the <b>Time Unit</b> control to set the model time unit, start time, length, DT, solver, and Advance increment.</li>
				<li><b>Build the structure.</b> Add Stocks, Flows, Links, Auxiliaries, Constants, Lookups, and Ghosts from the vertical toolbar.</li>
				<li><b>Enter definitions and units.</b> Double-click a model entity to edit its equation/value and declared unit. Links may also carry +/− polarity annotations.</li>
				<li><b>Check units.</b> Use <b>Check Units → Report</b>. Systemika reports inconsistencies but never changes, converts, or suggests units.</li>
				<li><b>Inspect outputs.</b> The right-hand Output panel starts closed so the modeling canvas has the full window. Use Equations, Table, Time Plot, XY Plot, or Histogram in the top toolbar to open the requested output; close it with × when you want the full modeling canvas again.</li>
				<li><b>Run or explore.</b> <b>Run/Pause</b> performs a normal simulation. <b>Advance</b> steps through the model and allows permitted parameter changes between advances.</li>
				<li><b>Save the model.</b> Use Save or Save As. The red <b>Unsaved Changes</b> indicator is also clickable.</li>
			</ol>
			<p><b>Editing Flow pipes:</b> select a Flow by its valve, then drag either endpoint away from a Stock to detach it. While dragging the arrow or cloud endpoint, press <b>Shift</b> to insert an elbow; press and release <b>Shift</b> again to add another elbow, with no fixed limit. This works both while creating a new Flow and when reshaping an existing Flow. Right-click a selected pipe to add an elbow handle, then drag that handle to reshape the pipe. Right-click an elbow handle, or select it and press Delete/Backspace, to remove the elbow.</p>
			<p>Press <b>Enter</b> to apply changes. Equations can span multiple lines; press <b>Shift+Enter</b> to insert a line break.</p>
		</div>`);
	}
}

function focusModelEntityById(id) {
	let visual = get_object(String(id));
	if (!visual || typeof visual.select !== "function") return false;

	// A Find result should leave the editor in normal selection mode, with only
	// the located entity highlighted.
	if (typeof ToolBox !== "undefined" && ToolBox && typeof ToolBox.setTool === "function") {
		ToolBox.setTool("mouse");
	}
	unselect_all();
	visual.select();
	mouse.lastClickedPrimitive = visual;
	refreshSelectionStacking();

	let pos = typeof visual.getPos === "function" ? visual.getPos() : null;
	let view = Zoom.view;
	if (view && Array.isArray(pos) && Number.isFinite(pos[0]) && Number.isFinite(pos[1])) {
		view.scrollLeft = Math.max(0, pos[0] * Zoom.level - view.clientWidth / 2);
		view.scrollTop = Math.max(0, pos[1] * Zoom.level - view.clientHeight / 2);
	}
	return true;
}

function findNextGhostOfSelection() {
	let context = getSelectedGhostNavigationContext();
	if (!context) return false;

	let ghostIds = findGhostsOfID(context.sourceId)
		.map(String)
		.filter(id => !!get_object(id));
	if (!ghostIds.length) {
		let source = findID(context.sourceId);
		let name = source ? String(getName(source) || "") : "";
		xAlert(name ? `The selected variable “${name}” has no ghosts.` : "The selected variable has no ghosts.");
		return false;
	}

	let nextId;
	if (context.selectedId === context.sourceId) {
		nextId = ghostIds[0];
	} else {
		let currentIndex = ghostIds.indexOf(context.selectedId);
		nextId = currentIndex >= 0 && currentIndex < ghostIds.length - 1
			? ghostIds[currentIndex + 1]
			: context.sourceId;
	}

	return focusModelEntityById(nextId);
}

class FindVariableDialog extends jqDialog {
	constructor() {
		super();
		this.sortColumn = "name";
		this.sortDirection = 1;
		this.selectedId = null;
		this.visibleRows = [];
		this.setTitle("Find");
		this.setHtml(`
		<div class="systemika-find-dialog">
			<label class="systemika-find-label" for="systemika-find-input">Find variable</label>
			<input id="systemika-find-input" class="systemika-find-input" type="search" autocomplete="off" spellcheck="false" placeholder="Type a variable name or type..." aria-label="Find variable">
			<div class="systemika-find-table-wrap">
				<table class="modern-table zebra systemika-find-table" aria-label="Model variables">
					<thead><tr>
						<th scope="col"><button type="button" class="systemika-find-sort" data-sort="name">Name <span class="systemika-find-sort-indicator"></span></button></th>
						<th scope="col"><button type="button" class="systemika-find-sort" data-sort="type">Type <span class="systemika-find-sort-indicator"></span></button></th>
					</tr></thead>
					<tbody class="systemika-find-results"></tbody>
				</table>
			</div>
			<div class="systemika-find-count" aria-live="polite"></div>
		</div>`);

		let root = $(this.dialogContent);
		root.find(".systemika-find-input").on("input", () => {
			this.selectedId = null;
			this.renderRows();
		});
		root.find(".systemika-find-input").on("keydown", event => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				this.selectRelativeRow(1);
			} else if (event.key === "ArrowUp") {
				event.preventDefault();
				this.selectRelativeRow(-1);
			} else if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
				event.preventDefault();
				this.findSelected();
			}
		});
		root.find(".systemika-find-sort").click(event => {
			let column = String($(event.currentTarget).attr("data-sort") || "name");
			if (this.sortColumn === column) this.sortDirection *= -1;
			else {
				this.sortColumn = column;
				this.sortDirection = 1;
			}
			this.renderRows();
		});
	}
	beforeCreateDialog() {
		this.dialogParameters.width = 560;
		this.dialogParameters.buttons = {
			"Find": () => this.findSelected(),
			"Close": () => $(this.dialog).dialog("close")
		};
	}
	collectRows() {
		let query = String($(this.dialogContent).find(".systemika-find-input").val() || "").trim().toLowerCase();
		let rows = getPrimitiveList().map(primitive => ({
			id: String(getID(primitive)),
			name: String(getName(primitive) || ""),
			type: String(getSystemikaType(primitive) || getTypeNew(primitive) || "")
		})).filter(row => !query || row.name.toLowerCase().includes(query) || row.type.toLowerCase().includes(query));

		let primary = this.sortColumn;
		let direction = this.sortDirection;
		rows.sort((a, b) => {
			let av = String(a[primary] || "");
			let bv = String(b[primary] || "");
			let result = av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true });
			if (result === 0 && primary !== "name") result = a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
			if (result === 0) result = a.id.localeCompare(b.id, undefined, { numeric: true });
			return result * direction;
		});
		return rows;
	}
	renderRows() {
		this.visibleRows = this.collectRows();
		if (this.selectedId && !this.visibleRows.some(row => row.id === this.selectedId)) this.selectedId = null;
		let body = $(this.dialogContent).find(".systemika-find-results");
		if (!this.visibleRows.length) {
			body.html(`<tr><td colspan="2" class="systemika-find-empty">No matching variables.</td></tr>`);
		} else {
			body.html(this.visibleRows.map(row => `<tr class="systemika-find-row${row.id === this.selectedId ? " selected" : ""}" data-id="${htmlEscape(row.id)}" tabindex="0" aria-selected="${row.id === this.selectedId ? "true" : "false"}"><td>${htmlEscape(row.name)}</td><td>${htmlEscape(row.type)}</td></tr>`).join(""));
			body.find(".systemika-find-row").on("click focus", event => this.selectRow(String($(event.currentTarget).attr("data-id") || "")));
			body.find(".systemika-find-row").on("dblclick", event => {
				this.selectRow(String($(event.currentTarget).attr("data-id") || ""));
				this.findSelected();
			});
			body.find(".systemika-find-row").on("keydown", event => {
				if (event.key === "Enter") {
					event.preventDefault();
					this.selectRow(String($(event.currentTarget).attr("data-id") || ""));
					this.findSelected();
				} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					this.selectRelativeRow(event.key === "ArrowDown" ? 1 : -1);
				}
			});
		}
		$(this.dialogContent).find(".systemika-find-count").text(`${this.visibleRows.length} variable${this.visibleRows.length === 1 ? "" : "s"}`);
		$(this.dialogContent).find(".systemika-find-sort").each((_, button) => {
			let column = String($(button).attr("data-sort") || "");
			let indicator = $(button).find(".systemika-find-sort-indicator");
			indicator.text(column === this.sortColumn ? (this.sortDirection > 0 ? "▲" : "▼") : "");
			button.setAttribute("aria-sort", column === this.sortColumn ? (this.sortDirection > 0 ? "ascending" : "descending") : "none");
		});
	}
	selectRow(id) {
		if (!id || !this.visibleRows.some(row => row.id === id)) return;
		this.selectedId = id;
		let rows = $(this.dialogContent).find(".systemika-find-row");
		rows.removeClass("selected").attr("aria-selected", "false");
		let selected = rows.filter(`[data-id="${CSS.escape(id)}"]`);
		selected.addClass("selected").attr("aria-selected", "true");
	}
	selectRelativeRow(delta) {
		if (!this.visibleRows.length) return;
		let index = this.visibleRows.findIndex(row => row.id === this.selectedId);
		if (index < 0) index = delta > 0 ? -1 : 0;
		index = Math.max(0, Math.min(this.visibleRows.length - 1, index + delta));
		let id = this.visibleRows[index].id;
		this.selectRow(id);
		let row = $(this.dialogContent).find(`.systemika-find-row[data-id="${CSS.escape(id)}"]`)[0];
		if (row) {
			row.focus();
			row.scrollIntoView({ block: "nearest" });
		}
	}
	findSelected() {
		if (!this.visibleRows.length) return;
		let id = this.selectedId || this.visibleRows[0].id;
		if (!focusModelEntityById(id)) return;
		this.selectedId = id;
		$(this.dialog).dialog("close");
	}
	beforeShow() {
		this.selectedId = null;
		$(this.dialogContent).find(".systemika-find-input").val("");
		this.renderRows();
	}
	afterShow() {
		let field = $(this.dialogContent).find(".systemika-find-input");
		setTimeout(() => field.trigger("focus"), 0);
	}
}

class KeyboardShortcutsDialog extends CloseDialog {
	constructor() {
		super();
		this.setTitle("Keyboard Shortcuts");
		this.setHtml(`
		<div style="min-width: 540px; max-width: 860px; max-height: 72vh; overflow-y: auto;">
		<table class="modern-table zebra" style="width:100%">
		<tr><th>Action</th><th>Shortcut</th></tr>
		<tr><td>New model</td><td>${modifierKey}+N</td></tr>
		<tr><td>Open model</td><td>${modifierKey}+O</td></tr>
		<tr><td>Save / Save As</td><td>${modifierKey}+S / ${modifierKey}+Shift+S</td></tr>
		<tr><td>Undo / Redo</td><td>${modifierKey}+Z / ${modifierKey}+Y</td></tr>
		<tr><td>Open equation/properties for selected model variable</td><td>Enter</td></tr>
		<tr><td>Mouse tool</td><td>M</td></tr>
		<tr><td>Cut / Copy / Paste</td><td>${modifierKey}+X / ${modifierKey}+C / ${modifierKey}+V<br/><small>Copy/Cut of one selected Figure also copies its image to the system clipboard.</small></td></tr>
		<tr><td>Select all</td><td>${modifierKey}+A</td></tr>
		<tr><td>Find variable</td><td>${modifierKey}+F</td></tr>
			<tr><td>Find next Ghost / return to original variable</td><td>${modifierKey}+G</td></tr>
		<tr><td>Delete selection</td><td>Delete or Backspace</td></tr>
		<tr><td>Zoom in / out</td><td>${modifierKey}++ / ${modifierKey}+-</td></tr>
		<tr><td>Return canvas to origin</td><td>${modifierKey}+Home</td></tr>
		<tr><td>Scroll canvas left / right</td><td>Shift+Page Up / Shift+Page Down</td></tr>
		<tr><td>Move selection</td><td>Arrow keys (Shift+Arrow for larger steps)</td></tr>
		<tr><td>Clear outputs</td><td>${modifierKey}+0</td></tr>
		<tr><td>Run / Pause</td><td>${modifierKey}+1 or ${modifierKey}+R</td></tr>
		<tr><td>Run / Pause from Run Name</td><td>Enter, ${modifierKey}+1, or ${modifierKey}+R</td></tr>
		<tr><td>Advance / Advance to End</td><td>${modifierKey}+2 / ${modifierKey}+3</td></tr>
		<tr><td>Equations / Table</td><td>E / T</td></tr>
		<tr><td>Time Plot / XY Plot / Histogram</td><td>P / X / H</td></tr>
		<tr><td>Stock / Flow / Auxiliary / Constant</td><td>S / F / A / C</td></tr>
		<tr><td>Link</td><td>L</td></tr>
		<tr><td>Link Properties (one Link selected)</td><td>L</td></tr>
		<tr><td>Lookup / Ghost</td><td>K / G</td></tr>
		<tr><td>Hide / unhide definition question marks</td><td>Q</td></tr>
		<tr><td>Rotate entity name</td><td>R</td></tr>
		<tr><td>Apply changes in dialog</td><td>Enter</td></tr>
		<tr><td>Insert line break in multiline dialog field</td><td>Shift+Enter</td></tr>
		<tr><td>Close dialog</td><td>Esc</td></tr>
		</table>
		<p style="color:#555">Single-letter shortcuts apply when focus is on the model canvas, not while typing in a field or dialog. Output shortcuts (E/T/P/X/H) toggle the corresponding Output panel: pressing the shortcut for the currently open output closes it; pressing it again reopens it.</p>
		</div>`);
	}
}

function helpTemplateText(item) {
	let text = item.syntax || item.replacement || item.name;
	return String(text).replace(/##/g, "").replace(/\$\$/g, "");
}

class FunctionsAndEquationsDialog extends CloseDialog {
	constructor() {
		super();
		this.setTitle("Functions & Equations");
		let categoryHtml = functionCategories.map(category => `
			<h3>${htmlEscape(category.name)}</h3>
			<table class="modern-table zebra" style="width:100%">
			<tr><th style="text-align:left">Function / syntax</th><th style="text-align:left">Purpose</th></tr>
			${category.functions.map(item => `
			<tr>
				<td><code>${htmlEscape(helpTemplateText(item))}</code></td>
				<td>${htmlEscape(item.description || "")}</td>
			</tr>`).join("")}
			</table>`).join("");
		this.setHtml(`
		<div style="min-width: 620px; max-width: 980px; max-height: 72vh; overflow-y: auto; line-height:1.4">
			<p>Model entity references use bare names, for example <code>Population</code>. Legacy square-bracket references such as <code>[Population]</code> remain readable for compatibility. Standard arithmetic operators, comparisons, parentheses, and the functions below are supported.</p>
			<p>Press <b>Enter</b> to apply changes. Equations may span multiple lines; press <b>Shift+Enter</b> to insert a line break. In random-function syntax, <code>[Seed]</code> means the seed argument is optional.</p>
			${categoryHtml}
		</div>`);
	}
}

class UnitsHelpDialog extends CloseDialog {
	constructor() {
		super();
		this.setTitle("Unit Checking");
		this.setHtml(`
		<div style="min-width: 440px; max-width: 780px; line-height:1.45">
			<p>Systemika uses a <b>strict reporting-only unit checker</b>. It identifies unit inconsistencies; it does not choose units, convert them, infer synonyms, or repair the model.</p>
			<ul>
				<li>Unit symbols are literal and case-sensitive: <code>USD</code> is different from <code>$</code>, and <code>Person</code> is different from <code>People</code>.</li>
				<li>Algebraically equivalent expressions are recognized: <code>Person/Year</code> is equivalent to <code>Person*Year^-1</code>.</li>
				<li>A Flow connected to a Stock must be consistent with the Stock unit divided by the model time unit.</li>
				<li>Missing information is reported as <b>Could not verify</b>, not treated as correct.</li>
				<li><code>Unitless</code> means explicitly dimensionless.</li>
			</ul>
			<p>Use <b>Check Units → Report</b> in the main toolbar to review the model. The report never changes the model and never prevents a simulation from running.</p>
		</div>`);
	}
}

class AboutDialog extends CloseDialog {
	constructor() {
		super();
		const productName = (typeof environment !== "undefined" && environment.getName && environment.getName() === "web")
			? "Systemika Studio"
			: "Systemika";
		this.setTitle(`About ${productName}`);
		this.setHtml(`
			<div style="min-width:340px; max-width: 760px; line-height:1.45">
			<img src="graphics/systemika_high.png" style="width: 96px; height: 96px" alt="Systemika"/><br/>
			<b>${productName} ${systemika.version}</b><br/><br/>
			<b><a target="_blank" href="https://systemika.no">Systemika</a></b> is educational System Dynamics software focused on learning and teaching stock-and-flow modelling. It provides a native simulation engine with Euler and fourth-order Runge-Kutta integration, strict unit-consistency reporting, interactive Advance runs, and classroom-oriented model/output tools.<br/><br/>
			Systemika was developed from the open-source <a target="_blank" href="https://stochsd.sourceforge.io">StochSD</a> codebase, which has historical lineage to <a target="_blank" href="https://insightmaker.com">Insight Maker</a>. The current Systemika simulation engine and the model infrastructure replaced during the independence work are independently written for Systemika; remaining StochSD-derived application code and attribution are covered by the project license. Historical <code>.ssd</code> storage identifiers are retained for file compatibility.<br/><br/>
			<a target="_blank" href="https://stochsd.sourceforge.io">StochSD</a> was developed by Leif Gustafsson, Erik Gustafsson and Magnus Gustafsson at Uppsala University, Sweden. <a target="_blank" href="https://insightmaker.com">Insight Maker</a> was developed by Scott Fortmann-Roe.<br/><br/>
			Project website: <a target="_blank" href="https://systemika.no">systemika.no</a>
			</div>
		`);
		$(this.dialogContent).find("a").click((event) => {
			let url = event.currentTarget.href;
			if (environment.openLink(url)) event.preventDefault();
		});
	}
}

class DirectoryDialog extends CloseDialog {
  constructor() {
		super();
		this.setTitle("Model directory");

		this.setHtml(`
		test
		`);
	}
}

function htmlEscape(text) {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

class BrowserModelsDialog extends jqDialog {
	constructor() {
		super();
		this.setTitle("Models in Browser");
		this.size = [640, 480];
		// When true the name field is focused, for "Save As" rather than browsing.
		this.saveAsMode = false;
		// When true this is the startup landing page, so nothing has been drawn
		// yet: "New Model" can skip straight to the time unit dialog instead of
		// going through the usual discard-and-reload flow.
		this.startupPrompt = false;
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"New Model": () => {
				this.startNewModel();
			},
			"Open from File...": () => {
				this.openFromFile();
			},
			"Close": () => {
				$(this.dialog).dialog('close');
			}
		};
	}
	beforeShow() {
		this.render();
	}
	afterShow() {
		if (this.saveAsMode) {
			$(this.dialogContent).find(".input-model-name").focus().select();
			this.saveAsMode = false;
		}
	}
	afterClose() {
		// Closing without picking anything (Close button, Esc) means this is no
		// longer a fresh, empty canvas as far as a later "New Model" click should
		// assume — only the startup-triggered show, closed without reloading in
		// between, gets the fast path.
		this.startupPrompt = false;
	}
	showForSaveAs() {
		this.saveAsMode = true;
		this.show();
	}
	// Shown automatically when the web app is opened with nothing pending to
	// restore, so this is the first thing the user sees.
	showAtStartup() {
		this.startupPrompt = true;
		this.show();
	}
	startNewModel() {
		if (this.startupPrompt) {
			this.startupPrompt = false;
			$(this.dialog).dialog('close');
			timeUnitDialog.show();
			return;
		}
		// A model may already be open and edited, so this goes through the same
		// unsaved-changes check and reset as File > New.
		$(this.dialog).dialog('close');
		saveChangedAlert(() => {
			// newModel() reloads, which would otherwise land back on this same
			// picker; skip it once so New Model always reaches the time unit dialog.
			localStorage.setItem("skipStartupPicker", "1");
			fileManager.newModel();
		});
	}
	// The escape hatch to a real file, for browsers where Open otherwise only
	// means this dialog — same route as File > Import.
	openFromFile() {
		this.startupPrompt = false;
		$(this.dialog).dialog('close');
		saveChangedAlert(() => {
			fileManager.importModel();
		});
	}
	render() {
		let models = ModelStorage.list();

		let rows = models.map((model) => `
			<tr>
				<td>${htmlEscape(model.name)}</td>
				<td>${new Date(model.savedAt).toLocaleString()}</td>
				<td style="text-align: right;">${Math.max(1, Math.round(model.size / 1024))} kB</td>
				<td style="padding:1px; white-space: nowrap;">
					<button class="btn-load-model ui-button ui-corner-all ui-widget" data-name="${htmlEscape(model.name)}">Open</button>
					<button class="btn-delete-model ui-button ui-corner-all ui-widget" data-name="${htmlEscape(model.name)}">Delete</button>
				</td>
			</tr>
		`).join("");

		if (models.length === 0) {
			rows = `<tr><td colspan="4" style="text-align: center;">No models stored in this browser yet.</td></tr>`;
		}

		this.setHtml(`
		<div style="min-width: 560px;">
			<table class="modern-table zebra" style="width: 100%;">
			<tr>
				<th style="text-align: left;">Name</th>
				<th style="text-align: left;">Saved</th>
				<th style="text-align: right;">Size</th>
				<th></th>
			</tr>
			${rows}
			</table>
			<br/>
			<table class="modern-table" style="width: 100%;">
			<tr>
				<td>Save current model as</td>
				<td style="padding:1px;">
					<input class="input-model-name enter-apply" style="width: 240px;" type="text" value="${htmlEscape(this.suggestedName())}"/>
				</td>
				<td style="padding:1px;"><button class="btn-save-model ui-button ui-corner-all ui-widget">Save</button></td>
			</tr>
			</table>
			<p style="color: #666;">
				Models stored here stay in this browser on this computer. Clearing your
				browser data removes them, so keep a file copy of anything important.
			</p>
		</div>
		`);

		$(this.dialogContent).find(".btn-save-model").click(() => {
			this.saveCurrentModel();
		});
		$(this.dialogContent).find(".btn-load-model").click((event) => {
			this.loadModel($(event.target).data("name"));
		});
		$(this.dialogContent).find(".btn-delete-model").click((event) => {
			this.deleteModel($(event.target).data("name"));
		});
		this.bindEnterApplyEvents();
	}
	// Enter in the name field saves, matching the other dialogs.
	applyChanges() {
		this.saveCurrentModel();
	}
	suggestedName() {
		if (fileManager.storedModelName !== null) {
			return fileManager.storedModelName;
		}
		// Reuse the open file's name without its extension, so saving a model that
		// came from disk keeps a recognisable name.
		let fileName = fileManager.fileName;
		if (!fileName) {
			return "";
		}
		let baseName = fileName.split(/[\\/]/).pop();
		return baseName.replace(new RegExp(Settings.fileExtension + "$", "i"), "");
	}
	saveCurrentModel() {
		let name = $(this.dialogContent).find(".input-model-name").val().trim();
		if (name === "") {
			xAlert("Enter a name for the model.");
			return;
		}
		if (ModelStorage.exists(name)) {
			yesNoAlert(`A model named "${htmlEscape(name)}" is already stored. Replace it?`, (answer) => {
				if (answer === "yes") {
					this.storeModel(name);
				}
			});
			return;
		}
		this.storeModel(name);
	}
	storeModel(name) {
		let modelData = createModelFileData();
		try {
			ModelStorage.save(name, modelData);
		} catch (error) {
			xAlert(error.message);
			return;
		}
		// The model now lives under this name, so a later Save overwrites it
		// instead of asking again.
		fileManager.storedModelName = name;
		fileManager.fileName = name;
		markModelSaved(modelData);
		fileManager.updateSaveTime();
		fileManager.updateTitle();
		if (this.visible) {
			this.render();
		}
		// Whoever asked to save before closing or opening something else.
		if (fileManager.finishedSaveHandler) {
			let handler = fileManager.finishedSaveHandler;
			fileManager.finishedSaveHandler = null;
			handler();
		}
	}
	loadModel(name) {
		if (History.unsavedChanges) {
			yesNoAlert("You have unsaved changes that will be lost. Open anyway?", (answer) => {
				if (answer === "yes") {
					this.applyLoad(name);
				}
			});
			return;
		}
		this.applyLoad(name);
	}
	applyLoad(name) {
		let modelData = ModelStorage.load(name);
		if (modelData === null) {
			xAlert(`Could not find a stored model named "${name}".`);
			this.render();
			return;
		}
		fileManager.fileName = name;
		fileManager.storedModelName = name;
		// Same route the file loaders take: stash the model and restart, so the
		// whole editor is rebuilt from it.
		History.forceCustomUndoState(modelData);
		fileManager.updateTitle();
		preserveRestart();
	}
	deleteModel(name) {
		yesNoAlert(`Delete the stored model "${htmlEscape(name)}"?`, (answer) => {
			if (answer === "yes") {
				ModelStorage.remove(name);
				this.render();
			}
		});
	}
}

class LicenseDialog extends CloseDialog {
	constructor() {
		super();
		this.setTitle("Systemika License");
		this.setHtml(`
		<p style="max-width:700px; line-height:1.4">
		Systemika contains original Systemika code and code derived from StochSD. The application is distributed under the <b>GNU Affero General Public License, version 3 (AGPLv3)</b>. Copyright in individual contributions remains with the respective authors and contributors. See <b>Third-party Notices</b> for bundled libraries and attribution.
		</p>
		<iframe title="GNU Affero General Public License v3" style="width: 700px; height: 500px;" src="license.html"></iframe>
		`);
	}
}

class ThirdPartyLicensesDialog extends CloseDialog {
	constructor() {
		super();
		this.setTitle("Third-party Notices");

		this.setHtml(`
		<iframe title="Third-party notices" style="width: 700px; height: 500px;" src="third-party-licenses.html"></iframe>
		`);
	}
}

const functions = [
	{ name: "IfThenElse", arguments: [{ name: "Condition" }, { name: "Then Value", note: "value if true" }, { name: "Else Value", note: "value if false" }] },
	{ name: "Abs", note: "absolute value", synonyms: "absolute", arguments: [{ name: "Value" }] },
	{ name: "Min", synonyms: "minimum", arguments: { name: "...Values" } },
	{ name: "Max", synonyms: "maximum", arguments: { name: "...Values" } },
	{ name: "Sqrt", note: "square root", synonyms: "square root", arguments: [{ name: "Value" }] },
	{ name: "Exp", arguments: [{ name: "Value" }] },
	{ name: "Ln", note: "natural logarithm", synonyms: "natural logarithm", arguments: [{ name: "Value", suggestions: ["e"] }] },
	{ name: "Log", note: "base-10 logarithm", synonyms: "base-10 logarithm log10", arguments: [{ name: "Value", suggestions: ["10"] }] },
	{ name: "Log10", note: "base-10 logarithm", synonyms: "logarithm", arguments: [{ name: "Value", suggestions: ["10"] }] },
	{ name: "Sin", arguments: [{ name: "Angle Radians", suggestions: ["pi"] }] },
	{ name: "Cos", arguments: [{ name: "Angle Radians", suggestions: ["pi"] }] },
	{ name: "Tan", arguments: [{ name: "Angle Radians", suggestions: ["pi"] }] },
	{ name: "ArcSin", synonyms: "asin", arguments: [{ name: "Value" }] },
	{ name: "ArcCos", synonyms: "acos", arguments: [{ name: "Value" }] },
	{ name: "ArcTan", synonyms: "atan", arguments: [{ name: "Value" }] },
	{ name: "Round", arguments: [{ name: "Value" }] },
	{ name: "Ceiling", synonyms: "ceil round", arguments: [{ name: "Value" }] },
	{ name: "Floor", synonyms: "round", arguments: [{ name: "Value" }] },
	{ name: "Sign", arguments: [{ name: "Value" }] },
	{ name: "Smooth", note: "N-stage exponential smooth", arguments: [{ name: "Input" }, { name: "Smooth Time" }, { name: "Order", note: "integer 1 to 100" }, { name: "Initial Value" }] },
	{ name: "Delay", note: "N-stage exponential delay", arguments: [{ name: "Input" }, { name: "Delay Time" }, { name: "Order", note: "integer 1 to 100" }, { name: "Initial Value" }] },
	{ name: "Lag", note: "fixed time lag / exact time shift", arguments: [{ name: "Input" }, { name: "Lag Time" }, { name: "Initial Value" }] },
	{ name: "RandomUniform", note: "uniform random value", synonyms: "random uniform", arguments: [{ name: "Minimum" }, { name: "Maximum" }, { name: "Seed", note: "optional; makes this call reproducible" }] },
	{ name: "RandomNormal", note: "normal random value", synonyms: "random normal gaussian", arguments: [{ name: "Mean" }, { name: "Standard Deviation" }, { name: "Seed", note: "optional; makes this call reproducible" }] },
	{ name: "RandomTriangular", note: "triangular random value", synonyms: "random triangular", arguments: [{ name: "Minimum" }, { name: "Maximum" }, { name: "Mode" }, { name: "Seed", note: "optional; makes this call reproducible" }] },
	{ name: "RandomGamma", note: "gamma random value", synonyms: "random gamma", arguments: [{ name: "Shape" }, { name: "Scale" }, { name: "Seed", note: "optional; makes this call reproducible" }] },
	{ name: "RandomBeta", note: "beta random value", synonyms: "random beta", arguments: [{ name: "Alpha" }, { name: "Beta" }, { name: "Seed", note: "optional; makes this call reproducible" }] },
	{ name: "T", note: "Current Time", synonyms: "time" },
	{ name: "DT", note: "Time Step", synonyms: "step time" },
	{ name: "TS", note: "Start Time", synonyms: "start time" },
	{ name: "TL", note: "Time Length", synonyms: "time length" },
	{ name: "TE", note: "Time End", synonyms: "time end" }
]

class FunctionHelper {
	static getHtml(cm) {
		let result = "<br/>"
		const func = FunctionHelper.updateFunctionHelp(cm)
		if (func) {
			func.note && (result = `<pre style="margin: 0;">${func.note}\n</pre>`)
			const args = func.arguments
				? (
					Array.isArray(func.arguments)
						? func.arguments.map((a, index) => {
							const argInfo = (a.note ? `Note: ${a.note}\n` : "") + (a.default ? `Default value: ${a.default}` : "")
							return func.argIndex == index
								? `<b style="position:relative; text-decoration:underline;" data-arg="${argInfo}">${a.name}</b>`
								: `${a.name}`
						}).join(", ")
						: `<b>${func.arguments.name}</b>`
				) : ""
			result += `<span class="example-code"><span class="cm-functioncall">${func.name}</span>(${args})</span>`
		}
		return result
	}
	static updateFunctionHelp(cm) {
		let func = undefined
		let cursor = cm.getCursor()
		// Read the complete equation prefix rather than only the current line so
		// function/argument help continues to work inside multiline expressions.
		const prevStr = cm.getRange({ line: 0, ch: 0 }, cursor)
		const bracketStack = []
		let argIndex = 0
		for (let index = prevStr.length - 1; index >= 0; index--) {
			const current = prevStr[index]
			if (bracketStack.length == 0 && current == "(") {
				func = FunctionHelper.getFunctionData(prevStr, index)
				break;
			} else if (current == "," && bracketStack.length == 0)
				argIndex++
			else if (current == ")" || current == "]")
				bracketStack.push(current)
			else if (current == "(") {
				if (bracketStack[bracketStack.length - 1] == ")")
					bracketStack.pop()
				else
					break
			} else if (current == "[") {
				if (bracketStack[bracketStack.length - 1] == "]")
					bracketStack.pop()
				else
					break
			}
		}
		return func ? { ...func, argIndex } : undefined
	}
	static getFunctionData(str, lastIndex) {
		const match = str.substring(0, lastIndex).match(/\w+$/gi)
		return match && typeof match[0] == "string"
			? functions.find(f => f.name.toLowerCase() == match[0].toLowerCase())
			: undefined
	}
}

class Autocomplete {
	static getCompletions(cm, options, prim) {
		let cursor = cm.getCursor()
		let line = cm.getLine(cursor.line)
		let start = cursor.ch
		let end = cursor.ch
		while (start && /\w/.test(line.charAt(start - 1))) --start
		while (end < line.length && /\w/.test(line.charAt(end))) ++end
		return {
			list: [
				...this.getPrimitiveNames(line, cursor, prim),
				...this.getFunctions(line, cursor),
			],
			from: { line: cursor.line, ch: start },
			to: { line: cursor.line, ch: end },
		}
	}
	/* row:string, cursor: Cursor */
	static getFunctions(line, cursor) {
		let start = cursor.ch
		let end = cursor.ch
		while (start && /\w/.test(line.charAt(start - 1))) --start
		while (end < line.length && /\w/.test(line.charAt(end))) ++end
		let word = line.substring(start, end)
		let suggestions = []
		functions.forEach(f => {
			const nameMatch = f.name.toLowerCase().startsWith(word.toLowerCase())
			const synonymMatch = f.synonyms ? f.synonyms.split(" ").some(n => n.toLowerCase().startsWith(word.toLowerCase())) : false
			if (nameMatch || synonymMatch) {
				suggestions.push({
					matchScore: nameMatch ? 2 : 1,
					className: "cm-functioncall",
					displayText: f.name,
					text: `${f.name}()`,
					note: f.note ? f.note : "",
					from: { line: 0, ch: start },
					to: { line: 0, ch: end },
					render: Autocomplete.render
				})
			}
		});
		return suggestions.sort((a, b) => b.matchScore - a.matchScore)
	}
	static getPrimitiveNames(line, cursor, prim) {
		let start = cursor.ch
		let end = cursor.ch
		while (start && /\w/.test(line.charAt(start - 1))) --start
		while (end < line.length && /\w/.test(line.charAt(end))) ++end
		let word = line.substring(start, end)
		const linkedPrims = getLinkedPrimitives(prim)
		return linkedPrims.filter(prim => getName(prim).toLowerCase().startsWith(word.toLowerCase())).map(prim => {
			const name = getName(prim)
			return {
				className: "cm-primitive",
				displayText: name,
				text: name,
				note: "model entity",
				from: { line: 0, ch: start },
				to: { line: 0, ch: end },
				render: Autocomplete.render
			}
		})
	}
	static render(elem, self, cur) {
		elem.style.display = "flex"
		elem.style.width = "100%"
		elem.style.justifyContent = "space-between"
		elem.style.boxSizing = "border-box"
		let preview = document.createElement("span")
		cur.className && preview.classList.add(cur.className)
		preview.innerText = cur.displayText
		let note = document.createElement("i")
		note.innerText = cur.note ?? ""
		note.style.paddingLeft = "1em"
		note.style.fontWeight = "normal"
		note.style.color = "#888"
		elem.appendChild(preview)
		elem.appendChild(note)
	}
}

class DefinitionEditor extends jqDialog {
	/** @type {Primitive} */
	primitive;

	constructor() {
		super();
		this.accordionBuilt = false;
		this.setTitle("Equation Editor");
		this.primitive = null;

		// read more about display: table, http://www.mattboldt.com/kicking-ass-with-display-table/
		this.setHtml(`
			<div class="table">
  				<div class="table-row">
					<div class="table-cell" style="width: 30rem; height: 20rem;">
						<div class="primitive-settings" style="padding: 10px 20px 20px 0px">
							<b>Name:</b><br/>
							<input class="name-field enter-apply cm-primitive" style="width: 100%;" type="text" value=""><br/>
							<div class="name-warning-div"></div><br/>
							<div style="display: flex; justify-content: space-between; width: 100%; align-items: baseline;">
								<b>Definition:</b><span>${this.renderHelpButtonHtml("definition-help")}</span>
							</div>
							<textarea class="value-field enter-apply" cols="30" rows="30"></textarea>
							<div class="function-helper" style="width: 100%; margin: 0.4em 0.2em;" ></div>
							<b>Unit:</b><br/>
							<input id="unit-field" class="enter-apply cm-primitive" style="width: 100%;" type="text" value=""><br/><br/>
							<b>Comment:</b><br/>
							<textarea class="comment-field" rows="3" style="width:100%; box-sizing:border-box; resize:vertical;" placeholder="Optional documentation comment"></textarea><br/>
							<div class="primitive-references-div" style="width: 100%; overflow-x: auto" ><!-- References go here-->
							</div>
						</div>
					</div>
					<div class="table-cell">
					<div style="width:240px;"></div> <!-- div here to show entire window on open since next div has position:absolute -->
    				<div style="position: absolute; top: 20px; bottom: 0px; overflow-y: scroll; width: 230px; padding: 10px 20px 20px 0px;">
						<div class="accordion-cluster">
						</div> <!--End of accordion-cluster. Programming help is inserted here-->
					</div>
  				</div>
			</div>
		`);

		let value_field = document.getElementsByClassName("value-field")[0];
		this.cmValueField = new CodeMirror.fromTextArea(value_field,
			{
				mode: "stochsd-dynamic-mode",
				theme: "stochsdtheme oneline",
				lineWrapping: false,
				lineNumbers: false,
				matchBrackets: true,
				extraKeys: {
					"Esc": () => {
						this.dialogParameters.buttons["Cancel"]();
					},
					"Tab": () => {
						if (this.unitField) this.unitField.focus();
					},
					"Shift-Tab": () => {
						if (this.nameField) this.nameField.focus();
					},
					"Ctrl-Space": "autocomplete"
				},
				hintOptions: {
					hint: (cm, options) => Autocomplete.getCompletions(cm, options, this.primitive)
				}
			}
		);

		this.cmValueField.on("cursorActivity", () => {
			const functionHelperDiv = $(this.dialogContent).find(".function-helper")
			if (Preferences.get("showFunctionHelper")) {
				functionHelperDiv.css("height", "5em");
				functionHelperDiv.html(FunctionHelper.getHtml(this.cmValueField))
			} else
				functionHelperDiv.css("height", "")
		});

		$(this.dialogContent).find(".name-field").on("input", (event) => {
			// Validate exactly what the user has typed. stripBrackets() intentionally
			// trims surrounding whitespace for saved names, but using that trimmed
			// value alone here made a newly typed trailing space invisible until the
			// next character was entered. Any whitespace is invalid in a Systemika
			// model-entity identifier, so flag it immediately on the input event.
			let rawName = String($(event.target).val() ?? "");
			let newName = stripBrackets(rawName);
			let containsWhitespace = /\s/.test(rawName);
			let nameFree = isNameFree(newName, this.primitive.id);
			// valid according to the legacy .ssd equation-name rules
			let validName = validPrimitiveName(newName, this.primitive);
			// valid for tools StatRes etc. A space must be rejected before trimming.
			let validToolVarName = !containsWhitespace && isValidToolName(newName);
			if (nameFree && validName && validToolVarName) {
				$(event.target).css("background-color", "white");
				$(this.dialogContent).find(".name-warning-div").html("");
			} else {
				$(event.target).css("background-color", "pink");
				if (!nameFree) {
					$(this.dialogContent).find(".name-warning-div").html(warningHtml(`Name <b>${newName}</b> is taken.`));
				} else if (newName === "") {
					$(this.dialogContent).find(".name-warning-div").html(warningHtml(`Name cannot be empty.`));
				} else if (!validToolVarName) {
					// not allowed by StatRes and Other tools
					$(this.dialogContent).find(".name-warning-div").html(warningHtml(`
						Allowed characters are: <br/>
						<b>A-Z</b>, <b>a-z</b>, <b>_</b> (anywhere)
						<br/><b>0-9</b> (if not first character)
					`));
				} else if (!validName) {
					// not allowed by the legacy .ssd equation-name rules
					$(this.dialogContent).find(".name-warning-div").html(warningHtml(`Name cannot contain bracket, parenthesis, or quote`));
				}
			}
		});

		$(this.dialogContent).find(".enter-apply").keydown((event) => {
			if (!event.shiftKey) {
				if (event.key == "Enter") {
					event.preventDefault();
					this.applyChanges();
				}
			}
		});

		this.valueField = $(this.dialogContent).find(".value-field").get(0);
		this.nameField = $(this.dialogContent).find(".name-field").get(0);
    this.unitField = $(this.dialogContent).find("#unit-field").get(0);
		this.commentField = $(this.dialogContent).find(".comment-field").get(0);
		this.referenceDiv = $(this.dialogContent).find(".primitive-references-div").get(0);

		// Tab follows the visible field order: Name -> Definition -> Unit.
		// CodeMirror normally uses Tab for indentation; equation editing should instead
		// behave like a properties form. New lines remain available with Enter.
		$(this.nameField).keydown((event) => {
			if (event.key === "Tab" && !event.shiftKey) {
				event.preventDefault();
				this.cmValueField.focus();
			}
		});
		$(this.unitField).keydown((event) => {
			if (event.key === "Tab" && event.shiftKey) {
				event.preventDefault();
				this.cmValueField.focus();
			} else if (event.key === "Tab" && !event.shiftKey && this.commentField) {
				event.preventDefault();
				this.commentField.focus();
			}
		});
		$(this.commentField).keydown((event) => {
			if (event.key === "Tab" && event.shiftKey) {
				event.preventDefault();
				this.unitField.focus();
			}
		});

		/** @param {import("./functionCategories").FunctionDetails[]} functionList */
		let functionListToHtml = function (functionList) {
			let filterFunctionTemplate = (functionTemplate) => {
				return functionTemplate.replace(/\$\$/g, "").replace(/##/g, "").replace(/\</g, "&lt;").replace(/\>/g, "&gt;").replace(/ /g, " ");
			};
			let result = "<ul>";
			let codeSnippetName = "";
			let codeTemplate = "";
			let codeHelp = "";
			for (let i = 0; i < functionList.length; i++) {
				const func = functionList[i];
				let example = "";
				if (func.example) {
					if (func.example.result) {
						example = `<br/><br/><b>Example</b><pre style="padding:0;margin:0;">${func.example.definition}</pre><br/><b>Returns:</b><br/> ${func.example.result}`;
					} else {
						example = `<br/><br/><b>Example</b><br/><pre style="padding:0;margin:0;">${func.example.definition}</pre>`;
					}
				}
				codeSnippetName = func.name;
				codeTemplate = `${filterFunctionTemplate(func.replacement)}`;
				let cmClassName = codeTemplate.includes("(") ? "cm-functioncall" : "";
				const syntaxHelp = func.syntax ? `<b>Syntax</b><pre style="padding:0;margin:0.25em 0 0.6em 0;">${func.syntax}</pre>` : "";
				codeHelp = `${syntaxHelp}${func.description} ${example}`;
				codeHelp = codeHelp.replace(/\'/g, "&#39;");
				codeHelp = codeHelp.replace(/\"/g, "&#34;");
				result += `<li class = "function-help click-function ${cmClassName}" data-template="${codeTemplate}" title="${codeHelp}">${codeSnippetName}</li>`;
			}
			result += "</ul>";
			return result;
		};

		for (let i = 0; i < functionCategories.length; i++) {
			$(".accordion-cluster").append(`<div>
				<h3 class="function-category">${functionCategories[i].name}</h3>
					<div>
					${functionListToHtml(functionCategories[i].functions)
				}
					</div>
				</div>`);
		}

		$(this.dialogContent).find(".click-function").click((event) => this.templateClick(event));

		/* Positioning
			This is done to avoid blocking the button with the tooltip
			https://api.jqueryui.com/position/
		*/
		$(".accordion-cluster").tooltip({
			position: { my: "left+5 center", at: "right center" },
			classes: { "ui-tooltip": "tooltip" },
			content: function () {
				return $(this).prop('title');
			}
		});


		if (this.defaultFocusSelector) {
			let valueFieldDom = $(this.dialogContent).find(this.defaultFocusSelector).get(0);
			valueFieldDom.focus();
			let inputLength = valueFieldDom.value.length;
			valueFieldDom.setSelectionRange(0, inputLength);
		}

	}
	open(id, defaultFocusSelector = null) {
		$(this.dialogContent).find(".name-field").css("background-color", "white");
		$(this.dialogContent).find(".name-warning-div").html("");
		if (jqDialog.blockingDialogOpen) {
			// We can't open a new dialog while one is already open
			return;
		}
		this.primitive = findID(id);
		if (this.primitive == null) {
			alert("Model entity with id " + id + " does not exist");
			return;
		}
		this.show();
		this.defaultFocusSelector = defaultFocusSelector;

		this.updateHelpText();

		const oldValue = getValue(this.primitive).replace(/\\n/g, "\n");

		const oldName = getName(this.primitive);
    const oldNameBrackets = makePrimitiveName(oldName);

    const oldUnits = getUnits(this.primitive);

		this.setTitle(oldNameBrackets + " properties");

		$(this.nameField).val(oldNameBrackets);
		$(this.unitField).val(oldUnits);
		$(this.commentField).val(this.primitive.getAttribute("Note") || "");
		this.cmValueField.setValue(oldValue);

		// Create reference list
		let referenceList = getLinkedPrimitives(this.primitive);

		// Sort reference list by name
		referenceList.sort(function (a, b) {
			let nameA = getName(a);
			let nameB = getName(b);
			if (nameA < nameB) return -1;
			if (nameA > nameB) return 1;
			return 0;
		})

		let referenceListToHtml = (referenceList) => {
			let result = "";
			for (let linked of referenceList) {
				const color = linked.getAttribute("Color");
				let name = getName(linked);
				result += `<span class = "linked-reference click-function cm-primitive ${color ? "cm-" + color : ""}" data-template="${name}">${name}</span>&nbsp;</br>`;
			}
			return result;
		}

		let referenceHTML = "";
		if (referenceList.length > 0) {
			referenceHTML = "<b>Linked model entities:</b><br/>" + referenceListToHtml(referenceList);
		} else {
			referenceHTML = "No linked model entities";
		}
		$(this.referenceDiv).html(referenceHTML);

		$(this.referenceDiv).find(".click-function").click((event) => this.templateClick(event));

		// refresh in order to show cursor
		this.cmValueField.refresh();

		if (this.defaultFocusSelector) {
			if (this.defaultFocusSelector === ".value-field") {
				this.cmValueField.focus();
				this.cmValueField.execCommand("selectAll");
			} else {
				let valueFieldDom = $(this.dialogContent).find(this.defaultFocusSelector).get(0);
				valueFieldDom.focus();
				let inputLength = valueFieldDom.value.length;
				valueFieldDom.setSelectionRange(0, inputLength);
			}
		}
	}
	updateHelpText() {
		let typeSpecificTexts = {
			"Stock": "The initial value of the stock is set in the definition. (The stock's value over time increases or decreases by inflows and outflows.)",
			"Flow": "The content in a stock will enter or leave through a flow at the rate determined by the definition.",
			"Variable": "The auxiliary will take on the value calculated from the definition. The value will be recalculated as the simulation progresses.",
			"Constant": "The constant is evaluated once at the start of the simulation. Linked model entities may be used in its definition; their start-of-simulation values are used, so the resulting constant does not change over time."
		}
		this.setHelpButtonInfo("definition-help", "Definition Help",
			`<div style="max-width: 400px;">
			<p>${typeSpecificTexts[getTypeNew(this.primitive)]}</p>
			<b>Key bindings:</b>
			<ul style="margin: 0.5em 0; padding-left: 2em;">
				<li>${keyHtml("Esc")} &rarr; Cancel changes</li>
				<li>${keyHtml("Enter")} &rarr; Apply changes</li>
				<li>${keyHtml(["Shift", "Enter"])} &rarr; Add new line</li>
				<li>${keyHtml("Tab")} &rarr; Move to the next field</li>
				<li>
				${keyHtml(["Ctrl", "Space"])} &rarr; Show autocomplete definition
				<ul>
					<li>Navigate with suggestions with ${keyHtml("&uarr;")} and ${keyHtml("&darr;")}</li>
					<li>Select with ${keyHtml("Enter")}</li>
					<li>Close suggestions with ${keyHtml("Esc")}</li>
				</ul>
				<img src="./graphics/autocomplete.png" style="width: 100%;" />
				</li>
			</ul>
			<b>Tip:</b><br/>
			<p style="margin: 0.5em 0;">Use the separate <b>Comment</b> field for model-documentation notes. Comments do not affect simulation equations.</p>
		</div>`);
	}
	templateClick(event) {
		let templateData = $(event.target).data("template");
		let start = this.cmValueField.getCursor("start");
		let end = this.cmValueField.getCursor("end");

		if (typeof templateData == "object") templateData = templateData.toString();
		this.cmValueField.replaceRange(String(templateData), start, end);
		this.cmValueField.focus();
	}
	beforeClose() {
		this.closeAccordion();
	}
	buildAccordion() {
		// Uses the trick of creating multiple accordions
		// So that they can be independetly opened and closed
		// http://stackoverflow.com/questions/3479447/jquery-ui-accordion-that-keeps-multiple-sections-open
		$(".accordion-cluster > div").accordion({
			heightStyle: "content",
			active: false,
			header: "h3",
			collapsible: true
		});
	}
	closeAccordion() {
		$(".accordion-cluster > div").accordion({
			active: false
		});
	}
	afterShow() {
		// Building the accordion must be done while the window is visible for accordions to work correctly
		// We therefor build it the first time the dialog is shown and store it in this.accordionBuilt
		if (!this.accordionBuilt) {
			this.buildAccordion();
			this.accordionBuilt = true;
		}
	}
	makeApply() {
		if (this.primitive) {
			let value = this.cmValueField.getValue();
			const unit = this.unitField.value.trim();
			const comment = this.commentField ? this.commentField.value : "";
			let oldName = getName(this.primitive);
			let newName = stripBrackets($(this.dialogContent).find(".name-field").val());

			if (typeof RunResults !== "undefined" && RunResults.isAdvanceActive()) {
				// Advance is an interactive experiment: formulation changes should affect
				// the remaining trajectory. Apply the complete model edit first, then
				// hot-recompile the paused engine while preserving its current stock state.
				const previousValue = getValue(this.primitive).replace(/\\n/g, "\n");
				const previousUnits = getUnits(this.primitive);
				const previousComment = this.primitive.getAttribute("Note") || "";
				let nameChanged = false;
				setValue2(this.primitive, value);
				setUnits(this.primitive, unit);
				if (oldName != newName && isNameFree(newName) && validPrimitiveName(newName, this.primitive) && isValidToolName(newName)) {
					setName(this.primitive, newName);
					changeReferencesToName(this.primitive.id, oldName, newName);
					nameChanged = true;
				}
				this.primitive.setAttribute("Note", comment);

				let runtimeChange = RunResults.recompileAdvanceModel();
				if (!runtimeChange.applied) {
					// Roll the editor model back atomically if the new formulation cannot be
					// compiled, leaving both model and paused simulation in the prior state.
					if (nameChanged) {
						setName(this.primitive, oldName);
						changeReferencesToName(this.primitive.id, newName, oldName);
					}
					setValue2(this.primitive, previousValue);
					setUnits(this.primitive, previousUnits);
					this.primitive.setAttribute("Note", previousComment);
					let detail = runtimeChange.error ? htmlEscape(runtimeChange.error.message || String(runtimeChange.error)) : "";
					xAlert(`Systemika could not apply this model change to the paused Advance simulation.${detail ? `<br/><br/>${detail}` : ""}`);
					return false;
				}
			} else {
				setValue2(this.primitive, value);
				setUnits(this.primitive, unit);
				if (oldName != newName) {
					if (isNameFree(newName) && validPrimitiveName(newName, this.primitive) && isValidToolName(newName)) {
						setName(this.primitive, newName);
						changeReferencesToName(this.primitive.id, oldName, newName);
					}
				}
			}

			this.primitive.setAttribute("Note", comment);

			let visualObject = object_array[this.primitive.id];
			if (visualObject) {
				visualObject.update();
			}
			visualObject = connection_array[this.primitive.id];
			if (visualObject) {
				visualObject.update();
			}
		}
	}
}
/** @param {string} htmlContent @param {string} title */
function printContentInNewWindow(htmlContent, title = "Systemika Studio") {
	const printWindow = window.open('', '', 'height=1000,width=1000,screenX=50,screenY=50');
	printWindow.document.title = title;
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.type = "text/css";
	link.href = "editor.css";
	printWindow.document.head.appendChild(link);
	printWindow.document.body.innerHTML = htmlContent;

	setTimeout(() => {
		printWindow.print();
		printWindow.close();
	}, 400);
}

/** @param {HTMLElement[]} elementsToHide */
function hideAndPrint(elementsToHide) {
	for (let element of elementsToHide) {
		$(element).hide();
	}
	window.print();
	for (let element of elementsToHide) {
		$(element).show();
	}
}
class TextAreaDialog extends DisplayDialog {
	constructor(id) {
		super(id);
		this.setTitle("Text");
		this.setHtml(`<div style="height: 100%;">
			<div style="display: flex; justify-content: space-between; width: 100%; align-items: baseline;">
					<b>Text:</b><span>${this.renderHelpButtonHtml("text-help")}</span>
			</div>
			<textarea class="text enter-apply" style="resize: none;"></textarea>
			<div class="systemika-text-formatting" aria-label="Text formatting">
				<label>Font
					<select class="text-font-family enter-apply">
						<option value="Arial, Helvetica, sans-serif">Arial</option>
						<option value="Verdana, Geneva, sans-serif">Verdana</option>
						<option value="Georgia, serif">Georgia</option>
						<option value="'Times New Roman', Times, serif">Times New Roman</option>
						<option value="'Courier New', Courier, monospace">Courier New</option>
					</select>
				</label>
				<label>Size <input class="text-font-size enter-apply" type="number" min="8" max="96" step="1" /></label>
				<label class="systemika-text-style-toggle"><input class="text-bold" type="checkbox" /> <b>B</b></label>
				<label class="systemika-text-style-toggle"><input class="text-italic" type="checkbox" /> <i>I</i></label>
				<label class="systemika-text-style-toggle"><input class="text-underline" type="checkbox" /> <u>U</u></label>
				<label>Alignment
					<select class="text-align enter-apply">
						<option value="left">Left</option>
						<option value="center">Center</option>
						<option value="right">Right</option>
					</select>
				</label>
			</div>
			<div class="vertical-space"></div>
			<table class="modern-table zebra"><tr title="Only hides when there is any text.">
				<td>Hide frame when there is text:</td>
				<td><input type="checkbox" class="hide-frame-checkbox enter-apply" /></td>
			</tr></table>
		</div>`);

		this.setHelpButtonInfo("text-help", "Text Help", `<div style="max-width: 400px;">
			<b>Key bindings:</b>
			<ul style="margin: 0.5em 0;">
				<li>${keyHtml("Esc")} &rarr; Cancels changes</li>
				<li>${keyHtml("Enter")} &rarr; Applies changes</li>
				<li>${keyHtml(["Shift", "Enter"])} &rarr; Adds new line</li>
			</ul>
		</div>`);

		this.textArea = $(this.dialogContent).find(".text");
		this.hideFrameCheckbox = $(this.dialogContent).find(".hide-frame-checkbox");
		this.fontFamilyField = $(this.dialogContent).find(".text-font-family");
		this.fontSizeField = $(this.dialogContent).find(".text-font-size");
		this.boldField = $(this.dialogContent).find(".text-bold");
		this.italicField = $(this.dialogContent).find(".text-italic");
		this.underlineField = $(this.dialogContent).find(".text-underline");
		this.alignField = $(this.dialogContent).find(".text-align");
		this.bindEnterApplyEvents();
	}
	beforeShow() {
		let oldText = getName(this.primitive);
		this.textArea.val(oldText);
		this.hideFrameCheckbox.prop("checked", this.primitive.getAttribute("HideFrame") === "true");
		this.fontFamilyField.val(this.primitive.getAttribute("FontFamily") || "Arial, Helvetica, sans-serif");
		this.fontSizeField.val(this.primitive.getAttribute("FontSize") || "16");
		this.boldField.prop("checked", this.primitive.getAttribute("FontWeight") === "bold");
		this.italicField.prop("checked", this.primitive.getAttribute("FontStyle") === "italic");
		this.underlineField.prop("checked", this.primitive.getAttribute("TextDecoration") === "underline");
		this.alignField.val(["left", "center", "right"].includes(this.primitive.getAttribute("TextAlign")) ? this.primitive.getAttribute("TextAlign") : "left");
		$(this.dialogContent).find(".text").focus();
	}
	afterShow() {
		this.updateSize();
	}
	resize() {
		this.updateSize();
	}
	updateSize() {
		let width = this.getWidth();
		let height = this.getHeight();
		this.textArea.width(width - 10);
		this.textArea.height(Math.max(90, height - 165));
	}
	beforeCreateDialog() {
		this.dialogParameters.width = "500";
		this.dialogParameters.height = "400";
	}
	makeApply() {
		let newText = $(this.dialogContent).find(".text").val();
		setName(this.primitive, newText);
		this.primitive.setAttribute("HideFrame", this.hideFrameCheckbox.prop("checked"));
		this.primitive.setAttribute("FontFamily", this.fontFamilyField.val() || "Arial, Helvetica, sans-serif");
		let fontSize = Number(this.fontSizeField.val());
		if (!Number.isFinite(fontSize)) fontSize = 16;
		fontSize = Math.round(Math.max(8, Math.min(96, fontSize)));
		this.primitive.setAttribute("FontSize", String(fontSize));
		this.primitive.setAttribute("FontWeight", this.boldField.prop("checked") ? "bold" : "normal");
		this.primitive.setAttribute("FontStyle", this.italicField.prop("checked") ? "italic" : "normal");
		this.primitive.setAttribute("TextDecoration", this.underlineField.prop("checked") ? "underline" : "none");
		this.primitive.setAttribute("TextAlign", ["left", "center", "right"].includes(this.alignField.val()) ? this.alignField.val() : "left");
	}
}

class UnitCheckDialog extends jqDialog {
	constructor() {
		super();
		this.setTitle("Unit Check Report");
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Close": () => { $(this.dialog).dialog('close'); },
			"Print Report": () => { printContentInNewWindow($(this.dialogContent).html(), "Unit Check Report"); }
		};
		this.dialogParameters.width = 780;
		this.dialogParameters.height = 560;
		this.dialogParameters.resizable = true;
	}
	renderIssueTable(title, issues, severity) {
		if (!issues.length) return "";
		const safe = value => htmlEscape(String(value == null ? "" : value));
		const label = severity === "error" ? "Unit inconsistencies" : "Could not verify";
		return `
			<h3 class="equation-list-header">${safe(title)}</h3>
			<table class="modern-table zebra" style="width:100%;">
				<tr><th>Entity</th><th>Type</th><th>Declared Unit</th><th>${safe(label)}</th></tr>
				${issues.map(issue => `<tr>
					<td>${safe(issue.entityName)}</td>
					<td>${safe(issue.entityType)}</td>
					<td style="font-family:monospace;">${safe(issue.declaredUnit || "—")}</td>
					<td>${safe(issue.message)}</td>
				</tr>`).join("")}
			</table>`;
	}
	beforeShow() {
		let report;
		try {
			report = SystemikaUnits.checkCurrentModel();
		} catch (error) {
			this.setHtml(`<p><b>Unit checking could not run.</b></p><p>${htmlEscape(error && error.message ? error.message : String(error))}</p>`);
			return;
		}
		const errorCount = report.errors.length;
		const unknownCount = report.unknowns.length;
		let statusHtml;
		if (errorCount === 0 && unknownCount === 0) {
			statusHtml = `<p><b>No unit inconsistencies found.</b> All ${report.checkedEntityCount} checkable model entities were verified.</p>`;
		} else if (errorCount === 0) {
			statusHtml = `<p><b>No unit inconsistencies found among the items Systemika could verify.</b> ${unknownCount} item${unknownCount === 1 ? "" : "s"} could not be checked completely.</p>`;
		} else {
			statusHtml = `<p><b>${errorCount} unit inconsistenc${errorCount === 1 ? "y" : "ies"} found.</b> ${unknownCount ? `${unknownCount} additional item${unknownCount === 1 ? "" : "s"} could not be checked completely.` : ""}</p>`;
		}
		const principles = `<p style="max-width:740px;">Systemika checks units strictly. It does not convert units or treat different symbols as equivalent. For example, <code>USD</code> and <code>$</code> are different units. Algebraically equivalent expressions such as <code>Person/Year</code> and <code>Person*Year^-1</code> are treated as the same unit.</p>`;
		this.setHtml(`
			<h3 class="equation-list-header">Unit Check Report</h3>
			<table class="modern-table zebra"><tr><td>Model time unit</td><td style="font-family:monospace;">${htmlEscape(report.timeUnits || "Not specified")}</td></tr><tr><td>Entities checked</td><td>${report.checkedEntityCount}</td></tr><tr><td>Errors</td><td>${errorCount}</td></tr><tr><td>Could not verify</td><td>${unknownCount}</td></tr></table>
			${statusHtml}${principles}
			${this.renderIssueTable("Unit inconsistencies", report.errors, "error")}
			${this.renderIssueTable("Could not verify", report.unknowns, "unknown")}
		`);
	}
}

class EquationListDialog extends jqDialog {
	constructor() {
		super();
		this.setTitle("Equations");
		this.equationForm = "integral";
		this.sortMode = "type";
	}
	beforeCreateDialog() {
		this.dialogParameters.buttons = {
			"Close": () => { $(this.dialog).dialog('close'); }
		};
		this.dialogParameters.width = 980;
		this.dialogParameters.height = 650;
		this.dialogParameters.resizable = true;
	}
	modelFileName() {
		let fileName = fileManager.fileName;
		if (!fileName) return "Unnamed file";
		return String(fileName).split("\\").pop().split("/").pop();
	}
	renderSpecsInfoHtml() {
		const date = new Date();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		const fullDate = `${date.getFullYear()}-${month}-${day}`;
		const specs = [
			["Time Unit", getTimeUnits()],
			["Start", getTimeStart()],
			["Length", getTimeLength()],
			["DT", getTimeStep()],
			["Method", getAlgorithm() === "RK1" ? "Euler" : "RK4"]
		];
		return (`<div class="equation-document-summary">
			<span><b>Model:</b> ${htmlEscape(this.modelFileName())}</span>
			<span><b>Date:</b> ${htmlEscape(fullDate)}</span>
			${specs.map(spec => `<span class="equation-spec"><b>${htmlEscape(spec[0])}:</b> ${htmlEscape(String(spec[1] == null ? "" : spec[1]))}</span>`).join("")}
		</div>`);
	}

	collectEntities() {
		const flows = primitives("Flow");
		const stocks = primitives("Stock").map(stock => ({
			type: "stock",
			name: getName(stock),
			expression: getValue(stock),
			units: getUnits(stock),
			comment: stock.getAttribute("Note") || "",
			inflows: flows.filter(flow => flow.target && String(flow.target.id) === String(getID(stock))).map(getName),
			outflows: flows.filter(flow => flow.source && String(flow.source.id) === String(getID(stock))).map(getName)
		}));
		const flowRows = flows.map(flow => ({
			type: "flow", name: getName(flow), expression: getValue(flow), units: getUnits(flow), comment: flow.getAttribute("Note") || ""
		}));
		const variableRows = primitives("Variable").map(variable => ({
			type: variable.getAttribute("isConstant") === "true" ? "constant" : "auxiliary",
			name: getName(variable), expression: getValue(variable), units: getUnits(variable), comment: variable.getAttribute("Note") || ""
		}));
		const lookupRows = primitives("Converter").map(lookup => {
			let input = getConverterInput(lookup);
			return {
				type: "lookup", name: getName(lookup), expression: getValue(lookup), units: getUnits(lookup), comment: lookup.getAttribute("Note") || "",
				lookupInput: input ? getName(input) : "Time"
			};
		});
		return stocks.concat(flowRows, variableRows, lookupRows);
	}
	getRows() {
		return SystemikaDocumentation.buildRows(this.collectEntities(), { form: this.equationForm, sort: this.sortMode });
	}
	equationFormLabel() {
		return ({ integral: "Integral equations", differential: "Differential equations", difference: "Difference equations" })[this.equationForm];
	}
	sortModeLabel() {
		return ({ type: "Variable type", name: "Variable name", computation: "Order of computation" })[this.sortMode];
	}
	renderPreviewHtml() {
		const rows = this.getRows();
		if (!rows.length) return `${this.renderSpecsInfoHtml()}<p><b>Total of 0 model entities</b></p><p>This model is empty. Build a model to show equations.</p>`;
		let formNote = this.equationForm === "difference" && getAlgorithm() === "RK4"
			? `<p style="font-size:0.9em;"><i>Difference form shows the standard DT stock-update equation. With RK4, Systemika evaluates rates at intermediate points internally rather than using a single Euler rate evaluation.</i></p>`
			: "";
		let orderNote = this.sortMode === "computation"
			? `<p style="font-size:0.9em;"><i>Computation order lists stocks first as state values available at the beginning of a simulation step, then orders algebraic equations by their dependencies.</i></p>`
			: "";
		return (`
			${this.renderSpecsInfoHtml()}
			<p><b>Equation form:</b> ${htmlEscape(this.equationFormLabel())}<br/>
			<b>Sorted by:</b> ${htmlEscape(this.sortModeLabel())}</p>
			${formNote}${orderNote}
			<div class="equation-entity-count">Total of ${rows.length} model entities</div>
			<table class="modern-table zebra equation-document-table">
				<tr><th>#</th><th>Type</th><th>Name</th><th>Equation</th><th>Initial Condition</th><th>Units</th><th>Comment</th></tr>
				${rows.map(row => `<tr>
					<td style="text-align:right;">${row.order}</td>
					<td>${htmlEscape(row.type)}</td>
					<td>${htmlEscape(row.name)}</td>
					<td style="font-family:monospace; white-space:normal; word-break:break-word;">${htmlEscape(row.equation)}</td>
					<td style="font-family:monospace; white-space:normal;">${htmlEscape(row.initialCondition || "")}</td>
					<td style="font-family:monospace;">${htmlEscape(row.units || "")}</td>
					<td style="white-space:pre-wrap; word-break:break-word;">${htmlEscape(row.comment || "")}</td>
				</tr>`).join("")}
			</table>
		`);
	}

	renderPanelHtml() {
		return (`
			<div class="systemika-documentation-controls" style="display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap; margin-bottom:12px; padding:8px; border:1px solid #ccc;">
				<label><b>Equation form</b><br/>
					<select class="documentation-equation-form">
						<option value="integral" ${this.equationForm === "integral" ? "selected" : ""}>Integral equations</option>
						<option value="differential" ${this.equationForm === "differential" ? "selected" : ""}>Differential equations</option>
						<option value="difference" ${this.equationForm === "difference" ? "selected" : ""}>Difference equations</option>
					</select>
				</label>
				<label><b>Sort equations by</b><br/>
					<select class="documentation-sort-mode">
						<option value="type" ${this.sortMode === "type" ? "selected" : ""}>Variable type</option>
						<option value="name" ${this.sortMode === "name" ? "selected" : ""}>Variable name</option>
						<option value="computation" ${this.sortMode === "computation" ? "selected" : ""}>Order of computation</option>
					</select>
				</label>
			</div>
			<div class="systemika-documentation-preview">${this.renderPreviewHtml()}</div>
		`);
	}
	updatePreview() {
		$(this.dialogContent).find(".systemika-documentation-preview").html(this.renderPreviewHtml());
	}
	bindPanelEvents() {
		$(this.dialogContent).find(".documentation-equation-form").change(event => {
			this.equationForm = String($(event.currentTarget).val() || "integral");
			this.updatePreview();
		});
		$(this.dialogContent).find(".documentation-sort-mode").change(event => {
			this.sortMode = String($(event.currentTarget).val() || "type");
			this.updatePreview();
		});
	}
	beforeShow() {
		this.setHtml(this.renderPanelHtml());
		this.bindPanelEvents();
	}
}

// Compatibility alert hook retained for inherited editor/model infrastructure
if (typeof mxUtils == "undefined") {
	window.mxUtils = {};
	window.mxUtils.alert = function (message, closeHandler) {
		xAlert("Systemika message:  " + message, closeHandler);
	}
}