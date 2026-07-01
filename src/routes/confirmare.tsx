import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Calendar, AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/external-client";
import { formatDateRO, parseISODate, getDayOfWeek, DAY_NAMES_RO } from "@/lib/date-utils";

export const Route = createFileRoute("/confirmare")({
  validateSearch: (raw: Record<string, unknown>) => ({
    reference: typeof raw.reference === "string" ? raw.reference : "",
    group: typeof raw.group === "string" ? raw.group : "",
    recurrent: raw.recurrent === "true",
    recurrenceCount: Number(raw.recurrenceCount) || 0,
  }),
  head: () => ({
    meta: [
      { title: "Rezervare confirmată — Rezervări Săli" },
      { name: "description", content: "Detaliile rezervării tale." },
    ],
  }),
  component: ConfirmarePage,
});

type BookingFull = {
  id: string;
  reference: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  duration_minutes?: number | null;
  price_per_hour: number;
  pricing_rule_label: string | null;
  subtotal: number;
  discount_amount: number;
  voucher_code_used: string | null;
  total_amount: number;
  status: string;
  payment_method: string;
  payment_status: string;
  room_name: string;
  room_address: string | null;
  room_city: string | null;
  room_currency: string | null;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

function buildICS(b: BookingFull): string {
  const date = b.booking_date.replace(/-/g, "");
  const start = b.start_time.slice(0, 5).replace(":", "") + "00";
  const end = b.end_time.slice(0, 5).replace(":", "") + "00";
  const dtStart = `${date}T${start}`;
  const dtEnd = `${date}T${end}`;
  const location = [b.room_address, b.room_city].filter(Boolean).join(", ");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rezervari Sali//RO",
    "BEGIN:VEVENT",
    `UID:${b.reference}@rezervari-sali`,
    `DTSTAMP:${dtStart}Z`,
    `DTSTART;TZID=Europe/Bucharest:${dtStart}`,
    `DTEND;TZID=Europe/Bucharest:${dtEnd}`,
    `SUMMARY:Rezervare ${b.room_name}`,
    `LOCATION:${location}`,
    `DESCRIPTION:Referință: ${b.reference}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return ics;
}

function downloadICS(b: BookingFull) {
  const blob = new Blob([buildICS(b)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rezervare-${b.reference}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ConfirmarePage() {
  const search = Route.useSearch();
  const reference = search.reference;
  const group = search.group;
  const [bookings, setBookings] = useState<BookingFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!reference && !group) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      let query = supabase.from("bookings_full").select("*");
      if (group) {
        query = query.eq("booking_group_id", group).order("booking_date").order("start_time");
      } else {
        query = query.eq("reference", reference);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setNotFound(true);
      } else {
        setBookings(data as BookingFull[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reference, group]);

  const booking = bookings[0] ?? null;
  const isGroup = bookings.length > 1;
  const isRecurring = search.recurrent;

  const recurringSummary = useMemo(() => {
    if (!isRecurring || !booking) return null;
    const startDate = parseISODate(booking.booking_date);
    const monthMap = new Map<string, number>();
    const list = bookings ?? [];
    for (const b of list) {
      const d = parseISODate(b.booking_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + Number(b.total_amount ?? 0));
    }
    const sortedKeys = Array.from(monthMap.keys()).sort();
    const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthAmount = monthMap.get(startMonthKey) ?? 0;
    const firstFullMonthKey = sortedKeys.find((k) => k > startMonthKey);
    const monthlyPrice = firstFullMonthKey
      ? (monthMap.get(firstFullMonthKey) ?? 0)
      : currentMonthAmount;
    const startsFirstOfMonth = startDate.getDate() === 1;
    return {
      weekday: DAY_NAMES_RO[getDayOfWeek(startDate)],
      startTime: booking.start_time.slice(0, 5),
      endTime: booking.end_time.slice(0, 5),
      monthlyPrice,
      currentMonthAmount,
      startsFirstOfMonth,
    };
  }, [isRecurring, booking, bookings]);

  if (loading) {
    return (
      <Shell>
        <div className="container mx-auto flex max-w-2xl items-center justify-center px-4 py-32">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Shell>
    );
  }

  if (notFound || !booking) {
    return (
      <Shell>
        <div className="container mx-auto max-w-xl px-4 py-20 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Rezervarea nu a fost găsită</h1>
          <p className="mt-2 text-muted-foreground">
            Verifică linkul sau referința rezervării.
          </p>
          <Link to="/sali" className="mt-6 inline-block">
            <Button size="lg">Înapoi la săli</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  const isConfirmed = booking.status === "confirmată";
  const currency = booking.room_currency ?? "RON";
  const dateObj = parseISODate(booking.booking_date);
  const startLabel = booking.start_time.slice(0, 5);
  const endLabel = booking.end_time.slice(0, 5);
  const isPaid = booking.payment_status === "platit";




  return (
    <Shell>
      <div className="container mx-auto max-w-[600px] px-4 py-12">
        {/* Hero */}
        <div className="text-center">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary">
            <CheckCircle2 className="h-11 w-11 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            {isRecurring
              ? "Cerere de rezervare recurentă trimisă!"
              : isConfirmed
                ? "Rezervare confirmată!"
                : "Cerere trimisă!"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {isRecurring
              ? "Vei primi confirmare pe email."
              : isConfirmed
                ? "Vei primi detaliile pe email și WhatsApp."
                : "Proprietarul va confirma în curând. Vei fi notificat pe email."}
          </p>
        </div>

        {/* Booking details */}
        <div className="mt-8 rounded-xl border border-border bg-background p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Detalii rezervare</h2>

          {isRecurring ? (
            <>
              <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm mt-3">
                <div className="font-medium text-primary">Rezervare recurentă</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Vei primi confirmare pe email.
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <DetailRow label="Sală" value={booking.room_name} />
                {booking.room_address && (
                  <DetailRow
                    label="Adresă"
                    value={[booking.room_address, booking.room_city]
                      .filter(Boolean)
                      .join(", ")}
                  />
                )}
                {recurringSummary && (
                  <>
                    <DetailRow
                      label="Recurență"
                      value={`În fiecare ${recurringSummary.weekday}, ${recurringSummary.startTime}–${recurringSummary.endTime}`}
                    />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      Se reînnoiește automat lunar.
                    </div>
                    <DetailRow
                      label="Preț lunar"
                      value={
                        <span className="font-semibold text-primary">
                          {recurringSummary.monthlyPrice.toFixed(2)} {currency}
                        </span>
                      }
                    />
                    {!recurringSummary.startsFirstOfMonth && (
                      <DetailRow
                        label="Luna curentă"
                        value={`${recurringSummary.currentMonthAmount.toFixed(2)} ${currency}`}
                      />
                    )}
                  </>
                )}
              </dl>
            </>
          ) : (
            <>
              {isGroup && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm mt-3">
                  <div className="font-medium text-primary">
                    Grup de rezervări — {bookings.length} intervale
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Vei primi confirmare pe email pentru fiecare interval în parte.
                  </div>
                </div>
              )}


              <dl className="mt-5 space-y-3 text-sm">
                <DetailRow label="Sală" value={booking.room_name} />
                {booking.room_address && (
                  <DetailRow
                    label="Adresă"
                    value={[booking.room_address, booking.room_city]
                      .filter(Boolean)
                      .join(", ")}
                  />
                )}
                {isGroup ? (
                  <div className="border-t border-border pt-3">
                    <div className="text-muted-foreground text-sm mb-2">Intervale</div>
                    <ul className="space-y-1">
                      {bookings.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-baseline justify-between gap-3 text-sm"
                        >
                          <span>
                            <span className="font-mono text-xs text-muted-foreground mr-2">
                              #{b.reference}
                            </span>
                            {formatDateRO(parseISODate(b.booking_date))} ·{" "}
                            {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                          </span>
                          <span className="font-medium">
                            {b.total_amount} {currency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <>
                    <DetailRow
                      label="Referință"
                      value={
                        <span className="font-mono font-bold">#{booking.reference}</span>
                      }
                    />
                    <DetailRow label="Data" value={formatDateRO(dateObj)} />
                    <DetailRow label="Interval" value={`${startLabel}–${endLabel}`} />
                    <DetailRow
                      label="Durată"
                      value={(() => {
                        const minutes = booking.duration_minutes ?? Math.round((booking.duration_hours ?? 0) * 60);
                        const hours = minutes / 60;
                        return `${hours} ${hours === 1 ? "oră" : "ore"}`;
                      })()}
                    />
                    <DetailRow
                      label="Preț/oră"
                      value={
                        <>
                          {booking.price_per_hour} {currency}/oră
                          {booking.pricing_rule_label && (
                            <span className="text-muted-foreground">
                              {" · "}
                              {booking.pricing_rule_label}
                            </span>
                          )}
                        </>
                      }
                    />
                  </>
                )}
              </dl>

              <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                {!isGroup && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>
                      {booking.subtotal} {currency}
                    </span>
                  </div>
                )}
                {!isGroup && booking.discount_amount > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>
                      Reducere
                      {booking.voucher_code_used && ` (${booking.voucher_code_used})`}
                    </span>
                    <span>
                      −{booking.discount_amount} {currency}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">
                    {isGroup
                      ? bookings.reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
                      : booking.total_amount}{" "}
                    {currency}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
            <div>
              <span className="text-muted-foreground">Metodă plată: </span>
              <span className="font-medium">
                {booking.payment_method === "la_sala" ? "La sală" : "Online"}
              </span>
            </div>
            <Badge
              className={
                isPaid
                  ? "bg-primary text-primary-foreground hover:bg-primary"
                  : "bg-orange-500 text-white hover:bg-orange-500"
              }
            >
              {isPaid ? "Plătit" : "Neplătit"}
            </Badge>
          </div>
        </div>

        {/* Contact card */}
        <div className="mt-6 rounded-xl border border-border bg-background p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Date de contact</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <DetailRow label="Nume" value={booking.guest_name} />
            <DetailRow label="Email" value={booking.guest_email} />
            <DetailRow label="Telefon" value={booking.guest_phone} />
          </dl>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/sali" className="flex-1">
            <Button variant="outline" size="lg" className="w-full">
              Înapoi la săli
            </Button>
          </Link>
          <Link to="/rezervari" className="flex-1">
            <Button variant="outline" size="lg" className="w-full">
              Rezervarea mea
            </Button>
          </Link>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => downloadICS(booking)}
          >
            <Calendar className="h-4 w-4" />
            Adaugă în calendar
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
