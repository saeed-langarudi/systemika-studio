# Systemika Studio 1.1.6

## Calibration Sandbox alert visibility

- Systemika alerts, warnings, and simulation-error dialogs now remain visible while the Calibration Sandbox is open.
- Alert dialogs are routed to a modal overlay inside the sandbox window, which is focused when an alert appears.
- The overlay sits above sandbox controls and variable pickers, supports OK, Enter, and Escape dismissal, and preserves existing close callbacks.
- Multiple alerts are queued so a later warning cannot silently replace an earlier one.
- The ordinary editor alert dialog remains the fallback whenever the Calibration Sandbox is closed.

Release verification: **414/414 automated tests passing** and **19/19 permanent numerical validation models** retained.
