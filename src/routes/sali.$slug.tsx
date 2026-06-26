import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Mail,
  Phone,
  Ruler,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Heart,
  View,
  ExternalLink,
  X,
  Plus,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/external-client";
import {
  getDayOfWeek,
  DAY_NAMES_RO,
  formatDateISO,
  addDays,
  startOfMonth,
  endOfMonth,
  isSameDay,
} from "@/lib/date-utils";
import {
  SLOT_GRANULARITY_MINUTES,
  slotFromTime,
  timeToMinutes,
  minutesToTime,
  intervalsOverlap,
} from "@/lib/time-slots";

export const Route = createFileRoute("/sali/$slug")({
  loader: ({ params }) => ({ slug: params.slug }),
  head: () => ({
    meta: [
      { title: "Detalii sală — Rezervări Săli" },
      { name: "description", content: "Vezi detalii și rezervă sala online." },
    ],
  }),
  component: RoomDetailsPage,
});

// ---------- Types ----------
type Room = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  neighbourhood: string | null;
  google_maps_url: string | null;
  virtual_tour_url: string | null;
  floor_size_sqm: number | null;
  has_mirrors: boolean | null;
  has_sound_system: boolean | null;
  has_ballet_barre: boolean | null;
  has_changing_room: boolean | null;
  has_air_conditioning: boolean | null;
  rules_and_notes: string | null;
  currency: string | null;
  is_active: boolean | null;
  cover_url?: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city_name?: string | null;
  county_name?: string | null;
};

type Photo = {
  id: string;
  storage_url: string;
  is_cover: boolean | null;
  sort_order: number | null;
};

type ScheduleRow = {
  day_of_week: number;
  open_time: string; // "HH:MM:SS"
  close_time: string;
  is_available: boolean;
};

type PricingRule = {
  id: string;
  price_per_hour: number;
  days_of_week: number[];
  start_time: string | null;
  end_time: string | null;
  priority: number;
  is_active: boolean;
  label: string | null;
};

type SlotPricing = {
  price: number;
  label: string | null;
};

function getPriceForSlotDetailed(
  date: Date,
  slotStart: string,
  pricingRules: PricingRule[],
): SlotPricing {
  const dayOfWeek = getDayOfWeek(date);
  const slotTime = `${slotStart}:00`;

  const matching = pricingRules
    .filter((rule) => {
      if (!rule.is_active) return false;
      const dayMatch = (rule.days_of_week ?? []).includes(dayOfWeek);
      const timeMatch =
        !rule.start_time ||
        !rule.end_time ||
        (slotTime >= rule.start_time && slotTime < rule.end_time);
      return dayMatch && timeMatch;
    })
    .sort((a, b) => b.priority - a.priority);

  const winner = matching[0];
  return {
    price: Number(winner?.price_per_hour ?? 0),
    label: winner?.label ?? null,
  };
}

type Booking = {
  booking_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  status: string;
};

// ---------- Helpers ----------
function getPriceForSlot(
  date: Date,
  slotStart: string,
  pricingRules: PricingRule[],
): number {
  return getPriceForSlotDetailed(date, slotStart, pricingRules).price;
}

/**
 * Generate weekly occurrences AFTER the selected start date, through the end
 * of (start month + 3 full months). The start date itself is NOT included
 * here — it's the first booking; this list is the additional recurring dates.
 */
function generateWeeklyDatesHorizon(selectedDate: Date): Date[] {
  // Last day of (startMonth + 3): day 0 of month+4
  const horizon = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 4,
    0,
  );
  const dates: Date[] = [];
  const current = new Date(selectedDate);
  current.setDate(current.getDate() + 7);
  while (current <= horizon) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

