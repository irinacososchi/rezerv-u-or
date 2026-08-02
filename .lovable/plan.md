# Temporary runtime debug for recurring confirmation

## Change
- In `ConfirmarePage`, immediately after `const search = Route.useSearch();`, add exactly:
  ```tsx
  console.log("CONFIRMARE SEARCH DEBUG", JSON.stringify(search), "recurrent=", search.recurrent, "typeof=", typeof search.recurrent);
  ```
- Keep the log in place so its output can be inspected in the browser console.
- Do not change any condition, search parsing, navigation, creation flow, or other route.
- Verify the project build after the change.

## Branch-tracing logs in `rezerva.$slug.tsx`
Add these temporary logs, each immediately before its `navigate()` call, with no other changes:
- Recurring branch (after `create_recurring_booking` succeeds):
  ```tsx
  console.log("RECURRING NAV DEBUG - about to navigate recurrent=true, recurrenceId=", newRecurrenceId);
  ```
- Single-booking branch:
  ```tsx
  console.log("SINGLE NAV DEBUG");
  ```
- Multi-slot branch:
  ```tsx
  console.log("MULTI NAV DEBUG");
  ```
All logs stay in place so the console shows which branch actually runs.



## Confirmed current code

1. Current `/confirmare` `validateSearch`:
   ```tsx
   validateSearch: (raw: Record<string, unknown>) => ({
     reference: typeof raw.reference === "string" ? raw.reference : "",
     group: typeof raw.group === "string" ? raw.group : "",
     recurrent: raw.recurrent === true || raw.recurrent === "true",
     recurrenceCount: Number(raw.recurrenceCount) || 0,
   }),
   ```

2. Exact recurring display condition:
   ```tsx
   if (isRecurringFromSearch) {
     return <RecurringSuccess recurrenceCount={search.recurrenceCount} />;
   }
   ```
   where `isRecurringFromSearch` is assigned from `search.recurrent`.

3. The recurring path in `rezerva.$slug.tsx` navigates with the **string** `"true"`:
   ```tsx
   navigate({
     to: "/confirmare",
     search: {
       reference: "",
       group: "",
       recurrent: "true",
       recurrenceCount: recResult.sessions_created ?? 0,
     } as never,
   });
   ```
