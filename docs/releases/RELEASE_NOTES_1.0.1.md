# Systemika Studio 1.0.1

Release date: 17 September 2026

Systemika Studio 1.0.1 is a focused interface refinement release based on the 1.0.0 stable baseline.

## Changes

- **Runs to compare + Display order:** comparison outputs now use one compact run list instead of two vertically stacked lists. A run appears only once; selecting it reveals its saved display-order number and up/down controls in the same row. This reduces settings-panel height while retaining multi-run selection and persistent ordering.
- **Simplified plot settings:** the **Numbered Lines**, **Colour from Model Entity**, and **Show Data when hovering** controls are no longer shown in plot property dialogs. Their underlying attributes and rendering behavior remain supported for file compatibility. New Time Plot and Compare Plot outputs retain the established defaults: numbered lines on, model-entity colours off, and hover data on. XY Plot retains its established hover-data default.

## Validation

- Automated regression tests: **316/316 passing**.
- Permanent validation models: **19/19 covered by the regression suite**.