/** Romanian duration label for a slot-derived minute count. */
function formatDurationRO(minutes: number): string {
  if (minutes <= 0) return "0 minute";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minute`;
  const hourWord = hours === 1 ? "oră" : "ore";
  if (mins === 0) return `${hours} ${hourWord}`;
  return `${hours} ${hourWord} și ${mins} minute`;
}

// ---------- Page ----------
function RoomDetailsPage() {
  const { slug } = Route.useParams() as { slug: string };
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [pricing, setPricing] = useState<PricingRule[]>([]);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  type DaySelection = {
    date: Date;
    /** Canonical merged list of 30-min slot starts ("HH:MM") for the day. */
    slots: string[];
    /** Currently in-progress start point (slot-start string, e.g. "09:30"). */
    selectedStart?: string | null;
    /** Currently in-progress end POINT (boundary time, e.g. "12:30" → last slot 12:00). */
    selectedEnd?: string | null;
    truncationMessage?: string | null;
  };
  const [daySelections, setDaySelections] = useState<DaySelection[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [isPickingNewDay, setIsPickingNewDay] = useState(true);
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceDates, setRecurrenceDates] = useState<Date[]>([]);

  // Favorites
  const [authUser, setAuthUser] = useState<{ id: string } | null>(null);
  const [authRole, setAuthRole] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [favLoading, setFavLoading] = useState(false);



  // ---------- Fetch ----------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);
      setUnavailable(false);
      const { data: r, error: rErr } = await supabase
        .from("rooms_with_cover")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;

      if (rErr) {
        console.error("room fetch error:", rErr.message);
      }
      if (!r) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const roomData = r as Room;
      setRoom(roomData);

      const today = new Date();
      const todayISO = formatDateISO(today);
      const sixtyISO = formatDateISO(addDays(today, 60));




      const [photosRes, schedRes, priceRes, blockRes, bookRes] =
        await Promise.all([
          supabase
            .from("room_photos")
            .select("*")
            .eq("room_id", roomData.id)
            .order("sort_order"),
          supabase
            .from("weekly_schedule")
            .select("*")
            .eq("room_id", roomData.id)
            .eq("is_available", true)
            .order("day_of_week"),
          supabase
            .from("pricing_rules")
            .select("*")
            .eq("room_id", roomData.id)
            .eq("is_active", true)
            .order("priority", { ascending: false }),
          supabase
            .from("blocked_dates")
            .select("blocked_date")
            .eq("room_id", roomData.id)
            .gte("blocked_date", todayISO)
            .lte("blocked_date", sixtyISO),
          supabase
            .from("bookings")
            .select("booking_date, start_time, end_time, status")
            .eq("room_id", roomData.id)
            .gte("booking_date", todayISO)
            .lte("booking_date", sixtyISO)
            .not("status", "in", '("refuzată","anulată","expirată")'),
        ]);

      if (cancelled) return;

      const photosData = (photosRes.data ?? []) as Photo[];
      setPhotos(photosData);
      const cover =
        photosData.find((p) => p.is_cover)?.storage_url ??
        photosData[0]?.storage_url ??
        roomData.cover_url ??
        null;
      setActivePhoto(cover);

      setSchedule((schedRes.data ?? []) as ScheduleRow[]);
      const pricingData = (priceRes.data ?? []) as PricingRule[];
      setPricing(pricingData);
      setBlockedDates(
        new Set(
          ((blockRes.data ?? []) as { blocked_date: string }[]).map(
            (b) => b.blocked_date,
          ),
        ),
      );
      setBookings((bookRes.data ?? []) as Booking[]);

      if (pricingData.length === 0) {
        setUnavailable(true);
      }

      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ---------- Derived ----------
  const scheduleByDay = useMemo(() => {
    const m = new Map<number, ScheduleRow>();
    for (const s of schedule) m.set(s.day_of_week, s);
    return m;
  }, [schedule]);

  const priceRange = useMemo(() => {
    const prices = pricing.map((p) => Number(p.price_per_hour)).filter((n) => !Number.isNaN(n));
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [pricing]);

  const today0 = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  // Global 2-hour buffer before slot start — applies to all rooms
  const SAME_DAY_BUFFER_HOURS = 2;

  // Earliest bookable date (start of day) — today
  const minBookingDate = today0;

  function isDayDisabled(date: Date): boolean {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    if (dayStart < minBookingDate) return true;
    const iso = formatDateISO(date);
    if (blockedDates.has(iso)) return true;
    const dow = getDayOfWeek(date);
    if (!scheduleByDay.has(dow)) return true;
    return false;
  }

  // Active day (currently being edited)
  const activeDay =
    activeDayIndex !== null ? daySelections[activeDayIndex] ?? null : null;

  // Slots for active day
  type Slot = { start: string; end: string; busy: boolean; tooSoon: boolean; price: number };
  const slots = useMemo<Slot[]>(() => {
    if (!activeDay) return [];
    const dow = getDayOfWeek(activeDay.date);
    const sched = scheduleByDay.get(dow);
    if (!sched) return [];
    const openMin = timeToMinutes(sched.open_time);
    const closeMin = timeToMinutes(sched.close_time);
    const iso = formatDateISO(activeDay.date);
    const dayBookings = bookings.filter((b) => b.booking_date === iso);

    const now = new Date();
    const isToday = isSameDay(activeDay.date, now);
    let earliestStartMin = -Infinity;
    if (isToday) {
      const cutoffMs = now.getTime() + SAME_DAY_BUFFER_HOURS * 60 * 60 * 1000;
      const cutoff = new Date(cutoffMs);
      // Round up to next full slot boundary
      const cutoffMinRaw = cutoff.getHours() * 60 + cutoff.getMinutes();
      earliestStartMin =
        Math.ceil(cutoffMinRaw / SLOT_GRANULARITY_MINUTES) * SLOT_GRANULARITY_MINUTES;
    }

    const result: Slot[] = [];
    for (let m = openMin; m + SLOT_GRANULARITY_MINUTES <= closeMin; m += SLOT_GRANULARITY_MINUTES) {
      const start = minutesToTime(m);
      const end = minutesToTime(m + SLOT_GRANULARITY_MINUTES);
      const busy = dayBookings.some((b) =>
        intervalsOverlap(start, end, slotFromTime(b.start_time), slotFromTime(b.end_time)),
      );
      const tooSoon = m < earliestStartMin;
      result.push({
        start,
        end,
        busy,
        tooSoon,
        price: getPriceForSlot(activeDay.date, start, pricing),
      });
    }
    return result;
  }, [activeDay, scheduleByDay, bookings, pricing]);

  // Reset recurrence if user transitions to multi-day (recurrence ambiguous)
  useEffect(() => {
    if (daySelections.length > 1 && isRecurrent) {
      setIsRecurrent(false);
      setRecurrenceDates([]);
    }
  }, [daySelections.length, isRecurrent]);

  // Auto-populate recurrence dates from the selected start date through end of
  // (start month + 3 full months). No user-provided end date.
  useEffect(() => {
    if (!isRecurrent) {
      setRecurrenceDates([]);
      return;
    }
    const startDate = daySelections[0]?.date;
    if (!startDate) {
      setRecurrenceDates([]);
      return;
    }
    setRecurrenceDates(generateWeeklyDatesHorizon(startDate));
  }, [isRecurrent, daySelections]);



  // Auth + favorite state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setAuthUser(null);
        setAuthRole(null);
        return;
      }
      setAuthUser({ id: user.id });
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setAuthRole((p as { role?: string } | null)?.role ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!authUser || authRole !== "renter" || !room) {
      setIsFavorite(false);
      setFavoriteId(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("renter_id", authUser.id)
        .eq("room_id", room.id)
        .maybeSingle();
      if (cancelled) return;
      setIsFavorite(!!data);
      setFavoriteId((data as { id?: string } | null)?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [authUser, authRole, room]);

  async function toggleFavorite() {
    if (!authUser) {
      navigate({ to: "/login" });
      return;
    }
    if (!room) return;
    setFavLoading(true);
    if (isFavorite && favoriteId) {
      await supabase.from("favorites").delete().eq("id", favoriteId);
      setIsFavorite(false);
      setFavoriteId(null);
    } else {
      const { data } = await supabase
        .from("favorites")
        .insert({ renter_id: authUser.id, room_id: room.id })
        .select()
        .single();
      setIsFavorite(true);
      setFavoriteId((data as { id?: string } | null)?.id ?? null);
    }
    setFavLoading(false);
  }


  /**
   * Hour-point selection model. Whole-hour buttons act on "time points"
   * (selectedStart slot-string, selectedEnd boundary string). `:30` chips
   * shift the selected point by 30 min. User confirms to materialize the
   * interval into ds.slots (the same shape downstream code expects).
   */
  const sortFn = (a: string, b: string) => timeToMinutes(a) - timeToMinutes(b);

  function removeIntervalContaining(ds: DaySelection, slotKey: string): DaySelection {
    const sorted = [...ds.slots].sort(sortFn);
    const i = sorted.indexOf(slotKey);
    if (i === -1) return ds;
    let lo = i;
    let hi = i;
    while (
      lo > 0 &&
      timeToMinutes(sorted[lo]) - timeToMinutes(sorted[lo - 1]) === SLOT_GRANULARITY_MINUTES
    )
      lo--;
    while (
      hi < sorted.length - 1 &&
      timeToMinutes(sorted[hi + 1]) - timeToMinutes(sorted[hi]) === SLOT_GRANULARITY_MINUTES
    )
      hi++;
    const toRemove = new Set(sorted.slice(lo, hi + 1));
    return {
      ...ds,
      slots: ds.slots.filter((s) => !toRemove.has(s)),
      selectedStart: null,
      selectedEnd: null,
      truncationMessage: null,
    };
  }

  function slotAvail(start: string): boolean {
    const sl = slots.find((x) => x.start === start);
    return !!sl && !sl.busy && !sl.tooSoon;
  }

  function handleHourTap(hour: number) {
    if (activeDayIndex === null) return;
    const hh = String(hour).padStart(2, "0");
    const h00 = `${hh}:00`;
    const h30 = `${hh}:30`;
    setDaySelections((prev) =>
      prev.map((ds, idx) => {
        if (idx !== activeDayIndex) return ds;

        // Tap on hour that overlaps a finalized interval → remove it.
        if (ds.slots.includes(h00)) return removeIntervalContaining(ds, h00);
        if (ds.slots.includes(h30)) return removeIntervalContaining(ds, h30);

        const startSlot = ds.selectedStart ?? null;
        const endTime = ds.selectedEnd ?? null;
        const startHour = startSlot ? parseInt(startSlot.slice(0, 2), 10) : null;
        const endHour = endTime ? parseInt(endTime.slice(0, 2), 10) : null;

        // No start yet → set start (prefer :00, fallback :30).
        if (!startSlot) {
          const newStart = slotAvail(h00) ? h00 : slotAvail(h30) ? h30 : null;
          if (!newStart) return ds;
          return { ...ds, selectedStart: newStart, selectedEnd: null, truncationMessage: null };
        }

        // Tap on the start's hour → deselect start (and end).
        if (startHour === hour) {
          return { ...ds, selectedStart: null, selectedEnd: null, truncationMessage: null };
        }

        // Tap on the end's hour → deselect end.
        if (endHour === hour) {
          return { ...ds, selectedEnd: null, truncationMessage: null };
        }

        // Tap BEFORE start → reset start.
        if (hour < (startHour as number)) {
          const newStart = slotAvail(h00) ? h00 : slotAvail(h30) ? h30 : null;
          if (!newStart) return ds;
          return { ...ds, selectedStart: newStart, selectedEnd: null, truncationMessage: null };
        }

        // Tap AFTER start → set end. End point boundary defaults to :00
        // (last slot included = (h-1):30); fallback :30 (last slot = h:00).
        const prevHH = String(hour - 1).padStart(2, "0");
        const canEnd00 = slotAvail(`${prevHH}:30`);
        const canEnd30 = slotAvail(h00);
        const newEnd = canEnd00 ? h00 : canEnd30 ? h30 : null;
        if (!newEnd) return ds;
        if (timeToMinutes(newEnd) <= timeToMinutes(startSlot)) return ds;
        return { ...ds, selectedEnd: newEnd, truncationMessage: null };
      }),
    );
  }

  function handleHalfToggle(kind: "start" | "end") {
    if (activeDayIndex === null) return;
    setDaySelections((prev) =>
      prev.map((ds, idx) => {
        if (idx !== activeDayIndex) return ds;
        if (kind === "start") {
          const cur = ds.selectedStart;
          if (!cur) return ds;
          const hh = cur.slice(0, 2);
          const next = cur.endsWith(":00") ? `${hh}:30` : `${hh}:00`;
          if (!slotAvail(next)) return ds;
          if (ds.selectedEnd && timeToMinutes(next) >= timeToMinutes(ds.selectedEnd)) return ds;
          return { ...ds, selectedStart: next };
        }
        const cur = ds.selectedEnd;
        if (!cur) return ds;
        const hh = cur.slice(0, 2);
        const next = cur.endsWith(":00") ? `${hh}:30` : `${hh}:00`;
        // Validate availability of the slot that the end-point covers.
        const prevHH = String(parseInt(hh, 10) - 1).padStart(2, "0");
        const reqSlot = next.endsWith(":00") ? `${prevHH}:30` : `${hh}:00`;
        if (!slotAvail(reqSlot)) return ds;
        if (ds.selectedStart && timeToMinutes(next) <= timeToMinutes(ds.selectedStart)) return ds;
        return { ...ds, selectedEnd: next };
      }),
    );
  }

  function handleConfirmInterval() {
    if (activeDayIndex === null) return;
    setDaySelections((prev) =>
      prev.map((ds, idx) => {
        if (idx !== activeDayIndex) return ds;
        const s = ds.selectedStart;
        const e = ds.selectedEnd;
        if (!s || !e) return ds;
        const startMin = timeToMinutes(s);
        const endMin = timeToMinutes(e);
        if (endMin <= startMin) return ds;
        const collected: string[] = [];
        let truncatedAt: string | null = null;
        for (let m = startMin; m + SLOT_GRANULARITY_MINUTES <= endMin; m += SLOT_GRANULARITY_MINUTES) {
          const key = minutesToTime(m);
          const sl = slots.find((x) => x.start === key);
          if (!sl || sl.busy || sl.tooSoon) {
            truncatedAt = collected.length > 0 ? minutesToTime(timeToMinutes(collected[collected.length - 1]) + SLOT_GRANULARITY_MINUTES) : null;
            break;
          }
          collected.push(key);
        }
        if (collected.length === 0) {
          return { ...ds, selectedStart: null, selectedEnd: null, truncationMessage: null };
        }
        const merged = Array.from(new Set([...ds.slots, ...collected])).sort(sortFn);
        return {
          ...ds,
          slots: merged,
          selectedStart: null,
          selectedEnd: null,
          truncationMessage: truncatedAt
            ? `Selecția s-a oprit la ${truncatedAt} — următorul interval este ocupat. Poți adăuga alt interval după acesta.`
            : null,
        };
      }),
    );
  }

  // Hour-point grid for the active day (whole-hour buttons only).
  const hourPoints = useMemo(() => {
    if (slots.length === 0) return [] as number[];
    const firstMin = timeToMinutes(slots[0].start);
    const lastMin = timeToMinutes(slots[slots.length - 1].end);
    const startH = Math.floor(firstMin / 60);
    const endH = Math.ceil(lastMin / 60);
    const out: number[] = [];
    for (let h = startH; h <= endH; h++) out.push(h);
    return out;
  }, [slots]);

  // Booking summary across all selected days
  const summary = useMemo(() => {
    const allValidDays = daySelections.filter((ds) => ds.slots.length > 0);
    if (allValidDays.length === 0) return null;

    const daysWithIntervals = allValidDays.map((ds) => {
      const sorted = [...ds.slots].sort(
        (a, b) => timeToMinutes(a) - timeToMinutes(b),
      );
      type Interval = { start: string; end: string; hours: string[] };
      const intervals: Interval[] = [];
      const firstEnd = minutesToTime(
        timeToMinutes(sorted[0]) + SLOT_GRANULARITY_MINUTES,
      );
      let current: Interval = { start: sorted[0], end: firstEnd, hours: [sorted[0]] };
      for (let i = 1; i < sorted.length; i++) {
        // Two slots are contiguous if slot[i].start === previous slot's end
        if (sorted[i] === current.end) {
          current.end = minutesToTime(
            timeToMinutes(sorted[i]) + SLOT_GRANULARITY_MINUTES,
          );
          current.hours.push(sorted[i]);
        } else {
          intervals.push(current);
          const e = minutesToTime(
            timeToMinutes(sorted[i]) + SLOT_GRANULARITY_MINUTES,
          );
          current = { start: sorted[i], end: e, hours: [sorted[i]] };
        }
      }
      intervals.push(current);

      const dayTotal = sorted.reduce(
        (sum, s) => sum + getPriceForSlot(ds.date, s, pricing),
        0,
      );

      return { date: ds.date, intervals, dayTotal, hoursCount: sorted.length };
    });

    const total = daysWithIntervals.reduce((s, d) => s + d.dayTotal, 0);
    const totalIntervals = daysWithIntervals.reduce((s, d) => s + d.intervals.length, 0);
    const totalHours = daysWithIntervals.reduce((s, d) => s + d.hoursCount, 0);

    const recurrenceMultiplier =
      isRecurrent && recurrenceDates.length > 0 ? recurrenceDates.length + 1 : 1;
    const totalSlotsToCreate = totalIntervals * recurrenceMultiplier;
    const exceedsLimit = totalSlotsToCreate > 50;

    return {
      days: daysWithIntervals,
      totalIntervals,
      totalHours,
      total,
      isMultiDay: daysWithIntervals.length > 1,
      isMultiSlot: totalIntervals > 1,
      totalSlotsToCreate,
      exceedsLimit,
    };
  }, [daySelections, pricing, isRecurrent, recurrenceDates.length]);

  // ---------- Render ----------
  if (loading) {
    return (
      <PageShell>
        <div className="container mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">
          Se încarcă…
        </div>
      </PageShell>
    );
  }

  if (notFound || !room) {
    return (
      <PageShell>
        <div className="container mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">Sala nu a fost găsită</h1>
          <p className="mt-2 text-muted-foreground">
            Linkul nu este valid sau sala nu mai este disponibilă.
          </p>
          <Button asChild className="mt-6">
            <Link to="/sali">
              <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la săli
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  if (unavailable) {
    return (
      <PageShell>
        <div className="container mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">Sală indisponibilă</h1>
          <p className="mt-2 text-muted-foreground">
            Această sală nu este disponibilă pentru rezervări momentan.
          </p>
          <Button asChild className="mt-6">
            <Link to="/sali">
              <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la săli
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const amenities: { key: string; label: string; on: boolean }[] = [
    { key: "mirrors", label: "Oglinzi", on: !!room.has_mirrors },
    { key: "sound", label: "Sistem audio", on: !!room.has_sound_system },
    { key: "barre", label: "Bară balet", on: !!room.has_ballet_barre },
    { key: "changing", label: "Vestiar", on: !!room.has_changing_room },
    { key: "ac", label: "Aer condiționat", on: !!room.has_air_conditioning },
  ].filter((a) => a.on);

  const currency = room.currency ?? "RON";

  return (
    <PageShell>
      <main className="flex-1">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <Link
            to="/sali"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Înapoi la săli
          </Link>

          {!room.is_active && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Această sală este momentan inactivă</div>
                <div className="mt-0.5 text-destructive/90">
                  Proprietarul a dezactivat temporar rezervările. Poți vedea detaliile, dar nu poți rezerva acum.
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-8 lg:grid-cols-[3fr_2fr]">
            {/* LEFT */}
            <div>
              {/* Gallery */}
              <div className="overflow-hidden rounded-2xl bg-muted">
                <div className="aspect-[4/3] w-full">
                  {activePhoto ? (
                    <img
                      src={activePhoto}
                      alt={room.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      Fără imagine
                    </div>
                  )}
                </div>
              </div>
              {photos.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {photos.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActivePhoto(p.storage_url)}
                      className={`h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                        activePhoto === p.storage_url
                          ? "border-primary"
                          : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={p.storage_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-start justify-between gap-3">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {room.name}
                </h1>
                {authRole === "renter" && (
                  <button
                    onClick={toggleFavorite}
                    disabled={favLoading}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
                      isFavorite
                        ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                        : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                    {isFavorite ? "Salvat la favorite" : "Salvează la favorite"}
                  </button>
                )}
              </div>

              {(() => {
                const fullAddress = [
                  room.neighbourhood,
                  room.city_name ?? room.city,
                  room.county_name,
                ]
                  .filter(Boolean)
                  .join(", ");
                const cls = "mt-2 flex items-center gap-1.5 text-sm text-muted-foreground";
                return room.google_maps_url ? (
                  <a
                    href={room.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cls} hover:underline`}
                  >
                    <MapPin className="h-4 w-4" />
                    {fullAddress}
                  </a>
                ) : (
                  <p className={cls}>
                    <MapPin className="h-4 w-4" />
                    {fullAddress}
                  </p>
                );
              })()}

              
              {room.virtual_tour_url && (
                <a
                  href={room.virtual_tour_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  <View className="h-4 w-4" />
                  Vezi tur virtual 360°
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              {amenities.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {amenities.map((a) => (
                    <Badge
                      key={a.key}
                      variant="outline"
                      className="border-primary text-primary"
                    >
                      {a.label}
                    </Badge>
                  ))}
                </div>
              )}

              {room.floor_size_sqm != null && (
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  Suprafața: <span className="font-medium">{room.floor_size_sqm} m²</span>
                </p>
              )}

              {room.description && (
                <div className="mt-6">
                  <h2 className="text-lg font-semibold">Descriere</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {room.description}
                  </p>
                </div>
              )}

              {room.rules_and_notes && (
                <div className="mt-6 rounded-xl border border-border bg-accent/30 p-4">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    Reguli și note
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">
                    {room.rules_and_notes}
                  </p>
                </div>
              )}

              {/* Weekly schedule */}
              <div className="mt-8">
                <h2 className="text-lg font-semibold">Program săptămânal</h2>
                <div className="mt-3 overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <tbody>
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                        const s = scheduleByDay.get(d);
                        return (
                          <tr key={d} className="border-b border-border last:border-b-0">
                            <td className="px-4 py-2 font-medium">{DAY_NAMES_RO[d]}</td>
                            <td className="px-4 py-2 text-right">
                              {s ? (
                                <span>
                                  {s.open_time.slice(0, 5)} – {s.close_time.slice(0, 5)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Închis</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {(room.contact_email || room.contact_phone) && (
                <div className="mt-8 rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-semibold mb-2">Contact proprietar</h2>
                  <div className="space-y-1.5 text-sm">
                    {room.contact_email && (
                      <a
                        href={`mailto:${room.contact_email}`}
                        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                      >
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{room.contact_email}</span>
                      </a>
                    )}
                    {room.contact_phone && (
                      <a
                        href={`tel:${room.contact_phone}`}
                        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                      >
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{room.contact_phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — booking card */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-2xl border-2 border-primary bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="text-2xl font-bold">
                  {priceRange.min === priceRange.max
                    ? `${priceRange.min} ${currency}`
                    : `${priceRange.min} – ${priceRange.max} ${currency}`}
                  <span className="text-sm font-normal text-muted-foreground">/oră</span>
                </div>

                {/* Calendar (visible while picking new day or while a day is active) */}
                {(isPickingNewDay || activeDayIndex !== null) && (
                  <div className="mt-5">
                    <CalendarMonth
                      month={currentMonth}
                      onPrev={() =>
                        setCurrentMonth(
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
                        )
                      }
                      onNext={() =>
                        setCurrentMonth(
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
                        )
                      }
                      isDisabled={isDayDisabled}
                      selected={activeDay?.date ?? null}
                      multiSelected={daySelections.map((ds) => ds.date)}
                      onSelect={(d) => {
                        const existingIdx = daySelections.findIndex((ds) =>
                          isSameDay(ds.date, d),
                        );
                        if (existingIdx >= 0) {
                          setActiveDayIndex(existingIdx);
                          setIsPickingNewDay(false);
                          return;
                        }
                        setDaySelections((prev) => [...prev, { date: d, slots: [] }]);
                        setActiveDayIndex(daySelections.length);
                        setIsPickingNewDay(false);
                      }}
                    />
                  </div>
                )}

                {/* Time slots for active day */}
                {activeDay && (
                  <div className="mt-5">
                    <p className="text-sm font-medium">
                      Ore disponibile —{" "}
                      <span className="text-muted-foreground">
                        {DAY_NAMES_RO[getDayOfWeek(activeDay.date)]},{" "}
                        {activeDay.date.getDate()}.
                        {String(activeDay.date.getMonth() + 1).padStart(2, "0")}
                      </span>
                    </p>
                    {slots.length === 0 || hourPoints.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nicio oră disponibilă.
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {!activeDay.selectedStart
                            ? "Apasă ora de început."
                            : !activeDay.selectedEnd
                              ? `Selectează ora de final (start: ${activeDay.selectedStart}).`
                              : `Interval: ${activeDay.selectedStart} – ${activeDay.selectedEnd}. Apasă „Confirmă interval" sau ajustează cu „:30".`}
                        </p>
                        <div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-x-2 gap-y-3">
                          {hourPoints.map((h) => {
                            const hh = String(h).padStart(2, "0");
                            const h00 = `${hh}:00`;
                            const h30 = `${hh}:30`;
                            const prevHH = String(h - 1).padStart(2, "0");
                            const canStart00 = slotAvail(h00);
                            const canStart30 = slotAvail(h30);
                            const canEnd00 = slotAvail(`${prevHH}:30`);
                            const canEnd30 = slotAvail(h00);

                            const startHour = activeDay.selectedStart
                              ? parseInt(activeDay.selectedStart.slice(0, 2), 10)
                              : null;
                            const endHour = activeDay.selectedEnd
                              ? parseInt(activeDay.selectedEnd.slice(0, 2), 10)
                              : null;
                            const isStart = startHour === h;
                            const isEnd = endHour === h;
                            // Build contiguous finalized intervals from slots: e = last_slot_start + 30.
                            const hMin = h * 60;
                            const sortedMins = activeDay.slots
                              .map((s) => timeToMinutes(s))
                              .sort((a, b) => a - b);
                            const intervals: Array<{ s: number; e: number }> = [];
                            for (const m of sortedMins) {
                              const last = intervals[intervals.length - 1];
                              if (last && last.e === m) last.e = m + 30;
                              else intervals.push({ s: m, e: m + 30 });
                            }
                            // Half-membership model: each whole-hour button has two halves.
                            //   left half  = slot H:00 (minutes hMin)
                            //   right half = slot H:30 (minutes hMin + 30)
                            // inclusiveEnd: an interval ends exactly at H:00 → highlight as boundary marker
                            // (preserves the previous inclusive-end visual for whole-hour ends).
                            const leftHalfIn = sortedMins.includes(hMin);
                            const rightHalfIn = sortedMins.includes(hMin + 30);
                            const inclusiveEnd = intervals.some((iv) => iv.e === hMin);
                            const bothIn = (leftHalfIn && rightHalfIn) || inclusiveEnd;
                            const onlyLeft = leftHalfIn && !rightHalfIn && !inclusiveEnd;
                            const onlyRight = !leftHalfIn && rightHalfIn;
                            const fullySelected = bothIn;
                            const inFinalized = bothIn || onlyLeft || onlyRight;

                            // Enable hour button if: in-finalized (remove), is current start/end (deselect),
                            // could become start (no start yet OR tap before start) → canStart any,
                            // could become end (tap after start) → canEnd any.
                            let enabled = false;
                            if (inFinalized) enabled = true;
                            else if (isStart || isEnd) enabled = true;
                            else if (startHour === null) enabled = canStart00 || canStart30;
                            else if (h < startHour) enabled = canStart00 || canStart30;
                            else if (h > startHour) enabled = canEnd00 || canEnd30;

                            const slotForPricing = canStart00 ? h00 : h30;
                            const slotPricing = slotAvail(slotForPricing)
                              ? getPriceForSlotDetailed(activeDay.date, slotForPricing, pricing)
                              : null;
                            const title = !enabled
                              ? "Indisponibil"
                              : slotPricing?.label
                                ? `${slotPricing.price} ${currency} · ${slotPricing.label}`
                                : undefined;

                            // Chip behavior: shown if isStart or isEnd.
                            const showChip = isStart || isEnd;
                            const chipKind: "start" | "end" | null = isStart ? "start" : isEnd ? "end" : null;
                            const chipActive = isStart
                              ? activeDay.selectedStart?.endsWith(":30")
                              : isEnd
                                ? activeDay.selectedEnd?.endsWith(":30")
                                : false;
                            const chipEnabled = isStart
                              ? (canStart30 || activeDay.selectedStart === h30) && (canStart00 || activeDay.selectedStart === h00)
                              : isEnd
                                ? (canEnd30 || activeDay.selectedEnd === h30) && (canEnd00 || activeDay.selectedEnd === h00)
                                : false;

                            const label = isStart
                              ? activeDay.selectedStart
                              : isEnd
                                ? activeDay.selectedEnd
                                : h00;

                            return (
                              <div key={h} className="flex flex-col items-stretch">
                                <button
                                  disabled={!enabled}
                                  onClick={() => handleHourTap(h)}
                                  title={title}
                                  className={`relative overflow-hidden rounded-md border px-2 py-2 text-sm font-medium transition ${
                                    !enabled
                                      ? "cursor-not-allowed border-border bg-muted text-muted-foreground/60"
                                      : fullySelected || onlyLeft
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : isStart || isEnd
                                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary"
                                          : "border-border bg-background hover:border-primary hover:text-primary"
                                  }`}
                                >
                                  {(onlyRight || onlyLeft) && (
                                    <span
                                      aria-hidden
                                      className="pointer-events-none absolute inset-y-0 right-0 w-4"
                                      style={{
                                        background: `repeating-linear-gradient(45deg, ${
                                          onlyLeft ? "#ffffff" : "var(--primary)"
                                        } 0 2px, transparent 2px 6px)`,
                                      }}
                                    />
                                  )}
                                  {label}
                                </button>
                                {showChip && (
                                  <button
                                    type="button"
                                    disabled={!chipEnabled}
                                    onClick={() => chipKind && handleHalfToggle(chipKind)}
                                    className={`mx-2 -mt-px rounded-b-md border-x border-b px-2 py-0.5 text-[10px] font-medium transition ${
                                      !chipEnabled
                                        ? "cursor-not-allowed border-border bg-muted text-muted-foreground/60"
                                        : chipActive
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-primary/40 bg-background text-primary hover:bg-primary/10"
                                    }`}
                                    title={chipActive ? "Revino la :00" : "Adaugă :30"}
                                  >
                                    {chipActive ? ":30 ✓" : "+ :30"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {activeDay.selectedStart && activeDay.selectedEnd && (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={handleConfirmInterval}
                              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              Confirmă interval
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDaySelections((prev) =>
                                  prev.map((ds, i) =>
                                    i === activeDayIndex
                                      ? { ...ds, selectedStart: null, selectedEnd: null, truncationMessage: null }
                                      : ds,
                                  ),
                                )
                              }
                              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                            >
                              Anulează
                            </button>
                          </div>
                        )}
                        {activeDay.truncationMessage && (
                          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                            {activeDay.truncationMessage}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* List of selected days */}
                {daySelections.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Zile selectate ({daySelections.length})
                    </div>
                    {daySelections.map((ds, idx) => {
                      const isActive = idx === activeDayIndex;
                      const hoursCount = ds.slots.length;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between rounded-md border p-2 text-sm transition ${
                            isActive ? "border-primary bg-primary/5" : "border-border bg-background"
                          }`}
                        >
                          <button
                            onClick={() => {
                              setActiveDayIndex(idx);
                              setIsPickingNewDay(false);
                            }}
                            className="flex-1 text-left hover:text-primary"
                          >
                            <div className="font-medium">
                              {DAY_NAMES_RO[getDayOfWeek(ds.date)]}, {ds.date.getDate()}.
                              {String(ds.date.getMonth() + 1).padStart(2, "0")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {hoursCount === 0
                                ? "Niciun interval selectat"
                                : formatDurationRO(hoursCount * SLOT_GRANULARITY_MINUTES)}
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              setDaySelections((prev) => prev.filter((_, i) => i !== idx));
                              if (activeDayIndex === idx) {
                                setActiveDayIndex(null);
                                setIsPickingNewDay(true);
                              } else if (activeDayIndex !== null && activeDayIndex > idx) {
                                setActiveDayIndex(activeDayIndex - 1);
                              }
                            }}
                            className="ml-2 rounded-md p-1 text-destructive hover:bg-destructive/10"
                            aria-label="Șterge ziua"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}

                    {!isPickingNewDay && (
                      <button
                        onClick={() => {
                          setIsPickingNewDay(true);
                          setActiveDayIndex(null);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                      >
                        <Plus className="h-4 w-4" />
                        Adaugă altă zi
                      </button>
                    )}
                  </div>
                )}

                {/* Summary */}
                {summary && (
                  <div className="mt-5 rounded-lg bg-secondary p-4 text-sm">
                    {summary.isMultiDay ? (
                      <>
                        <div className="text-muted-foreground mb-2">
                          {summary.days.length} zile · {summary.totalIntervals} intervale · {formatDurationRO(summary.totalHours * SLOT_GRANULARITY_MINUTES)}
                        </div>
                        <ul className="space-y-2 max-h-60 overflow-y-auto">
                          {summary.days.map((d, i) => (
                            <li key={i} className="border-b border-border pb-2 last:border-0">
                              <div className="font-medium">
                                {DAY_NAMES_RO[getDayOfWeek(d.date)]}, {d.date.getDate()}.
                                {String(d.date.getMonth() + 1).padStart(2, "0")}
                              </div>
                              <ul className="mt-1 space-y-0.5 ml-2">
                                {d.intervals.map((iv, j) => (
                                  <li key={j} className="text-xs flex justify-between">
                                    <span>
                                      {iv.start}–{iv.end}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {formatDurationRO(iv.hours.length * SLOT_GRANULARITY_MINUTES)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Data</span>
                          <span className="font-medium">
                            {summary.days[0].date.getDate()}.
                            {String(summary.days[0].date.getMonth() + 1).padStart(2, "0")}.
                            {summary.days[0].date.getFullYear()}
                          </span>
                        </div>
                        {summary.isMultiSlot ? (
                          <div className="mt-2">
                            <div className="text-muted-foreground mb-1">
                              Intervale ({summary.totalIntervals})
                            </div>
                            <ul className="space-y-1">
                              {summary.days[0].intervals.map((iv, i) => (
                                <li key={i} className="flex justify-between text-sm">
                                  <span className="font-medium">
                                    {iv.start}–{iv.end}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatDurationRO(iv.hours.length * SLOT_GRANULARITY_MINUTES)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <>
                            <div className="mt-1 flex justify-between">
                              <span className="text-muted-foreground">Interval</span>
                              <span className="font-medium">
                                {summary.days[0].intervals[0].start}–
                                {summary.days[0].intervals[0].end}
                              </span>
                            </div>
                            <div className="mt-1 flex justify-between">
                              <span className="text-muted-foreground">Durată</span>
                              <span className="font-medium">
                                {formatDurationRO(summary.totalHours * SLOT_GRANULARITY_MINUTES)}
                              </span>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    <div className="mt-2 flex justify-between border-t border-border pt-2 text-base">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-primary">
                        {summary.total} {currency}
                      </span>
                    </div>

                    {summary.total === 0 && pricing.length === 0 && (
                      <p className="mt-2 text-xs text-amber-600">
                        Sala nu are tarife configurate. Proprietarul trebuie să adauge reguli de preț.
                      </p>
                    )}

                    {summary.exceedsLimit && (
                      <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                        <p className="text-sm font-medium text-destructive">
                          Prea multe rezervări într-un singur checkout
                        </p>
                        <p className="text-xs text-destructive/90 mt-1">
                          Ai selectat {summary.totalSlotsToCreate} rezervări (limita e 50). Redu numărul de intervale sau perioada de recurență.
                        </p>
                      </div>
                    )}

                    {(summary.isMultiDay || summary.isMultiSlot) && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Vor fi create {summary.totalIntervals} rezervări separate — le poți anula individual.
                      </p>
                    )}
                  </div>
                )}

                {/* Recurrence — only single-day */}
                {summary && !summary.isMultiDay && (
                  <div className="mt-4 border-t border-border pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRecurrent}
                        onChange={(e) => {
                          setIsRecurrent(e.target.checked);
                          setRecurrenceEndDate("");
                          setRecurrenceDates([]);
                        }}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">
                        Rezervă recurent (săptămânal)
                      </span>
                    </label>

                    {isRecurrent && summary.days[0] && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground">
                            Repetă până la:
                          </label>
                          <input
                            type="date"
                            value={recurrenceEndDate}
                            min={formatDateISO(addDays(summary.days[0].date, 7))}
                            max={formatDateISO(addDays(new Date(), 365 * 2))}
                            onChange={(e) => {
                              setRecurrenceEndDate(e.target.value);
                              setRecurrenceDates(
                                generateWeeklyDates(summary.days[0].date, e.target.value),
                              );
                            }}
                            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                          />
                        </div>

                        {recurrenceDates.length > 0 && (
                          <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm">
                            <div className="font-medium text-primary">
                              {recurrenceDates.length + 1} rezervări săptămânale
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              În fiecare {DAY_NAMES_RO[getDayOfWeek(summary.days[0].date)]}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Din {summary.days[0].date.toLocaleDateString("ro-RO")} până în{" "}
                              {new Date(recurrenceEndDate).toLocaleDateString("ro-RO")}
                            </div>
                            <div className="mt-2 font-semibold text-primary">
                              Total: {(recurrenceDates.length + 1) * summary.total} {currency}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {summary?.isMultiDay && (
                  <p className="mt-3 text-xs text-muted-foreground italic">
                    Recurența săptămânală e disponibilă doar pentru rezervări într-o singură zi.
                  </p>
                )}

                <Button
                  className="mt-5 w-full cursor-pointer"
                  size="lg"
                  disabled={!summary || !room.is_active || summary.exceedsLimit}
                  onClick={() => {
                    if (!room?.is_active || !summary || !room || summary.exceedsLimit) return;
                    const recurrentActive =
                      !summary.isMultiDay && isRecurrent && recurrenceDates.length > 0;

                    // New format: "DATE:HH:MM-HH:MM,DATE:HH:MM-HH:MM,..."
                    const slotsParam = summary.days
                      .flatMap((d) => {
                        const dateStr = formatDateISO(d.date);
                        return d.intervals.map(
                          (iv) => `${dateStr}:${iv.start}-${iv.end}`,
                        );
                      })
                      .join(",");

                    navigate({
                      to: "/rezerva/$slug",
                      params: { slug: room.slug },
                      search: {
                        slots: slotsParam,
                        // Backward compat for single-day
                        date: !summary.isMultiDay ? formatDateISO(summary.days[0].date) : "",
                        intervals: !summary.isMultiDay
                          ? summary.days[0].intervals
                              .map((iv) => `${iv.start}-${iv.end}`)
                              .join(",")
                          : "",
                        duration: (summary.totalHours * SLOT_GRANULARITY_MINUTES) / 60,
                        total: summary.total,
                        recurrent: recurrentActive ? "true" : "false",
                        recurrenceEnd: recurrentActive ? recurrenceEndDate : "",
                        recurrenceCount: recurrentActive ? recurrenceDates.length + 1 : 0,
                      },
                    });
                  }}
                >
                  {!room.is_active
                    ? "Rezervările sunt indisponibile"
                    : summary?.isMultiDay
                      ? `Rezervă ${summary.totalIntervals} intervale (${summary.days.length} zile)`
                      : summary?.isMultiSlot
                        ? `Rezervă ${summary.totalIntervals} intervale`
                        : "Rezervă acum"}
                </Button>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Fără cont necesar · Completezi doar numele, emailul și telefonul.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </PageShell>
  );
}

// ---------- Page shell ----------
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

// ---------- Calendar ----------
function CalendarMonth({
  month,
  onPrev,
  onNext,
  isDisabled,
  selected,
  onSelect,
  multiSelected = [],
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  isDisabled: (d: Date) => boolean;
  selected: Date | null;
  onSelect: (d: Date) => void;
  multiSelected?: Date[];
}) {
  const monthName = month.toLocaleDateString("ro-RO", {
    month: "long",
    year: "numeric",
  });
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const startDow = getDayOfWeek(start);
  const leading = startDow - 1;
  const totalDays = end.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const dayLabels = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          className="rounded-md p-1.5 hover:bg-muted"
          aria-label="Luna precedentă"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium capitalize">{monthName}</span>
        <button
          onClick={onNext}
          className="rounded-md p-1.5 hover:bg-muted"
          aria-label="Luna următoare"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {dayLabels.map((d, i) => (
          <div key={i} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />;
          const disabled = isDisabled(d);
          const isActive = selected && isSameDay(d, selected);
          const isInMultiSelection = multiSelected.some((md) => isSameDay(md, d));
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onSelect(d)}
              className={`aspect-square rounded-md text-sm transition ${
                isActive
                  ? "bg-primary text-primary-foreground font-semibold"
                  : isInMultiSelection
                    ? "bg-primary/15 text-primary font-medium border border-primary/40"
                    : disabled
                      ? "cursor-not-allowed bg-muted/40 text-muted-foreground/50"
                      : "bg-background hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
