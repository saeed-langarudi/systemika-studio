# Systemika Studio 1.3.0 — Link Junctions and Shortcuts

## Link junctions

Open **Link Properties** by double-clicking a Link or selecting a Link and pressing **L**. Set **Number of junctions** with the plus/minus controls and apply.

New junctions are hollow, draggable circles at the midpoint of the link; additional junctions initially overlap. Select the link to show its junctions and drag each circle independently. Unused junctions disappear when the link is deselected, but junctions with attached branches remain visible (DYNAMO style). During Link tool operation all junctions are visible, regardless of selection. The original Bézier handles remain draggable when junctions are present: the first controls the outgoing tangent and source attachment position, and the second controls the incoming tangent and destination attachment position.

To fork, press **L** with no Link selected. Systemika displays all available junctions, so you can start dragging at any junction and release over the destination variable. **L** still opens Link Properties when exactly one Link is selected; in that case use **Shift+L** or the toolbar Link button to begin creating a branch. A branch is drawn from the junction, but the saved causal connection is between the original source variable and the new destination variable. Junctions cannot be arrow destinations. Forks can be nested by adding junctions to branches.

**Straighten Link (N)** straightens the selected link while preserving its junctions and branch attachments, spacing its junctions along the direct line. **Move Valve (M)** moves the valve of a selected Flow. **Esc** switches to the Mouse tool (replacing its former M shortcut). These shortcuts are disabled while typing and in dialogs.

Junctions and branch references are stored in the ordinary `.ssd` Link attributes (`SystemikaJunctions`, `SystemikaJunctionParent`, `SystemikaJunctionId`); no simulation-engine entities are created. Old models without these attributes retain their current link geometry. Copying and pasting adjusts junction positions and remaps fork parent identifiers when included in the selection. If a trunk is deleted, remaining branches retain their causal dependencies and return to normal direct link rendering.

### Important compatibility note

Older Systemika versions do not implement junction editing and may display branched links as direct causal connections or ignore junction routing. Use 1.3.0 to edit forked diagrams.

### Acceptance test checklist

1. Open an existing `.ssd` with curved links; check its geometry and simulation are unchanged.
2. Add three junctions to a selected Link, drag each, save, close and reopen; verify geometry.
3. Select the trunk, activate the Link tool using its toolbar button, drag from a junction to another variable; verify a valid branch and run the simulation.
4. Add a junction to the new branch and fork it again. Verify saved source dependencies.
5. Move a junction with branches attached and verify the branches follow it.
6. Try to reduce the junction count when an attached branch would be orphaned; ensure it is refused with an explanation.
7. Delete a trunk and verify its branches remain ordinary source-to-target causal connections.
8. Try M on a selected Flow, N on a selected Link, and Esc to return to Mouse mode; inspect tooltips.
9. Test Undo/Redo and SVG export after editing junctions.

The automated suite and a limited headless Chromium interaction test cover junction creation, mouse dragging, branching, XML save/reload, and trunk deletion. The desktop app and full website-hosted browser workflows still require manual acceptance testing.

## 1.3.0 corrective build — legacy curves and junction interaction

- Legacy `.ssd` Bézier handles are restored **before** initial junction layout, preventing premature geometry recalculation during load.
- Junctions use the original two draggable Bézier handles for precise source/destination attachment direction, in addition to intermediate draggable junctions.
- L (with no Link selected) shows all junctions, not just those on a selected link. Shift+L starts link creation even with a selected Link; L alone retains its existing Link Properties behavior for a selected Link.
- Junctions used as branch origins remain visible even when the trunk is deselected.
- The model's saved causal connections and run-file layout have not changed.
