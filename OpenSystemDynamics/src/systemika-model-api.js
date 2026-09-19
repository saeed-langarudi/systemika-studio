"use strict";

/*
 * Systemika model API.
 *
 * Independently written, intentionally small API for the Systemika editor.
 * It preserves the existing .ssd storage schema while exposing only operations
 * needed by Systemika's model entities, displays, file handling, and settings.
 */

var last_vertex = null;

function systemikaApply(value, fn) {
    if (Array.isArray(value)) return value.map(fn);
    return fn(value);
}

function uniquePrimitives(items) {
    const seen = new Set();
    const result = [];
    for (const item of items || []) {
        if (!item) continue;
        const id = String(item.id);
        if (seen.has(id)) continue;
        seen.add(id);
        result.push(item);
    }
    return result;
}

function showMessage(message) {
    if (typeof dpopup === "function") dpopup(message);
    else if (typeof xAlert === "function") xAlert(message);
    else console.log(message);
}

function showPrompt(message, defaultValue) {
    return window.prompt(message, defaultValue == null ? "" : defaultValue);
}

function showChoice(message) {
    return window.confirm(message);
}

function downloadFile(fileName, data) {
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.style.display = "none";
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
        anchor.remove();
    }, 0);
}

function openFile(config) {
    config = Object.assign({ multiple: false, accept: null, read: false }, config || {});
    const input = document.createElement("input");
    input.type = "file";
    if (config.multiple) input.multiple = true;
    if (config.accept) input.accept = config.accept;

    const readOne = (file) => new Promise((resolve, reject) => {
        const record = { file, size: file.size, name: file.name, type: file.type };
        if (!config.read) return resolve(record);
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error("Unable to read file."));
        reader.onabort = () => reject(new Error("File reading was cancelled."));
        reader.onload = () => {
            record.contents = reader.result;
            resolve(record);
        };
        const mode = String(config.read).toLowerCase();
        if (mode === "text") reader.readAsText(file);
        else if (mode === "binary") reader.readAsBinaryString(file);
        else reject(new Error("Unsupported file read mode: " + config.read));
    });

    input.addEventListener("change", async () => {
        try {
            const files = Array.from(input.files || []);
            if (typeof config.onSelected === "function") config.onSelected(input.files);
            if (!files.length) {
                if (typeof config.onCompleted === "function") config.onCompleted(null);
                return;
            }
            const records = await Promise.all(files.map(readOne));
            if (typeof config.onCompleted === "function") {
                config.onCompleted(config.multiple ? records : records[0]);
            }
        } catch (error) {
            if (typeof config.onError === "function") config.onError(error);
            else showMessage(error.message || String(error));
        } finally {
            input.remove();
        }
    });
    document.body.appendChild(input);
    input.click();
}

function runModel(config) {
    if (config == null) config = { silent: typeof SimpleNode !== "undefined" && graph instanceof SimpleNode };
    if (typeof config === "boolean") config = { silent: config };
    if (typeof SystemikaEngine === "undefined" || !SystemikaEngine || typeof SystemikaEngine.runCurrentModel !== "function") {
        throw new Error("Systemika simulation engine is not available.");
    }
    return SystemikaEngine.runCurrentModel(config || {});
}

function simulationRunning() {
    if (typeof RunResults === "undefined" || !RunResults) return false;
    return ["running", "paused", "stepping"].includes(RunResults.runState);
}

function endRunningSimulation() {
    if (typeof RunResults !== "undefined" && RunResults && typeof RunResults.stopSimulation === "function") {
        RunResults.stopSimulation();
    }
}

function clearModel() {
    const root = systemikaRootContainer();
    if (!root) return;
    root.children = (root.children || []).filter(item => item && item.value && item.value.nodeName === "Setting");
    clearPrimitiveCache();
}

function settingNumber(name, fallback) {
    const setting = getSetting();
    if (!setting) return fallback;
    const number = Number(setting.getAttribute(name));
    return Number.isFinite(number) ? number : fallback;
}

function setSetting(name, value) {
    const setting = getSetting();
    if (!setting) throw new Error("Simulation settings are missing from the model.");
    setAttributeUndoable(setting, name, value);
}

