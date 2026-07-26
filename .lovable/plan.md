Goal
- On desktop (sm and up), restore the original single-row horizontal header: logo on the left, nav links in the middle, user actions on the right.
- Keep the current mobile behavior: full header at top of page, compact bar with hamburger after scroll, expanded panel on hamburger click.

Current problem
- The header container is `flex-col items-center gap-3 px-4 py-3`.
- The desktop branch uses `hidden sm:contents`, so its children (logo, nav, actions) flow into the parent's `flex-col` and stack vertically instead of sitting in one horizontal row.

Changes to `src/components/site-header.tsx`

1. Container responsive layout
   - Change the inner `<div>` to:
     - Mobile (`default`): `flex flex-col items-center gap-3 px-4 py-3` (same as today).
     - Desktop (`sm:`): `sm:flex sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0`.
   - This restores the original horizontal desktop row.

2. Desktop branch
   - Replace `hidden sm:contents` wrapper with `hidden sm:flex sm:items-center sm:gap-6` (or similar) containing `logoLink()`, `navLinks()`, `userActions()`.
   - Ensure `userActions()` stays right-aligned via the parent `justify-between`.

3. Mobile branches
   - Keep the existing `!isScrolled` full-header block exactly as is.
   - Keep the existing `isScrolled` compact bar and expanded menu exactly as is.

4. Logo sizing
   - Keep `logoLink()` sizes: `h-24 sm:h-32 md:h-40` for the full header, `h-10` for the compact scrolled mobile bar.
   - On desktop the logo renders at `sm:h-32 md:h-40` inside the horizontal row, matching the original.

5. No logic changes
   - All hooks, state, click-outside handlers, scroll hysteresis, and dropdown code remain untouched.
   - No backend, route, or schema changes.

Verification
- Typecheck the project.
- Visually verify desktop header is a single horizontal row and mobile header still collapses/expands correctly.