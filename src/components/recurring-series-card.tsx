import { Repeat } from "lucide-react";
import { describeRecurrence, type RecurrenceInfo } from "@/lib/recurrence-series";
import { parseISODate } from "@/lib/date-utils";

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
  onCancelSeries: () => void;
  roomLink?: React.ReactNode;
};

export function RecurringSeriesCard({
  bookings,
  recurrence,
  todayISO,
  onCancelSeries,
  roomLink,
}: Props) {
  const first = bookings[0];
  const description = describeRecurrence(recurrence);

  const startDate = parseISODate(first.booking_date);
  const monthMap = new Map<string, number>();
  for (const b of bookings) {
    const d = parseISODate(b.booking_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(b.total_amount ?? 0));
  }

  const sortedKeys = Array.from(monthMap.keys()).sort();
  const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
  const firstFullMonthKey = sortedKeys.find((k) => k > startMonthKey);
  const monthlyPrice = firstFullMonthKey
    ? (monthMap.get(firstFullMonthKey) ?? 0)
    : (monthMap.get(startMonthKey) ?? 0);

  const hasFutureActive = bookings.some(
    (b) =>
      b.booking_date >= todayISO &&
      (b.status === "confirmată" || b.status === "în așteptare"),
  );

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
        <div className="font-semibold">
          Preț lunar: {monthlyPrice.toFixed(2)} RON
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {roomLink}
        {hasFutureActive && (
          <button
            type="button"
            onClick={onCancelSeries}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            Anulează seria
          </button>
        )}
      </div>
    </article>
  );
}
