# Clean up recurring confirmation and remove debug logs

## Change 1: Hide session count on recurring confirmation screen

In `src/routes/confirmare.tsx`, inside the `RecurringSuccess` component, change the paragraph text from:

```
Rezervarea ta recurentă ({recurrenceCount} ședințe) a fost trimisă proprietarului spre aprobare. Vei primi un email când seria va fi confirmată. Detaliile sunt și în emailul primit.
```

to:

```
Rezervarea ta recurentă a fost trimisă proprietarului spre aprobare. Vei primi un email când seria va fi confirmată. Detaliile sunt și în emailul primit.
```

Keep the `recurrenceCount` prop on the component (do not change the signature), but do not render the number in the message. Keep the buttons and layout unchanged.

## Change 2: Remove temporary debug console.log statements

Remove exactly these logs and nothing else:

From `src/routes/confirmare.tsx`:
- Line ~130: `console.log("CONFIRMARE SEARCH DEBUG", ...);`

From `src/routes/rezerva.$slug.tsx`:
- Line ~706: `console.log("PRECHECK QUERY ERROR", error);`
- Line ~981: `console.log("PRECHECK THREW - aborting", err);`
- Line ~1029: `console.log("RECURRING BRANCH ENTERED");`
- Line ~1048: `console.log("RECURRING RPC RESULT", rpcErr, recResult);`
- Line ~1082: `console.log("RECURRING NAV DEBUG - about to navigate recurrent=true, recurrenceId=", newRecurrenceId);`
- Line ~1159: `console.log("SINGLE NAV DEBUG");`
- Line ~1241: `console.log("MULTI NAV DEBUG");`
- Line ~1400: `console.log("LEGACY NAV DEBUG - isRecurrent=", isRecurrent);`

## Verification

Run typecheck and production build to ensure no syntax errors remain after deleting the log lines.
