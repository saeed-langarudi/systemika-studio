# Systemika Studio 1.1.7

Released: 2026-09-30

## Text Box interaction repair

- Restores the Text Box properties dialog on double-click.
- Restores the Enter-key shortcut for a single selected Text Box.
- Refines annotation/model overlap handling so model entities still take priority only when they are actually painted beneath the pointer. The browser's `elementsFromPoint()` hit test is used first, with the previous geometry check retained only as a compatibility fallback.
- Retains the 1.1.6 Calibration Sandbox topmost alert/error behavior.

## Verification

- 415/415 automated regression tests pass.
- 19/19 permanent numerical validation models pass.
