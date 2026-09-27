# Systemika Studio 1.0.4

**Release date:** 2026-09-17

Systemika Studio 1.0.4 is a focused output-panel layout refinement built on the 1.0.3 stable baseline.

## Changes

- **Exact settings widths:** every Table and Plot settings box now uses the same exact 360 px outer width, including Selected Variable(s), Runs to compare, axis/label settings, Histogram options, and Table settings.
- **Settings-driven panel width:** the dock defaults to 378 px, exactly 5% wider than the 360 px settings boxes. When a Table/Plot settings pane is mounted, the default width is synchronized from the actual settings-box width unless the user has manually resized the dock.
- **50/50 vertical layout:** Table and Plot panels now begin with equal output and settings shares of the available body height. The horizontal splitter remains draggable.
- **Cleaner detach/attach control:** the text labels were removed. The unlink icon is retained, its button footprint matches the adjacent Close button, and the tooltip/accessible label changes between Detach and Attach.
- **Simpler Plot exports:** Plot headers now provide **Export SVG** and **Export CSV** only. Direct PNG export was removed because copying a Figure already places a high-resolution transparent PNG on the system clipboard.

## Compatibility

No `.ssd` model schema changes were required. Plot pages, line styles, selected variables, run selections, Table decimals, and other saved settings remain compatible with 1.0.3 models.

## Verification

- **330/330 automated regression tests passing**
- **19/19 permanent validation models retained**
- JavaScript syntax validation passes for the modified editor code
