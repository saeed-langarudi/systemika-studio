"use strict";

/*
 * Systemika model graph/document layer.
 *
 * Independently written lightweight representation for Systemika .ssd models.
 * The editor uses SVG for rendering, so it only needs a small in-memory tree
 * with attributes, parent/child relationships, subscriptions, and XML loading.
 */

var defaultAttributeChangeHandler = function () {};
var defaultPositionChangeHandler = function () {};
var defaultPrimitiveCreatedHandler = function () {};
var defaultPrimitiveBeforeDestroyHandler = function () {};

class SystemikaNode {
    constructor(value, parent) {
        this.value = value || null;
        this.parent = parent || null;
        this.parentNode = parent || null;
        this.children = [];
        this.id = null;
        this.source = null;
        this.target = null;
        this.attributeSubscribers = [];
        this.positionSubscribers = [];
    }

    getAttribute(name) {
        return this.value && typeof this.value.getAttribute === "function"
            ? this.value.getAttribute(name)
            : null;
    }

    setAttribute(name, value) {
        if (!this.value || typeof this.value.setAttribute !== "function") return;
        this.value.setAttribute(name, value);
        if (String(name) === "id") this.id = this.value.getAttribute("id");
        defaultAttributeChangeHandler(this, name, value);
        for (const subscriber of this.attributeSubscribers.slice()) subscriber(name, value);
    }

    positionUpdate() {
        defaultPositionChangeHandler(this);
        for (const subscriber of this.positionSubscribers.slice()) subscriber();
    }

    subscribeAttribute(handler) {
        if (typeof handler === "function") this.attributeSubscribers.push(handler);
    }

    subscribePosition(handler) {
        if (typeof handler === "function") this.positionSubscribers.push(handler);
    }
}

// Temporary compatibility alias while editor code is migrated to SystemikaNode.
// This name is an implementation detail and is not part of the .ssd format.
var SimpleNode = SystemikaNode;

function systemikaNextNodeId() {
    let highest = 1;
    if (typeof primitives === "function") {
        for (const item of primitives()) {
            const value = Number(item && item.id);
            if (Number.isFinite(value)) highest = Math.max(highest, value);
        }
    }
    return String(highest + 1);
}

function systemikaWrapXmlNode(xmlNode, parent) {
    if (!xmlNode || xmlNode.nodeType === 3 || xmlNode.nodeType === 8) return null;
    const wrapped = new SystemikaNode(xmlNode, parent || null);
    if (xmlNode.nodeType === 1) wrapped.id = xmlNode.getAttribute("id");
    if (xmlNode.childNodes) {
        for (const child of Array.from(xmlNode.childNodes)) {
            const wrappedChild = systemikaWrapXmlNode(child, wrapped);
            if (wrappedChild) wrapped.children.push(wrappedChild);
        }
    }
    return wrapped;
}

function mxGraphToJson(xml, parent) {
    return systemikaWrapXmlNode(xml, parent || null);
}

function systemikaCellChild(node) {
    if (!node || !node.children) return null;
    return node.children.find(child => child && child.value && child.value.nodeName === "mxCell") || null;
}

