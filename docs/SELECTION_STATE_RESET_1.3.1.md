# Systemika Studio 1.3.1 RC5 — Selection visual-state regression correction

## Symptoms

After opening an existing model, many link control squares and handle lines are shown even though the user did not select them. Repeated blank-canvas clicks can be required to clear the display.

## Root cause

Connections reconstructed during a model load do not necessarily mark their parent visual as selected even when the anchor objects created by their constructors have their selected flag set and/or their SVG graphics still visible. RC4 optimized `unselect_all()` so it skipped any parent that reported `selected=false`. This bypassed the parent's visual cleanup (`LinkVisual.unselect()` / `FlowVisual.unselect()`), leaving those handles visible.

## Correction

- At the end of `syncAllVisuals()`, after all connections have been reconstructed, call `unselect_all(true)` to normalize every newly-created visual once, regardless of its selected flag. Clear children first, then connections so connection visual cleanup sees no selected children.
- For ordinary clicks, keep incremental clearing, but track selected child handles and also clear their parent connection if the parent is not marked selected. A subsequent blank click with nothing selected remains inexpensive.
- Preserve intentionally visible, in-use junction circles through the existing `refreshJunctionVisibility()` logic. Preserve Undo semantics and the RC3/RC4 selection-performance improvements.

## Acceptance checks

1. Open `model_starter.ssd` or the user's larger model in Chrome. Verify that no link squares or Bézier handles appear until their link is selected; in-use fork junctions may remain visible by design.
2. Click an unselected causal link, then click blank canvas once. All associated nonpersistent handles should disappear.
3. Select and drag a link handle, then click blank canvas. Confirm the link geometry is preserved and Undo remains functional.
4. Switch between Stocks, Flows, Lookups, Ghosts, and links and verify that selection is immediate and the info bar reports the correct object.
5. Confirm rectangle selection still works quickly and expanding/shrinking it updates the selection without stutter.
6. Save, close, and reopen a model; handles should not appear selected on reopening.

Four automated regression tests target the parent-child selection mismatch. The full website-hosted Chrome/Edge workflow still requires interactive verification.
