import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/external-client";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, CalendarPlus, Ban, ChevronDown, Check, Repeat, CalendarIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
  startOfWeek,
} from "@/lib/date-utils";
import {
  SLOT_GRANULARITY_MINUTES,
  timeToMinutes,
  minutesToTime,
  slotDurationMinutes,
} from "@/lib/time-slots";
import { ClientSelect } from "@/components/clients/ClientSelect";
import { LinkedBadge } from "@/components/clients/LinkedBadge";

function AttachedClientDisplay({ bookingId }: { bookingId: string }) {
  const [client, setClient] = useState<{
    name: string;
    phone: string | null;
    linked_user_id: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: booking } = (await supabase
        .from("bookings")
        .select("owner_client_id")
        .eq("id", bookingId)
        .maybeSingle()) as { data: { owner_client_id: string | null } | null };

      if (cancelled) return;

      if (!booking?.owner_client_id) {
        setLoading(false);
        return;
      }

      const { data: clientData } = (await supabase
        .from("clients")
        .select("name, phone, linked_user_id")
        .eq("id", booking.owner_client_id)
        .maybeSingle()) as {
        data: { name: string; phone: string | null; linked_user_id: string | null } | null;
      };

      if (cancelled) return;

      if (clientData) setClient(clientData);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (loading || !client) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Client atribuit
      </div>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{client.name}</span>
        {client.linked_user_id && <LinkedBadge />}
      </div>
      {client.phone && (
        <div className="text-xs text-muted-foreground">{client.phone}</div>
      )}
    </div>
  );
}

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

export const Route = createFileRoute("/panou/sali/$id/calendar")({
  component: RoomCalendarPage,
});

const HOUR_START = 7;
const HOUR_END = 23; // last slot starts at HOUR_END - 0.5h
const SLOT_ROWS = Array.from(
  { length: (HOUR_END - HOUR_START) * (60 / SLOT_GRANULARITY_MINUTES) },
  (_, i) => minutesToTime(HOUR_START * 60 + i * SLOT_GRANULARITY_MINUTES),
);
// Inclusive bounds for start/end time pickers (07:00 .. 23:00)
const TIME_OPTIONS = Array.from(
  { length: (HOUR_END - HOUR_START) * (60 / SLOT_GRANULARITY_MINUTES) + 1 },
  (_, i) => minutesToTime(HOUR_START * 60 + i * SLOT_GRANULARITY_MINUTES),
);

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
  duration_minutes?: number | null;
  renter_notes?: string | null;
  recurrence_id?: string | null;
  recurrence_index?: number | null;
  is_recurring?: boolean | null;
};

function blockNotePreview(notes?: string | null): string | null {
  if (!notes) return null;
  const t = notes.trim();
  if (!t || t === "Rezervat de proprietar") return null;
  const words = t.split(/\s+/);
  if (words.length <= 2) return words.join(" ");
  return words.slice(0, 2).join(" ") + "...";
}


