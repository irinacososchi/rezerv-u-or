# Fix mobile horizontal scroll in the owner panel

Logged in with the test account and measured every panel page at 360px and 393px. Results:

| Page | 360px | 393px |
| --- | --- | --- |
| /panou/dashboard | ok | ok |
| /panou/sali | scroll (394px) | scroll (394px) |
| calendar | ok | ok |
| /panou/cereri | ok | ok |
| /panou/vouchere | scroll (694px) | scroll (694px) |
| /panou/clienti | ok | ok |
| /panou/cont | ok | ok |
| /panou/orarul-meu | ok | ok |
| room edit form (/panou/sali/{id}/edit) | scroll (566px) | scroll |

## Root cause

The panel content column in `src/components/owner-layout.tsx` (`flex-1 md:ml-64 flex flex-col min-h-screen`) has no `min-w-0`. As a flex item it sizes to its content's minimum width, so any wide child stretches the whole column past the viewport — and because the column grows, the `overflow-x-hidden` already on `<main>` never clips anything. That is why one wide table pushes the entire page (header included) to 694px.

## Changes

1. **Layout containment (fixes page-level scroll everywhere)** — `src/components/owner-layout.tsx`: add `min-w-0 w-full` to the content column so `<main className="overflow-x-hidden">` actually engages and the sticky mobile header stays viewport-width.

2. **Vouchere table** — `src/routes/panou.vouchere.tsx`: the 7-column table is the widest offender (~694px intrinsic). Keep the table for `md+` (`hidden md:block` around the existing `overflow-x-auto` wrapper) and add a mobile card list below it showing code, discount, scope, uses, validity, status badge and the action buttons.

3. **Room edit form** — `src/components/owner/room-form-page.tsx`: the slug field row (`rzrv.ro/sali/` prefix with `whitespace-nowrap` + flex-1 input) cannot shrink. Add `shrink-0` to the prefix and `min-w-0` to the input, plus `min-w-0` on the field wrapper.

4. **Padding stack on mobile** — panel pages wrap content in `p-6 md:p-8` inside the shell's `px-4`, leaving only ~280px of usable width at 360px, which is what tips `/panou/sali` over. Change the mobile padding to `p-4 md:p-8` in `src/routes/panou.sali.index.tsx`, `src/routes/panou.dashboard.tsx` and `src/components/owner/room-form-page.tsx`.

5. **Long unbroken strings** — add `break-words` to email/reference text in `src/components/clients/ClientList.tsx` and `src/routes/panou.cereri.tsx`, and cap the notification popover in `src/components/notification-bell.tsx` with `max-w-[calc(100vw-2rem)]`.

## Verification

Re-run the automated measurement (logged in, 360px and 393px) across all panel pages plus the room edit form, and confirm `scrollWidth === clientWidth` on each.
