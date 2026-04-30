import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/external-client";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarPlus, Ban, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import {
  getDayOfWeek,
  formatDateISO,
  formatDateRO,
  parseISODate,
  addDays,
  DAY_NAMES_RO,
  MONTH_NAMES_RO,
  startOfMonth,
  endOfMonth,
} from "@/lib/date-utils";

type PricingRule = {
  id: string;
  price_per_hour: number;
  days_of_week: number[];
  start_time: string | null;
  end_time: string | null;
  priority: number;
  is_active: boolean;
};

function calculatePriceForDate(
  dateISO: string,
  startHHMM: string,
  pricingRules: PricingRule[],
): number {
  const date = parseISODate(dateISO);
  const dayOfWeek = getDayOfWeek(date);
  const slotTime = `${startHHMM}:00`;
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

export const Route = createFileRoute("/proprietar/sali/$id/calendar")({
  component: RoomCalendarPage,
});

const HOUR_START = 8;
const HOUR_END = 22; // last slot starts at 21:00

const MONTH_LABELS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

type Room = { id: string; name: string; slug: string; owner_id: string };

type Entry = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  entry_type?: string | null;
  status?: string | null;
  payment_status?: string | null;
  reason?: string | null;
  reference?: string | null;
  renter_name?: string | null;
  renter_email?: string | null;
  renter_phone?: string | null;
  total_amount?: number | null;
  price_per_hour?: number | null;
  discount_amount?: number | null;
  duration_hours?: number | null;
  renter_notes?: string | null;
  recurrence_id?: string | null;
  recurrence_index?: number | null;
};

function startOfWeek(d: Date): Date {
  const dow = getDayOfWeek(d);
  return addDays(d, -(dow - 1));
}

function formatRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const m1 = MONTH_NAMES_RO[weekStart.getMonth()].slice(0, 3);
  const m2 = MONTH_NAMES_RO[weekEnd.getMonth()].slice(0, 3);
  if (sameMonth) {
    return `${weekStart.getDate()} – ${weekEnd.getDate()} ${m2} ${weekEnd.getFullYear()}`;
  }
  if (sameYear) {
    return `${weekStart.getDate()} ${m1} – ${weekEnd.getDate()} ${m2} ${weekEnd.getFullYear()}`;
  }
  return `${weekStart.getDate()} ${m1} ${weekStart.getFullYear()} – ${weekEnd.getDate()} ${m2} ${weekEnd.getFullYear()}`;
}

function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function parseHM(t: string): number {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h + (m || 0) / 60;
}

