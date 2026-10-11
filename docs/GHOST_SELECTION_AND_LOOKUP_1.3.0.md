# Ghost selection and Lookup editing — Systemika Studio 1.3.0 RC5

This corrective build retains the `.ssd` format and the existing simulation engine.

## Corrections

- Model-name uniqueness ignores Ghost objects. A Ghost is a visual alias and intentionally duplicates its source name; real variables continue to require unique names. The Lookup editor can now apply a definition, unit, comment, or valid rename even if the Lookup has one or several Ghosts.
- Clicking a Ghost symbol delegates selection to its SVG group, including the Ghost glyph inside a Lookup hexagon. For Stock/Auxiliary Ghosts, their labels remain separately selectable because those labels may be rendered on the top text layer.
- `ConverterDialog.open` resolves a Ghost ID to its source Lookup ID before any validation or editing.
- The status bar displays the actual source type for Flow and Constant Ghosts, which are drawn using the common Auxiliary-shaped icon.
- Find Ghosts (Ctrl/Cmd+G) retains its existing behavior: original -> each Ghost -> original.

## Acceptance checklist

1. In Chrome or Edge, create one Stock, Flow, Auxiliary, Constant, and Lookup; assign valid definitions where needed.
2. Create at least two Ghosts of each type, including a Lookup. Click each Ghost glyph and its label. It should be selected, recognized in the top-left status bar, and enable Find Ghosts.
3. Press Ctrl/Cmd+G repeatedly. It must cycle through the original, its Ghosts, and back without mixing types.
4. Double-click a Lookup Ghost. The editor must show its source Lookup; with the existing name unchanged, Apply should succeed. Edit its definition, unit, or comment and verify the original and Ghost reflect the result.
5. Rename the original Lookup while its Ghosts exist. Their displayed names should follow automatically. An actual name collision with another distinct model variable must still be rejected.
6. Save as `.ssd`, reopen, and repeat steps 2–5.
7. Repeat on the desktop version after rebuilding the desktop distribution from this source.

## Verification

The automated suite covers all five Ghost types, ghost-name aliasing and duplicate-name protection, original/Ghost navigation, delegated click selection, and Lookup Ghost source resolution. A standalone headless Chromium editor check additionally exercised mouse selection for all five types, Find Ghosts from a Lookup Ghost, and save/reopen.

The browser smoke check uses an in-memory page due to restrictions on local browser navigation in the execution environment. Website-hosted Chrome/Edge and desktop acceptance checks remain recommended.
