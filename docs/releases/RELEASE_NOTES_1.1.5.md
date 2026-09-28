# Systemika Studio 1.1.5

Systemika Studio 1.1.5 refines Flow pipe editing so repeated Shift presses can create multiple elbows during one continuous endpoint drag. This corrective build also places Text Boxes and geometry shapes behind model entities so annotations cannot steal double-clicks from Stocks, Auxiliaries, Constants, Lookups, or Flows.

## Flow elbow refinement

- **Each Shift press adds one elbow.** While dragging either the arrow endpoint or the cloud/source endpoint, press Shift once to create one elbow.
- **There is no fixed elbow limit.** Release Shift and press it again to add another elbow during the same drag. This can be repeated as many times as needed.
- **Mouse movement is not required between Shift presses.** The Shift key-up event explicitly re-arms elbow creation, which avoids the previous one-elbow behavior when the pointer stayed still between key presses.
- **New and existing Flows behave consistently.** The same repeated-Shift workflow works while first drawing a Flow and while reshaping a Flow that already exists.
- **Right-click editing is retained.** Right-clicking a selected pipe can still add an elbow, and right-clicking an elbow or using Delete/Backspace can still remove it.

## Annotation stacking refinement

- **Text Boxes and geometry shapes are background annotations.** Rectangle, Ellipse, Arrow/Line, and Text Box visuals now render in a dedicated annotation layer below all model-entity layers.
- **Model entities keep interaction priority.** When a Rectangle or other annotation overlaps a model variable, double-clicking the model entity opens that entity's equation/properties instead of the annotation dialog. The corrective build now enforces this in the double-click event path itself instead of relying only on SVG paint order, which was insufficient in some selected-annotation/browser hit-testing cases.
- **Annotation editing is retained.** Annotations remain directly selectable wherever no model entity is on top. Rectangle resize handles can still rise into the editing layer while selected without raising the Rectangle itself above the model.
- **Links remain visually beneath annotations.** The annotation layer is above Links but below model entities, while ordinary editing anchors remain above annotations.

## Verification

- Added focused regression coverage for repeated Shift presses during a single Flow endpoint drag.
- Current automated regression baseline: **412/412 tests passing**.
- Permanent numerical validation set retained: **19/19 models**.