function getTimeStep() { return settingNumber("TimeStep", 1); }
function setTimeStep(value) { setSetting("TimeStep", value); }
function getTimeStart() { return settingNumber("TimeStart", 0); }
function setTimeStart(value) { setSetting("TimeStart", value); }
function getTimeLength() { return settingNumber("TimeLength", 100); }
function setTimeLength(value) { setSetting("TimeLength", value); }
function getPauseInterval() {
    const value = settingNumber("TimePause", NaN);
    return Number.isFinite(value) ? value : undefined;
}
function setPauseInterval(value) { setSetting("TimePause", value); }
function getAdvanceBy() {
    const value = settingNumber("AdvanceBy", 1);
    return Number.isInteger(value) && value >= 1 ? value : 1;
}
function setAdvanceBy(value) {
    value = Number(value);
    if (!Number.isInteger(value) || value < 1) throw new Error("Advance By must be an integer greater than or equal to 1.");
    setSetting("AdvanceBy", value);
}
function getTimeUnits() { const s = getSetting(); return s ? (s.getAttribute("TimeUnits") || "") : ""; }
function setTimeUnits(value) { setSetting("TimeUnits", value == null ? "" : String(value)); }
function getAlgorithm() { const s = getSetting(); return s ? (s.getAttribute("SolutionAlgorithm") || "RK1") : "RK1"; }
function setAlgorithm(value) {
    const algorithm = String(value || "").toUpperCase();
    if (algorithm !== "RK1" && algorithm !== "RK4") throw new Error("Systemika supports RK1 (Euler) and RK4.");
    setSetting("SolutionAlgorithm", algorithm);
}

function findAll() {
    return primitives().filter(item => item && item.value && !["Setting", "Display"].includes(item.value.nodeName));
}

function findID(id) {
    if (Array.isArray(id)) return id.map(findID);
    if (id == null) return null;
    const wanted = String(id);
    return primitives().find(item => String(item.id) === wanted) || null;
}

function findName(name) {
    if (Array.isArray(name)) return flatten(name.map(findName)).filter(Boolean);
    const wanted = String(name).toLowerCase();
    const matches = findAll().filter(item => String(item.getAttribute("name") || "").toLowerCase() === wanted);
    if (!matches.length) return null;
    return matches.length === 1 ? matches[0] : matches;
}

function findType(type) {
    if (Array.isArray(type)) return flatten(type.map(findType));
    return primitives(type);
}

function findValue(search) {
    const patterns = Array.isArray(search) ? search : [search];
    return uniquePrimitives(findAll().filter(item => patterns.some(pattern => {
        const value = getValue(item);
        if (pattern instanceof RegExp) {
            pattern.lastIndex = 0;
            return pattern.test(value);
        }
        return value === pattern;
    })));
}

function excludeType(value, type) {
    const types = new Set((Array.isArray(type) ? type : [type]).map(String));
    if (Array.isArray(value)) return value.filter(item => item && !types.has(getType(item)));
    if (!value) return value;
    return types.has(getType(value)) ? null : value;
}

function getID(primitive) { return systemikaApply(primitive, item => item ? item.id : null); }
function getType(primitive) { return systemikaApply(primitive, item => item && item.value ? item.value.nodeName : null); }
function getName(primitive) { return systemikaApply(primitive, item => item ? item.getAttribute("name") : null); }
function getUnits(primitive) { return systemikaApply(primitive, item => item ? (item.getAttribute("Units") || "") : ""); }

function setName(primitive, name) {
    const items = arrify(primitive);
    let success = true;
    for (const item of items) {
        if (!item || !validPrimitiveName(String(name), item)) {
            success = false;
            continue;
        }
        setAttributeUndoable(item, "name", String(name));
        if (typeof propogateGhosts === "function") propogateGhosts(item);
    }
    return success;
}

function setUnits(primitive, units) {
    for (const item of arrify(primitive)) setAttributeUndoable(item, "Units", String(units == null ? "" : units));
}

function decodeStoredDefinition(value) {
    return String(value == null ? "" : value).replace(/\\n/g, "\n");
}

