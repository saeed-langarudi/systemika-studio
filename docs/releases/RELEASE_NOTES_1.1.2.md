# Systemika Studio 1.1.2

## Update checking

- Systemika Studio now checks for a newer published version shortly after startup.
- **Help → Check for Updates...** performs the same check on demand.
- Desktop builds read the canonical deployed WebApp at `https://systemika.no/studio/app/`, starting with `systemika-update.json` and falling back to the exact analyser/editor HTML if needed.
- The WebApp normally checks by refetching the editor page that is already running, so it works regardless of the folder used to host the WebApp.
- The WebApp build generates `systemika-update.json` and `update.json` directly in the upload-ready WebApp root from the central version/build ID. Uploading the complete WebApp therefore publishes update metadata automatically; no separate `/download/` metadata file is required.
- When a newer desktop release is available, Systemika shows the installed and latest versions and can open the Systemika download page. An older WebApp can reload the current deployed release directly.

## Calibration Sandbox feedback

- **Save as Default** is disabled when the current slider values already match the saved defaults.
- Changing a calibration slider immediately re-enables the button.
- Saving now displays **Saved** plus the confirmation message **Changes have been saved as the default parameter values.**

## Variable naming feedback

- Name validation now listens to the browser `input` event rather than `keyup`, so an invalid blank space or other disallowed character is flagged immediately when it is entered, pasted, or otherwise inserted.

## Auxiliary label readability

- Auxiliary names now use the same rounded 72%-opaque adaptive background as Stock names.
- Auxiliary labels are rendered in the protected top label layer so Links and other model graphics cannot paint over them.
- Auxiliary Ghost labels receive the same treatment.

## Model-entity rename propagation

- Renaming a Stock, Flow, Auxiliary, Constant, or Lookup now updates references throughout Stock initial values, Flow equations, and Auxiliary/Constant equations.
- Rename propagation follows the simulation engine's case-insensitive identifier rules, so references such as `myconstant` correctly follow a rename of `MyConstant`.
- Multiline definitions are decoded before rewriting, so references after commented lines are no longer skipped.
- Rename propagation does not depend on visual Link traversal. Lookup inputs, Link endpoints, Flow attachments, and Ghost sources are ID-based and remain valid automatically.
- Comments and longer identifiers containing the old name remain unchanged.

## Toolbar artwork

- Replaced the **Link** toolbar icon with the newly supplied SVG artwork.
- Replaced the **Find** toolbar icon with the newly supplied SVG artwork.

## Verification

- **393/393 automated regression tests pass.**
- All **19 permanent validation models** remain in the package and pass their numerical expectations.

## Corrective refinements retained in 1.1.2

- All local WebApp resources now receive a semantic-version plus content-derived build fingerprint, including SVG/PNG toolbar assets. Apache/cPanel no-store rules also cover application images/fonts.
- The network-only WebApp service worker activates immediately and claims clients so an older worker cannot continue controlling the app after deployment.
- Auxiliary label backgrounds are clipped clear of the Auxiliary circle outline.
- Variable-name validation checks the raw typed text before trimming, so a blank space is flagged immediately.
- Disabled toolbar icons remain visually inactive while their tooltips stay fully opaque and readable.
- Source/build support files are organized under `build/`, `docs/`, and `platform/`; Windows and Linux WebApp wrappers now share the same builder and `build/output/web/1.1.2/` output path.

## Corrective maintenance in the 1.1.2 source

- Update checking no longer probes guessed deployment paths. Browser builds refetch their current editor URL; desktop builds use the confirmed canonical WebApp root at `/studio/app/`.
- If the WebApp-root JSON metadata is unavailable, the desktop checker falls back to the exact deployed `MultiSimulationAnalyser/index.html` and `OpenSystemDynamics/src/index.html`, both of which carry generated version/build metadata. Probe details go to the diagnostic console; the user sees one concise failure message instead of a chain of repeated HTTP errors.
- The content-derived build ID is shared by WebApp and packaged desktop staging. Corrective builds can therefore remain version 1.1.2 while the canonical metadata still identifies a refreshed build.
- Loading a model safely repairs model-entity names stored literally as `[Name]` by older/malformed saves; matching legacy equation references are normalized at the same time.
- Links and their handles are below model entities in the canvas stacking order, so a nearby link no longer blocks selecting or opening a Stock, Flow, Auxiliary, Constant, or Lookup.
- Application, favicon, Windows, macOS, WebApp, and analyser logo assets use the current Systemika logo.
- Text Boxes support font family, font size, bold, italic, underline, and left/center/right alignment.
