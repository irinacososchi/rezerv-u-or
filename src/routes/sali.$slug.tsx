import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Ruler,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
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
  floor_size_sqm: number | null;
  has_mirrors: boolean | null;
  has_sound_system: boolean | null;
  has_ballet_barre: boolean | null;
  has_changing_room: boolean | null;
  has_air_conditioning: boolean | null;
  rules_and_notes: string | null;
  currency: string | null;
  cover_url?: string | null;
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
};

type Booking = {
  booking_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  status: string;
};

// ---------- Helpers ----------
function hourFromTime(t: string): number {
  return parseInt(t.slice(0, 2), 10);
}

function getPriceForSlot(
  date: Date,
  hour: number,
  pricingRules: PricingRule[],
): number {
  const dayOfWeek = getDayOfWeek(date);
  const slotTime = `${hour.toString().padStart(2, "0")}:00:00`;

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

  return Number(matching[0]?.price_per_hour ?? 0);
}

function generateWeeklyDates(selectedDate: Date, endDateStr: string): Date[] {
  if (!endDateStr) return [];
  const end = new Date(endDateStr);
  const dates: Date[] = [];
  const current = new Date(selectedDate);
  current.setDate(current.getDate() + 7);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

// ---------- Page ----------
function RoomDetailsPage() {
  const { slug } = Route.useParams() as { slug: string };
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [recurrenceDates, setRecurrenceDates] = useState<Date[]>([]);

  // ---------- Fetch ----------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);

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
      setPricing((priceRes.data ?? []) as PricingRule[]);
      setBlockedDates(
        new Set(
          ((blockRes.data ?? []) as { blocked_date: string }[]).map(
            (b) => b.blocked_date,
          ),
        ),
      );
      setBookings((bookRes.data ?? []) as Booking[]);

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

  function isDayDisabled(date: Date): boolean {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    if (dayStart < today0) return true;
    const iso = formatDateISO(date);
    if (blockedDates.has(iso)) return true;
    const dow = getDayOfWeek(date);
    if (!scheduleByDay.has(dow)) return true;
    return false;
  }

  // Slots for selected day
  const slots = useMemo(() => {
    if (!selectedDate) return [] as { hour: number; busy: boolean; price: number }[];
    const dow = getDayOfWeek(selectedDate);
    const sched = scheduleByDay.get(dow);
    if (!sched) return [];
    const open = hourFromTime(sched.open_time);
    const close = hourFromTime(sched.close_time);
    const iso = formatDateISO(selectedDate);
    const dayBookings = bookings.filter((b) => b.booking_date === iso);

    const result: { hour: number; busy: boolean; price: number }[] = [];
    for (let h = open; h < close; h++) {
      const slotStart = h;
      const slotEnd = h + 1;
      const busy = dayBookings.some((b) => {
        const bs = hourFromTime(b.start_time);
        const be = hourFromTime(b.end_time);
        return slotStart < be && slotEnd > bs;
      });
      result.push({
        hour: h,
        busy,
        price: getPriceForSlot(selectedDate, h, pricing),
      });
    }
    return result;
  }, [selectedDate, scheduleByDay, bookings, pricing]);

  // Reset slots when date changes
  useEffect(() => {
    setSelectedHours([]);
    setIsRecurrent(false);
    setRecurrenceEndDate("");
    setRecurrenceDates([]);
  }, [selectedDate]);

  function toggleHour(h: number) {
    setSelectedHours((prev) => {
      if (prev.includes(h)) {
        return prev.filter((x) => x !== h).sort((a, b) => a - b);
      }
      return [...prev, h].sort((a, b) => a - b);
    });
  }

  // Booking summary
  const summary = useMemo(() => {
    if (!selectedDate || selectedHours.length === 0) return null;
    const sorted = [...selectedHours].sort((a, b) => a - b);
    const start = sorted[0];
    const end = sorted[sorted.length - 1] + 1;
    const total = sorted.reduce(
      (sum, h) => sum + getPriceForSlot(selectedDate, h, pricing),
      0,
    );
    // Check contiguity
    let contiguous = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        contiguous = false;
        break;
      }
    }
    return {
      start: `${start.toString().padStart(2, "0")}:00`,
      end: `${end.toString().padStart(2, "0")}:00`,
      duration: sorted.length,
      total,
      contiguous,
    };
  }, [selectedDate, selectedHours, pricing]);

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

              <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                {room.name}
              </h1>

              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {[room.neighbourhood, room.city].filter(Boolean).join(", ")}
              </p>

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

                {/* Calendar */}
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
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                  />
                </div>

                {/* Time slots */}
                {selectedDate && (
                  <div className="mt-5">
                    <p className="text-sm font-medium">
                      Ore disponibile —{" "}
                      <span className="text-muted-foreground">
                        {DAY_NAMES_RO[getDayOfWeek(selectedDate)]},{" "}
                        {selectedDate.getDate()}.{String(selectedDate.getMonth() + 1).padStart(2, "0")}
                      </span>
                    </p>
                    {slots.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nicio oră disponibilă.
                      </p>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {slots.map((s) => {
                          const selected = selectedHours.includes(s.hour);
                          return (
                            <button
                              key={s.hour}
                              disabled={s.busy}
                              onClick={() => toggleHour(s.hour)}
                              className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                                s.busy
                                  ? "cursor-not-allowed border-border bg-muted text-muted-foreground/60"
                                  : selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background hover:border-primary hover:text-primary"
                              }`}
                            >
                              {`${s.hour.toString().padStart(2, "0")}:00–${(s.hour + 1).toString().padStart(2, "0")}:00`}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                {summary && (
                  <div className="mt-5 rounded-lg bg-secondary p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data</span>
                      <span className="font-medium">
                        {selectedDate!.getDate()}.
                        {String(selectedDate!.getMonth() + 1).padStart(2, "0")}.
                        {selectedDate!.getFullYear()}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">Interval</span>
                      <span className="font-medium">
                        {summary.start}–{summary.end}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">Durată</span>
                      <span className="font-medium">
                        {summary.duration} {summary.duration === 1 ? "oră" : "ore"}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-border pt-2 text-base">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-primary">
                        {summary.total} {currency}
                      </span>
                    </div>
                    {!summary.contiguous && (
                      <p className="mt-2 text-xs text-destructive">
                        Selectează ore consecutive pentru un interval continuu.
                      </p>
                    )}
                    {summary.contiguous && summary.total === 0 && pricing.length === 0 && (
                      <p className="mt-2 text-xs text-amber-600">
                        Sala nu are tarife configurate. Proprietarul trebuie să adauge reguli de preț.
                      </p>
                    )}
                  </div>
                )}

                {summary && (
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

                    {isRecurrent && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground">
                            Repetă până la:
                          </label>
                          <input
                            type="date"
                            value={recurrenceEndDate}
                            min={formatDateISO(addDays(selectedDate!, 7))}
                            max={formatDateISO(addDays(new Date(), 365 * 2))}
                            onChange={(e) => {
                              setRecurrenceEndDate(e.target.value);
                              setRecurrenceDates(
                                generateWeeklyDates(selectedDate!, e.target.value),
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
                              {summary.start}–{summary.end} în fiecare{" "}
                              {DAY_NAMES_RO[getDayOfWeek(selectedDate!)]}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Din {selectedDate!.toLocaleDateString("ro-RO")} până în{" "}
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

                <Button
                  className="mt-5 w-full cursor-pointer"
                  size="lg"
                  disabled={!summary || !summary.contiguous}
                  onClick={() => {
                    if (!summary || !summary.contiguous || !selectedDate || !room) return;
                    const recurrentActive = isRecurrent && recurrenceDates.length > 0;
                    navigate({
                      to: "/rezerva/$slug",
                      params: { slug: room.slug },
                      search: {
                        date: formatDateISO(selectedDate),
                        start: summary.start,
                        end: summary.end,
                        duration: summary.duration,
                        total: summary.total,
                        recurrent: recurrentActive ? "true" : "false",
                        recurrenceEnd: recurrentActive ? recurrenceEndDate : "",
                        recurrenceCount: recurrentActive ? recurrenceDates.length + 1 : 0,
                      },
                    });
                  }}
                >
                  Rezervă acum
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
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  isDisabled: (d: Date) => boolean;
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const monthName = month.toLocaleDateString("ro-RO", {
    month: "long",
    year: "numeric",
  });
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  // Grid starting Monday
  const startDow = getDayOfWeek(start); // 1..7 (Mon..Sun)
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
          const isSelected = selected && isSameDay(d, selected);
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onSelect(d)}
              className={`aspect-square rounded-md text-sm transition ${
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold"
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
