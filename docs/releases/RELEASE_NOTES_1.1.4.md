# Systemika Studio 1.1.4

Systemika Studio 1.1.4 improves Flow drawing and editing without changing model semantics or equation behavior.

## Flow editing improvements

- **Attached Flow endpoints are easier to grab.** Endpoint and elbow handles retain their compact visual size but now have larger invisible pointer targets. While a Flow is selected, its routing handles are temporarily rendered above Stocks so a Stock cannot cover the handle at the attachment point.
- **Dragging an attached endpoint detaches it immediately.** This applies to both the source/cloud side and the arrow side. Releasing the endpoint over a Stock uses the normal Flow attachment logic to reconnect it.
- **Elbows can be added after a Flow has been created.** Select the Flow, right-click a pipe segment to add an elbow handle, then drag that handle to reshape the pipe. Multiple elbow handles can be added as needed.
- **Elbows can be removed without deleting the Flow.** Right-click an elbow handle to remove it, or select the elbow handle and press Delete/Backspace.
- **The workflow is documented in the application.** The Getting Started dialog now explains Flow detachment and elbow editing.

## Verification

- Added focused regression coverage for Flow handle hit targets/layering, endpoint detachment, completed-Flow elbow creation/removal, and in-app guidance.
- Current automated regression baseline: **402/402 tests passing**.
- Permanent numerical validation set retained: **19/19 models**.
- Web/desktop staging build ID: **d8811d1615cd**.
