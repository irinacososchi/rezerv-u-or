
# Phase A — In-App Notifications (v2: actor-exclusion guard)

Approved with the actor-exclusion principle baked in.
Poll-based. External Supabase only. One wired event end-to-end:
`booking_cancelled_by_renter`. Same `<NotificationBell />` mounts in both
headers. Deep-link via `?bookingId=` on `/proprietar/cereri`.

---

## 0. `cancel_booking` investigation — what I can and can't see

I do NOT have read access to the external Supabase project
(`ctvbcywmyigggwmozevr`). The Lovable-managed `supabase--read_query` tool
hits the Cloud-attached project, not yours, and `psql` in the sandbox is
also wired to the Cloud project. I can confirm the *call sites* of
`cancel_booking` from the codebase but not its body. Findings:

**Call sites (4 total, all use the same RPC name):**
- Renter cancels — `src/routes/rezervari.tsx:278, 303, 358` (3 entry points: single, future-in-series, whole-series).
- Owner cancels (override from calendar) — `src/routes/proprietar.sali.$id.calendar.tsx:1165, 1213`.

So both renter and owner cancellations go through the same RPC. The
actor-exclusion guard is exactly what's needed to keep the owner from
self-notifying.

**`auth.uid()` inside a `SECURITY DEFINER` trigger — known Postgres / Supabase semantics:**
- `auth.uid()` reads the JWT claim `sub` from the GUC `request.jwt.claims`, which is set by PostgREST per HTTP request *before* any function runs.
- `SECURITY DEFINER` changes the executing *role* (e.g. to the function owner) but does **not** touch `request.jwt.claims`. Neither does a plain `SET ROLE` / `SET LOCAL ROLE`.
- The only way `auth.uid()` returns NULL or a different uid inside a `SECURITY DEFINER` body is if the function explicitly calls `set_config('request.jwt.claims', ..., true)` or runs outside an HTTP request (cron, scripted backfill with service role, etc.).
- Therefore: **as long as `cancel_booking` doesn't override the JWT claims GUC, `auth.uid()` inside the AFTER UPDATE trigger will be the real renter when a renter calls it, and the real owner when an owner calls it.** The direct `update bookings ...` calls in `proprietar.cereri.tsx` / `proprietar.dashboard.tsx` always run as the logged-in user, so `auth.uid()` is the owner there.

**Action requested from you (one-time, ~10 seconds):** open the Supabase SQL editor and run

```sql
SELECT pg_get_functiondef('public.cancel_booking'::regprocedure);
```

Scan the body for any `set_config('request.jwt.claims', …)`. If there is
none, the plan below is safe as-is. If there is one, we swap `v_actor :=
auth.uid()` for an explicit `p_actor uuid` arg threaded through the
RPC — I'll flag that as a follow-up rather than block Phase A.

I'm proceeding with the `auth.uid()`-based guard. The risk of false-self-mute is zero (overshoots only suppress *legitimate* notifications, never spam the wrong person) and the failure mode is symmetric across renter/owner.

---

## Part A — SQL (you run, I do not)

A1 (table) and A2 (RLS) are unchanged from the prior plan. A3 is the
updated trigger with actor exclusion + structured so Phase B branches drop in.

### A1. Table

```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  booking_id uuid,
  room_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);
```

### A2. RLS

```sql
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- No INSERT policy on purpose. Only the SECURITY DEFINER trigger writes rows.
```

### A3. Trigger function + trigger (Phase A: renter-cancels branch only, with actor guard)