function canonicalizeEquationReferences(value) {
    // Older .ssd files use [Name] references. Systemika names are identifier-safe,
    // so bare Name is the canonical syntax. Keep non-identifier brackets intact
    // for maximum legacy compatibility.
    return String(value == null ? "" : value).replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, "$1");
}

function encodeStoredDefinition(value) {
    return String(value == null ? "" : value).replace(/\r\n?/g, "\n").replace(/\n/g, "\\n");
}

function getValue(primitive) {
    return systemikaApply(primitive, item => {
        if (!item || !item.value) return "";
        let value = "";
        switch (item.value.nodeName) {
            case "Stock": value = item.getAttribute("InitialValue") || ""; break;
            case "Flow": value = item.getAttribute("FlowRate") || ""; break;
            case "Variable": value = item.getAttribute("Equation") || ""; break;
            case "Converter": value = item.getAttribute("Data") || ""; break;
            default: return "";
        }
        return decodeStoredDefinition(value);
    });
}

function setValue(primitive, value) {
    for (const item of arrify(primitive)) {
        if (!item || !item.value) continue;
        switch (item.value.nodeName) {
            case "Stock": setAttributeUndoable(item, "InitialValue", encodeStoredDefinition(canonicalizeEquationReferences(value))); break;
            case "Flow": setAttributeUndoable(item, "FlowRate", encodeStoredDefinition(canonicalizeEquationReferences(value))); break;
            case "Variable": setAttributeUndoable(item, "Equation", encodeStoredDefinition(canonicalizeEquationReferences(value))); break;
            case "Converter": setAttributeUndoable(item, "Data", encodeStoredDefinition(value)); break;
        }
    }
}

function getData(lookup) { return systemikaApply(lookup, item => item ? decodeStoredDefinition(item.getAttribute("Data") || "") : ""); }
function setData(lookup, data) { for (const item of arrify(lookup)) setAttributeUndoable(item, "Data", encodeStoredDefinition(data)); }
function getConverterInput(lookup) {
    return systemikaApply(lookup, item => {
        if (!item) return null;
        const source = item.getAttribute("Source");
        return !source || source === "Time" ? null : findID(source);
    });
}
function setConverterInput(lookup, input) {
    for (const item of arrify(lookup)) setAttributeUndoable(item, "Source", input ? input.id : "Time");
}
function getInterpolation(lookup) { return systemikaApply(lookup, item => item ? (item.getAttribute("Interpolation") || "Linear") : "Linear"); }
function setInterpolation(lookup, interpolation) {
    const value = String(interpolation || "Linear");
    if (!["Linear", "Discrete"].includes(value)) throw new Error("Lookup interpolation must be Linear or Discrete.");
    for (const item of arrify(lookup)) setAttributeUndoable(item, "Interpolation", value);
}

function systemikaDocumentFor(primitive) {
    return primitive && primitive.value && primitive.value.ownerDocument ? primitive.value.ownerDocument : document;
}

function systemikaGeometry(primitive, withPoints) {
    const doc = systemikaDocumentFor(primitive);
    let cell = primitive.value.children && primitive.value.children[0];
    if (!cell || cell.nodeName !== "mxCell") {
        cell = doc.createElement("mxCell");
        primitive.value.appendChild(cell);
    }
    let geometry = cell.children && cell.children[0];
    if (!geometry || geometry.nodeName !== "mxGeometry") {
        geometry = doc.createElement("mxGeometry");
        geometry.setAttribute("as", "geometry");
        cell.appendChild(geometry);
    }
    if (withPoints) {
        let source = Array.from(geometry.children || []).find(node => node.getAttribute && node.getAttribute("as") === "sourcePoint");
        let target = Array.from(geometry.children || []).find(node => node.getAttribute && node.getAttribute("as") === "targetPoint");
        if (!source) {
            source = doc.createElement("mxPoint"); source.setAttribute("as", "sourcePoint"); source.setAttribute("x", "0"); source.setAttribute("y", "0"); geometry.appendChild(source);
        }
        if (!target) {
            target = doc.createElement("mxPoint"); target.setAttribute("as", "targetPoint"); target.setAttribute("x", "0"); target.setAttribute("y", "0"); geometry.appendChild(target);
        }
        return { cell, geometry, source, target };
    }
    return { cell, geometry };
}

