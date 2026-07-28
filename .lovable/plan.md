Goal
- On desktop (≥1024 px), move the "Săli" and "Rezervarea mea" navigation links closer to the left side of the header, next to the logo.
- Keep the existing responsive behavior unchanged: mobile/tablet stacked header with scroll collapse + hamburger, desktop horizontal single row.

Current state
- `src/components/site-header.tsx` renders the desktop header as a single row with `lg:justify-between`, placing the logo on the left, nav links in the center, and user actions on the right.
- The nav links are centered because they are the middle flex child of a `justify-between` container.

Changes to `src/components/site-header.tsx`

1. Desktop header layout
   - Change the desktop header container from `lg:justify-between` to `lg:justify-start`.
   - Add a left-side group that contains the logo and the nav links with a small gap (e.g., `lg:gap-4` or `lg:gap-6`).
   - Push user actions to the far right using `lg:ml-auto` on the user actions wrapper.
   - This keeps logo + nav together on the left and user actions on the right.

2. Keep existing responsive behavior
   - Do not change the mobile/tablet stacked header logic or the scroll-collapse hamburger behavior.
   - Do not change the `lg:hidden` / `hidden lg:flex` breakpoints.

3. Optional fine-tuning
   - Reduce horizontal gap between nav buttons if needed so the links sit tighter to the logo.
   - Keep "Rezervarea mea" hidden on smaller viewports where it currently hides (`hidden lg:inline-flex`).

Verification
- Run TypeScript typecheck.
- Take a desktop-width Playwright screenshot to confirm nav links are now positioned to the left of the header, near the logo.

No backend, route, or schema changes.