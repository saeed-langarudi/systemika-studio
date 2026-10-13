# Systemika Studio 1.3.1 RC4 — Click-selection responsiveness

## Root causes

In earlier builds, an ordinary click (including a click on a causal link)
called `unselect()` for every graphical object. Each call also ran global
selection UI updates that scanned every object, making selection work grow
roughly quadratically as models became larger. At mouse release the editor
also rebuilt an XML Undo snapshot of the entire model, even when the only
change was which object was selected.

## Correction

- `unselect_all()` and `unselect_all_but()` now modify only objects that
  actually report being selected. Both group UI refreshes into one batch.
- `primitive_mousedown()` groups the previous selection's removal with the
  new entity selection, so selecting a link, node, ghost, or handle performs
  one global selection refresh.
- Mouse-tool selection-only clicks and marquee selections no longer serialize
  a model Undo snapshot. Actual drags, edits on mouse-down or mouse-up (such
  as Flow endpoint detach/attach), and non-Mouse tools still store Undo state.
- There are no model-file, simulation, plotting, or saved-run format changes.

## Manual acceptance checklist

1. Open `model_starter.ssd` in Chrome and rapidly select different stocks,
   flows, auxiliaries, lookups, ghosts, and links. The highlight and information
   bar should follow without the previous perceptible pause.
2. Shift-click several items to add/remove them; click elsewhere to replace
   the selection. Ensure a selected link's control handles remain operable.
3. Drag a variable or a link handle. Confirm Undo and Redo restore the geometry
   and that unsaved-change state is correct.
4. Drag a rectangle over many items, then repeat with a smaller rectangle.
   Check that canvas and Equations selection both follow.
5. Click without moving any variable. Confirm the model does not become
   modified merely because its selection changed.
6. Drag a Flow endpoint off and back onto a Stock and verify Undo preserves
   the resulting attachment state.

Automated selection and Undo regression tests accompany this change. A full
hosted Chrome/Edge acceptance check remains required.