function RoomCalendarPage() {
  const { id } = useParams({ from: "/proprietar/sali/$id/calendar" });
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(new Date()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [selected, setSelected] = useState<
    | { kind: "booking"; entry: Entry }
    | { kind: "block"; entry: Entry }
    | null
  >(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Room switcher dropdown
  const [allRooms, setAllRooms] = useState<{ id: string; name: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadRooms() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("rooms")
        .select("id, name")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .order("name");
      setAllRooms(data ?? []);
    }
    loadRooms();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cell-click flow: choose → block | booking
  type CellClickMode = "choose" | "block" | "booking";
  const [cellModal, setCellModal] = useState<{
    date: string;
    hour: number;
    mode: CellClickMode;
  } | null>(null);

  // Manual booking form state
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("10:00");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualPaymentStatus, setManualPaymentStatus] = useState("neplatit");
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Load entries — range depends on view
  const loadEntries = useCallback(async () => {
    let startISO: string;
    let endISO: string;
    if (view === "week") {
      startISO = formatDateISO(weekStart);
      endISO = formatDateISO(addDays(weekStart, 6));
    } else {
      startISO = formatDateISO(startOfMonth(monthAnchor));
      endISO = formatDateISO(endOfMonth(monthAnchor));
    }
    const { data, error } = await supabase
      .from("owner_calendar")
      .select("*")
      .eq("room_id", id)
      .gte("booking_date", startISO)
      .lte("booking_date", endISO);
    if (error) {
      console.error("owner_calendar error", error);
      toast.error("Eroare la încărcarea calendarului");
      setEntries([]);
      return;
    }
    setEntries((data ?? []) as Entry[]);
  }, [id, view, weekStart, monthAnchor]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: r, error } = await supabase
        .from("rooms")
        .select("id, name, slug, owner_id")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (error || !r) {
        toast.error("Sala nu a fost găsită");
        navigate({ to: "/proprietar/sali" });
        return;
      }
      if (r.owner_id !== user.id) {
        navigate({ to: "/proprietar/sali" });
        return;
      }
      setRoom(r as Room);

      // Load pricing rules
      const { data: rules } = await supabase
        .from("pricing_rules")
        .select("id, price_per_hour, days_of_week, start_time, end_time, priority, is_active")
        .eq("room_id", id);
      if (!cancelled) setPricingRules((rules ?? []) as PricingRule[]);

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!loading) loadEntries();
  }, [loading, loadEntries]);

  // Map (dateISO|hour) -> entry
  const cellMap = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const e of entries) {
      const sh = Math.floor(parseHM(e.start_time));
      const eh = Math.ceil(parseHM(e.end_time));
      for (let h = sh; h < eh; h++) {
        map.set(`${e.booking_date}|${h}`, e);
      }
    }
    return map;
  }, [entries]);

  // Per-day stats for month view
  const dayStats = useMemo(() => {
    const m = new Map<string, { bookings: number; blocks: number }>();
    for (const e of entries) {
      const k = e.booking_date;
      const cur = m.get(k) ?? { bookings: 0, blocks: 0 };
      if (e.entry_type === "blocat") cur.blocks++;
      else cur.bookings++;
      m.set(k, cur);
    }
    return m;
  }, [entries]);

  function onCellClick(dateISO: string, hour: number) {
    const e = cellMap.get(`${dateISO}|${hour}`);
    if (!e) {
      // Reset manual form and open chooser
      const sH = `${String(hour).padStart(2, "0")}:00`;
      const eH = `${String(Math.min(hour + 1, HOUR_END)).padStart(2, "0")}:00`;
      setManualStart(sH);
      setManualEnd(eH);
      setManualName("");
      setManualPhone("");
      setManualEmail("");
      setManualNote("");
      setManualPaymentStatus("neplatit");
      setManualError(null);
      setCellModal({ date: dateISO, hour, mode: "choose" });
      return;
    }
    if (e.entry_type === "blocat") setSelected({ kind: "block", entry: e });
    else setSelected({ kind: "booking", entry: e });
  }

  function cellClass(e: Entry | undefined): string {
    if (!e) return "bg-background hover:bg-muted/60 cursor-pointer";
    if (e.entry_type === "blocat") {
      return "bg-muted text-foreground cursor-pointer bg-[repeating-linear-gradient(45deg,hsl(var(--muted))_0,hsl(var(--muted))_6px,hsl(var(--muted-foreground)/0.15)_6px,hsl(var(--muted-foreground)/0.15)_12px)]";
    }
    if (e.status === "confirmată") return "bg-primary/30 text-foreground cursor-pointer";
    if (e.status === "în așteptare") return "bg-orange-200/80 text-orange-950 cursor-pointer";
    if (e.status === "finalizată") return "bg-muted/70 text-foreground cursor-pointer";
    if (e.status === "anulată" || e.status === "refuzată")
      return "bg-destructive/15 text-destructive cursor-pointer";
    return "bg-secondary text-secondary-foreground cursor-pointer";
  }

  function jumpToMonth(monthIdx: number, year: number) {
    const d = new Date(year, monthIdx, 1);
    setMonthAnchor(d);
    setWeekStart(startOfWeek(d));
    setPickerOpen(false);
  }

  // Build month grid (always 6 weeks for stable layout)
  const monthCells = useMemo(() => {
    const first = startOfMonth(monthAnchor);
    const start = startOfWeek(first); // Monday on/before 1st
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthAnchor]);

  const headerLabel =
    view === "week"
      ? formatRange(weekStart)
      : `${MONTH_LABELS[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`;

  const pickerYears = useMemo(() => {
    const cy = new Date().getFullYear();
    return [cy, cy + 1, cy + 2];
  }, []);

  return (
    <OwnerLayout>
      <div className="p-4 md:p-6 space-y-4">
        {loading || !room ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            Se încarcă…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-semibold">{room.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Calendar {view === "week" ? "săptămânal" : "lunar"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (view === "week") setWeekStart((w) => addDays(w, -7));
                    else
                      setMonthAnchor(
                        (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                      );
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {view === "week" ? "Săptămâna trecută" : "Luna trecută"}
                </Button>

                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-sm font-medium px-2 py-1 rounded hover:bg-muted"
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
                          view === "week"
                            ? weekStart.getMonth()
                            : monthAnchor.getMonth()
                        }
                        id="picker-month"
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
                          view === "week"
                            ? weekStart.getFullYear()
                            : monthAnchor.getFullYear()
                        }
                        id="picker-year"
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
                        const ms = (document.getElementById("picker-month") as HTMLSelectElement | null)?.value;
                        const ys = (document.getElementById("picker-year") as HTMLSelectElement | null)?.value;
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
                    if (view === "week") setWeekStart((w) => addDays(w, 7));
                    else
                      setMonthAnchor(
                        (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                      );
                  }}
                >
                  {view === "week" ? "Săptămâna viitoare" : "Luna viitoare"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    setWeekStart(startOfWeek(today));
                    setMonthAnchor(startOfMonth(today));
                  }}
                >
                  Astăzi
                </Button>
              </div>
            </div>

            <div className="inline-flex rounded-md border bg-card p-1 text-sm">
              <button
                className={
                  "px-3 py-1 rounded " +
                  (view === "week"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted")
                }
                onClick={() => setView("week")}
              >
                Săptămână
              </button>
              <button
                className={
                  "px-3 py-1 rounded " +
                  (view === "month"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted")
                }
                onClick={() => setView("month")}
              >
                Lună
              </button>
            </div>

            {view === "week" ? (
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
                          className={
                            "p-2 text-center border-l " + (isToday ? "bg-primary/5" : "")
                          }
                        >
                          <div className="font-medium">{DAY_NAMES_RO[dow]}</div>
                          <div className="text-muted-foreground">
                            {d.getDate()} {MONTH_NAMES_RO[d.getMonth()].slice(0, 3)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {Array.from(
                    { length: HOUR_END - HOUR_START },
                    (_, i) => HOUR_START + i,
                  ).map((hour) => (
                    <div
                      key={hour}
                      className="grid border-b last:border-b-0"
                      style={{ gridTemplateColumns: "70px repeat(7, 1fr)" }}
                    >
                      <div className="p-2 text-xs text-muted-foreground border-r">
                        {hourLabel(hour)}
                      </div>
                      {days.map((d) => {
                        const dateISO = formatDateISO(d);
                        const e = cellMap.get(`${dateISO}|${hour}`);
                        const sh = e ? Math.floor(parseHM(e.start_time)) : null;
                        const showLabel = e && sh === hour;
                        return (
                          <button
                            type="button"
                            key={dateISO + hour}
                            onClick={() => onCellClick(dateISO, hour)}
                            className={
                              "h-12 border-l text-left text-xs px-1.5 py-1 transition-colors " +
                              cellClass(e)
                            }
                          >
                            {showLabel && (
                              <div className="truncate font-medium flex items-center gap-1">
                                <span className="truncate">
                                  {e!.entry_type === "blocat"
                                    ? (e!.reason ?? "Blocat")
                                    : (e!.renter_name ?? e!.reference ?? "Rezervare")}
                                </span>
                                {e!.recurrence_id && (
                                  <span className="text-[9px] leading-none" title="Rezervare recurentă">
                                    ↻
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
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
                    const stats = dayStats.get(dateISO);
                    const hasBookings = (stats?.bookings ?? 0) > 0;
                    const hasBlocks = (stats?.blocks ?? 0) > 0;
                    return (
                      <button
                        type="button"
                        key={dateISO}
                        onClick={() => {
                          setView("week");
                          setWeekStart(startOfWeek(d));
                        }}
                        className={
                          "min-h-[72px] border-l border-t -ml-px -mt-px text-left p-2 text-xs transition-colors " +
                          (inMonth ? "" : "bg-muted/30 text-muted-foreground ") +
                          (hasBookings ? "bg-primary/15 hover:bg-primary/25 " : "hover:bg-muted/60 ") +
                          (hasBlocks ? "ring-2 ring-orange-300 ring-inset " : "") +
                          (isToday ? "outline outline-2 outline-primary " : "")
                        }
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-semibold">{d.getDate()}</span>
                        </div>
                        {hasBookings && (
                          <div className="mt-1 text-[11px]">
                            {stats!.bookings}{" "}
                            {stats!.bookings === 1 ? "rezervare" : "rezervări"}
                          </div>
                        )}
                        {hasBlocks && (
                          <div className="text-[11px] text-orange-700">
                            {stats!.blocks} blocat
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
              <LegendDot className="bg-primary/30" label="Confirmată" />
              <LegendDot className="bg-orange-200/80" label="În așteptare" />
              <LegendDot
                className="bg-[repeating-linear-gradient(45deg,hsl(var(--muted))_0,hsl(var(--muted))_4px,hsl(var(--muted-foreground)/0.25)_4px,hsl(var(--muted-foreground)/0.25)_8px)]"
                label="Blocat de proprietar"
              />
              <LegendDot className="bg-muted/70" label="Finalizată" />
            </div>
          </>
        )}
      </div>

      <Dialog
        open={selected?.kind === "booking"}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent>
          {selected?.kind === "booking" && (
            <BookingDetails
              entry={selected.entry}
              onClose={() => setSelected(null)}
              onChanged={loadEntries}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selected?.kind === "block"}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent>
          {selected?.kind === "block" && (
            <BlockDetails
              entry={selected.entry}
              onClose={() => setSelected(null)}
              onChanged={loadEntries}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!cellModal}
        onOpenChange={(o) => !o && setCellModal(null)}
      >
        <DialogContent>
          {cellModal?.mode === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle>Ce vrei să faci?</DialogTitle>
                <DialogDescription>
                  {formatDateRO(parseISODate(cellModal.date))} ·{" "}
                  {cellModal.hour.toString().padStart(2, "0")}:00
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <button
                  type="button"
                  onClick={() => setCellModal({ ...cellModal, mode: "booking" })}
                  className="flex items-start gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-left hover:border-primary transition w-full"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <CalendarPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">Adaugă rezervare</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Rezervă în numele unui client (telefon, email, mesaj)
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCellModal({ ...cellModal, mode: "block" })}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left hover:bg-muted/40 transition w-full"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground shrink-0">
                    <Ban className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">Blochează interval</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Marchează ca indisponibil (curs privat, renovare etc.)
                    </div>
                  </div>
                </button>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCellModal(null)}>
                  Anulează
                </Button>
              </DialogFooter>
            </>
          )}

          {cellModal?.mode === "block" && (
            <BlockSlotForm
              roomId={id}
              date={cellModal.date}
              startHour={cellModal.hour}
              onClose={() => setCellModal(null)}
              onChanged={loadEntries}
            />
          )}

          {cellModal?.mode === "booking" && (
            <ManualBookingForm
              roomId={id}
              date={cellModal.date}
              pricingRules={pricingRules}
              manualStart={manualStart}
              manualEnd={manualEnd}
              manualName={manualName}
              manualPhone={manualPhone}
              manualEmail={manualEmail}
              manualNote={manualNote}
              manualPaymentStatus={manualPaymentStatus}
              manualError={manualError}
              manualSubmitting={manualSubmitting}
              setManualStart={setManualStart}
              setManualEnd={setManualEnd}
              setManualName={setManualName}
              setManualPhone={setManualPhone}
              setManualEmail={setManualEmail}
              setManualNote={setManualNote}
              setManualPaymentStatus={setManualPaymentStatus}
              setManualError={setManualError}
              setManualSubmitting={setManualSubmitting}
              onClose={() => setCellModal(null)}
              onChanged={loadEntries}
            />
          )}
        </DialogContent>
      </Dialog>
    </OwnerLayout>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={"inline-block h-3 w-3 rounded-sm border " + className} />
      {label}
    </span>
  );
}

function BookingDetails({
  entry,
  onClose,
  onChanged,
}: {
  entry: Entry;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<Entry>(entry);
  const [editingTime, setEditingTime] = useState(false);
  const [newStartHour, setNewStartHour] = useState(entry.start_time.slice(0, 5));
  const [newEndHour, setNewEndHour] = useState(entry.end_time.slice(0, 5));
  const [nota, setNota] = useState("");

  const [recurrenceInfo, setRecurrenceInfo] = useState<{
    total: number;
    index: number;
    id: string;
  } | null>(null);

  // Fetch full booking row (price_per_hour, discount_amount, renter_notes)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, start_time, end_time, duration_hours, subtotal, total_amount, price_per_hour, discount_amount, renter_notes, payment_status, status, recurrence_id, recurrence_index",
        )
        .eq("id", entry.id)
        .single();
      if (cancelled || !data) return;
      const merged = { ...entry, ...data } as Entry;
      setDetails(merged);
      setNewStartHour(merged.start_time.slice(0, 5));
      setNewEndHour(merged.end_time.slice(0, 5));
      setNota(merged.renter_notes ?? "");

      if (merged.recurrence_id) {
        const { data: rec } = await supabase
          .from("recurrences")
          .select("id, total_bookings")
          .eq("id", merged.recurrence_id)
          .single();
        if (cancelled) return;
        if (rec) {
          setRecurrenceInfo({
            total: (rec as { total_bookings: number }).total_bookings,
            index: merged.recurrence_index ?? 1,
            id: (rec as { id: string }).id,
          });
        }
      } else {
        setRecurrenceInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const hourOptions = Array.from(
    { length: HOUR_END - HOUR_START + 1 },
    (_, i) => HOUR_START + i,
  );

  async function saveTime() {
    const sh = parseInt(newStartHour, 10);
    const eh = parseInt(newEndHour, 10);
    if (eh <= sh) return toast.error("Ora de sfârșit trebuie să fie după start.");
    const newDuration = eh - sh;
    const pph = details.price_per_hour ?? 0;
    const disc = details.discount_amount ?? 0;
    const newSubtotal = pph * newDuration;
    setBusy(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        start_time: `${newStartHour}:00`,
        end_time: `${newEndHour}:00`,
        duration_hours: newDuration,
        subtotal: newSubtotal,
        total_amount: newSubtotal - disc,
      })
      .eq("id", entry.id);
    setBusy(false);
    if (error) {
      console.error(error);
      return toast.error(error.message || "Eroare la salvare interval");
    }
    toast.success("Salvat cu succes.");
    setEditingTime(false);
    onChanged();
    onClose();
  }

  async function togglePayment() {
    const next = details.payment_status === "platit" ? "neplatit" : "platit";
    setBusy(true);
    const { error } = await supabase
      .from("bookings")
      .update({ payment_status: next })
      .eq("id", entry.id);
    setBusy(false);
    if (error) return toast.error("Eroare la actualizare plată");
    setDetails((d) => ({ ...d, payment_status: next }));
    toast.success("Salvat cu succes.");
    onChanged();
  }

  async function saveNote() {
    setBusy(true);
    const { error } = await supabase
      .from("bookings")
      .update({ renter_notes: nota })
      .eq("id", entry.id);
    setBusy(false);
    if (error) return toast.error("Eroare la salvarea notei");
    toast.success("Salvat cu succes.");
    onChanged();
  }

  async function cancelBooking(cancelAll: boolean) {
    const message = cancelAll && recurrenceInfo
      ? `Sigur vrei să anulezi TOATE cele ${recurrenceInfo.total} apariții ale acestei rezervări recurente?`
      : "Sigur vrei să anulezi această rezervare?";
    if (!confirm(message)) return;
    setBusy(true);
    let error;
    if (cancelAll && recurrenceInfo) {
      ({ error } = await supabase
        .from("bookings")
        .update({ status: "anulată" })
        .eq("recurrence_id", recurrenceInfo.id)
        .in("status", ["în așteptare", "confirmată"]));
    } else {
      ({ error } = await supabase
        .from("bookings")
        .update({ status: "anulată" })
        .eq("id", entry.id));
    }
    setBusy(false);
    if (error) {
      console.error("Cancel error:", error);
      return toast.error("Eroare la anulare");
    }
    toast.success(cancelAll ? "Toate aparițiile au fost anulate" : "Rezervare anulată");
    onChanged();
    onClose();
  }

  const isPaid = details.payment_status === "platit";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Detalii rezervare</DialogTitle>
        <DialogDescription>
          {details.booking_date} · {details.start_time?.slice(0, 5)}–
          {details.end_time?.slice(0, 5)}
        </DialogDescription>
      </DialogHeader>
      {recurrenceInfo && (
        <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm">
          <div className="font-medium text-primary">
            Rezervare recurentă · apariția {recurrenceInfo.index} din {recurrenceInfo.total}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Săptămânal, același interval
          </div>
        </div>
      )}
      <div className="space-y-2 text-sm">
        <Row label="Chiriaș" value={details.renter_name ?? "—"} />
        <Row label="Email" value={details.renter_email ?? "—"} />
        <Row label="Telefon" value={details.renter_phone ?? "—"} />
        <Row label="Referință" value={details.reference ?? details.id.slice(0, 8)} />
        <Row label="Status" value={details.status ?? "—"} />
        <Row label="Plată" value={details.payment_status ?? "—"} />
        {details.total_amount != null && (
          <Row label="Total" value={`${details.total_amount} RON`} />
        )}
      </div>

      {editingTime && (
        <div className="border rounded-md p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Ora start</Label>
              <select
                value={newStartHour}
                onChange={(e) => setNewStartHour(e.target.value)}
                className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              >
                {hourOptions.slice(0, -1).map((h) => {
                  const v = `${String(h).padStart(2, "0")}:00`;
                  return (
                    <option key={h} value={v}>
                      {v}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ora final</Label>
              <select
                value={newEndHour}
                onChange={(e) => setNewEndHour(e.target.value)}
                className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              >
                {hourOptions.slice(1).map((h) => {
                  const v = `${String(h).padStart(2, "0")}:00`;
                  return (
                    <option key={h} value={v}>
                      {v}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingTime(false)}
              disabled={busy}
            >
              Renunță
            </Button>
            <Button size="sm" onClick={saveTime} disabled={busy}>
              Salvează interval
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs" htmlFor="nota">
          Notă internă
        </Label>
        <div className="flex gap-2">
          <Input
            id="nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Notă vizibilă doar pentru tine"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={saveNote}
            disabled={busy}
          >
            Salvează nota
          </Button>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-between flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setEditingTime((v) => !v)}
            disabled={busy}
          >
            {editingTime ? "Ascunde editor" : "Modifică intervalul"}
          </Button>
          {isPaid ? (
            <Button variant="outline" onClick={togglePayment} disabled={busy}>
              Marchează ca neplatit
            </Button>
          ) : (
            <Button
              onClick={togglePayment}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Marchează ca plătit
            </Button>
          )}
          {details.status !== "anulată" && (
            recurrenceInfo ? (
              <>
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => cancelBooking(false)}
                  disabled={busy}
                >
                  Anulează doar această apariție
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => cancelBooking(true)}
                  disabled={busy}
                >
                  Anulează TOATE aparițiile ({recurrenceInfo.total})
                </Button>
              </>
            ) : (
              <Button variant="destructive" onClick={() => cancelBooking(false)} disabled={busy}>
                Anulează rezervarea
              </Button>
            )
          )}
        </div>
        <Button variant="outline" onClick={onClose}>
          Închide
        </Button>
      </DialogFooter>
    </>
  );
}

function BlockDetails({
  entry,
  onClose,
  onChanged,
}: {
  entry: Entry;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function unblock() {
    setBusy(true);
    const { error } = await supabase.rpc("unblock_slot", { p_booking_id: entry.id });
    setBusy(false);
    if (error) return toast.error("Eroare la deblocare");
    toast.success("Slot deblocat");
    onChanged();
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Interval blocat</DialogTitle>
        <DialogDescription>
          {entry.booking_date} · {entry.start_time?.slice(0, 5)}–{entry.end_time?.slice(0, 5)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2 text-sm">
        <Row label="Motiv" value={entry.reason ?? "—"} />
      </div>
      <DialogFooter className="gap-2">
        <Button onClick={unblock} disabled={busy}>
          Deblochează
        </Button>
        <Button variant="outline" onClick={onClose}>
          Închide
        </Button>
      </DialogFooter>
    </>
  );
}

function BlockSlotForm({
  roomId,
  date,
  startHour,
  onClose,
  onChanged,
}: {
  roomId: string;
  date: string;
  startHour: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const initialStart = Math.min(Math.max(startHour, HOUR_START), HOUR_END - 1);
  const [start, setStart] = useState(`${String(initialStart).padStart(2, "0")}:00`);
  const [end, setEnd] = useState(
    `${String(Math.min(initialStart + 1, HOUR_END)).padStart(2, "0")}:00`,
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const startHours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i,
  );
  const endHours = Array.from(
    { length: HOUR_END - HOUR_START + 1 },
    (_, i) => HOUR_START + 1 + i,
  ).filter((h) => h <= HOUR_END);

  async function submit() {
    setBlockError(null);
    if (parseInt(end, 10) <= parseInt(start, 10)) {
      setBlockError("Ora de sfârșit trebuie să fie după ora de început.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("block_slot", {
      p_room_id: roomId,
      p_date: date,
      p_start_time: start,
      p_end_time: end,
      p_reason: reason || "Rezervat de proprietar",
    });
    setBusy(false);
    if (error) {
      console.error("block_slot error:", error);
      if (error.code === "23P01") {
        setBlockError("Acest interval se suprapune cu o rezervare existentă.");
      } else {
        setBlockError(error.message || "Eroare la blocare.");
      }
      return;
    }
    toast.success("Interval blocat");
    onChanged();
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Blochează interval</DialogTitle>
        <DialogDescription>{date}</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="start">Ora start</Label>
          <select
            id="start"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full border rounded-md h-9 px-2 text-sm bg-background"
          >
            {startHours.map((h) => {
              const v = `${String(h).padStart(2, "0")}:00`;
              return (
                <option key={h} value={v}>
                  {v}
                </option>
              );
            })}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="end">Ora final</Label>
          <select
            id="end"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full border rounded-md h-9 px-2 text-sm bg-background"
          >
            {endHours.map((h) => {
              const v = `${String(h).padStart(2, "0")}:00`;
              return (
                <option key={h} value={v}>
                  {v}
                </option>
              );
            })}
          </select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor="reason">Motiv (opțional)</Label>
          <Input
            id="reason"
            placeholder="ex: Curs privat"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {blockError && (
          <div className="col-span-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {blockError}
          </div>
        )}
      </div>
      <DialogFooter className="gap-2">
        <Button onClick={submit} disabled={busy}>
          Blochează
        </Button>
        <Button variant="outline" onClick={onClose}>
          Anulează
        </Button>
      </DialogFooter>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}

function ManualBookingForm({
  roomId,
  date,
  pricingRules,
  manualStart,
  manualEnd,
  manualName,
  manualPhone,
  manualEmail,
  manualNote,
  manualPaymentStatus,
  manualError,
  manualSubmitting,
  setManualStart,
  setManualEnd,
  setManualName,
  setManualPhone,
  setManualEmail,
  setManualNote,
  setManualPaymentStatus,
  setManualError,
  setManualSubmitting,
  onClose,
  onChanged,
}: {
  roomId: string;
  date: string;
  pricingRules: PricingRule[];
  manualStart: string;
  manualEnd: string;
  manualName: string;
  manualPhone: string;
  manualEmail: string;
  manualNote: string;
  manualPaymentStatus: string;
  manualError: string | null;
  manualSubmitting: boolean;
  setManualStart: (v: string) => void;
  setManualEnd: (v: string) => void;
  setManualName: (v: string) => void;
  setManualPhone: (v: string) => void;
  setManualEmail: (v: string) => void;
  setManualNote: (v: string) => void;
  setManualPaymentStatus: (v: string) => void;
  setManualError: (v: string | null) => void;
  setManualSubmitting: (v: boolean) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const startHours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i,
  );
  const endHours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + 1 + i,
  );

  const sH = parseInt(manualStart, 10);
  const eH = parseInt(manualEnd, 10);
  const validRange = eH > sH;
  const duration = validRange ? eH - sH : 0;
  const pricePerHour = calculatePriceForDate(date, manualStart.slice(0, 2), pricingRules);
  const total = duration * pricePerHour;

  async function handleManualBooking() {
    if (!manualName.trim()) {
      setManualError("Completează numele clientului.");
      return;
    }
    if (!manualPhone.trim()) {
      setManualError("Completează telefonul.");
      return;
    }
    if (!validRange) {
      setManualError("Ora de sfârșit trebuie să fie după ora de început.");
      return;
    }

    setManualSubmitting(true);
    setManualError(null);

    const startTime = `${manualStart}:00`;
    const endTime = `${manualEnd}:00`;

    const { error } = await supabase.from("bookings").insert({
      room_id: roomId,
      guest_name: manualName.trim(),
      guest_email: manualEmail.trim() || `noemail+${Date.now()}@rezervari.intern`,
      guest_phone: manualPhone.trim(),
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
      duration_hours: duration,
      price_per_hour: pricePerHour,
      subtotal: total,
      discount_amount: 0,
      total_amount: total,
      status: "confirmată",
      payment_method: "la_sala",
      payment_status: manualPaymentStatus,
      renter_notes: manualNote.trim() || null,
    });

    setManualSubmitting(false);

    if (error) {
      if (error.code === "23P01") {
        setManualError("Intervalul se suprapune cu o rezervare existentă.");
      } else {
        setManualError("Eroare: " + error.message);
      }
      return;
    }

    toast.success("Rezervare adăugată");
    onChanged();
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rezervare nouă</DialogTitle>
        <DialogDescription>{formatDateRO(parseISODate(date))}</DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Ora start</Label>
            <select
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              className="w-full rounded-md border border-border h-9 px-2 text-sm bg-background"
            >
              {startHours.map((h) => {
                const v = `${String(h).padStart(2, "0")}:00`;
                return (
                  <option key={h} value={v}>
                    {v}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ora final</Label>
            <select
              value={manualEnd}
              onChange={(e) => setManualEnd(e.target.value)}
              className="w-full rounded-md border border-border h-9 px-2 text-sm bg-background"
            >
              {endHours.map((h) => {
                const v = `${String(h).padStart(2, "0")}:00`;
                return (
                  <option key={h} value={v}>
                    {v}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Nume client *</Label>
          <Input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="ex: Ana Ionescu"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Telefon *</Label>
          <Input
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
            placeholder="07xxxxxxxx"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Email (opțional)</Label>
          <Input
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder="client@email.ro"
          />
        </div>

        {validRange && (
          <div className="rounded-md bg-muted/40 border border-border p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Durată</span>
              <span className="font-medium">{duration} ore</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preț/oră</span>
              <span className="font-medium">{pricePerHour} RON</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{total} RON</span>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Status plată</Label>
          <select
            value={manualPaymentStatus}
            onChange={(e) => setManualPaymentStatus(e.target.value)}
            className="w-full rounded-md border border-border h-9 px-2 text-sm bg-background"
          >
            <option value="neplatit">Neplatit</option>
            <option value="platit">Plătit</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notă (opțional)</Label>
          <Input
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="ex: A sunat joi seara"
          />
        </div>

        {manualError && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {manualError}
          </div>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} disabled={manualSubmitting}>
          Anulează
        </Button>
        <Button onClick={handleManualBooking} disabled={manualSubmitting}>
          {manualSubmitting ? "Se salvează..." : "Confirmă rezervarea"}
        </Button>
      </DialogFooter>
    </>
  );
}
