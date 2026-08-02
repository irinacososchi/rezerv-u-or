# Trace recurring submit before navigation

## Confirmed execution path

For a recurring, single-day, single-interval submission, `handleSubmit` currently runs in this order:

1. Prevent form submission, clear the prior error, and print `=== HANDLE SUBMIT START ===`.
2. Validate room/route/date, name, email, and phone; each failed validation returns immediately.
3. Derive `isRecurrent` and `allDateIntervals`; return if there are no intervals or more than 50.
4. Set submitting state.
5. Await the fresh availability query through `checkSlotAvailability(finalSlotsToCreate)`:
   ```tsx
   supabase
     .from("bookings")
     .select("booking_date, start_time, end_time, status")
     .eq("room_id", room.id)
     .gte("booking_date", minDate)
     .lte("booking_date", maxDate)
     .not("status", "in", '("refuzată","anulată","expirată")')
   ```
6. Because the submission is recurring, ordinary busy slots do not block it. However, any query error is explicitly thrown by `checkSlotAvailability`, caught by `handleSubmit`, converted to `precheck_threw`, and followed by an immediate return.
7. Await `check_recurring_conflict` with room, ISO weekday, interval, first date, and no excluded recurrence. An RPC error or a returned conflict causes an immediate return.
8. Enter the secure recurring branch and await `create_recurring_booking`.
9. Normalize the RPC payload into `recResult`; an RPC error or missing `recurrence_id` causes an immediate return.
10. Await a best-effort `bookings` update filtered by the new `recurrence_id`.
11. Start the booking-email function without awaiting it, then print the existing recurring navigation log and navigate to `/confirmare`.

## 404 diagnosis

The query in step 5 is the submit-time availability query producing the upper-bound date filter (for example `booking_date=lte.2026-10-01`). It is on the recurring path and runs before both recurring RPCs. If it returns the observed 404, the helper throws; the surrounding `try/catch` catches it and returns before `check_recurring_conflict`, `create_recurring_booking`, and every navigation log.

Other pre-navigation exits are the validation/interval limits, a `check_recurring_conflict` error, a returned recurring conflict, and a failed or malformed `create_recurring_booking` result. The two recurring RPC awaits and the post-create metadata update are not wrapped in an outer `try/catch`; a genuinely rejected promise there would escape `handleSubmit`, while normal backend errors returned in `{ error }` are handled as described above.

## Temporary instrumentation only

- Add `console.log("RECURRING BRANCH ENTERED");` as the first statement inside the `create_recurring_booking` branch.
- Add `console.log("RECURRING RPC RESULT", rpcErr, recResult);` immediately after `recResult` is derived, which is the first point where both requested variables exist.
- Keep all existing debug logs and make no business-logic changes.
- Verify the project build after adding the logs.