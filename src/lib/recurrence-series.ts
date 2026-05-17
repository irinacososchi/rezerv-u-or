// Helpers for grouping bookings by recurrence series and formatting recurrence info.

export type RecurrenceInfo = {
  id: string;
  frequency: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  first_date: string | null;
  last_date: string | null;
  total_bookings: number | null;
};

export type RecurringBookingLike = {
  id: string;
  booking_date: string;
  status: string;
  recurrence_id: string | null;
};

export const ZILE_SAPTAMANA: Record<number, string> = {
  1: "luni",
  2: "marți",
  3: "miercuri",
  4: "joi",
  5: "vineri",
  6: "sâmbătă",
  7: "duminică",
};

export function formatDateRoLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function describeRecurrence(rec: RecurrenceInfo | undefined): string {
  if (!rec) return "Serie recurentă";
  const t1 = rec.start_time?.slice(0, 5) ?? "";
  const t2 = rec.end_time?.slice(0, 5) ?? "";
  const interval = t1 && t2 ? `${t1} – ${t2}` : "";
  const ziua = rec.day_of_week ? ZILE_SAPTAMANA[rec.day_of_week] : "";
  const freq = (rec.frequency ?? "").toLowerCase();
  if ((freq === "saptamanal" || freq === "weekly") && ziua) {
    return `În fiecare ${ziua}${interval ? `, ${interval}` : ""}`;
  }
  if ((freq === "bisaptamanal" || freq === "biweekly") && ziua) {
    return `La fiecare 2 săptămâni, ${ziua}${interval ? `, ${interval}` : ""}`;
  }
  if (freq === "lunar" || freq === "monthly") {
    return `Lunar${interval ? `, ${interval}` : ""}`;
  }
  if (freq === "zilnic" || freq === "daily") {
    return `Zilnic${interval ? `, ${interval}` : ""}`;
  }
  return `Serie recurentă${interval ? `, ${interval}` : ""}`;
}

export type SeriesGroup<B extends RecurringBookingLike> = {
  recurrenceId: string;
  bookings: B[];
};

export function groupByRecurrence<B extends RecurringBookingLike>(bookings: B[]): {
  series: SeriesGroup<B>[];
  singles: B[];
} {
  const map = new Map<string, B[]>();
  const singles: B[] = [];
  for (const b of bookings) {
    if (b.recurrence_id) {
      const arr = map.get(b.recurrence_id) ?? [];
      arr.push(b);
      map.set(b.recurrence_id, arr);
    } else {
      singles.push(b);
    }
  }
  const series: SeriesGroup<B>[] = [];
  for (const [recurrenceId, arr] of map.entries()) {
    arr.sort((a, b) => a.booking_date.localeCompare(b.booking_date));
    series.push({ recurrenceId, bookings: arr });
  }
  return { series, singles };
}

export function seriesStats<B extends RecurringBookingLike>(
  bookings: B[],
  todayISO: string,
): {
  total: number;
  futureActive: number;
  pastCount: number;
  hasUpcoming: boolean;
  hasPast: boolean;
  nextDate: string | null;
  lastPastDate: string | null;
} {
  let futureActive = 0;
  let pastCount = 0;
  let nextDate: string | null = null;
  let lastPastDate: string | null = null;
  const activeStatuses = new Set(["în așteptare", "confirmată"]);
  for (const b of bookings) {
    if (b.booking_date >= todayISO) {
      if (activeStatuses.has(b.status)) {
        futureActive++;
        if (!nextDate || b.booking_date < nextDate) nextDate = b.booking_date;
      }
    } else {
      pastCount++;
      if (!lastPastDate || b.booking_date > lastPastDate) lastPastDate = b.booking_date;
    }
  }
  return {
    total: bookings.length,
    futureActive,
    pastCount,
    hasUpcoming: futureActive > 0,
    hasPast: pastCount > 0,
    nextDate,
    lastPastDate,
  };
}