function systemikaResolveLoadedStructure(modelGraph) {
    const modelElement = modelGraph && modelGraph.children ? modelGraph.children[0] : null;
    const rootContainer = modelElement && modelElement.children ? modelElement.children[0] : null;
    if (!modelElement || !rootContainer) throw new Error("The model XML does not contain a root container.");

    // The outer XML element is not a model primitive. Give it a lightweight
    // marker so existing root-navigation code can distinguish it from entities.
    modelElement.value = { nodeName: "root", id: 1 };
    modelElement.id = 1;

    const allNodes = [];
    (function collect(node) {
        if (!node || !node.children) return;
        for (const child of node.children) {
            if (child && child.value && child.value.nodeName !== "mxCell" && child.value.nodeName !== "mxGeometry" && child.value.nodeName !== "mxPoint") {
                allNodes.push(child);
            }
            collect(child);
        }
    })(rootContainer);

    const byId = new Map();
    byId.set("1", rootContainer);
    for (const item of allNodes) if (item.id != null) byId.set(String(item.id), item);

    // Capture mxCell metadata before removing mxGraph storage wrappers.
    const metadata = new Map();
    for (const item of allNodes) {
        const cell = systemikaCellChild(item);
        metadata.set(item, {
            parentId: cell && cell.getAttribute("parent") ? String(cell.getAttribute("parent")) : "1",
            sourceId: cell && cell.getAttribute("source") ? String(cell.getAttribute("source")) : null,
            targetId: cell && cell.getAttribute("target") ? String(cell.getAttribute("target")) : null
        });
        if (item.children) item.children = item.children.filter(child => !(child && child.value && child.value.nodeName === "mxCell"));
    }

    // Rebuild entity parentage from the stored parent id. This is primarily for
    // reading older files that used folders; Systemika itself creates entities
    // directly in the root container.
    for (const item of allNodes) {
        const info = metadata.get(item);
        const desiredParent = byId.get(info.parentId) || rootContainer;
        if (item.parent && item.parent.children) {
            const oldIndex = item.parent.children.indexOf(item);
            if (oldIndex >= 0) item.parent.children.splice(oldIndex, 1);
        }
        item.parent = desiredParent;
        item.parentNode = desiredParent;
        if (!desiredParent.children) desiredParent.children = [];
        if (!desiredParent.children.includes(item)) desiredParent.children.push(item);
    }

    for (const item of allNodes) {
        const type = item.value && item.value.nodeName;
        if (type !== "Flow" && type !== "Link") continue;
        const info = metadata.get(item);
        item.source = info.sourceId ? byId.get(info.sourceId) || null : null;
        item.target = info.targetId ? byId.get(info.targetId) || null : null;
    }

    return modelGraph;
}

function systemikaNormalizeLoadedModel() {
    if (typeof primitives !== "function") return;

    // Very old .ssd/Insight-Maker-compatible files called Auxiliaries
    // "Parameter". Systemika stores Auxiliaries/Constants as Variable nodes.
    for (const item of primitives().slice()) {
        if (!item || !item.value) continue;
        if (item.value.nodeName === "Parameter" && typeof changeNodeName === "function") {
            item.value = changeNodeName(item.value, "Variable");
            if (item.getAttribute("isConstant") == null) item.value.setAttribute("isConstant", "false");
        }
    }

    // Insight Maker / older Systemika files may carry OnlyPositive="true"
    // on Flows. Systemika deliberately permits signed flow rates, so normalize
    // that legacy storage flag away. A negative rate reverses the effective
    // direction of transfer; it is never clipped to zero.
    for (const flow of primitives("Flow")) {
        if (flow && flow.value) flow.value.setAttribute("OnlyPositive", "false");
    }

    // Canonical Systemika equations use bare identifier references. Convert
    // legacy [Name] references on load when the name is a valid Systemika
    // identifier; the native parser still accepts bracketed syntax for files
    // that cannot be normalized safely.
    const normalizeEquation = value => String(value == null ? "" : value)
        .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, "$1");
    for (const item of primitives()) {
        if (!item || !item.value) continue;
        const type = item.value.nodeName;
        const attr = type === "Stock" ? "InitialValue" : type === "Flow" ? "FlowRate" : type === "Variable" ? "Equation" : null;
        if (!attr) continue;
        const current = item.getAttribute(attr);
        if (current != null) item.value.setAttribute(attr, normalizeEquation(current));
    }

    // Early Lookup storage used parallel Inputs/Outputs attributes. Convert it
    // to the semicolon-delimited Data representation used by Systemika.
    for (const lookup of primitives("Converter")) {
        if (lookup.getAttribute("Data") == null) {
            const inputs = String(lookup.getAttribute("Inputs") || "").split(",");
            const outputs = String(lookup.getAttribute("Outputs") || "").split(",");
            const pairs = [];
            for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
                if (inputs[i] !== "" || outputs[i] !== "") pairs.push(inputs[i] + "," + outputs[i]);
            }
            lookup.value.setAttribute("Data", pairs.join(";"));
        }
        if (lookup.getAttribute("Source") == null) lookup.value.setAttribute("Source", "Time");
        if (lookup.getAttribute("Interpolation") == null) lookup.value.setAttribute("Interpolation", "Linear");
    }

    let setting = typeof getSetting === "function" ? getSetting() : null;
    if (!setting && typeof primitiveBank !== "undefined" && primitiveBank.setting) {
        const rootContainer = typeof systemikaRootContainer === "function" ? systemikaRootContainer() : null;
        if (rootContainer) {
            setting = simpleCloneNode(primitiveBank.setting, rootContainer);
            if (!rootContainer.children) rootContainer.children = [];
            rootContainer.children.push(setting);
            if (typeof clearPrimitiveCache === "function") clearPrimitiveCache();
        }
    }
    if (setting && typeof primitiveBank !== "undefined" && primitiveBank.setting) {
        for (const attr of Array.from(primitiveBank.setting.attributes || [])) {
            if (setting.getAttribute(attr.name) == null) setting.value.setAttribute(attr.name, attr.value);
        }
        // Keep the legacy numeric schema marker for .ssd interoperability.
        setting.value.setAttribute("Version", "36");
    }
}

