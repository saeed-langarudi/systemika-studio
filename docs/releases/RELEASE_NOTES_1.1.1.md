# Systemika Studio 1.1.1

## Constant information inputs

- Constants can now accept incoming Links from model entities.
- Links that terminate at a Constant are information links and are rendered as dashed arrows, matching information links into Stocks.
- A Constant is evaluated once at the simulation start. If its definition refers to linked model entities, their start-of-simulation values are used, so the Constant remains fixed for the full run.
- Constant property dialogs now show linked model entities and expose them to equation autocomplete just like other equation-based entities.

## Information-link visibility

- The View menu now includes **Hide Information Links / Show Information Links**.
- The command hides or restores all dashed information links whose targets are Stocks or Constants without deleting or changing the model structure.

## Find variable

- Added a **Find** toolbar action with **Ctrl+F** (Cmd+F on macOS).
- The Find dialog lists model variables in sortable **Name** and **Type** columns and filters as you type.
- Finding a variable selects it and centers it in the model canvas.
- The Keyboard Shortcuts dialog now documents the Find command.

## Find Ghosts

- Added a **Find Ghosts** toolbar action beside Find with **Ctrl+G** (Cmd+G on macOS).
- The action is enabled only when exactly one ghostable model variable or one of its Ghosts is selected.
- Repeated activation cycles through every Ghost of that variable, then returns to the original variable, and repeats.
- Variables with no Ghosts display an explanatory message.
- The supplied Find, Find Ghosts, and Ghost artwork is now used by the corresponding toolbar tools.
- The Keyboard Shortcuts dialog documents the new command.

## Stock label visibility

- Stock names now render above the model graphics so flows, valves, links, and overlapping variable entities cannot hide any part of a Stock name.
- Stock names now use a compact rounded translucent background that follows the rendered text bounds. The background automatically switches between light and dark according to the label colour to preserve contrast without fully hiding the model underneath.
- The background updates after renaming, recolouring, or rotating the Stock name and also applies to Stock Ghost labels.
- The background padding now clears the visible Stock outline itself (not just the rectangle geometry), including the stroke thickness and a small anti-aliasing margin, so the border remains crisp even when the label sits directly against it.
- Stock label placement, rotation, editing, and model semantics are otherwise unchanged.
- The Find Ghosts toolbar tool now uses the newly supplied SVG icon.

## Verification

- **375/375 automated regression tests pass.**
- All **19 permanent validation models** remain in the package.

