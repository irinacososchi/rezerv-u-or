import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  getDayOfWeek,
  formatDateISO,
  addDays,
  DAY_NAMES_RO,
  MONTH_NAMES_RO,
  startOfMonth,
  endOfMonth,
} from "@/lib/date-utils";

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
  const [selected, setSelected] = useState<
    | { kind: "booking"; entry: Entry }
    | { kind: "block"; entry: Entry }
    | { kind: "empty"; date: string; hour: number }
    | null
  >(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
    if (!e) return setSelected({ kind: "empty", date: dateISO, hour });
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
                              <div className="truncate font-medium">
                                {e!.entry_type === "blocat"
                                  ? (e!.reason ?? "Blocat")
                                  : (e!.renter_name ?? e!.reference ?? "Rezervare")}
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
        open={selected?.kind === "empty"}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent>
          {selected?.kind === "empty" && (
            <BlockSlotForm
              roomId={id}
              date={selected.date}
              startHour={selected.hour}
              onClose={() => setSelected(null)}
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

  async function markPaid() {
    setBusy(true);
    const { error } = await supabase
      .from("bookings")
      .update({ payment_status: "platit" })
      .eq("id", entry.id);
    setBusy(false);
    if (error) return toast.error("Eroare la marcare ca plătit");
    toast.success("Marcat ca plătit");
    onChanged();
    onClose();
  }

  async function cancelBooking() {
    if (!confirm("Sigur vrei să anulezi această rezervare?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "anulată" })
      .eq("id", entry.id);
    setBusy(false);
    if (error) return toast.error("Eroare la anulare");
    toast.success("Rezervare anulată");
    onChanged();
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Detalii rezervare</DialogTitle>
        <DialogDescription>
          {entry.booking_date} · {entry.start_time?.slice(0, 5)}–{entry.end_time?.slice(0, 5)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2 text-sm">
        <Row label="Chiriaș" value={entry.renter_name ?? "—"} />
        <Row label="Email" value={entry.renter_email ?? "—"} />
        <Row label="Telefon" value={entry.renter_phone ?? "—"} />
        <Row label="Referință" value={entry.reference ?? entry.id.slice(0, 8)} />
        <Row label="Status" value={entry.status ?? "—"} />
        <Row label="Plată" value={entry.payment_status ?? "—"} />
        {entry.total_amount != null && (
          <Row label="Total" value={`${entry.total_amount} RON`} />
        )}
      </div>
      <DialogFooter className="gap-2">
        {entry.payment_status === "neplatit" && (
          <Button onClick={markPaid} disabled={busy}>
            Marchează ca plătit
          </Button>
        )}
        {entry.status !== "anulată" && (
          <Button variant="destructive" onClick={cancelBooking} disabled={busy}>
            Anulează rezervarea
          </Button>
        )}
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
          <Label htmlFor="end">Ora end</Label>
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
