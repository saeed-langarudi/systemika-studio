# Systemika Studio 1.3.0 RC6 — Lookup Ghost link correction

## Problem corrected

In older builds, creating an outgoing causal Link from the Ghost of a Lookup could corrupt the Ghost's saved `Source` attribute. The field identifies the original model variable; the Lookup input-update callback mistakenly replaced it with `Time` when an outgoing Link was attached. On a later opening, the old renderer could no longer resolve the Ghost, deleted it, and stopped model synchronization with a corrupted-Ghost warning.

## Corrections

- A Lookup Ghost no longer executes the numerical Lookup input-update callback. Only an actual Lookup's input is modified by incoming Links.
- On loading damaged models, an invalid Ghost source is repaired **only** when exactly one real model variable has the Ghost's saved name (case-insensitive). The Ghost is then associated with that variable's ID.
- When no unambiguous repair is possible, the Ghost and its dependent Link records are preserved in the model instead of being deleted, and the remainder of the model loads. An on-screen warning indicates that some aliases could not be restored. Such records may not be drawn until the source is identified.
- Equation autocomplete and linked-primitive lists refer to original variables, not their visual Ghost aliases.

## Acceptance scenarios

1. Create a Lookup, Ghost it, draw a causal Link **from the Ghost** to an Auxiliary, and refer to the Lookup in the Auxiliary equation. Save and reopen. The Ghost, link, and equation should persist. Ctrl+G should cycle the original and Ghost.
2. Create a normal incoming Link to the real Lookup. Confirm that the Lookup input source is still set correctly.
3. Reopen a copy of a previously damaged file containing a Ghost whose `Source` is `Time`, with a unique original variable sharing the Ghost name. Confirm that it reconnects.
4. Reopen a file where the original variable is missing. The model should open without deleting unrelated content; the unresolved Ghost and its Link records should remain stored and a warning should be shown.
5. Confirm the Ghost behavior for Stock, Flow, Auxiliary, and Constant is unchanged.

## Recovery advice

Always work with a copy of a damaged `.ssd` model. The automatic recovery uses the original variable's name and works only when that name is unambiguous and still present. If a previous version already removed the Ghost from a saved copy, this fix cannot reconstruct information that is no longer in the file; use an earlier backup.

The `.ssd` model format, separate `.sysrun` files, and simulation engine are unchanged.
