// ISO day-of-week convention: 1=Mon..7=Sun (matches DB schema).
// Never use raw Date.getDay() (0=Sun) elsewhere — always go through this helper.
export function getDayOfWeek(date: Date): number {
  const day = date.getDay(); // 0=Sun..6=Sat
  return day === 0 ? 7 : day;
}

export const DAY_NAMES_RO: Record<number, string> = {
  1: "Luni",
  2: "Marți",
  3: "Miercuri",
  4: "Joi",
  5: "Vineri",
  6: "Sâmbătă",
  7: "Duminică",
};

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const MONTH_NAMES_RO = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

// Format: "Luni, 15 ianuarie 2025"
export function formatDateRO(d: Date): string {
  return `${DAY_NAMES_RO[getDayOfWeek(d)]}, ${d.getDate()} ${MONTH_NAMES_RO[d.getMonth()]} ${d.getFullYear()}`;
}

// Parse "YYYY-MM-DD" to local Date (avoid TZ shift from new Date(iso))
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}
