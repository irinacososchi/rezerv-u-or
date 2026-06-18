import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarX } from "lucide-react";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/external-client";
import {
  addDays,
  DAY_NAMES_RO,
  endOfMonth,
  formatDateISO,
  getDayOfWeek,
  MONTH_NAMES_RO,
  startOfMonth,
  startOfWeek,
} from "@/lib/date-utils";
import {
  SLOT_GRANULARITY_MINUTES,
  minutesToTime,
  timeToMinutes,
} from "@/lib/time-slots";
import {
  BookingDetailsRenter,
  type RenterBookingRow,
} from "@/components/renter/BookingDetailsRenter";

export const Route = createFileRoute("/panou/orarul-meu")({
  component: OrarulMeu,
});

const HOUR_START = 7;
const HOUR_END = 23;
const SLOT_ROWS = Array.from(
  { length: (HOUR_END - HOUR_START) * (60 / SLOT_GRANULARITY_MINUTES) },
  (_, i) => minutesToTime(HOUR_START * 60 + i * SLOT_GRANULARITY_MINUTES),
);
const MONTH_LABELS = MONTH_NAMES_RO.map((m) => m.charAt(0).toUpperCase() + m.slice(1));
const VIEW_KEY = "orarul-meu-view-mode";

type ViewMode = "day" | "week" | "month";

function formatRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const m1 = MONTH_NAMES_RO[weekStart.getMonth()].slice(0, 3);
  const m2 = MONTH_NAMES_RO[weekEnd.getMonth()].slice(0, 3);
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${weekStart.getDate()} – ${weekEnd.getDate()} ${m2} ${weekEnd.getFullYear()}`;
  }
  if (weekStart.getFullYear() === weekEnd.getFullYear()) {
    return `${weekStart.getDate()} ${m1} – ${weekEnd.getDate()} ${m2} ${weekEnd.getFullYear()}`;
  }
  return `${weekStart.getDate()} ${m1} ${weekStart.getFullYear()} – ${weekEnd.getDate()} ${m2} ${weekEnd.getFullYear()}`;
}

function cellClass(b: RenterBookingRow | undefined): string {
  if (!b) return "bg-background hover:bg-muted/40";
  if (b.status === "confirmată") return "bg-primary/30 text-foreground cursor-pointer hover:bg-primary/40";
  if (b.status === "în așteptare") return "bg-orange-200/80 text-orange-950 cursor-pointer hover:bg-orange-200";
  return "bg-muted/60 cursor-pointer hover:bg-muted";
}

function detectDefaultView(): ViewMode {
  if (typeof window === "undefined") return "week";
  const saved = window.localStorage.getItem(VIEW_KEY);
  if (saved === "day" || saved === "week" || saved === "month") return saved;
  return window.matchMedia("(max-width: 768px)").matches ? "day" : "week";
}

function OrarulMeu() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<RenterBookingRow[]>([]);
  const [view, setView] = useState<ViewMode>(() => detectDefaultView());
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [weekStart, setWeekStartState] = useState<Date>(() => startOfWeek(new Date()));
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<RenterBookingRow | null>(null);

  useEffect(() => {
    window.localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // Auth + initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!u) {
        navigate({ to: "/login" as never });
        return;
      }
      const usr = { id: u.id, email: u.email ?? "" };
      setUser(usr);
      setAuthChecked(true);
      await fetchBookings(usr);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchBookings(usr: { id: string; email: string }) {
    const { data } = await supabase
      .from("bookings_full")
      .select("*")
      .or(`renter_id.eq.${usr.id},guest_email.ilike.${usr.email}`)
      .in("status", ["confirmată", "în așteptare"])
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true });
    setBookings((data ?? []) as RenterBookingRow[]);
  }

  async function refetch() {
    if (user) await fetchBookings(user);
  }

  // Build slot cell map (covers every 30-min slot)
  const cellMap = useMemo(() => {
    const map = new Map<string, RenterBookingRow>();
    for (const b of bookings) {
      const startMin = timeToMinutes(b.start_time);
      const endMin = timeToMinutes(b.end_time);
      for (let m = startMin; m < endMin; m += SLOT_GRANULARITY_MINUTES) {
        map.set(`${b.booking_date}|${minutesToTime(m)}`, b);
      }
    }
    return map;
  }, [bookings]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Month grid (6 weeks)
  const monthCells = useMemo(() => {
    const first = startOfMonth(monthAnchor);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthAnchor]);

  // bookings indexed by date for month view
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, RenterBookingRow[]>();
    for (const b of bookings) {
      const arr = map.get(b.booking_date) ?? [];
      arr.push(b);
      map.set(b.booking_date, arr);
    }
    return map;
  }, [bookings]);

  function setWeekStart(d: Date) {
    setWeekStartState(startOfWeek(d));
  }

  function jumpToMonth(monthIdx: number, year: number) {
    const d = new Date(year, monthIdx, 1);
    setMonthAnchor(d);
    setWeekStart(d);
    setSelectedDay(d);
    setPickerOpen(false);
  }

  const headerLabel =
    view === "day"
      ? `${DAY_NAMES_RO[getDayOfWeek(selectedDay)]}, ${selectedDay.getDate()} ${MONTH_NAMES_RO[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`
      : view === "week"
        ? formatRange(weekStart)
        : `${MONTH_LABELS[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`;

  const pickerYears = useMemo(() => {
    const cy = new Date().getFullYear();
    return [cy - 1, cy, cy + 1, cy + 2];
  }, []);

  // Empty state visibility per view
  const hasAnyForCurrentView = useMemo(() => {
    if (view === "day") {
      return bookings.some((b) => b.booking_date === formatDateISO(selectedDay));
    }
    if (view === "week") {
      const startISO = formatDateISO(weekStart);
      const endISO = formatDateISO(addDays(weekStart, 6));
      return bookings.some((b) => b.booking_date >= startISO && b.booking_date <= endISO);
    }
    const mStart = formatDateISO(startOfMonth(monthAnchor));
    const mEnd = formatDateISO(endOfMonth(monthAnchor));
    return bookings.some((b) => b.booking_date >= mStart && b.booking_date <= mEnd);
  }, [bookings, view, selectedDay, weekStart, monthAnchor]);

  if (!authChecked || loading) {
    return (
      <OwnerLayout>
        <div className="h-40 flex items-center justify-center text-muted-foreground">
          Se încarcă…
        </div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Orarul meu</h1>
            <p className="text-sm text-muted-foreground">
              Calendar {view === "day" ? "zilnic" : view === "week" ? "săptămânal" : "lunar"} cu rezervările tale
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (view === "day") setSelectedDay((d) => addDays(d, -1));
                else if (view === "week") setWeekStartState((w) => addDays(w, -7));
                else setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-sm font-medium px-2 py-1 rounded hover:bg-muted capitalize"
                >
                  {headerLabel}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Lună</Label>
                  <select
                    className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    defaultValue={
                      view === "week" ? weekStart.getMonth() : monthAnchor.getMonth()
                    }
                    id="om-picker-month"
                  >
                    {MONTH_LABELS.map((m, i) => (
                      <option key={m} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">An</Label>
                  <select
                    className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    defaultValue={
                      view === "week" ? weekStart.getFullYear() : monthAnchor.getFullYear()
                    }
                    id="om-picker-year"
                  >
                    {pickerYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const ms = (document.getElementById("om-picker-month") as HTMLSelectElement | null)?.value;
                    const ys = (document.getElementById("om-picker-year") as HTMLSelectElement | null)?.value;
                    if (ms != null && ys != null) {
                      jumpToMonth(parseInt(ms, 10), parseInt(ys, 10));
                    }
                  }}
                >
                  Mergi
                </Button>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (view === "day") setSelectedDay((d) => addDays(d, 1));
                else if (view === "week") setWeekStartState((w) => addDays(w, 7));
                else setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setSelectedDay(today);
                setWeekStart(today);
                setMonthAnchor(startOfMonth(today));
              }}
            >
              Astăzi
            </Button>
          </div>

          <div className="inline-flex rounded-md border bg-card p-1 text-sm">
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                className={
                  "px-3 py-1 rounded " +
                  (view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted")
                }
                onClick={() => setView(v)}
              >
                {v === "day" ? "Zi" : v === "week" ? "Săptămână" : "Lună"}
              </button>
            ))}
          </div>
        </div>

        {!hasAnyForCurrentView && (
          <div className="border rounded-lg bg-card p-10 flex flex-col items-center text-center gap-3">
            <CalendarX className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">Nu ai rezervări în această perioadă.</p>
            <Button asChild size="sm">
              <Link to="/sali">Caută o sală</Link>
            </Button>
          </div>
        )}

        {hasAnyForCurrentView && view === "day" && (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted/20 text-sm font-medium capitalize">
              {DAY_NAMES_RO[getDayOfWeek(selectedDay)]}, {selectedDay.getDate()} {MONTH_NAMES_RO[selectedDay.getMonth()]}
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
              {SLOT_ROWS.map((slotStart) => {
                const dateISO = formatDateISO(selectedDay);
                const b = cellMap.get(`${dateISO}|${slotStart}`);
                const showLabel = b && b.start_time.slice(0, 5) === slotStart;
                const isHalfHour = slotStart.endsWith(":30");
                return (
                  <button
                    type="button"
                    key={slotStart}
                    onClick={() => b && setSelected(b)}
                    disabled={!b}
                    className={
                      "flex w-full border-b last:border-b-0 min-h-[28px] text-left transition-colors " +
                      (isHalfHour ? "" : "border-dashed ") +
                      cellClass(b)
                    }
                  >
                    <div
                      className={
                        "w-16 shrink-0 flex items-start justify-end pr-3 pt-1 border-r bg-muted/10 " +
                        (isHalfHour ? "text-[10px] text-muted-foreground/60" : "text-xs text-muted-foreground")
                      }
                    >
                      {isHalfHour ? ":30" : slotStart}
                    </div>
                    <div className="flex-1 px-3 py-1 text-sm">
                      {showLabel && (
                        <div className="min-w-0">
                          <div className="font-medium truncate">{b!.room_name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {b!.start_time.slice(0, 5)}–{b!.end_time.slice(0, 5)}
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {hasAnyForCurrentView && view === "week" && (
          <div className="border rounded-lg bg-card overflow-x-auto">
            <div className="min-w-[760px]">
              <div
                className="grid border-b text-xs"
                style={{ gridTemplateColumns: "70px repeat(7, 1fr)" }}
              >
                <div className="p-2 text-muted-foreground"></div>
                {days.map((d) => {
                  const dow = getDayOfWeek(d);
                  const isToday = formatDateISO(d) === formatDateISO(new Date());
                  return (
                    <div
                      key={formatDateISO(d)}
                      className={"p-2 text-center border-l " + (isToday ? "bg-primary/5" : "")}
                    >
                      <div className="font-medium">{DAY_NAMES_RO[dow]}</div>
                      <div className="text-muted-foreground">
                        {d.getDate()} {MONTH_NAMES_RO[d.getMonth()].slice(0, 3)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                {SLOT_ROWS.map((slotStart) => {
                  const isHalfHour = slotStart.endsWith(":30");
                  return (
                    <div
                      key={slotStart}
                      className={
                        "grid border-b last:border-b-0 " + (isHalfHour ? "" : "border-dashed")
                      }
                      style={{ gridTemplateColumns: "70px repeat(7, 1fr)" }}
                    >
                      <div
                        className={
                          "p-1 border-r " +
                          (isHalfHour
                            ? "text-[10px] text-muted-foreground/60"
                            : "text-xs text-muted-foreground")
                        }
                      >
                        {isHalfHour ? ":30" : slotStart}
                      </div>
                      {days.map((d) => {
                        const dateISO = formatDateISO(d);
                        const b = cellMap.get(`${dateISO}|${slotStart}`);
                        const showLabel = b && b.start_time.slice(0, 5) === slotStart;
                        return (
                          <button
                            type="button"
                            key={dateISO + slotStart}
                            onClick={() => b && setSelected(b)}
                            disabled={!b}
                            className={
                              "h-7 border-l text-left text-xs px-1.5 py-0.5 transition-colors " +
                              cellClass(b)
                            }
                          >
                            {showLabel && (
                              <div className="truncate font-medium">{b!.room_name}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {hasAnyForCurrentView && view === "month" && (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="grid grid-cols-7 text-xs border-b">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <div
                  key={i}
                  className="p-2 text-center font-medium text-muted-foreground border-l first:border-l-0"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((d) => {
                const dateISO = formatDateISO(d);
                const inMonth = d.getMonth() === monthAnchor.getMonth();
                const isToday = dateISO === formatDateISO(new Date());
                const dayBookings = bookingsByDate.get(dateISO) ?? [];
                const visible = dayBookings.slice(0, 3);
                const more = dayBookings.length - visible.length;
                return (
                  <div
                    key={dateISO}
                    className={
                      "min-h-[96px] border-l border-t -ml-px -mt-px p-1.5 text-xs " +
                      (inMonth ? "" : "bg-muted/30 text-muted-foreground ") +
                      (isToday ? "outline outline-2 outline-primary " : "")
                    }
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-semibold">{d.getDate()}</span>
                      {dayBookings.length > 0 && (
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline"
                          onClick={() => {
                            const day = new Date(d);
                            day.setHours(0, 0, 0, 0);
                            setSelectedDay(day);
                            setView("day");
                          }}
                        >
                          Vezi zi
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {visible.map((b) => (
                        <button
                          type="button"
                          key={b.id}
                          onClick={() => setSelected(b)}
                          className={
                            "w-full text-left truncate px-1 py-0.5 rounded text-[10px] " +
                            cellClass(b)
                          }
                          title={`${b.room_name} · ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`}
                        >
                          {b.start_time.slice(0, 5)} {b.room_name}
                        </button>
                      ))}
                      {more > 0 && (
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:underline"
                          onClick={() => {
                            const day = new Date(d);
                            day.setHours(0, 0, 0, 0);
                            setSelectedDay(day);
                            setView("day");
                          }}
                        >
                          +{more} altele
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-primary/30" /> Confirmată
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-orange-200/80" /> În așteptare
          </span>
        </div>
      </div>

      <BookingDetailsRenter
        booking={selected}
        userEmail={user?.email ?? ""}
        onClose={() => setSelected(null)}
        onCancelled={refetch}
      />
    </OwnerLayout>
  );
}

// silence unused parseISODate warning if tree-shaken
void parseISODate;