```sql
CREATE OR REPLACE FUNCTION public.notify_on_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_room_name text;
  v_actor uuid := auth.uid();   -- the user who made this change (NULL for guest / no JWT)
BEGIN
  -- Branch: cancellation (status -> 'anulată', and not coming from 'blocată')
  IF (TG_OP = 'UPDATE'
      AND NEW.status = 'anulată'
      AND OLD.status IS DISTINCT FROM 'anulată'
      AND OLD.status <> 'blocată') THEN

    SELECT owner_id, name INTO v_owner_id, v_room_name
    FROM public.rooms WHERE id = NEW.room_id;

    -- Notify owner ONLY when the canceller is not the owner themselves.
    IF v_owner_id IS NOT NULL AND v_owner_id IS DISTINCT FROM v_actor THEN
      INSERT INTO public.notifications (user_id, type, title, body, booking_id, room_id)
      VALUES (
        v_owner_id,
        'booking_cancelled_by_renter',
        'Rezervare anulată',
        'O rezervare la "' || COALESCE(v_room_name, 'sala ta') || '" din ' ||
          to_char(NEW.booking_date, 'DD.MM.YYYY') || ' (' ||
          to_char(NEW.start_time, 'HH24:MI') || '–' || to_char(NEW.end_time, 'HH24:MI') ||
          ') a fost anulată.',
        NEW.id,
        NEW.room_id
      );
    END IF;
  END IF;

  -- (Phase B will add sibling IF branches here for approve / refuse / owner-cancel /
  --  reschedule, each notifying NEW.renter_id and each gated by
  --  `NEW.renter_id IS DISTINCT FROM v_actor`.)

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_booking_change
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_booking_change();
```

### A4. Realtime — intentionally skipped.

### Verification SQL

```sql
-- 1. confirm function + trigger are installed
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.bookings'::regclass;

-- 2. inspect cancel_booking (one-time, so we know auth.uid() will hold)
SELECT pg_get_functiondef('public.cancel_booking'::regprocedure);

-- 3. functional test: cancel a confirmed test booking as the RENTER (from the app)
--    then check:
SELECT id, user_id, type, title, body, booking_id, is_read, created_at
FROM public.notifications
ORDER BY created_at DESC LIMIT 5;
-- Expect: 1 row, user_id = owner of the room, type = 'booking_cancelled_by_renter'.

-- 4. negative test: cancel another confirmed booking from the OWNER calendar override.
--    Re-query notifications — expect NO new row (actor == owner, guard suppressed it).
```

---

## Part B — `src/hooks/use-notifications.ts` (new)

`useNotifications()` → `{ notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch }`.

- `supabase.auth.getUser()` → uid, then `select * from notifications where user_id = uid order by created_at desc limit 50`.
- Polls on: mount, `window` `focus`, `setInterval(120_000)`, `supabase.auth.onAuthStateChange`. All cleaned up on unmount.
- `markAsRead(id)` and `markAllAsRead()` do an optimistic local update + the RLS-scoped `update`. RLS blocks cross-user writes.
- Uses `@/integrations/supabase/external-client`.

## Part C — `src/components/notification-bell.tsx` (new)

Self-contained `<NotificationBell />`, no props.

- shadcn `Popover` trigger is a 36×36 round button.
  - 0 unread → transparent bg, bell stroke `hsl(var(--muted-foreground))`.
  - >0 unread → bg `#e8faf5`, bell stroke `#009f89`, thicker stroke.
  - Red circular badge top-right with the count (`99+` if huge).
- Panel (22rem wide, 24rem max-height, scrollable):
  - Header: "Notificări" + "Marchează toate ca citite" (visible only when `unreadCount > 0`).
  - Empty: "Nu ai notificări." Loading: "Se încarcă…"
  - Row: title (bold) + body (muted) + relative time via existing `formatRelativeRo` from `src/lib/format-time.ts` — **no new dependency**.
  - Unread row: 2px left border in `#009f89`, soft tinted bg, small dot.
- Row click: `markAsRead(n.id)` → `setOpen(false)` → `navigate({ to, search })`.
- `deepLinkFor(n)` switch on `n.type`. Phase A's only type routes to `/proprietar/cereri` with `?bookingId=...`. Phase B types slot into the same switch.