function EntryTooltipCard({ e }: { e: Entry }) {
  const start = e.start_time?.slice(0, 5) ?? "";
  const end = e.end_time?.slice(0, 5) ?? "";
  if (e.entry_type === "blocat") {
    const note = (e.renter_notes ?? e.reason ?? "").trim();
    return (
      <div className="space-y-0.5 text-xs">
        <div className="font-medium">Blocat</div>
        <div className="text-muted-foreground">{start}–{end}</div>
        {note && <div className="text-muted-foreground">{note}</div>}
      </div>
    );
  }
  const durationMin = start && end ? slotDurationMinutes(start, end) : 0;
  const payment =
    e.payment_status === "platit"
      ? "plătit"
      : e.payment_status === "neplatit"
        ? "neplătit"
        : (e.payment_status ?? "—");
  return (
    <div className="space-y-1 text-xs min-w-[180px]">
      <div className="font-medium truncate">
        {e.renter_name ?? e.reference ?? "Rezervare"}
      </div>
      <div className="text-muted-foreground">
        {start}–{end} · {formatDurationRO(durationMin)}
      </div>
      {e.total_amount != null && e.total_amount > 0 && (
        <div>
          Total: <span className="font-medium">{e.total_amount} RON</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1 pt-0.5">
        {e.status && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border">
            {e.status}
          </span>
        )}
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border">
          {payment}
        </span>
      </div>
      {e.recurrence_id && (
        <div className="text-muted-foreground pt-0.5">Rezervare recurentă</div>
      )}
    </div>
  );
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

function formatDurationRO(minutes: number): string {
  if (minutes <= 0) return "0 minute";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minute`;
  const hourWord = hours === 1 ? "oră" : "ore";
  if (mins === 0) return `${hours} ${hourWord}`;
  return `${hours} ${hourWord} și ${mins} minute`;
}

function generateWeeklyDates(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const end = parseISODate(endDateStr);
  let current = parseISODate(startDateStr);
  while (current <= end) {
    dates.push(formatDateISO(current));
    current = addDays(current, 7);
  }
  return dates;
}

// Weekly dates from startDate through the end of (startMonth + 3 full months).
// Includes the start date itself. Mirrors the renter horizon logic.
function generateWeeklyDatesHorizonISO(startDateStr: string): string[] {
  const start = parseISODate(startDateStr);
  const horizon = new Date(start.getFullYear(), start.getMonth() + 4, 0);
  const dates: string[] = [];
  let current = start;
  while (current <= horizon) {
    dates.push(formatDateISO(current));
    current = addDays(current, 7);
  }
  return dates;
}

function formatShortRO(dateISO: string): string {
  const d = parseISODate(dateISO);
  return `${d.getDate()} ${MONTH_NAMES_RO[d.getMonth()].slice(0, 3)}`;
}

// Returns true if a slot (date + start time HH:MM) is in the past relative to now.
function isSlotInPast(dateISO: string, startHHMM: string): boolean {
  const d = parseISODate(dateISO);
  const [h, m] = startHHMM.split(":").map((n) => parseInt(n, 10));
  d.setHours(h, m || 0, 0, 0);
  return d.getTime() < Date.now();
}

// Returns dates (ISO) from `dates` whose start time is in the past.
function pastDates(dates: string[], startHHMM: string): string[] {
  return dates.filter((d) => isSlotInPast(d, startHHMM));
}

function RoomCalendarPage() {
  const { id } = useParams({ from: "/panou/sali/$id/calendar" });
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day" | "week" | "month">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) return "day";
    return "week";
  });
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Auto-switch from week to day on small screens
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1024 && view === "week") {
        setView("day");
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [view]);
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
    slotStart: string; // "HH:MM"
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
  const [manualOwnerClientId, setManualOwnerClientId] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  async function handleManualClientChange(newClientId: string | null) {
    setManualOwnerClientId(newClientId);
    if (newClientId === null) {
      setManualName("");
      setManualPhone("");
      setManualEmail("");
      return;
    }
    const { data, error } = await supabase
      .from("clients")
      .select("name, phone, email")
      .eq("id", newClientId)
      .maybeSingle();
    if (error || !data) {
      toast.error("Nu am putut prelua datele clientului.");
      return;
    }
    setManualName((data as { name: string | null }).name ?? "");
    setManualPhone((data as { phone: string | null }).phone ?? "");
    setManualEmail((data as { email: string | null }).email ?? "");
  }

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Load entries — range depends on view
  const loadEntries = useCallback(async () => {
    let startISO: string;
    let endISO: string;
    if (view === "day") {
      startISO = formatDateISO(selectedDay);
      endISO = startISO;
    } else if (view === "week") {
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
  }, [id, view, weekStart, monthAnchor, selectedDay]);

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
        navigate({ to: "/panou/sali" });
        return;
      }
      if (r.owner_id !== user.id) {
        navigate({ to: "/panou/sali" });
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

  // Map (dateISO|HH:MM) -> entry, one entry per 30-min slot it covers
  const cellMap = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const e of entries) {
      const startMin = timeToMinutes(e.start_time);
      const endMin = timeToMinutes(e.end_time);
      for (let m = startMin; m < endMin; m += SLOT_GRANULARITY_MINUTES) {
        map.set(`${e.booking_date}|${minutesToTime(m)}`, e);
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

  // Per-day sorted entries for month view chips
  const entriesByDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const arr = m.get(e.booking_date) ?? [];
      arr.push(e);
      m.set(e.booking_date, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return m;
  }, [entries]);

  function onCellClick(dateISO: string, slotStart: string) {
    const e = cellMap.get(`${dateISO}|${slotStart}`);
    if (!e) {
      const startMin = timeToMinutes(slotStart);
      const endMin = Math.min(startMin + SLOT_GRANULARITY_MINUTES, HOUR_END * 60);
      setManualStart(slotStart);
      setManualEnd(minutesToTime(endMin));
      setManualName("");
      setManualPhone("");
      setManualEmail("");
      setManualNote("");
      setManualPaymentStatus("neplatit");
      setManualOwnerClientId(null);
      setManualError(null);
      setCellModal({ date: dateISO, slotStart, mode: "choose" });
      return;
    }
    if (e.entry_type === "blocat") setSelected({ kind: "block", entry: e });
    else setSelected({ kind: "booking", entry: e });
  }

  function cellClass(e: Entry | undefined): string {
    if (!e) return "bg-background hover:bg-muted/60 cursor-pointer";
    if (e.entry_type === "blocat") {
      if (e.recurrence_id) {
        return "bg-sky-100 text-sky-950 border-sky-300 cursor-pointer dark:bg-sky-950/40 dark:text-sky-100";
      }
      return "bg-muted text-foreground cursor-pointer";
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
    view === "day"
      ? `${DAY_NAMES_RO[getDayOfWeek(selectedDay)]}, ${selectedDay.getDate()} ${MONTH_NAMES_RO[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`
      : view === "week"
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
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 group"
                >
                  <h1 className="text-xl md:text-2xl font-semibold group-hover:text-primary transition">
                    {room.name}
                  </h1>
                  {allRooms.length > 1 && (
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition ${
                        dropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>
                <p className="text-sm text-muted-foreground">
                  Calendar {view === "day" ? "zilnic" : view === "week" ? "săptămânal" : "lunar"}
                </p>

                {dropdownOpen && allRooms.length > 1 && (
                  <div className="absolute left-0 top-full mt-2 w-64 bg-card border rounded-xl shadow-lg z-20 overflow-hidden">
                    {allRooms.map((r) => (
                      <a
                        key={r.id}
                        href={`/panou/sali/${r.id}/calendar`}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm transition ${
                          r.id === id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-muted/40 hover:text-primary"
                        }`}
                        onClick={() => setDropdownOpen(false)}
                      >
                        {r.id === id ? (
                          <Check className="h-4 w-4 shrink-0" />
                        ) : (
                          <span className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{r.name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (view === "day") setSelectedDay((d) => addDays(d, -1));
                    else if (view === "week") setWeekStart((w) => addDays(w, -7));
                    else
                      setMonthAnchor(
                        (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                      );
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">
                    {view === "day" ? "Ziua trecută" : view === "week" ? "Săptămâna trecută" : "Luna trecută"}
                  </span>
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
                    if (view === "day") setSelectedDay((d) => addDays(d, 1));
                    else if (view === "week") setWeekStart((w) => addDays(w, 7));
                    else
                      setMonthAnchor(
                        (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                      );
                  }}
                >
                  <span className="hidden sm:inline">
                    {view === "day" ? "Ziua viitoare" : view === "week" ? "Săptămâna viitoare" : "Luna viitoare"}
                  </span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    setSelectedDay(today);
                    setWeekStart(startOfWeek(today));
                    setMonthAnchor(startOfMonth(today));
                  }}
                >
                  Astăzi
                </Button>
              </div>
            </div>

            {/* Desktop: Săptămână / Lună */}
            <div className="hidden lg:inline-flex rounded-md border bg-card p-1 text-sm">
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

            {/* Mobile: Zi / Săptămână / Lună */}
            <div className="inline-flex lg:hidden rounded-md border bg-card p-1 text-sm">
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
                  {v === "day" ? "Zi" : v === "week" ? "Săpt." : "Lună"}
                </button>
              ))}
            </div>

            {view === "day" ? (
              <div className="border rounded-lg bg-card overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/20 text-sm font-medium capitalize">
                  {DAY_NAMES_RO[getDayOfWeek(selectedDay)]},{" "}
                  {selectedDay.getDate()} {MONTH_NAMES_RO[selectedDay.getMonth()]}
                </div>
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                {SLOT_ROWS.map((slotStart) => {
                  const dateISO = formatDateISO(selectedDay);
                  const e = cellMap.get(`${dateISO}|${slotStart}`);
                  const showLabel = e && e.start_time.slice(0, 5) === slotStart;
                  const isHalfHour = slotStart.endsWith(":30");
                  return (
                    <button
                      type="button"
                      key={slotStart}
                      onClick={() => onCellClick(dateISO, slotStart)}
                      className={
                        "flex w-full border-b last:border-b-0 min-h-[28px] text-left transition-colors " +
                        (isHalfHour ? "" : "border-dashed ") +
                        cellClass(e)
                      }
                    >
                      <div className={
                        "w-16 shrink-0 flex items-start justify-end pr-3 pt-1 border-r bg-muted/10 " +
                        (isHalfHour ? "text-[10px] text-muted-foreground/60" : "text-xs text-muted-foreground")
                      }>
                        {isHalfHour ? ":30" : slotStart}
                      </div>
                      <div className="flex-1 px-3 py-1 text-sm">
                        {showLabel && (
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate flex items-center gap-1">
                                <span className="truncate">
                                  {e!.entry_type === "blocat"
                                    ? "Blocat"
                                    : (e!.renter_name ?? e!.reference ?? "Rezervare")}
                                </span>
                                {e!.recurrence_id && e!.entry_type === "blocat" && (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-[10px] px-1 py-px rounded bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-50"
                                    title="Blocare recurentă (săptămânală)"
                                  >
                                    <Repeat className="h-2.5 w-2.5" />
                                    recurent
                                  </span>
                                )}
                                {e!.recurrence_id && e!.entry_type !== "blocat" && (
                                  <span className="text-[10px]" title="Rezervare recurentă">↻</span>
                                )}
                              </div>
                              {e!.entry_type === "blocat" && blockNotePreview(e!.renter_notes) && (
                                <div className="text-[11px] text-muted-foreground truncate overflow-hidden text-ellipsis whitespace-nowrap">
                                  {blockNotePreview(e!.renter_notes)}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {e!.start_time?.slice(0, 5)}–{e!.end_time?.slice(0, 5)}
                                {e!.entry_type !== "blocat" &&
                                  e!.total_amount != null &&
                                  e!.total_amount > 0 &&
                                  ` · ${e!.total_amount} RON`}
                              </div>
                            </div>
                            {e!.entry_type !== "blocat" && e!.status && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0">
                                {e!.status}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
            ) : view === "week" ? (
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

                  <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                  {SLOT_ROWS.map((slotStart) => {
                    const isHalfHour = slotStart.endsWith(":30");
                    return (
                    <div
                      key={slotStart}
                      className={
                        "grid border-b last:border-b-0 " +
                        (isHalfHour ? "" : "border-dashed")
                      }
                      style={{ gridTemplateColumns: "70px repeat(7, 1fr)" }}
                    >
                      <div className={
                        "p-1 border-r " +
                        (isHalfHour ? "text-[10px] text-muted-foreground/60" : "text-xs text-muted-foreground")
                      }>
                        {isHalfHour ? ":30" : slotStart}
                      </div>
                      {days.map((d) => {
                        const dateISO = formatDateISO(d);
                        const e = cellMap.get(`${dateISO}|${slotStart}`);
                        const showLabel = e && e.start_time.slice(0, 5) === slotStart;
                        return (
                          <button
                            type="button"
                            key={dateISO + slotStart}
                            onClick={() => onCellClick(dateISO, slotStart)}
                            className={
                              "h-7 border-l text-left text-xs px-1.5 py-0.5 transition-colors " +
                              cellClass(e)
                            }
                          >
                            {showLabel && (
                              <>
                                <div className="truncate font-medium flex items-center gap-1">
                                  <span className="truncate">
                                    {e!.entry_type === "blocat"
                                      ? "Blocat"
                                      : (e!.renter_name ?? e!.reference ?? "Rezervare")}
                                  </span>
                                  {e!.recurrence_id && e!.entry_type === "blocat" && (
                                    <Repeat
                                      className="h-3 w-3 text-sky-700 dark:text-sky-300 shrink-0"
                                      aria-label="Blocare recurentă"
                                    />
                                  )}
                                  {e!.recurrence_id && e!.entry_type !== "blocat" && (
                                    <span className="text-[9px] leading-none" title="Rezervare recurentă">
                                      ↻
                                    </span>
                                  )}
                                </div>
                                {e!.entry_type === "blocat" && blockNotePreview(e!.renter_notes) && (
                                  <div className="text-[10px] text-muted-foreground truncate overflow-hidden text-ellipsis whitespace-nowrap leading-tight">
                                    {blockNotePreview(e!.renter_notes)}
                                  </div>
                                )}
                              </>
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
                <TooltipProvider delayDuration={150}>
                <div className="grid grid-cols-7">
                  {monthCells.map((d) => {
                    const dateISO = formatDateISO(d);
                    const inMonth = d.getMonth() === monthAnchor.getMonth();
                    const isToday = dateISO === formatDateISO(new Date());
                    const stats = dayStats.get(dateISO);
                    const hasBookings = (stats?.bookings ?? 0) > 0;
                    const hasBlocks = (stats?.blocks ?? 0) > 0;
                    const dayEntries = entriesByDay.get(dateISO) ?? [];
                    const MAX_CHIPS = 3;
                    const visibleEntries = dayEntries.slice(0, MAX_CHIPS);
                    const extraCount = dayEntries.length - visibleEntries.length;
                    return (
                      <button
                        type="button"
                        key={dateISO}
                        onClick={() => {
                          if (typeof window !== "undefined" && window.innerWidth < 1024) {
                            const day = new Date(d);
                            day.setHours(0, 0, 0, 0);
                            setSelectedDay(day);
                            setView("day");
                          } else {
                            setView("week");
                            setWeekStart(startOfWeek(d));
                          }
                        }}
                        className={
                          "min-h-[72px] border-l border-t -ml-px -mt-px text-left p-2 text-xs transition-colors " +
                          (inMonth ? "" : "bg-muted/30 text-muted-foreground ") +
                          (hasBookings ? "bg-primary/15 hover:bg-primary/25 " : "hover:bg-muted/60 ") +
                          (hasBlocks && !hasBookings ? "ring-2 ring-orange-300 ring-inset " : "") +
                          (isToday ? "outline outline-2 outline-primary " : "")
                        }
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-semibold">{d.getDate()}</span>
                        </div>
                        {visibleEntries.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {visibleEntries.map((e) => {
                              const isBlock = e.entry_type === "blocat";
                              const label = isBlock
                                ? "Blocat"
                                : (e.renter_name ?? e.reference ?? "Rezervare");
                              const chipClass = isBlock
                                ? "bg-muted text-foreground"
                                : e.status === "confirmată"
                                  ? "bg-primary/30 text-foreground"
                                  : e.status === "în așteptare"
                                    ? "bg-orange-200/80 text-orange-950"
                                    : e.status === "anulată" || e.status === "refuzată"
                                      ? "bg-destructive/15 text-destructive"
                                      : "bg-secondary text-secondary-foreground";
                              return (
                                <Tooltip key={e.id}>
                                  <TooltipTrigger asChild>
                                    <span
                                      tabIndex={0}
                                      className={
                                        "block truncate rounded px-1 py-px text-[10px] leading-tight " +
                                        chipClass
                                      }
                                    >
                                      <span className="opacity-70 mr-1">
                                        {e.start_time.slice(0, 5)}
                                      </span>
                                      {label}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="p-2">
                                    <EntryTooltipCard e={e} />
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                            {extraCount > 0 && (
                              <div className="text-[10px] text-muted-foreground pl-1">
                                +{extraCount} încă
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                </TooltipProvider>
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
              <LegendDot className="bg-primary/30" label="Confirmată" />
              <LegendDot className="bg-orange-200/80" label="În așteptare" />
              <LegendDot className="bg-muted border border-muted-foreground/30" label="Blocat de proprietar" />
              <LegendDot className="bg-sky-100 border border-sky-300 dark:bg-sky-950/40" label="Blocat recurent" />
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
        <DialogContent className={cellModal?.mode === "choose" ? "" : "max-h-[90vh] flex flex-col p-0"}>
          {cellModal?.mode === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle>Ce vrei să faci?</DialogTitle>
                <DialogDescription>
                  {formatDateRO(parseISODate(cellModal.date))} ·{" "}
                  {cellModal.slotStart}
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
              startSlot={cellModal.slotStart}
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
              manualOwnerClientId={manualOwnerClientId}
              setManualOwnerClientId={setManualOwnerClientId}
              onClientChange={handleManualClientChange}
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
    frequency: string;
  } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelScope, setCancelScope] = useState<"this" | "future" | "suspend">("this");
  const [cancelUntilDate, setCancelUntilDate] = useState("");
  

  const [tariffOpen, setTariffOpen] = useState(false);
  const [tariffValue, setTariffValue] = useState("");
  const [tariffScope, setTariffScope] = useState<"single" | "future">("single");

  const bookingStartMs = useMemo(() => {
    if (!details.booking_date || !details.start_time) return null;
    const [y, m, d] = details.booking_date.split("-").map((n) => parseInt(n, 10));
    const [hh, mm] = details.start_time.slice(0, 5).split(":").map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d, hh, mm).getTime();
  }, [details.booking_date, details.start_time]);
  const tariffLocked = bookingStartMs != null && bookingStartMs < Date.now() + 48 * 3600 * 1000;

  // Fetch full booking row (price_per_hour, discount_amount, renter_notes)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, start_time, end_time, duration_hours, duration_minutes, subtotal, total_amount, price_per_hour, discount_amount, renter_notes, payment_status, status, recurrence_id, recurrence_index",
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
          .select("id, total_bookings, frequency")
          .eq("id", merged.recurrence_id)
          .single();
        if (cancelled) return;
        if (rec) {
          setRecurrenceInfo({
            total: (rec as { total_bookings: number }).total_bookings,
            index: merged.recurrence_index ?? 1,
            id: (rec as { id: string }).id,
            frequency: (rec as { frequency: string }).frequency,
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

  async function saveTime() {
    const durationMinutes = timeToMinutes(newEndHour) - timeToMinutes(newStartHour);
    if (durationMinutes <= 0) {
      return toast.error("Ora de sfârșit trebuie să fie după start.");
    }
    if (durationMinutes % 30 !== 0) {
      return toast.error("Durata trebuie să fie un multiplu de 30 de minute.");
    }
    const newDurationHours = durationMinutes / 60;
    const pph = details.price_per_hour ?? 0;
    const disc = details.discount_amount ?? 0;
    const newSubtotal = pph * newDurationHours;
    setBusy(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        start_time: `${newStartHour}:00`,
        end_time: `${newEndHour}:00`,
        duration_hours: newDurationHours,
        duration_minutes: durationMinutes,
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

  async function cancelSingleBooking(): Promise<boolean> {
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: entry.id,
      p_guest_email: null,
      p_owner_override: true,
    });
    if (error) {
      console.error("Cancel error:", error);
      toast.error(error.message || "Eroare la anulare");
      return false;
    }
    return true;
  }

  async function cancelSingle() {
    if (!confirm("Sigur vrei să anulezi această rezervare?")) return;
    setBusy(true);
    const ok = await cancelSingleBooking();
    setBusy(false);
    if (!ok) return;
    toast.success("Rezervare anulată");
    onChanged();
    onClose();
  }

  async function performBulkCancel() {
    if (!recurrenceInfo) return;
    setBusy(true);
    let ok = false;
    let successMsg = "";
    if (cancelScope === "this") {
      ok = await cancelSingleBooking();
      if (ok) successMsg = "Rezervare anulată";
    } else if (cancelScope === "future") {
      const { data, error } = await supabase.rpc("cancel_booking_and_future", {
        p_booking_id: entry.id,
        p_owner_override: true,
      });
      if (error) {
        toast.error(error.message);
      } else {
        ok = true;
        successMsg = typeof data === "string" ? data : "Sesiunile viitoare au fost anulate.";
      }
    } else if (cancelScope === "suspend") {
      const { data, error } = await supabase.rpc("suspend_recurrence_until", {
        p_recurrence_id: recurrenceInfo.id,
        p_until_date: cancelUntilDate,
        p_owner_override: true,
      });
      if (error) {
        toast.error(error.message);
      } else {
        ok = true;
        successMsg = typeof data === "string" ? data : "Seria a fost suspendată.";
      }
    }
    setBusy(false);
    if (ok) {
      toast.success(successMsg);
      setCancelOpen(false);
      onChanged();
      onClose();
    }
  }

  async function saveTariff() {
    const newTariff = Number(tariffValue);
    if (!Number.isFinite(newTariff) || newTariff < 0) {
      return toast.error("Tarif invalid.");
    }
    setBusy(true);
    const scope: "single" | "future" = recurrenceInfo ? tariffScope : "single";
    const { data, error } = await supabase.rpc("edit_booking_tariff", {
      p_booking_id: entry.id,
      p_new_tariff: newTariff,
      p_scope: scope,
      p_owner_override: true,
    });
    setBusy(false);
    if (error) {
      return toast.error(error.message || "Eroare la salvarea tarifului");
    }
    toast.success(typeof data === "string" ? data : "Tarif actualizat.");
    setTariffOpen(false);
    onChanged();
    onClose();
  }

  const isPaid = details.payment_status === "platit";
  const currentPph = details.price_per_hour ?? 0;
  const durationHoursForTariff = details.duration_hours ?? 0;
  const parsedTariff = Number(tariffValue);
  const tariffValid =
    tariffValue.trim() !== "" &&
    Number.isFinite(parsedTariff) &&
    parsedTariff >= 0 &&
    parsedTariff !== currentPph;

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
            Rezervare recurentă · apariția {recurrenceInfo.index}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Săptămânal, același interval
          </div>
        </div>
      )}
      <AttachedClientDisplay bookingId={entry.id} />
      <div className="space-y-2 text-sm">
        <Row label="Chiriaș" value={details.renter_name ?? "—"} />
        {details.renter_email && !details.renter_email.startsWith("noemail+") && (
          <Row label="Email" value={details.renter_email} />
        )}
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
                {TIME_OPTIONS.slice(0, -1).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ora final</Label>
              <select
                value={newEndHour}
                onChange={(e) => setNewEndHour(e.target.value)}
                className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              >
                {TIME_OPTIONS.slice(1).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      variant="secondary"
                      disabled={busy || tariffLocked}
                      onClick={() => {
                        setTariffValue(String(currentPph));
                        setTariffScope("single");
                        setTariffOpen(true);
                      }}
                    >
                      Editează tarif
                    </Button>
                  </span>
                </TooltipTrigger>
                {tariffLocked && (
                  <TooltipContent>
                    Tariful nu mai poate fi modificat cu mai puțin de 48 de ore înainte.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          {details.status !== "anulată" && (
            recurrenceInfo ? (
              <Button
                variant="destructive"
                onClick={() => {
                  setCancelScope("this");
                  setCancelUntilDate("");
                  setCancelOpen(true);
                }}
                disabled={busy}
              >
                Anulează rezervarea...
              </Button>
            ) : (
              <Button variant="destructive" onClick={cancelSingle} disabled={busy}>
                Anulează rezervarea
              </Button>
            )
          )}
        </div>
        <Button variant="outline" onClick={onClose}>
          Închide
        </Button>
      </DialogFooter>

      {recurrenceInfo && (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anulează rezervare recurentă?</DialogTitle>
              <DialogDescription>
                Această rezervare face parte dintr-o serie{" "}
                {recurrenceInfo.frequency ?? "recurentă"}. Alege ce vrei să anulezi:
              </DialogDescription>
            </DialogHeader>
            <RadioGroup
              value={cancelScope}
              onValueChange={(v) => setCancelScope(v as "this" | "future" | "suspend")}
              className="gap-3"
            >
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="this" className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Doar această apariție</div>
                  <div className="text-xs text-muted-foreground">Anulează un singur booking. Restul seriei rămâne.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="future" className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Aceasta și toate viitoarele</div>
                  <div className="text-xs text-muted-foreground">
                    Anulează această apariție și toate cele de după. Trecutul rămâne intact.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="suspend" className="mt-0.5" />
                <div className="text-sm flex-1">
                  <div className="font-medium">Suspendă până la o dată (vacanță)</div>
                  <div className="text-xs text-muted-foreground">
                    Anulezi sesiunile până la data aleasă, apoi seria continuă automat.
                  </div>
                  {cancelScope === "suspend" && (
                    <div className="pt-2 space-y-1">
                      <Label className="text-xs">Seria se reia de la data:</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !cancelUntilDate && "text-muted-foreground",
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {cancelUntilDate
                              ? format(parseISODate(cancelUntilDate), "dd.MM.yyyy")
                              : "Alege o dată"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
                          <Calendar
                            mode="single"
                            selected={cancelUntilDate ? parseISODate(cancelUntilDate) : undefined}
                            onSelect={(d) => d && setCancelUntilDate(format(d, "yyyy-MM-dd"))}
                            disabled={(d) => details.booking_date ? d < parseISODate(details.booking_date) : false}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </label>
            </RadioGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={busy}>
                Renunță
              </Button>
              <Button
                variant="destructive"
                onClick={performBulkCancel}
                disabled={busy || (cancelScope === "suspend" && !cancelUntilDate)}
              >
                Continuă
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={tariffOpen} onOpenChange={setTariffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editează tariful</DialogTitle>
            <DialogDescription>
              Tarif curent: {currentPph} RON/oră · Durată: {durationHoursForTariff}h
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-tariff" className="text-xs">
                Tarif nou (RON/oră)
              </Label>
              <Input
                id="new-tariff"
                type="number"
                min={0}
                step="any"
                value={tariffValue}
                onChange={(e) => setTariffValue(e.target.value)}
              />
            </div>
            {recurrenceInfo && (
              <RadioGroup
                value={tariffScope}
                onValueChange={(v) => setTariffScope(v as "single" | "future")}
                className="gap-3"
              >
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                  <RadioGroupItem value="single" className="mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium">Doar această rezervare</div>
                    <div className="text-xs text-muted-foreground">
                      Schimbi tariful doar pentru această sesiune.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                  <RadioGroupItem value="future" className="mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium">Această sesiune și toate viitoarele</div>
                    <div className="text-xs text-muted-foreground">
                      Schimbi tariful pentru această apariție și toate cele viitoare din serie (peste 48h). Trecutul rămâne neschimbat.
                    </div>
                  </div>
                </label>
              </RadioGroup>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTariffOpen(false)} disabled={busy}>
              Renunță
            </Button>
            <Button onClick={saveTariff} disabled={busy || !tariffValid}>
              {busy ? "Se salvează..." : "Salvează tariful"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type RecurrenceInfo = {
  id: string;
  frequency: string | null;
  is_active: boolean | null;
  total_bookings: number | null;
  first_date: string | null;
  last_date: string | null;
};

const FREQUENCY_LABEL_RO: Record<string, string> = {
  weekly: "săptămânală",
  biweekly: "bi-săptămânală",
  monthly: "lunară",
  daily: "zilnică",
};

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
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState<string>(entry.renter_notes ?? entry.reason ?? "");
  const [recurrenceInfo, setRecurrenceInfo] = useState<RecurrenceInfo | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteScope, setDeleteScope] = useState<"single" | "future" | "all">("single");

  const isRecurrent = !!entry.recurrence_id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, room_id, booking_date, start_time, end_time, renter_notes, status")
        .eq("id", entry.id)
        .eq("status", "blocată")
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("load block reason error", error);
        return;
      }
      if (!data) return;
      setReason((data as { renter_notes?: string | null }).renter_notes ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  useEffect(() => {
    if (!entry.recurrence_id) {
      setRecurrenceInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("recurrences")
        .select("id, frequency, is_active, total_bookings, first_date, last_date")
        .eq("id", entry.recurrence_id!)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setRecurrenceInfo(data as RecurrenceInfo);
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.recurrence_id]);

  const frequencyLabel = recurrenceInfo?.frequency
    ? (FREQUENCY_LABEL_RO[recurrenceInfo.frequency] ?? recurrenceInfo.frequency)
    : "săptămânală";

  async function saveReason() {
    setSaving(true);
    const { error } = await supabase
      .from("bookings")
      .update({ renter_notes: reason.trim() || null })
      .eq("id", entry.id)
      .eq("status", "blocată");
    setSaving(false);
    if (error) {
      toast.error(error.message || "Eroare la salvarea motivului");
      return;
    }
    toast.success("Motiv salvat");
    onChanged();
  }

  async function deleteSingle() {
    const { error } = await supabase.from("bookings").delete().eq("id", entry.id);
    if (error) throw error;

    // If part of a series, decrement counter
    if (entry.recurrence_id) {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("recurrence_id", entry.recurrence_id);
      await supabase
        .from("recurrences")
        .update({ total_bookings: count ?? 0 })
        .eq("id", entry.recurrence_id);
    }
  }

  async function deleteFuture() {
    if (!entry.recurrence_id) return;
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("recurrence_id", entry.recurrence_id)
      .gte("booking_date", entry.booking_date);
    if (error) throw error;

    // Recompute last_date and total_bookings from remaining rows
    const { data: remaining } = await supabase
      .from("bookings")
      .select("booking_date")
      .eq("recurrence_id", entry.recurrence_id)
      .order("booking_date", { ascending: false })
      .limit(1);

    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("recurrence_id", entry.recurrence_id);

    const newLast = remaining?.[0]?.booking_date ?? null;
    await supabase
      .from("recurrences")
      .update({
        last_date: newLast,
        total_bookings: count ?? 0,
        is_active: (count ?? 0) > 0,
      })
      .eq("id", entry.recurrence_id);
  }

  async function deleteAll() {
    if (!entry.recurrence_id) return;
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("recurrence_id", entry.recurrence_id);
    if (error) throw error;
    await supabase
      .from("recurrences")
      .update({ is_active: false, total_bookings: 0 })
      .eq("id", entry.recurrence_id);
  }

  async function performDelete() {
    setBusy(true);
    try {
      if (!isRecurrent || deleteScope === "single") {
        await deleteSingle();
        toast.success("Slot deblocat");
      } else if (deleteScope === "future") {
        await deleteFuture();
        toast.success("Acest slot și toate viitoarele au fost șterse");
      } else {
        await deleteAll();
        toast.success("Toată seria a fost ștearsă");
      }
      setConfirmOpen(false);
      onChanged();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Eroare la ștergere";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function openDelete() {
    if (isRecurrent) {
      setDeleteScope("single");
      setConfirmOpen(true);
    } else {
      void performDelete();
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          Interval blocat
          {isRecurrent && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-50"
              title={`Blocare recurentă (${frequencyLabel})`}
            >
              <Repeat className="h-3 w-3" />
              recurent
            </span>
          )}
        </DialogTitle>
        <DialogDescription>
          {entry.booking_date} · {entry.start_time?.slice(0, 5)}–{entry.end_time?.slice(0, 5)}
          {isRecurrent && (
            <>
              {" · "}
              <span>Serie {frequencyLabel}</span>
              {recurrenceInfo?.total_bookings ? ` · ${recurrenceInfo.total_bookings} blocări` : ""}
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      <AttachedClientDisplay bookingId={entry.id} />
      <div className="space-y-2 text-sm">
        <Label htmlFor="block-reason">Motiv blocare</Label>
        <Textarea
          id="block-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: Curs privat, mentenanță..."
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={saveReason} disabled={saving}>
            {saving ? "Se salvează..." : "Salvează motiv"}
          </Button>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button onClick={openDelete} disabled={busy} variant="destructive">
          {isRecurrent ? "Șterge..." : "Deblochează"}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Închide
        </Button>
      </DialogFooter>

      <Dialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge blocare recurentă?</DialogTitle>
            <DialogDescription>
              Această blocare face parte dintr-o serie {frequencyLabel}. Alege ce vrei să ștergi:
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={deleteScope}
            onValueChange={(v) => setDeleteScope(v as "single" | "future" | "all")}
            className="gap-3 py-2"
          >
            <label className="flex items-start gap-2 cursor-pointer">
              <RadioGroupItem value="single" id="scope-single" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Doar acest slot</div>
                <div className="text-xs text-muted-foreground">
                  Șterge doar blocarea din {entry.booking_date}, restul seriei rămâne.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <RadioGroupItem value="future" id="scope-future" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Acesta și toate viitoarele</div>
                <div className="text-xs text-muted-foreground">
                  Șterge această blocare și toate cele de după.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <RadioGroupItem value="all" id="scope-all" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Toată seria</div>
                <div className="text-xs text-muted-foreground">
                  Șterge TOATE blocările din serie (inclusiv trecutul) și dezactivează seria.
                </div>
              </div>
            </label>
          </RadioGroup>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Anulează
            </Button>
            <Button variant="destructive" onClick={performDelete} disabled={busy}>
              {busy ? "Se șterge..." : "Confirmă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function BlockSlotForm({
  roomId,
  date,
  startSlot,
  onClose,
  onChanged,
}: {
  roomId: string;
  date: string;
  startSlot: string; // "HH:MM"
  onClose: () => void;
  onChanged: () => void;
}) {
  const initialStartMin = Math.min(
    Math.max(timeToMinutes(startSlot), HOUR_START * 60),
    HOUR_END * 60 - SLOT_GRANULARITY_MINUTES,
  );
  const [start, setStart] = useState(minutesToTime(initialStartMin));
  const [end, setEnd] = useState(
    minutesToTime(Math.min(initialStartMin + SLOT_GRANULARITY_MINUTES, HOUR_END * 60)),
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  const startOptions = TIME_OPTIONS.slice(0, -1); // exclude HOUR_END as start
  const endOptions = TIME_OPTIONS.slice(1); // exclude HOUR_START as end

  const recurrenceDates =
    isRecurrent && recurrenceEndDate
      ? generateWeeklyDates(date, recurrenceEndDate)
      : [];

  async function submit() {
    setBlockError(null);
    if (timeToMinutes(end) <= timeToMinutes(start)) {
      setBlockError("Ora de sfârșit trebuie să fie după ora de început.");
      return;
    }
    if (isRecurrent && !recurrenceEndDate) {
      setBlockError("Selectează data de sfârșit pentru recurență.");
      return;
    }

    const allDates =
      isRecurrent && recurrenceEndDate ? generateWeeklyDates(date, recurrenceEndDate) : [date];

    setBusy(true);
    const skipped: string[] = [];
    const inserted: string[] = [];

    // Create recurrence group when recurrent so all slots share recurrence_id
    let recurrenceId: string | null = null;
    if (isRecurrent && allDates.length > 1) {
      const { data: userData } = await supabase.auth.getUser();
      const ownerEmail = userData.user?.email ?? `owner+${Date.now()}@rezervari.intern`;
      const dayOfWeek = getDayOfWeek(parseISODate(date));
      const { data: rec, error: recError } = await supabase
        .from("recurrences")
        .insert({
          room_id: roomId,
          created_by_email: ownerEmail,
          frequency: "saptamanal",
          day_of_week: dayOfWeek,
          start_time: `${start}:00`,
          end_time: `${end}:00`,
          first_date: allDates[0],
          last_date: allDates[allDates.length - 1],
          is_active: true,
          total_bookings: allDates.length,
        })
        .select("id")
        .single();
      if (recError) {
        console.error("recurrences insert error:", recError);
        setBusy(false);
        setBlockError("Eroare la crearea grupului de recurență: " + recError.message);
        return;
      }
      recurrenceId = (rec as { id: string }).id;
    }

    for (const [idx, d] of allDates.entries()) {
      const { error } = await supabase.rpc("block_slot", {
        p_room_id: roomId,
        p_date: d,
        p_start_time: start,
        p_end_time: end,
        p_reason: reason || "Rezervat de proprietar",
        ...(recurrenceId
          ? { p_recurrence_id: recurrenceId, p_recurrence_index: idx }
          : {}),
      } as never);
      if (error) {
        if (error.code === "23P01") {
          skipped.push(formatShortRO(d));
        } else {
          console.error("block_slot error:", error);
          // Cleanup partially-created series so user can retry cleanly
          if (recurrenceId) {
            await supabase.from("bookings").delete().eq("recurrence_id", recurrenceId);
            await supabase.from("recurrences").delete().eq("id", recurrenceId);
          }
          setBusy(false);
          setBlockError(error.message || "Eroare la blocare.");
          return;
        }
      } else {
        inserted.push(d);
      }
    }

    // If some dates were skipped, sync recurrences totals to reflect reality
    if (recurrenceId && skipped.length > 0 && inserted.length > 0) {
      await supabase
        .from("recurrences")
        .update({
          total_bookings: inserted.length,
          last_date: inserted[inserted.length - 1],
        })
        .eq("id", recurrenceId);
    }
    // If nothing was inserted, remove the empty recurrence row
    if (recurrenceId && inserted.length === 0) {
      await supabase.from("recurrences").delete().eq("id", recurrenceId);
    }

    setBusy(false);

    if (inserted.length === 0) {
      setBlockError("Toate intervalele sunt deja ocupate.");
      return;
    }

    if (skipped.length > 0) {
      toast.warning(
        `${inserted.length} blocări create. Sărite (ocupate): ${skipped.join(", ")}`,
      );
    } else {
      toast.success(
        allDates.length > 1 ? `${inserted.length} intervale blocate` : "Interval blocat",
      );
    }
    onChanged();
    onClose();
  }

  return (
    <>
      <DialogHeader className="shrink-0 px-6 py-4 border-b">
        <DialogTitle>Blochează interval</DialogTitle>
        <DialogDescription>{date}</DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto flex-1 px-6 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="start">Ora start</Label>
            <select
              id="start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full border rounded-md h-9 px-2 text-sm bg-background"
            >
              {startOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
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
              {endOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
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
          <div className="col-span-2 space-y-2 pt-2 border-t">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurrent}
                onChange={(e) => {
                  setIsRecurrent(e.target.checked);
                  setRecurrenceEndDate("");
                }}
                className="accent-primary h-4 w-4"
              />
              Repetă săptămânal
            </label>
            {isRecurrent && (
              <div className="space-y-1 pl-6">
                <Label className="text-xs">Până la:</Label>
                <Input
                  type="date"
                  value={recurrenceEndDate}
                  min={date}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                />
                {recurrenceDates.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {recurrenceDates.length} blocări săptămânale
                  </p>
                )}
              </div>
            )}
          </div>
          {blockError && (
            <div className="col-span-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {blockError}
            </div>
          )}
          {(() => {
            const allDates =
              isRecurrent && recurrenceEndDate
                ? generateWeeklyDates(date, recurrenceEndDate)
                : [date];
            const past = pastDates(allDates, start);
            if (past.length === 0) return null;
            const list = past.slice(0, 5).map(formatShortRO).join(", ");
            const more = past.length > 5 ? ` și încă ${past.length - 5}` : "";
            return (
              <div className="col-span-2 text-sm text-amber-900 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md px-3 py-2">
                <strong>Atenție:</strong>{" "}
                {past.length === 1
                  ? "blochezi un interval în trecut"
                  : `blochezi ${past.length} intervale în trecut`}{" "}
                ({list}{more}).
              </div>
            );
          })()}
          </div>
      </div>
      <DialogFooter className="shrink-0 px-6 py-4 border-t gap-2">
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
  manualOwnerClientId,
  setManualOwnerClientId,
  onClientChange,
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
  manualOwnerClientId: string | null;
  setManualOwnerClientId: (v: string | null) => void;
  onClientChange: (id: string | null) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [isRecurrent, setIsRecurrent] = useState(false);

  const startOptions = TIME_OPTIONS.slice(0, -1);
  const endOptions = TIME_OPTIONS.slice(1);

  const startMin = timeToMinutes(manualStart);
  const endMin = timeToMinutes(manualEnd);
  const durationMinutes = endMin - startMin;
  const validRange = durationMinutes > 0 && durationMinutes % 30 === 0;
  const durationHours = validRange ? durationMinutes / 60 : 0;
  const pricePerHour = calculatePriceForDate(date, manualStart, pricingRules);
  const total = validRange ? durationHours * pricePerHour : 0;

  const recurrenceDates = isRecurrent ? generateWeeklyDatesHorizonISO(date) : [];

  async function handleManualBooking() {
    if (!manualName.trim()) {
      setManualError("Completează numele clientului.");
      return;
    }
    if (!manualPhone.trim()) {
      setManualError("Completează telefonul.");
      return;
    }
    if (durationMinutes <= 0) {
      setManualError("Ora de sfârșit trebuie să fie după ora de început.");
      return;
    }
    if (durationMinutes % 30 !== 0) {
      setManualError("Durata trebuie să fie un multiplu de 30 de minute.");
      return;
    }

    const startTime = `${manualStart}:00`;
    const endTime = `${manualEnd}:00`;

    const allDates = isRecurrent ? generateWeeklyDatesHorizonISO(date) : [date];

    setManualSubmitting(true);
    setManualError(null);

    // Create recurrence group if recurrent
    let recurrenceId: string | null = null;
    if (isRecurrent && allDates.length > 1) {
      const dayOfWeek = getDayOfWeek(parseISODate(date));
      const { data: rec, error: recError } = await supabase
        .from("recurrences")
        .insert({
          room_id: roomId,
          created_by_email: manualEmail.trim() || `noemail+${Date.now()}@rezervari.intern`,
          frequency: "saptamanal",
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          first_date: allDates[0],
          last_date: allDates[allDates.length - 1],
          total_bookings: allDates.length,
        })
        .select()
        .single();

      if (recError) {
        setManualError("Eroare la crearea grupului de recurență: " + recError.message);
        setManualSubmitting(false);
        return;
      }
      recurrenceId = (rec as { id: string }).id;
    }

    const skipped: string[] = [];
    const inserted: string[] = [];

    for (const [idx, d] of allDates.entries()) {
      const { error } = await supabase.from("bookings").insert({
        room_id: roomId,
        recurrence_id: recurrenceId,
        recurrence_index: recurrenceId ? idx + 1 : null,
        guest_name: manualName.trim(),
        guest_email: manualEmail.trim() || `noemail+${Date.now()}@rezervari.intern`,
        guest_phone: manualPhone.trim(),
        booking_date: d,
        start_time: startTime,
        end_time: endTime,
        duration_hours: durationHours,
        duration_minutes: durationMinutes,
        price_per_hour: pricePerHour,
        subtotal: total,
        discount_amount: 0,
        total_amount: total,
        status: "confirmată",
        payment_method: "la_sala",
        payment_status: manualPaymentStatus,
        renter_notes: manualNote.trim() || null,
        owner_client_id: manualOwnerClientId,
      } as any);

      if (error) {
        if (error.code === "23P01") {
          skipped.push(formatShortRO(d));
        } else {
          setManualError("Eroare: " + error.message);
          setManualSubmitting(false);
          return;
        }
      } else {
        inserted.push(d);
      }
    }

    setManualSubmitting(false);

    if (inserted.length === 0) {
      setManualError("Toate intervalele selectate sunt deja ocupate.");
      return;
    }

    if (skipped.length > 0) {
      toast.warning(
        `${inserted.length} rezervări create. Sărite (ocupate): ${skipped.join(", ")}`,
      );
    } else {
      toast.success(
        isRecurrent
          ? "Rezervare recurentă creată"
          : allDates.length > 1
            ? `${inserted.length} rezervări adăugate`
            : "Rezervare adăugată",
      );
    }
    onChanged();
    onClose();
  }

  return (
    <>
      <DialogHeader className="shrink-0 px-6 py-4 border-b">
        <DialogTitle>Rezervare nouă</DialogTitle>
        <DialogDescription>{formatDateRO(parseISODate(date))}</DialogDescription>
      </DialogHeader>

      <div className="overflow-y-auto flex-1 px-6 py-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Ora start</Label>
              <select
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="w-full rounded-md border border-border h-9 px-2 text-sm bg-background"
              >
                {startOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ora final</Label>
              <select
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="w-full rounded-md border border-border h-9 px-2 text-sm bg-background"
              >
                {endOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="manual-client" className="text-xs">Client (opțional)</Label>
            <ClientSelect
              context="owner"
              value={manualOwnerClientId}
              onChange={onClientChange}
              placeholder="Fără client atribuit"
            />
          </div>

          {manualOwnerClientId !== null && (
            <p className="text-xs text-muted-foreground -mb-2">
              Datele sunt preluate din clientul selectat.
            </p>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Nume client *</Label>
            <Input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="ex: Ana Ionescu"
              disabled={manualOwnerClientId !== null}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Telefon *</Label>
            <Input
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="07xxxxxxxx"
              disabled={manualOwnerClientId !== null}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Email (opțional)</Label>
            <Input
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="client@email.ro"
              disabled={manualOwnerClientId !== null}
            />
          </div>

          {validRange && (
            <div className="rounded-md bg-muted/40 border border-border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Durată</span>
                <span className="font-medium">{formatDurationRO(durationMinutes)}</span>
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





          <div className="space-y-2 pt-2 border-t">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurrent}
                onChange={(e) => {
                  setIsRecurrent(e.target.checked);
                }}
                className="accent-primary h-4 w-4"
              />
              Rezervare recurentă săptămânală
            </label>
            {isRecurrent && (
              <p className="text-xs text-muted-foreground pl-6">
                Programarea se reînnoiește automat lunar.
              </p>
            )}
          </div>

          {manualError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {manualError}
            </div>
          )}
          {(() => {
            const allDates = isRecurrent ? generateWeeklyDatesHorizonISO(date) : [date];
            const past = pastDates(allDates, manualStart);
            if (past.length === 0) return null;
            const list = past.slice(0, 5).map(formatShortRO).join(", ");
            const more = past.length > 5 ? ` și încă ${past.length - 5}` : "";
            return (
              <div className="text-sm text-amber-900 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md px-3 py-2">
                <strong>Atenție:</strong>{" "}
                {past.length === 1
                  ? "rezervarea este în trecut"
                  : `${past.length} apariții sunt în trecut`}{" "}
                ({list}{more}).
              </div>
            );
          })()}
          </div>
      </div>

      <DialogFooter className="shrink-0 px-6 py-4 border-t gap-2">
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
