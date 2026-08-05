# Fix mobile horizontal scroll in the owner panel

## What changes

1. **Layout containment** — `src/components/owner-layout.tsx`: add `min-w-0 w-full` to the content column so the sticky mobile header and `<main>` stay viewport-width and page-level overflow is clipped.

2. **Vouchere table** — `src/routes/panou.vouchere.tsx`: keep the 7-column table only for `md+` (`hidden md:block`) and add a mobile card list with code, discount, scope, uses, validity, status and actions.

3. **Room edit form** — `src/components/owner/room-form-page.tsx`: add `shrink-0` to the slug prefix, `min-w-0` on the input, and `min-w-0` on the field wrapper so the slug row doesn't push the page wide.

4. **Mobile padding** — change `p-6 md:p-8` to `p-4 md:p-8` in `src/routes/panou.sali.index.tsx`, `src/routes/panou.dashboard.tsx`, and `src/components/owner/room-form-page.tsx` to give more usable width on small screens.

5. **Long unbroken strings** — add `break-words` to email/reference text in `src/components/clients/ClientList.tsx` and `src/routes/panou.cereri.tsx`, and cap the notification popover in `src/components/notification-bell.tsx` with `max-w-[calc(100vw-2rem)]`.

## Calendar pages — no change needed

The live measurement at 360px showed `/panou/sali/{id}/calendar` and `/panou/orarul-meu` at `scrollWidth === 360` (no page-level scroll). The `min-w-[760px]` week grid is correctly contained by its `overflow-x-auto` wrapper and scrolls internally, so those files stay untouched.

## Verification

Re-run the mobile measurement (logged in, 360px and 393px) on all panel pages and the room edit form, confirming `scrollWidth === clientWidth` everywhere and that calendar/voucher tables scroll internally.

