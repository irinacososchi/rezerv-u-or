import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Calendar, AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/external-client";
import { formatDateRO, parseISODate } from "@/lib/date-utils";

export const Route = createFileRoute("/confirmare")({
  validateSearch: (raw: Record<string, unknown>) => ({
    reference: typeof raw.reference === "string" ? raw.reference : "",
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
  duration_hours: number;
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
  const [booking, setBooking] = useState<BookingFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!reference) {
      setNotFound(true);
      setLoading(false);
      return;
    }
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("bookings_full")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
      } else {
        setBooking(data as BookingFull);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reference]);

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
            {isConfirmed ? "Rezervare confirmată!" : "Cerere trimisă!"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {isConfirmed
              ? "Vei primi detaliile pe email și WhatsApp."
              : "Proprietarul va confirma în curând. Vei fi notificat pe email."}
          </p>
        </div>

        {/* Booking details */}
        <div className="mt-8 rounded-xl border border-border bg-background p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Detalii rezervare</h2>

          <dl className="mt-5 space-y-3 text-sm">
            <DetailRow
              label="Referință"
              value={
                <span className="font-mono font-bold">#{booking.reference}</span>
              }
            />
            <DetailRow label="Sală" value={booking.room_name} />
            {booking.room_address && (
              <DetailRow
                label="Adresă"
                value={[booking.room_address, booking.room_city]
                  .filter(Boolean)
                  .join(", ")}
              />
            )}
            <DetailRow label="Data" value={formatDateRO(dateObj)} />
            <DetailRow label="Interval" value={`${startLabel}–${endLabel}`} />
            <DetailRow
              label="Durată"
              value={`${booking.duration_hours} ${
                booking.duration_hours === 1 ? "oră" : "ore"
              }`}
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
          </dl>

          <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                {booking.subtotal} {currency}
              </span>
            </div>
            {booking.discount_amount > 0 && (
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
                {booking.total_amount} {currency}
              </span>
            </div>
          </div>

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
