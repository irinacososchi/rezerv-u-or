import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/external-client";

export type RateBreakdownRow = { label: string; price_per_hour: number };

export type RateInterval = {
  roomId: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
};

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

export async function fetchRateBreakdown(
  iv: RateInterval,
): Promise<RateBreakdownRow[]> {
  try {
    const { data, error } = await supabase.rpc("get_booking_rate_breakdown", {
      p_room_id: iv.roomId,
      p_date: iv.date,
      p_start_time: normalizeTime(iv.start),
      p_end_time: normalizeTime(iv.end),
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[])
      .map((r) => ({
        label: String(r?.label ?? ""),
        price_per_hour: Number(r?.price_per_hour ?? 0),
      }))
      .filter((r) => r.label !== "");
  } catch {
    return [];
  }
}

function dedupe(rows: RateBreakdownRow[]): RateBreakdownRow[] {
  const map = new Map<string, RateBreakdownRow>();
  for (const r of rows) {
    map.set(`${r.label}|${r.price_per_hour}`, r);
  }
  return Array.from(map.values());
}

/** Fetches (in parallel) and deduplicates the applied rates for 0..n intervals. */
export function useRateBreakdown(intervals: RateInterval[]): RateBreakdownRow[] {
  const key = useMemo(
    () =>
      intervals
        .map((i) => `${i.roomId}|${i.date}|${i.start}|${i.end}`)
        .join(";"),
    [intervals],
  );
  const [rows, setRows] = useState<RateBreakdownRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (intervals.length === 0) {
      setRows([]);
      return;
    }
    (async () => {
      const results = await Promise.all(intervals.map(fetchRateBreakdown));
      if (cancelled) return;
      setRows(dedupe(results.flat()));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return rows;
}
