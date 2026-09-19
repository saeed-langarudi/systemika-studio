"use strict";

/*
 * Systemika model utilities.
 *
 * Independently written support code for the Systemika editor/model layer.
 * This file intentionally contains only the small set of graph helpers used by
 * Systemika. Legacy .ssd storage tags are supported at the file boundary.
 */

var primitiveCache = Object.create(null);
var neighborhoodCache = Object.create(null);

function isDefined(value) {
    return typeof value !== "undefined";
}

function isUndefined(value) {
    return typeof value === "undefined";
}

function isTrue(value) {
    return value === true || value === 1 || value === -1 || value === "1" ||
        value === "-1" || value === "true" || value === "True" || value === "Yes";
}

function arrify(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

function flatten(values) {
    const result = [];
    (function visit(value) {
        if (Array.isArray(value)) {
            value.forEach(visit);
        } else {
            result.push(value);
        }
    })(values);
    return result;
}

function systemikaRootContainer() {
    if (!graph) return null;
    if (typeof SimpleNode !== "undefined" && graph instanceof SimpleNode) {
        return graph.children && graph.children[0] && graph.children[0].children
            ? graph.children[0].children[0]
            : null;
    }
    if (typeof graph.getModel === "function") {
        const root = graph.getModel().getRoot();
        return root && root.children ? root.children[0] : null;
    }
    return null;
}

function childrenCells(root) {
    if (!root || !root.children) return [];
    const result = [];
    for (const child of root.children) {
        if (!child || !child.value) continue;
        result.push(child);
        // Folders are legacy-only, but recurse so older .ssd files remain readable.
        if (child.value.nodeName === "Folder") result.push(...childrenCells(child));
    }
    return result;
}

function clearPrimitiveCache() {
    primitiveCache = Object.create(null);
    neighborhoodCache = Object.create(null);
}

function primitiveMatchesType(cell, requestedType) {
    if (!cell || !cell.value) return false;
    const storageType = cell.value.nodeName;
    if (requestedType == null) return true;

    switch (String(requestedType)) {
        case "Auxiliary":
            return storageType === "Variable" && cell.getAttribute("isConstant") !== "true";
        case "Constant":
            return storageType === "Variable" && cell.getAttribute("isConstant") === "true";
        case "Lookup":
            return storageType === "Converter";
        default:
            return storageType === requestedType;
    }
}

function primitives(type) {
    const key = type == null ? "*" : String(type);
    if (primitiveCache[key]) return primitiveCache[key].slice();
    const root = systemikaRootContainer();
    const cells = childrenCells(root);
    const result = type == null ? cells : cells.filter(cell => primitiveMatchesType(cell, type));
    primitiveCache[key] = result;
    return result.slice();
}

function getSetting() {
    return primitives("Setting")[0] || null;
}

function orig(cell) {
    if (!cell) return null;
    if (cell.value && cell.value.nodeName === "Ghost") {
        const sourceId = cell.getAttribute("Source");
        return typeof findID === "function" ? findID(sourceId) : null;
    }
    return cell;
}

function isValued(cell) {
    const item = orig(cell);
    if (!item || !item.value) return false;
    return ["Stock", "Flow", "Variable", "Converter"].includes(item.value.nodeName);
}

function validPrimitiveName(name, primitive) {
    if (!primitive || !primitive.value) return false;
    const type = primitive.value.nodeName;
    const namedModelTypes = ["Stock", "Flow", "Variable", "Converter"];
    if (!namedModelTypes.includes(type)) return true;
    return String(name).length > 0 && !/[\[\](){}<>'"]/.test(String(name));
}

function getGraphXml() {
    if (typeof createModelFileData === "function") return createModelFileData();
    if (graph && graph.value && typeof XMLSerializer !== "undefined") {
        return new XMLSerializer().serializeToString(graph.value);
    }
    return "";
}

function changeNodeName(node, newName) {
    const owner = node && node.ownerDocument ? node.ownerDocument : document;
    const replacement = owner.createElement(newName);
    if (node && node.attributes) {
        for (const attribute of Array.from(node.attributes)) {
            replacement.setAttribute(attribute.name, attribute.value);
        }
    }
    for (const child of Array.from(node && node.childNodes ? node.childNodes : [])) {
        replacement.appendChild(child.cloneNode(true));
    }
    return replacement;
}

function setAllConnectable() {
    if (graph && typeof graph.setConnectable === "function") graph.setConnectable(true);
    for (const item of primitives()) {
        if (typeof item.setConnectable === "function") item.setConnectable(true);
    }
}

function neighborhood(target) {
    if (!target) return [];
    const targetId = String(target.id);
    if (neighborhoodCache[targetId]) return neighborhoodCache[targetId].slice();

    const result = [];
    const seen = new Map();
    const add = (item, linkHidden) => {
        item = orig(item);
        if (!item || !isValued(item)) return;
        const id = String(item.id);
        if (id === targetId) return;
        if (!seen.has(id)) {
            const entry = { item: item, type: "direct" };
            if (linkHidden) entry.linkHidden = true;
            seen.set(id, entry);
            result.push(entry);
        } else if (!linkHidden) {
            delete seen.get(id).linkHidden;
        }
    };

    const type = target.value && target.value.nodeName;
    if (type === "Flow" || type === "Link") {
        add(target.source, false);
        add(target.target, false);
    }

    // Stock-flow attachment is structural. It is shown as a hidden link in the
    // definition helper, matching Systemika's distinction between structure and
    // explicit information links.
    for (const flow of primitives("Flow")) {
        if (flow.source && String(flow.source.id) === targetId) add(flow, true);
        if (flow.target && String(flow.target.id) === targetId) add(flow, true);
    }

    // Information links are directed: source is visible to target. A link marked
    // bidirectional also makes target visible to source.
    for (const link of primitives("Link")) {
        if (link.target && String(link.target.id) === targetId) add(link.source, false);
        if (link.source && String(link.source.id) === targetId && isTrue(link.getAttribute("BiDirectional"))) {
            add(link.target, false);
        }
    }

    neighborhoodCache[targetId] = result;
    return result.slice();
}

function replaceAll(text, search, replacement) {
    return String(text).split(search).join(replacement);
}

function cmd(key) {
    const isMac = typeof mxClient !== "undefined" && mxClient.IS_MAC;
    return isMac
        ? "<span style='color:grey'>(&#8984;" + key + ")</span>"
        : "<span style='color:grey'>(Ctrl-" + key + ")</span>";
}
