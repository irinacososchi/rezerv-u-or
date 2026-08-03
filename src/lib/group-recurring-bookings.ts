export type Booking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_amount: number | string | null;
  is_recurring?: boolean;
  booking_group_id?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  renter_name?: string | null;
  renter_email?: string | null;
  renter_phone?: string | null;
  room_name?: string | null;
  room_currency?: string | null;
  [key: string]: any;
};

export type BookingItem =
  | { kind: "single"; booking: Booking }
  | {
      kind: "recurring_group";
      groupId: string;
      groupedBy: "recurrence_id" | "booking_group_id";
      recurrenceId: string | null;
      bookings: Booking[];
    };

export type GroupStatusSummary = {
  pending: number;
  confirmed: number;
  refused: number;
  cancelled: number;
  blocked: number;
  total: number;
};

/**
 * Grupează rezervări: cele recurente cu aceeași cheie (recurrence_id, sau
 * booking_group_id pentru seriile vechi) devin un singur item de tip
 * "recurring_group". Restul rămân "single".
 */
export function groupRecurringBookings(bookings: Booking[]): BookingItem[] {
  const recurringMap = new Map<string, Booking[]>();
  const singles: Booking[] = [];

  for (const b of bookings) {
    const key = (b.recurrence_id as string | null | undefined) ?? b.booking_group_id ?? null;
    if (b.is_recurring && key) {
      const arr = recurringMap.get(key) ?? [];
      arr.push(b);
      recurringMap.set(key, arr);
    } else {
      singles.push(b);
    }
  }

  const items: BookingItem[] = [];

  for (const [groupId, gBookings] of recurringMap.entries()) {
    gBookings.sort(
      (a, b) =>
        a.booking_date.localeCompare(b.booking_date) ||
        a.start_time.localeCompare(b.start_time),
    );
    const recurrenceId =
      (gBookings.find((b) => b.recurrence_id)?.recurrence_id as string | undefined) ?? null;
    items.push({
      kind: "recurring_group",
      groupId,
      groupedBy: recurrenceId === groupId ? "recurrence_id" : "booking_group_id",
      recurrenceId,
      bookings: gBookings,
    });
  }

  for (const s of singles) {
    items.push({ kind: "single", booking: s });
  }

  // Sortare descrescător după prima dată (cele apropiate sus)
  items.sort((a, b) => {
    const dateA = a.kind === "single" ? a.booking.booking_date : a.bookings[0].booking_date;
    const dateB = b.kind === "single" ? b.booking.booking_date : b.bookings[0].booking_date;
    return dateB.localeCompare(dateA);
  });

  return items;
}


export function getGroupStatusSummary(bookings: Booking[]): GroupStatusSummary {
  let pending = 0,
    confirmed = 0,
    refused = 0,
    cancelled = 0,
    blocked = 0;
  for (const b of bookings) {
    if (b.status === "în așteptare") pending++;
    else if (b.status === "confirmată") confirmed++;
    else if (b.status === "refuzată") refused++;
    else if (b.status === "anulată") cancelled++;
    else if (b.status === "blocată") blocked++;
  }
  return { pending, confirmed, refused, cancelled, blocked, total: bookings.length };
}

export function getGroupStatusLabel(s: GroupStatusSummary): {
  label: string;
  variant: "warning" | "success" | "destructive" | "muted" | "mixed";
} {
  if (s.pending === s.total) return { label: "Toate în așteptare", variant: "warning" };
  if (s.confirmed === s.total) return { label: "Toate aprobate", variant: "success" };
  if (s.refused === s.total) return { label: "Toate refuzate", variant: "destructive" };
  if (s.cancelled === s.total) return { label: "Toate anulate", variant: "muted" };
  const parts: string[] = [];
  if (s.confirmed > 0) parts.push(`${s.confirmed} aprobate`);
  if (s.pending > 0) parts.push(`${s.pending} în așteptare`);
  if (s.refused > 0) parts.push(`${s.refused} refuzate`);
  if (s.cancelled > 0) parts.push(`${s.cancelled} anulate`);
  return { label: parts.join(" · "), variant: "mixed" };
}
