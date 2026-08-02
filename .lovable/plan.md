# Audit: recurring confirmation shows "Rezervarea nu a fost găsită"

## 1. Exact condition that shows RecurringSuccess
`src/routes/confirmare.tsx`:
```tsx
const isRecurringFromSearch = search.recurrent;   // line 132
...
if (isRecurringFromSearch) {
  return <RecurringSuccess recurrenceCount={search.recurrenceCount} />;  // line 218-220
}
```

## 2. How `recurrent` is defined in the route search schema
```tsx
validateSearch: (raw: Record<string, unknown>) => ({
  reference: typeof raw.reference === "string" ? raw.reference : "",
  group: typeof raw.group === "string" ? raw.group : "",
  recurrent: raw.recurrent === "true",
  recurrenceCount: Number(raw.recurrenceCount) || 0,
}),
```
So `recurrent` is typed **boolean**, and it is `true` **only** when the raw value is the JS string `"true"`. Any other representation (boolean `true`, `1`, `"True"`) parses to `false`.

## 3. Value/type at runtime — this is the bug
`rezerva.$slug.tsx` (line 1077-1085) navigates with the string `recurrent: "true"`, but TanStack Router does not hand that string straight to `validateSearch`. The search object is serialized into the URL (`?recurrent=true`) and the default search parser JSON-parses `true` back into the **boolean** `true` before `validateSearch` runs.

Therefore in `confirmare.tsx` the raw value is boolean `true`, and:
`raw.recurrent === "true"` → `false` → `search.recurrent === false`.

Consequence: `isRecurringFromSearch` is false, `reference` and `group` are both `""`, the effect hits the `if (!reference && !group)` branch and sets `notFound = true`.

(No temporary `console.log` was added — plan mode makes no code edits. The parse path above fully explains the observed behaviour; the log can be added during implementation if you want it confirmed live.)

## 4. Order of checks in the component
1. `useEffect` — if `isRecurringFromSearch` → skip lookup; else if `!reference && !group` → `setNotFound(true)`.
2. Render: `if (loading)` → spinner.
3. Render: `if (isRecurringFromSearch)` → `RecurringSuccess`.
4. Render: `if (notFound || !booking)` → "Rezervarea nu a fost găsită".

The order is correct — the recurring branch does run before the not-found branch. It simply never evaluates to true because of the parsing mismatch in (3).

## 5. Where the message comes from
From the component's own JSX (line 222-239), not the router's `notFound()`/error boundary. Triggered purely by `notFound === true` with an empty `reference`.

## Fix (for approval, not yet applied)
In `confirmare.tsx` `validateSearch`, accept both representations:
```ts
recurrent: raw.recurrent === true || raw.recurrent === "true",
```
Optionally keep `rezerva.$slug.tsx` unchanged (its `"true"` string still round-trips fine), and drop the `as never` casts once types line up.