function loadXML(modelString) {
    if (typeof DOMParser === "undefined") throw new Error("XML loading is unavailable in this environment.");
    const documentNode = new DOMParser().parseFromString(String(modelString), "text/xml");
    if (documentNode.getElementsByTagName && documentNode.getElementsByTagName("parsererror").length) {
        throw new Error("The model file contains invalid XML.");
    }
    const documentElement = documentNode.documentElement;
    const rootName = documentElement && documentElement.nodeName;
    if (!documentElement || (rootName !== "InsightMakerModel" && rootName !== "SystemikaModel")) {
        throw new Error("This file is not a Systemika .ssd model.");
    }
    const rootContainers = Array.from(documentElement.childNodes || []).filter(node => node && node.nodeType === 1 && node.nodeName === "root");
    if (rootContainers.length !== 1) {
        throw new Error("The model file does not contain exactly one model root.");
    }

    graph = systemikaWrapXmlNode(documentNode, null);
    systemikaResolveLoadedStructure(graph);
    if (typeof clearPrimitiveCache === "function") clearPrimitiveCache();
    systemikaNormalizeLoadedModel();
    if (typeof clearPrimitiveCache === "function") clearPrimitiveCache();
    return graph;
}

function simpleCloneNode(node, parent) {
    const source = node && node.value ? node.value : node;
    if (!source || typeof source.cloneNode !== "function") throw new Error("Cannot clone an invalid model entity template.");
    const clone = new SystemikaNode(source.cloneNode(true), parent || null);
    clone.id = systemikaNextNodeId();
    clone.value.setAttribute("id", clone.id);
    return clone;
}

function simpleCloneNode2(node, parent) {
    const clone = simpleCloneNode(node, parent);
    const destination = parent || (typeof systemikaRootContainer === "function" ? systemikaRootContainer() : null);
    if (!destination) throw new Error("Cannot clone a model entity without a model root.");
    clone.parent = destination;
    clone.parentNode = destination;
    if (!destination.children) destination.children = [];
    destination.children.push(clone);
    return clone;
}

function setAttributeUndoable(primitive, name, value) {
    if (primitive instanceof SystemikaNode) {
        primitive.setAttribute(name, value);
        if (typeof clearPrimitiveCache === "function") clearPrimitiveCache();
        return;
    }

    // Kept only for environments embedding the old mxGraph editor. Systemika's
    // current SVG editor always uses SystemikaNode.
    if (typeof mxCellAttributeChange !== "undefined" && graph && typeof graph.getModel === "function") {
        graph.getModel().execute(new mxCellAttributeChange(primitive, name, value));
        return;
    }
    throw new Error("Unsupported model node implementation.");
}
