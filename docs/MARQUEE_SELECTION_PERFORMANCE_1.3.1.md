# Systemika Studio 1.3.1 RC3 — Rectangle-selection responsiveness

## Problem

In larger models, dragging a selection rectangle could stall the editor even when scrolling and simulation stayed responsive. Each pointer move deselected **every** model object, including connection handles, and then reselected all objects whose positions were inside the rectangle. Each individual selection change also recalculated the overall selection state, Find Ghost availability, and SVG selection styling.

## Correction

- Rectangle selection keeps a set of current matches and changes only those entering or leaving the rectangle.
- Related parent links are selected once, even when more than one of their anchors is inside the rectangle.
- Shared selection affordances are refreshed once per batch, rather than after each object/handle.
- Repeated movements that do not change the selected objects do not trigger selection mutations or global refreshes.
- On releasing the mouse, selected connection roots retain their normal handle-selection behavior.

This changes only editor interaction. The model file format, simulation equations, and `.sysrun` storage are unchanged.

## Acceptance checks

1. Open a copy of `model_starter.ssd` and drag a large rectangle over a group of Stocks, Flows, Auxiliaries, Lookups, Ghosts, and Links. Verify smooth interaction and correct selection on release.
2. Pause and move slightly without adding or removing an object from the rectangle; existing selections should remain stable.
3. Enlarge and shrink the rectangle across groups of entities and control handles; only intersecting objects should enter/leave the selection.
4. Repeat with the Equations panel open and closed, and ensure the panel tracks the final selection.
5. Verify normal single-object selection, editing, link dragging, Undo/Redo, model saving, and simulation are unchanged.

Automated coverage: `tests/systemika-marquee-performance-131.test.js`. The test verifies repeated mouse moves do not reselect the same set and that selection and link-handle parents update incrementally. Browser/desktop acceptance testing is still recommended.