function getPositionType(primitive) {
    return ["Flow", "Link", "TextArea", "Rectangle", "Ellipse", "Line", "Table", "TimePlot", "ComparePlot", "XyPlot", "HistoPlot"].includes(getType(primitive)) ? 2 : 1;
}

function getSize(primitive) {
    return systemikaApply(primitive, item => {
        if (!item) return [0, 0];
        const { geometry } = systemikaGeometry(item, false);
        return [Number(geometry.getAttribute("width")) || 0, Number(geometry.getAttribute("height")) || 0];
    });
}

function setSize(primitive, size) {
    // Match the historical .ssd editor semantics: changing stored size does not
    // emit a position-update event. Visual code explicitly refreshes itself.
    for (const item of arrify(primitive)) {
        const { geometry } = systemikaGeometry(item, false);
        geometry.setAttribute("width", Number(size[0]) || 0);
        geometry.setAttribute("height", Number(size[1]) || 0);
    }
}

function getXmlPoint(point) {
    return [Number(point && point.getAttribute("x")) || 0, Number(point && point.getAttribute("y")) || 0];
}
function setXmlPoint(point, pos) { point.setAttribute("x", Number(pos[0]) || 0); point.setAttribute("y", Number(pos[1]) || 0); }
function getSourcePosition(primitive) { return getXmlPoint(systemikaGeometry(primitive, true).source); }
function getTargetPosition(primitive) { return getXmlPoint(systemikaGeometry(primitive, true).target); }
// Endpoint setters are low-level storage operations. They deliberately do not
// emit positionUpdate(): Link/Flow construction writes endpoints while the
// visual object is still being assembled. A whole-object move via setPosition()
// emits exactly one update after both endpoints are consistent.
function setSourcePosition(primitive, pos) { setXmlPoint(systemikaGeometry(primitive, true).source, pos); }
function setTargetPosition(primitive, pos) { setXmlPoint(systemikaGeometry(primitive, true).target, pos); }

function getPosition(primitive) {
    return systemikaApply(primitive, item => {
        if (!item) return [0, 0];
        if (getPositionType(item) === 2) {
            const a = getSourcePosition(item), b = getTargetPosition(item);
            return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        }
        const { geometry } = systemikaGeometry(item, false);
        return [Number(geometry.getAttribute("x")) || 0, Number(geometry.getAttribute("y")) || 0];
    });
}

function setPosition(primitive, position) {
    for (const item of arrify(primitive)) {
        if (!item) continue;
        if (getPositionType(item) === 2) {
            const current = getPosition(item);
            const dx = (Number(position[0]) || 0) - current[0];
            const dy = (Number(position[1]) || 0) - current[1];
            const source = getSourcePosition(item), target = getTargetPosition(item);
            setSourcePosition(item, [source[0] + dx, source[1] + dy]);
            setTargetPosition(item, [target[0] + dx, target[1] + dy]);
            if (typeof item.positionUpdate === "function") item.positionUpdate();
        } else {
            const { geometry } = systemikaGeometry(item, false);
            geometry.setAttribute("x", Number(position[0]) || 0);
            geometry.setAttribute("y", Number(position[1]) || 0);
            if (item.positionUpdate) item.positionUpdate();
        }
    }
}

function getCenterPosition(primitive) {
    const pos = getPosition(primitive), size = getSize(primitive);
    return [pos[0] + size[0] / 2, pos[1] + size[1] / 2];
}
function setCenterPosition(primitive, position) {
    if (getPositionType(primitive) === 2) return setPosition(primitive, position);
    const size = getSize(primitive);
    setPosition(primitive, [position[0] - size[0] / 2, position[1] - size[1] / 2]);
}

function getEnds(connector) { return systemikaApply(connector, item => item ? [item.source || null, item.target || null] : [null, null]); }
function systemikaStoreTerminal(connector, side, terminal) {
    const { cell } = systemikaGeometry(connector, true);
    if (terminal) cell.setAttribute(side, terminal.id);
    else cell.removeAttribute(side);
}
function setSource(connector, source) { connector.source = source || null; systemikaStoreTerminal(connector, "source", source); clearPrimitiveCache(); }
function setTarget(connector, target) { connector.target = target || null; systemikaStoreTerminal(connector, "target", target); clearPrimitiveCache(); }
function setEnds(connector, ends) {
    for (const item of arrify(connector)) { setSource(item, ends[0] || null); setTarget(item, ends[1] || null); }
}

