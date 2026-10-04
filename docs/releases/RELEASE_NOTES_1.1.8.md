# Systemika Studio 1.1.8

## Multi-model workspaces and cross-model copy/paste

- Fixed **Equations export in the WebApp**. TXT/CSV/LaTeX equation exports now use the browser save-file API where available and fall back to a normal browser download when needed.
- Added **File → New Window...** so multiple Systemika models can remain open at the same time. Desktop windows are independent Electron model windows; modern WebApp windows use independent per-window model/session state and file handles.
- Copy/paste supports **cross-model transfer between open Systemika windows**. A copied entity keeps its original name when that name is not already used in the destination model. If a destination entity already has that name, Systemika generates the normal numbered suffix and remaps copied equations to the renamed entity. IDs, links, and connector geometry are remapped for the destination model as before.
- The experimental direct **Import Model Structure...** command has been removed; copy/paste between open model windows is the supported structure-transfer workflow for 1.1.8.
- The experimental spreadsheet-style **model page/tab** feature has been removed from 1.1.8 and deferred for a later design pass.

## Feedback Loop annotation tool

Systemika Studio 1.1.8 adds a purely graphical Feedback Loop tool for presenting causal feedback structure on the modeling canvas. It does not participate in simulation equations or model computation.

- The new **Feedback Loop** button is on the vertical toolbar immediately above **Text**.
- Clicking the button opens a compact picker with four symbols: reinforcing clockwise, reinforcing counterclockwise, balancing clockwise, and balancing counterclockwise.
- Reinforcing loops use the exact **red** provided by the Color tool; balancing loops use the exact **blue** provided by the Color tool. The toolbar/picker artwork uses those same colors.
- After choosing a symbol, click an empty canvas location to place it.
- New loops default to **50 points** and always remain square/circular while resizing.
- Double-click a placed loop to open **Feedback Loop Properties**. The dialog provides one exact **Size (points)** field, an optional label, font family, font size, and **Bold / Italic / Underline** controls. Alignment and color are intentionally not duplicated in this dialog.
- **Bold, Italic, and Underline are enabled by default** for newly created loop captions.
- The caption is displayed below the loop graphic and initially uses the same color as the loop.
- The toolbar **Color** tool changes the whole feedback-loop annotation together: circular arrow, arrowhead, polarity mark, and caption text.
- Feedback loops live in the background annotation layer, so model entities retain pointer/double-click priority when they overlap a loop graphic.
- Feedback loops are stored in `.ssd` files and remain editable after reopening a model.

## American English interface terminology

- The toolbar color tool is now labeled **Color**.
- User-facing model-tool, menu, Help, and maintained documentation wording has been standardized to American English. Internal legacy file/folder names that form part of the source layout are unchanged for compatibility.

## Calibration Sandbox disk-I/O refinements

- Live slider reruns use the maintained **40 ms coalescing interval**. Pending reruns collapse to the newest slider state, and the sandbox-owned timer path avoids background-window throttling after Alt+Tab.
- Moving a calibration slider no longer schedules metadata writes for every `input` event. Any pending metadata write is canceled while the slider is moving, and the current sandbox state is committed when the slider change is completed/released. The sandbox also requests a final state save when its window closes.
- Updating Calibration Sandbox settings no longer requires recompressing and rewriting the entire `.sysrun` archive. Current sandbox settings are written to a small companion file named `<Run Name>.sysrun.metadata.json` beside the run package.
- Loading a run transparently merges that lightweight metadata patch over the metadata stored in the `.sysrun` archive. Writing a new authoritative run clears any stale companion metadata; run rename/duplicate/delete operations preserve or clean up the effective metadata as appropriate.
- The large `data.csv` payload inside `.sysrun` is therefore left untouched when Systemika only needs to remember Calibration Sandbox settings, reducing avoidable disk load, particularly on Windows.

The release retains the **19 permanent numerical validation models** and all prior 1.1.7 fixes.
