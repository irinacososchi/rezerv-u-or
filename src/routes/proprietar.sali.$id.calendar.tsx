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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  getDayOfWeek,
  formatDateISO,
  addDays,
  DAY_NAMES_RO,
  MONTH_NAMES_RO,
} from "@/lib/date-utils";

export const Route = createFileRoute("/proprietar/sali/$id/calendar")({
  component: RoomCalendarPage,
});

const HOUR_START = 8;
const HOUR_END = 22; // last slot starts at 21:00

type Room = { id: string; name: string; slug: string; owner_id: string };

type Entry = {
  id: string;
  room_id: string;
  booking_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
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
};

// Get Monday of the week containing `d`
function startOfWeek(d: Date): Date {
  const dow = getDayOfWeek(d); // 1..7
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
  // "HH:MM" or "HH:MM:SS" → fractional hours
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h + (m || 0) / 60;
}

function RoomCalendarPage() {
  const { id } = useParams({ from: "/proprietar/sali/$id/calendar" });
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<
    | { kind: "booking"; entry: Entry }
    | { kind: "block"; entry: Entry }
    | { kind: "empty"; date: string; hour: number }
    | null
  >(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const loadEntries = useCallback(async () => {
    const startISO = formatDateISO(weekStart);
    const endISO = formatDateISO(addDays(weekStart, 6));
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
  }, [id, weekStart]);

  // Load room + verify ownership
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

  // Map (dateISO|hour) -> entry occupying that cell
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

  function onCellClick(dateISO: string, hour: number) {
    const e = cellMap.get(`${dateISO}|${hour}`);
    if (!e) {
      setSelected({ kind: "empty", date: dateISO, hour });
      return;
    }
    if (e.entry_type === "blocat") {
      setSelected({ kind: "block", entry: e });
    } else {
      setSelected({ kind: "booking", entry: e });
    }
  }

  function cellClass(e: Entry | undefined): string {
    if (!e) return "bg-background hover:bg-muted/60 cursor-pointer";
    if (e.entry_type === "blocat") {
      return "bg-muted text-muted-foreground cursor-pointer bg-[repeating-linear-gradient(45deg,hsl(var(--muted))_0,hsl(var(--muted))_6px,hsl(var(--muted-foreground)/0.15)_6px,hsl(var(--muted-foreground)/0.15)_12px)]";
    }
    if (e.status === "confirmată") return "bg-primary/20 text-primary-foreground/90 cursor-pointer";
    if (e.status === "în așteptare") return "bg-orange-200/70 text-orange-900 cursor-pointer";
    if (e.status === "finalizată") return "bg-muted/60 text-muted-foreground cursor-pointer";
    if (e.status === "anulată" || e.status === "refuzată")
      return "bg-destructive/10 text-destructive cursor-pointer";
    return "bg-secondary cursor-pointer";
  }

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
                <p className="text-sm text-muted-foreground">Calendar săptămânal</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart((w) => addDays(w, -7))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Săptămâna trecută
                </Button>
                <div className="text-sm font-medium px-2">{formatRange(weekStart)}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart((w) => addDays(w, 7))}
                >
                  Săptămâna viitoare <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekStart(startOfWeek(new Date()))}
                >
                  Astăzi
                </Button>
              </div>
            </div>

            <div className="inline-flex rounded-md border bg-card p-1 text-sm">
              <button className="px-3 py-1 rounded bg-primary text-primary-foreground">
                Săptămână
              </button>
              <button
                className="px-3 py-1 rounded text-muted-foreground"
                disabled
                title="Disponibil în curând"
              >
                Lună
              </button>
            </div>

            {/* Grid */}
            <div className="border rounded-lg bg-card overflow-x-auto">
              <div className="min-w-[760px]">
                {/* Header row */}
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
                          "p-2 text-center border-l " +
                          (isToday ? "bg-primary/5" : "")
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

                {/* Hour rows */}
                {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map(
                  (hour) => (
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
                  ),
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
              <LegendDot className="bg-primary/20" label="Confirmată" />
              <LegendDot className="bg-orange-200/70" label="În așteptare" />
              <LegendDot
                className="bg-[repeating-linear-gradient(45deg,hsl(var(--muted))_0,hsl(var(--muted))_4px,hsl(var(--muted-foreground)/0.25)_4px,hsl(var(--muted-foreground)/0.25)_8px)]"
                label="Blocat de proprietar"
              />
              <LegendDot className="bg-muted/60" label="Finalizată" />
            </div>
          </>
        )}
      </div>

      {/* Booking modal */}
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

      {/* Block modal */}
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

      {/* Empty cell → block slot modal */}
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
  const [start, setStart] = useState(`${String(startHour).padStart(2, "0")}:00`);
  const [end, setEnd] = useState(`${String(startHour + 1).padStart(2, "0")}:00`);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.rpc("block_slot", {
      p_room_id: roomId,
      p_date: date,
      p_start_time: start,
      p_end_time: end,
      p_reason: reason || "Rezervat de proprietar",
    });
    setBusy(false);
    if (error) return toast.error("Eroare la blocare: " + error.message);
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
          <Input
            id="start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="end">Ora end</Label>
          <Input id="end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
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
