import type { RateBreakdownRow } from "@/lib/rate-breakdown";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function RateBreakdown({
  rows,
  currency = "RON",
  className = "",
}: {
  rows: RateBreakdownRow[];
  currency?: string;
  className?: string;
}) {
  if (!rows || rows.length === 0) return null;

  if (rows.length === 1) {
    return (
      <div className={`text-sm text-muted-foreground break-words ${className}`}>
        {fmt(rows[0].price_per_hour)} {currency}/oră · {rows[0].label}
      </div>
    );
  }

  return (
    <div className={`text-sm break-words ${className}`}>
      <div className="text-muted-foreground">Tarife aplicate:</div>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={`${r.label}-${r.price_per_hour}`} className="text-muted-foreground">
            • {r.label} — {fmt(r.price_per_hour)} {currency}/oră
          </li>
        ))}
      </ul>
    </div>
  );
}
