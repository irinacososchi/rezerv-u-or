Plan: Mobile header that collapses into a menu button on scroll

Current state
- `src/components/site-header.tsx` renders a sticky 3-row header on mobile: large logo, nav links (Acasă/Săli), user actions (Panoul meu, notifications, profile).
- The header already uses `sticky top-0` and wraps everything in a container.

Goal
- On mobile viewports only, after the user scrolls down a small amount, collapse the header into a compact bar with just the logo and a menu button.
- Tapping the menu button expands the full header again (same content as today).
- Keep the desktop header unchanged.

Implementation

1. Scroll detection
   - Add a small hook / `useEffect` that listens to `window.scrollY`.
   - Track a boolean `isScrolled` (true when `scrollY > 48` or similar).
   - Only activate the collapsed behavior on `sm:` and below; use Tailwind responsive classes or a CSS media query.

2. Mobile collapsed bar
   - When `isScrolled` is true on mobile, render a single-row compact bar instead of the 3-row stack.
   - Bar contains:
     - Small logo (e.g., `h-10`) linking to `/`.
     - A hamburger/menu button (Lucide `Menu` icon) on the right.
   - Keep `sticky top-0` and the existing backdrop blur background.

3. Mobile expanded menu
   - Use local state `mobileMenuOpen` toggled by the hamburger button.
   - When open, render a slide-down / overlay panel directly below the compact bar.
   - The panel shows the existing content:
     - Logo (full size)
     - Nav links: Acasă, Săli, Rezervarea mea
     - User actions: Panoul meu, NotificationBell, Profile dropdown (reused as-is)
     - Auth buttons when not logged in
   - Clicking outside or pressing the hamburger again closes the panel.
   - On route change, close the panel.

4. Preserve desktop
   - Keep the current layout for `sm:` and up.
   - The collapsed/expanded logic only applies below the `sm` breakpoint.

5. Polish
   - Add CSS transitions for height/opacity when switching between collapsed and expanded states.
   - Ensure z-index stays above page content (`z-40` already set).
   - Avoid horizontal scroll; the compact bar uses `justify-between`.

Files to change
- `src/components/site-header.tsx` only.

No backend, route, or schema changes required.
