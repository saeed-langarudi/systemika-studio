(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SystemikaPlotPages = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PAGE_ATTRIBUTE = "PlotPages";
  const INDEX_ATTRIBUTE = "PlotPageIndex";

  const ATTRIBUTES = Object.freeze({
    TimePlot: [
      "Primitives", "Sides", "RunName", "AxisLimits",
      "LineOptions", "LineStyles", "TitleLabel", "LeftAxisLabel", "RightAxisLabel",
      "HasNumberedLines", "ColorFromPrimitive", "ShowHighlighter", "Color"
    ],
    ComparePlot: [
      "Primitives", "RunNames", "RunName", "AxisLimits",
      "LineOptions", "LineStyles", "TitleLabel", "LeftAxisLabel", "HasNumberedLines",
      "ColorFromPrimitive", "ShowHighlighter", "Color"
    ],
    XyPlot: [
      "Primitives", "RunNames", "RunName", "AxisLimits",
      "ShowLine", "ShowMarker", "ShowNumber", "MarkStart", "MarkEnd", "TitleLabel",
      "XLogScale", "YLogScale", "ShowHighlighter", "Color"
    ],
    HistoPlot: [
      "Primitives", "RunNames", "RunName", "NumberOfBars", "NumberOfBarsAuto",
      "LowerBound", "LowerBoundAuto", "UpperBound", "UpperBoundAuto", "Color"
    ]
  });

  function primitiveType(primitive) {
    if (!primitive) return "";
    if (primitive.value && primitive.value.nodeName) return String(primitive.value.nodeName);
    if (typeof primitive.getType === "function") return String(primitive.getType() || "");
    return String(primitive.type || "");
  }

  function isPagedType(type) {
    return Object.prototype.hasOwnProperty.call(ATTRIBUTES, String(type || ""));
  }

  function isPagedPrimitive(primitive) {
    return isPagedType(primitiveType(primitive));
  }

  function readAttribute(primitive, name) {
    const value = primitive && typeof primitive.getAttribute === "function" ? primitive.getAttribute(name) : null;
    return value == null ? "" : String(value);
  }

  function writeAttribute(primitive, name, value) {
    if (primitive && typeof primitive.setAttribute === "function") primitive.setAttribute(name, value == null ? "" : String(value));
  }

  function captureAttributes(primitive) {
    const type = primitiveType(primitive);
    const result = {};
    for (const name of (ATTRIBUTES[type] || [])) result[name] = readAttribute(primitive, name);
    return result;
  }

  function sanitizePage(page, index, primitive) {
    const attrs = {};
    const current = captureAttributes(primitive);
    const type = primitiveType(primitive);
    const source = page && page.attrs && typeof page.attrs === "object" ? page.attrs : {};
    for (const name of (ATTRIBUTES[type] || [])) {
      attrs[name] = source[name] == null ? current[name] : String(source[name]);
    }
    let name = page && page.name != null ? String(page.name).trim() : "";
    if (!name) name = `Page ${index + 1}`;
    return { name, attrs };
  }

  function parsePages(primitive) {
    if (!isPagedPrimitive(primitive)) return [];
    const raw = readAttribute(primitive, PAGE_ATTRIBUTE).trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.map((page, index) => sanitizePage(page, index, primitive));
        }
      } catch (error) {
        if (typeof console !== "undefined" && console.warn) console.warn("Invalid plot page data; using current plot as Page 1.", error);
      }
    }
    return [{ name: "Page 1", attrs: captureAttributes(primitive) }];
  }

  function clampIndex(index, count) {
    const number = Number(index);
    if (!Number.isInteger(number)) return 0;
    return Math.max(0, Math.min(Math.max(0, count - 1), number));
  }

  function currentIndex(primitive, pages) {
    const list = pages || parsePages(primitive);
    return clampIndex(Number(readAttribute(primitive, INDEX_ATTRIBUTE) || 0), list.length);
  }

  function writeState(primitive, pages, index) {
    writeAttribute(primitive, PAGE_ATTRIBUTE, JSON.stringify(pages));
    writeAttribute(primitive, INDEX_ATTRIBUTE, clampIndex(index, pages.length));
  }

  function ensure(primitive) {
    const pages = parsePages(primitive);
    const index = currentIndex(primitive, pages);
    writeState(primitive, pages, index);
    return { pages, index };
  }

  function applyPage(primitive, page) {
    if (!page || !page.attrs) return;
    const type = primitiveType(primitive);
    for (const name of (ATTRIBUTES[type] || [])) {
      if (Object.prototype.hasOwnProperty.call(page.attrs, name)) writeAttribute(primitive, name, page.attrs[name]);
    }
  }

  function persistCurrentPage(primitive) {
    if (!isPagedPrimitive(primitive)) return null;
    const { pages, index } = ensure(primitive);
    pages[index].attrs = captureAttributes(primitive);
    writeState(primitive, pages, index);
    return { pages, index, page: pages[index] };
  }

  function selectPage(primitive, requestedIndex) {
    if (!isPagedPrimitive(primitive)) return null;
    const saved = persistCurrentPage(primitive);
    const index = clampIndex(requestedIndex, saved.pages.length);
    writeState(primitive, saved.pages, index);
    applyPage(primitive, saved.pages[index]);
    return { pages: saved.pages, index, page: saved.pages[index] };
  }

  function blankFrom(page) {
    const attrs = Object.assign({}, page.attrs);
    attrs.Primitives = "";
    if (Object.prototype.hasOwnProperty.call(attrs, "Sides")) attrs.Sides = "";
    if (Object.prototype.hasOwnProperty.call(attrs, "LineStyles")) attrs.LineStyles = "{}";
    if (Object.prototype.hasOwnProperty.call(attrs, "TitleLabel")) attrs.TitleLabel = "";
    return attrs;
  }

  function addPage(primitive) {
    const saved = persistCurrentPage(primitive);
    if (!saved) return null;
    const newIndex = saved.pages.length;
    const page = { name: `Page ${newIndex + 1}`, attrs: blankFrom(saved.pages[saved.index]) };
    saved.pages.push(page);
    writeState(primitive, saved.pages, newIndex);
    applyPage(primitive, page);
    return { pages: saved.pages, index: newIndex, page };
  }

  function duplicatePage(primitive) {
    const saved = persistCurrentPage(primitive);
    if (!saved) return null;
    const source = saved.pages[saved.index];
    const page = {
      name: `${source.name} copy`,
      attrs: Object.assign({}, source.attrs)
    };
    const newIndex = saved.index + 1;
    saved.pages.splice(newIndex, 0, page);
    writeState(primitive, saved.pages, newIndex);
    applyPage(primitive, page);
    return { pages: saved.pages, index: newIndex, page };
  }

  function deletePage(primitive) {
    const saved = persistCurrentPage(primitive);
    if (!saved) return null;
    if (saved.pages.length <= 1) return saved;
    saved.pages.splice(saved.index, 1);
    const index = Math.min(saved.index, saved.pages.length - 1);
    writeState(primitive, saved.pages, index);
    applyPage(primitive, saved.pages[index]);
    return { pages: saved.pages, index, page: saved.pages[index] };
  }

  function setPageName(primitive, name) {
    const saved = persistCurrentPage(primitive);
    if (!saved) return null;
    const clean = String(name == null ? "" : name).trim();
    saved.pages[saved.index].name = clean || `Page ${saved.index + 1}`;
    writeState(primitive, saved.pages, saved.index);
    return { pages: saved.pages, index: saved.index, page: saved.pages[saved.index] };
  }

  function getInfo(primitive) {
    const saved = persistCurrentPage(primitive);
    if (!saved) return { count: 0, index: 0, name: "" };
    return { count: saved.pages.length, index: saved.index, name: saved.pages[saved.index].name };
  }

  function removeReference(primitive, removeId) {
    if (!isPagedPrimitive(primitive)) return false;
    const saved = persistCurrentPage(primitive);
    const id = String(removeId);
    let changed = false;
    for (const page of saved.pages) {
      const ids = String(page.attrs.Primitives || "").split(",").filter(Boolean);
      const removeAt = ids.indexOf(id);
      if (removeAt === -1) continue;
      ids.splice(removeAt, 1);
      page.attrs.Primitives = ids.join(",");
      if (primitiveType(primitive) === "TimePlot") {
        const sides = String(page.attrs.Sides || "").split(",").filter(Boolean);
        if (removeAt < sides.length) sides.splice(removeAt, 1);
        page.attrs.Sides = sides.join(",");
      }
      if (Object.prototype.hasOwnProperty.call(page.attrs, "LineStyles")) {
        try {
          const styles = JSON.parse(page.attrs.LineStyles || "{}");
          if (styles && typeof styles === "object") {
            delete styles[id];
            page.attrs.LineStyles = JSON.stringify(styles);
          }
        } catch (_error) { page.attrs.LineStyles = "{}"; }
      }
      changed = true;
    }
    if (changed) {
      writeState(primitive, saved.pages, saved.index);
      applyPage(primitive, saved.pages[saved.index]);
    }
    return changed;
  }

  return Object.freeze({
    PAGE_ATTRIBUTE,
    INDEX_ATTRIBUTE,
    ATTRIBUTES,
    isPagedType,
    isPagedPrimitive,
    captureAttributes,
    ensure,
    persistCurrentPage,
    selectPage,
    addPage,
    duplicatePage,
    deletePage,
    setPageName,
    getInfo,
    removeReference
  });
});
