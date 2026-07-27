Goal
- Fix crowded header on tablets. Chosen approach: make tablet behave like mobile (collapsible / stacked header). Simpler, no content loss, keeps "Acasă" everywhere.

Change in `src/components/site-header.tsx`
- Swap the header breakpoint from `sm:` (640px) to `lg:` (1024px) throughout. Result:
  - <1024px (mobile + tablet): current mobile behavior — full stacked header at top, compact bar + hamburger on scroll, expanded panel on tap.
  - ≥1024px (desktop): current horizontal single-row header.
- Concretely, rename every `sm:` utility in this file to `lg:` (container flex direction/height/padding, desktop branch `hidden sm:flex` → `hidden lg:flex`, mobile branches `sm:hidden` → `lg:hidden`, and the logo variant heights `sm:h-20 md:h-24` → `lg:h-20 xl:h-24`).
- Also update the two `hidden sm:inline-flex` / `hidden sm:block` occurrences inside `navLinks()` and the user dropdown label to `lg:` so they don't appear prematurely on tablet.
- No logic changes: hooks, scroll hysteresis, click-outside, dropdown, and mobile expanded menu stay identical.

Out of scope
- No route, backend, or styling-token changes.
- "Acasă" stays.

Verification
- Typecheck.
- Visually confirm at ~768px viewport the header collapses like mobile (large stacked header at top; hamburger after scroll) and at ≥1024px it's the horizontal desktop row.