## Part D — Mount in both headers

### D1. `src/components/site-header.tsx`
Render `<NotificationBell />` inside the existing `{user && (...)}` block, immediately before the user-dropdown `<div>`. Wrap with a fragment.

### D2. `src/components/owner-layout.tsx`
- **Desktop**: add a slim sticky top bar at the top of the right-hand `<div className={`flex-1 ${contentMargin} ...`}>`, above the mobile-only `<header>`:
  ```
  <div className="hidden md:flex h-12 items-center justify-end px-6 border-b bg-card/60 sticky top-0 z-10">
    <NotificationBell />
  </div>
  ```
- **Mobile**: inside the existing `<header className="md:hidden …">`, insert `<NotificationBell />` immediately before the logout button (wrap them in a `flex items-center gap-1` div).

## Part E — Deep link on `/proprietar/cereri`

`src/routes/proprietar.cereri.tsx`:
1. Extend `validateSearch` with `bookingId: typeof s.bookingId === "string" ? s.bookingId : ""`.
2. Read it via `Route.useSearch()`.
3. After `bookings` finishes loading: if the id matches a row, scroll its `<tr>` / card into view (`document.getElementById('booking-row-<id>')?.scrollIntoView({ behavior: 'smooth', block: 'center' })`), apply a temporary `ring-2 ring-primary` highlight for 2.5s, then `navigate({ to: '/proprietar/cereri', search: { …rest, bookingId: '' } }, { replace: true })`.
4. Add `id={`booking-row-${b.id}`}` + conditional highlight class to both the desktop `<tr>` and the mobile card.
5. No match → no-op (no toast).

**Deviation vs the original brief**: `proprietar.cereri.tsx` has no on-click detail modal — row actions are inline buttons. "Auto-open the detail view" therefore becomes "scroll into view + highlight". A real modal can be added in a separate prompt if you want it.

---

## Files

| Action | Path |
|---|---|
| Create | `src/hooks/use-notifications.ts` |
| Create | `src/components/notification-bell.tsx` |
| Edit | `src/components/site-header.tsx` |
| Edit | `src/components/owner-layout.tsx` |
| Edit | `src/routes/proprietar.cereri.tsx` |

No new dependencies. Reuses `formatRelativeRo`.

---

## Verification I'll run after approval

1. `bunx tsc --noEmit` → 0 errors.
2. **Code-path trace — renter cancels:** `/rezervari` → `cancel_booking` RPC sets `bookings.status='anulată'` → trigger fires with `v_actor = renter_uid` → branch matches → `v_owner_id != v_actor` → row inserted for the owner.
3. **Code-path trace — owner cancels (override):** `/proprietar/sali/$id/calendar` → `cancel_booking` RPC → trigger fires with `v_actor = owner_uid` → branch matches → `v_owner_id IS DISTINCT FROM v_actor` is FALSE → INSERT skipped. No self-notification.
4. **Code-path trace — owner opens & clicks:** any page → `useNotifications` polls on mount → unread=1, bell turns `#009f89`, red badge `1` → popover opens, click row → `markAsRead` (optimistic + PATCH) → `navigate({ to: '/proprietar/cereri', search: { bookingId: X } })` → page loads → effect scrolls + highlights row X for 2.5s → URL `bookingId` stripped.
5. Bell renders in `site-header.tsx` (next to avatar) and `owner-layout.tsx` (desktop top bar + mobile header). Logged-out users see nothing.

## Stop-and-ask still respected

No Realtime, no new deps, no new routes, no edits to booking mutation paths, no pricing/scheduling/slot changes, only the one notification type wired. Phase B will add sibling `IF` branches sharing the same `v_actor`.

Ready to implement on approval. Please run the `pg_get_functiondef('public.cancel_booking'::regprocedure)` query and paste the result (or just confirm "no `set_config('request.jwt.claims', …)` in there") either before or alongside approval.
