/* Systemika link junctions: graphical routing metadata, not simulation entities. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SystemikaLinkJunctions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function parse(value) {
    let parsed;
    try { parsed = JSON.parse(value || '[]'); } catch (_) { return []; }
    if (!Array.isArray(parsed)) return [];
    const ids = new Set();
    return parsed.slice(0, 40).filter(item => {
      if (!item || !/^\d+$/.test(String(item.id)) || !Number.isFinite(Number(item.x)) || !Number.isFinite(Number(item.y))) return false;
      const id = String(item.id);
      if (ids.has(id)) return false;
      ids.add(id);
      return true;
    }).map(item => ({id: String(item.id), x: Number(item.x), y: Number(item.y)}));
  }
  function serialize(junctions) { return JSON.stringify(parse(JSON.stringify(junctions))); }
  function midpoint(p0, p1, p2, p3) {
    return [(p0[0] + 3*p1[0] + 3*p2[0] + p3[0])/8,
            (p0[1] + 3*p1[1] + 3*p2[1] + p3[1])/8];
  }
  // Cubic segments share tangent directions at interior junctions. The
  // ordinary Bézier handles remain authoritative at the two model endpoints,
  // allowing users to move link attachment positions even with forks.
  function path(points, startHandle, endHandle) {
    if (!Array.isArray(points) || points.length < 2) return '';
    const valid = point => Array.isArray(point) && point.length >= 2 &&
      Number.isFinite(point[0]) && Number.isFinite(point[1]);
    if (!points.every(valid)) return '';
    let result = `M${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[Math.max(0, i - 1)];
      const b = points[i];
      const c = points[i + 1];
      const d = points[Math.min(points.length - 1, i + 2)];
      const c1 = i === 0 && valid(startHandle) ? startHandle :
        [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
      const c2 = i === points.length - 2 && valid(endHandle) ? endHandle :
        [c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6];
      result += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${c[0]},${c[1]}`;
    }
    return result;
  }
  return {parse,serialize,midpoint,path};
});
