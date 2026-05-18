import { useState } from "react";
import { Loader2, Repeat, ChevronDown, ChevronUp } from "lucide-react";
import {
  describeRecurrence,
  formatDateRoLong,
  seriesStats,
  type RecurrenceInfo,
} from "@/lib/recurrence-series";

export type SeriesBooking = {
  id: string;
  reference: string;
  room_name: string;
  room_address: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  duration_minutes?: number | null;
  total_amount: number;
  status: string;
  payment_status: string;
  guest_email: string;
  recurrence_id: string | null;
};

type Props = {
  bookings: SeriesBooking[];
  recurrence: RecurrenceInfo | undefined;
  todayISO: string;
  tabContext: "upcoming" | "past" | "all";
  cancelLoadingId: string | null;
  onCancelSingle: (b: SeriesBooking) => void;
  onCancelSeries: () => void;
  roomLink?: React.ReactNode;
};

export function RecurringSeriesCard({
  bookings,
  recurrence,
  todayISO,
  tabContext,
  cancelLoadingId,
  onCancelSingle,
  onCancelSeries,
  roomLink,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const stats = seriesStats(bookings, todayISO);
  const first = bookings[0];
  const description = describeRecurrence(recurrence);

  // Total estimativ pe baza rezervărilor existente
  const totalSum = bookings.reduce(
    (acc, b) => acc + (Number(b.total_amount) || 0),
    0,
  );

  const firstDate = recurrence?.first_date ?? bookings[0]?.booking_date ?? null;
  const lastDate =
    recurrence?.last_date ??
    bookings[bookings.length - 1]?.booking_date ??
    null;

  let contextLine: string;
  if (tabContext === "upcoming") {
    contextLine = `${stats.futureActive} viitoare din ${stats.total} în total`;
  } else if (tabContext === "past") {
    contextLine = `${stats.pastCount} trecute din ${stats.total} în total`;
  } else {
    contextLine = `${stats.total} rezervări în serie`;
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <Repeat className="h-3 w-3" />
            Serie recurentă
          </div>
          <h3 className="mt-2 font-semibold">{first.room_name}</h3>
          {first.room_address && (
            <p className="text-xs text-muted-foreground">{first.room_address}</p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
        <div className="font-medium">{description}</div>
        <div className="text-muted-foreground">
          {contextLine}
          {firstDate && (
            <>
              {" · "}prima: {formatDateRoLong(firstDate)}
            </>
          )}
          {lastDate && (
            <>
              {" · "}ultima: {formatDateRoLong(lastDate)}
            </>
          )}
        </div>
        <div className="font-semibold">
          Total estimativ: {totalSum.toFixed(2)} RON
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {roomLink}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Ascunde rezervările
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Vezi toate rezervările
              ({stats.total})
            </>
          )}
        </button>
        {stats.futureActive > 0 && (
          <button
            type="button"
            onClick={onCancelSeries}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            Anulează toate viitoarele din serie ({stats.futureActive})
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          {bookings.map((b) => {
            const isPast = b.booking_date < todayISO;
            const canCancel =
              !isPast &&
              (b.status === "confirmată" || b.status === "în așteptare");
            return (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">
                    #{b.reference}
                  </div>
                  <div>
                    {new Date(b.booking_date).toLocaleDateString("ro-RO", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {b.start_time?.slice(0, 5)}–{b.end_time?.slice(0, 5)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {b.total_amount} RON
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      b.status === "confirmată"
                        ? "bg-primary/10 text-primary"
                        : b.status === "anulată" ||
                            b.status === "refuzată" ||
                            b.status === "expirată"
                          ? "bg-destructive/10 text-destructive"
                          : b.status === "finalizată"
                            ? "bg-muted text-muted-foreground"
                            : "bg-orange-500/10 text-orange-600"
                    }`}
                  >
                    {b.status}
                  </span>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => onCancelSingle(b)}
                      disabled={cancelLoadingId === b.id}
                      className="inline-flex items-center gap-1 rounded border border-destructive/30 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      {cancelLoadingId === b.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Anulează doar aceasta"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
