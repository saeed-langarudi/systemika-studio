# Systemika Studio 1.1.3

Systemika Studio 1.1.3 is a corrective release focused on output plotting and structural copy/paste fidelity.

## Fixed

- **Detached plot windows render normally.** Time Plot, comparative Time Plot, XY Plot, and Histogram now use a document-safe jqPlot rendering path when the live Output panel is detached into its own window. This fixes blank detached charts while retaining the same live panel and interactions.
- **Single-run Histogram rendering is restored.** Hidden Histogram legends no longer request jqPlot's `outsideGrid` placement. jqPlot 1.0.8 aborts that rendering path when the legend is hidden, which caused the one-run Histogram to remain blank. Multi-run legends still render below the plot.
- **Copied Links preserve their curve geometry.** Copy/paste now translates the persisted Bezier handle coordinates together with the copied structure instead of leaving the handles at the original canvas position.
- **Copied Flow bends preserve their geometry.** Flow `MiddlePoints` are translated with the pasted structure for the same reason, preventing copied stock-flow structures from being visually distorted.
- **Copied equations follow copied inputs.** When a copied Stock, Flow, Auxiliary, or Constant refers to another entity included in the same copied structure, its equation now replaces the original input name with the generated copied name. Canonical bare references and legacy bracketed references are both handled without changing function names or comments; references to entities outside the copied selection remain attached to the originals.

## Verification

- Added focused regression coverage for detached-plot rendering integration, hidden Histogram legend behavior, single-run Histogram configuration, copied connector geometry, and copied-equation reference remapping.
- Current automated regression baseline: **398/398 tests passing**.
- Permanent numerical validation set retained: **19/19 models**.