function setParent(primitive, parent) {
    const destination = parent || systemikaRootContainer();
    for (const item of arrify(primitive)) {
        if (!item || !destination) continue;
        if (item.parent && item.parent.children) {
            const index = item.parent.children.indexOf(item);
            if (index >= 0) item.parent.children.splice(index, 1);
        }
        item.parent = destination;
        item.parentNode = destination;
        if (!destination.children) destination.children = [];
        if (!destination.children.includes(item)) destination.children.push(item);
    }
    clearPrimitiveCache();
}

function systemikaTemplateKey(type, extraAttributes) {
    switch (String(type)) {
        case "Auxiliary": return "variable";
        case "Constant": return "variable";
        case "Lookup": return "converter";
        default: return String(type).toLowerCase();
    }
}

function createPrimitive(name, type, position, size, extraAttributes) {
    const key = systemikaTemplateKey(type, extraAttributes);
    const template = primitiveBank[key];
    if (!template) throw new Error("Unsupported Systemika entity type: " + type);
    const parent = systemikaRootContainer();
    const item = simpleCloneNode(template, parent);
    if (!parent.children) parent.children = [];
    parent.children.push(item);
    last_vertex = item;

    const attributes = Object.assign({}, extraAttributes || {});
    if (type === "Constant") attributes.isConstant = true;
    if (type === "Auxiliary") attributes.isConstant = false;
    for (const [keyName, value] of Object.entries(attributes)) item.value.setAttribute(keyName, value);

    setSize(item, size || [0, 0]);
    setPosition(item, position || [0, 0]);
    setName(item, name || "");
    clearPrimitiveCache();
    if (typeof defaultPrimitiveCreatedHandler === "function") defaultPrimitiveCreatedHandler(item);
    return item;
}

function createConnector(name, type, alpha, omega) {
    const key = systemikaTemplateKey(type);
    const template = primitiveBank[key];
    if (!template) throw new Error("Unsupported Systemika connector/display type: " + type);
    let parent = (omega && omega.parent) || (alpha && alpha.parent) || systemikaRootContainer();
    const item = simpleCloneNode(template, parent);
    if (!parent.children) parent.children = [];
    parent.children.push(item);
    systemikaGeometry(item, true);
    setEnds(item, [alpha || null, omega || null]);
    setName(item, name || "");
    clearPrimitiveCache();
    return item;
}

function removePrimitive(primitive) {
    for (const item of arrify(primitive)) {
        if (!item) continue;
        if (typeof defaultPrimitiveBeforeDestroyHandler === "function") defaultPrimitiveBeforeDestroyHandler(item);
        if (item.parent && item.parent.children) {
            const index = item.parent.children.indexOf(item);
            if (index >= 0) item.parent.children.splice(index, 1);
        }
        // Disconnect surviving connectors from a removed endpoint. Link cleanup is
        // performed by the editor; Flows may remain unattached by design.
        for (const connector of primitives().filter(candidate => candidate && candidate !== item && ["Flow", "Link"].includes(getType(candidate)))) {
            if (connector.source === item) setSource(connector, null);
            if (connector.target === item) setTarget(connector, null);
        }
    }
    clearPrimitiveCache();
}

function connected(a, b) {
    if (!a || !b) return false;
    return primitives("Flow").concat(primitives("Link")).some(connector =>
        (connector.source === a && connector.target === b) || (connector.source === b && connector.target === a));
}

// Compatibility stubs used by old import/update paths. Selection and editor
// presentation are owned by editor.js, not the model API.
function highlight() {}
function isSelected(primitive) {
    const visual = typeof get_object === "function" && primitive ? get_object(primitive.id) : null;
    return !!(visual && typeof visual.isSelected === "function" && visual.isSelected());
}
function toggleSideBar() {}
function showEditor(primitive, annotations) {
    if (typeof EditorControll !== "undefined" && EditorControll.showEditor) EditorControll.showEditor(primitive, annotations);
}
