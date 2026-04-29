import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Tag, Check, Loader2, AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/external-client";
import {
  formatDateRO,
  parseISODate,
  getDayOfWeek,
} from "@/lib/date-utils";

// ---------- Search params ----------
type CheckoutSearch = {
  date: string;
  start: string;
  end: string;
  duration: number;
  total: number;
  recurrent: string;
  recurrenceEnd: string;
  recurrenceCount: number;
};

export const Route = createFileRoute("/rezerva/$slug")({
  validateSearch: (raw: Record<string, unknown>): CheckoutSearch => ({
    date: typeof raw.date === "string" ? raw.date : "",
    start: typeof raw.start === "string" ? raw.start : "",
    end: typeof raw.end === "string" ? raw.end : "",
    duration: Number(raw.duration) || 0,
    total: Number(raw.total) || 0,
    recurrent: typeof raw.recurrent === "string" ? raw.recurrent : "false",
    recurrenceEnd: typeof raw.recurrenceEnd === "string" ? raw.recurrenceEnd : "",
    recurrenceCount: Number(raw.recurrenceCount) || 0,
  }),
  loader: ({ params }) => ({ slug: params.slug }),
  head: () => ({
    meta: [
      { title: "Finalizează rezervarea — Rezervări Săli" },
      { name: "description", content: "Completează datele și confirmă rezervarea sălii." },
    ],
  }),
  component: CheckoutPage,
});

// ---------- Types ----------
type Room = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  neighbourhood: string | null;
  booking_type: string | null;
  currency: string | null;
};

type PricingRule = {
  id: string;
  price_per_hour: number;
  days_of_week: number[];
  start_time: string | null;
  end_time: string | null;
  priority: number;
  is_active: boolean;
  label: string | null;
};

type Voucher = {
  id: string;
  code: string;
  discount_type: string; // "procent" | "suma"
  discount_value: number;
  max_uses: number | null;
  times_used: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  room_id: string | null;
};

// ---------- Helpers ----------
function generateWeeklyDates(startDateStr: string, endDateStr: string): string[] {
  if (!endDateStr) return [startDateStr];
  const dates: string[] = [];
  const [sy, sm, sd] = startDateStr.split("-").map((n) => parseInt(n, 10));
  const [ey, em, ed] = endDateStr.split("-").map((n) => parseInt(n, 10));
  const end = new Date(ey, em - 1, ed);
  const current = new Date(sy, sm - 1, sd);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function isValidPhone(s: string): boolean {
  return s.replace(/\D/g, "").length >= 10;
}

function pickActivePricing(
  date: Date,
  startHour: number,
  rules: PricingRule[],
): PricingRule | null {
  const dayOfWeek = getDayOfWeek(date);
  const slotTime = `${startHour.toString().padStart(2, "0")}:00:00`;
  const matching = rules
    .filter((r) => {
      if (!r.is_active) return false;
      const dayMatch = (r.days_of_week ?? []).includes(dayOfWeek);
      const timeMatch =
        !r.start_time ||
        !r.end_time ||
        (slotTime >= r.start_time && slotTime < r.end_time);
      return dayMatch && timeMatch;
    })
    .sort((a, b) => b.priority - a.priority);
  return matching[0] ?? null;
}

// ---------- Page ----------
function CheckoutPage() {
  const { slug } = Route.useParams() as { slug: string };
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [pricing, setPricing] = useState<PricingRule[]>([]);
  const [notFound, setNotFound] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // voucher
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // payment
  const [paymentMethod] = useState<"la_sala">("la_sala");

  // invoice
  const [needsInvoice, setNeedsInvoice] = useState(false);
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceVat, setInvoiceVat] = useState("");
  const [invoiceAddress, setInvoiceAddress] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---------- Validation of incoming params ----------
  const paramsValid = !!(
    search.date && search.start && search.end && search.duration > 0 && search.total > 0
  );

  // ---------- Fetch room + pricing ----------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: r } = await supabase
        .from("rooms")
        .select("id, slug, name, address, city, neighbourhood, booking_type, currency")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (cancelled) return;
      if (!r) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRoom(r as Room);

      const { data: pr } = await supabase
        .from("pricing_rules")
        .select("*")
        .eq("room_id", r.id)
        .eq("is_active", true)
        .order("priority", { ascending: false });
      if (cancelled) return;
      setPricing((pr ?? []) as PricingRule[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ---------- Derived ----------
  const currency = room?.currency ?? "RON";
  const dateObj = paramsValid ? parseISODate(search.date) : null;
  const startHour = paramsValid ? parseInt(search.start.slice(0, 2), 10) : 0;
  const activeRule = useMemo(() => {
    if (!dateObj || !pricing.length) return null;
    return pickActivePricing(dateObj, startHour, pricing);
  }, [dateObj, startHour, pricing]);

  const subtotal = search.total;
  const discountAmount = useMemo(() => {
    if (!voucher) return 0;
    if (voucher.discount_type === "procent") {
      return Math.round((subtotal * voucher.discount_value) / 100);
    }
    return Math.min(subtotal, voucher.discount_value);
  }, [voucher, subtotal]);
  const finalTotal = Math.max(0, subtotal - discountAmount);

  // ---------- Voucher apply ----------
  async function applyVoucher() {
    setVoucherError(null);
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucherError("Introdu un cod de voucher.");
      return;
    }
    setVoucherLoading(true);
    const { data, error } = await supabase
      .from("voucher_codes")
      .select("*")
      .ilike("code", code)
      .maybeSingle();
    setVoucherLoading(false);

    if (error || !data) {
      setVoucher(null);
      setVoucherError("Cod invalid.");
      return;
    }
    const v = data as Voucher;
    const now = new Date();
    if (!v.is_active) {
      setVoucher(null);
      setVoucherError("Acest voucher nu mai este activ.");
      return;
    }
    if (v.valid_from && new Date(v.valid_from) > now) {
      setVoucher(null);
      setVoucherError("Acest voucher nu este încă valid.");
      return;
    }
    if (v.valid_until && new Date(v.valid_until) < now) {
      setVoucher(null);
      setVoucherError("Acest voucher a expirat.");
      return;
    }
    if (v.max_uses != null && (v.times_used ?? 0) >= v.max_uses) {
      setVoucher(null);
      setVoucherError("Acest voucher a atins limita de utilizări.");
      return;
    }
    if (v.room_id && room && v.room_id !== room.id) {
      setVoucher(null);
      setVoucherError("Acest voucher nu se aplică pentru această sală.");
      return;
    }
    setVoucher(v);
  }

  function removeVoucher() {
    setVoucher(null);
    setVoucherInput("");
    setVoucherError(null);
  }

  // ---------- Submit ----------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!room || !paramsValid || !dateObj) {
      setSubmitError("Date de rezervare incomplete.");
      return;
    }
    if (!name.trim()) return setSubmitError("Completează numele complet.");
    if (!isValidEmail(email)) return setSubmitError("Email invalid.");
    if (!isValidPhone(phone)) return setSubmitError("Telefon invalid (minim 10 cifre).");
    if (needsInvoice) {
      if (!invoiceName.trim()) return setSubmitError("Completează numele pentru factură.");
      if (!invoiceAddress.trim()) return setSubmitError("Completează adresa de facturare.");
    }

    setSubmitting(true);

    // Re-check availability
    const startTime = `${search.start}:00`;
    const endTime = `${search.end}:00`;
    const { data: overlap } = await supabase
      .from("bookings")
      .select("id, start_time, end_time, status")
      .eq("room_id", room.id)
      .eq("booking_date", search.date)
      .not("status", "in", '("refuzată","anulată","expirată")');

    const conflict = (overlap ?? []).some((b: { start_time: string; end_time: string }) => {
      return b.start_time < endTime && b.end_time > startTime;
    });
    if (conflict) {
      setSubmitting(false);
      setSubmitError("Acest interval a fost rezervat între timp. Te rugăm să alegi alt interval.");
      return;
    }

    const pricePerHour = activeRule?.price_per_hour ?? subtotal / Math.max(1, search.duration);
    const pricingLabel = activeRule?.label ?? null;

    const insertPayload: Record<string, unknown> = {
      room_id: room.id,
      guest_name: name.trim(),
      guest_email: email.trim(),
      guest_phone: phone.trim(),
      booking_date: search.date,
      start_time: startTime,
      end_time: endTime,
      duration_hours: search.duration,
      price_per_hour: pricePerHour,
      pricing_rule_label: pricingLabel,
      subtotal,
      discount_amount: discountAmount,
      voucher_code_id: voucher?.id ?? null,
      voucher_code_used: voucher?.code ?? null,
      total_amount: finalTotal,
      status: room.booking_type === "instant" ? "confirmată" : "în așteptare",
      payment_method: paymentMethod,
      payment_status: "neplatit",
      needs_invoice: needsInvoice,
      invoice_name: needsInvoice ? invoiceName.trim() : null,
      invoice_vat: needsInvoice ? invoiceVat.trim() || null : null,
      invoice_address: needsInvoice ? invoiceAddress.trim() : null,
    };

    const { data, error } = await supabase
      .from("bookings")
      .insert(insertPayload)
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      if (error.code === "23P01") {
        setSubmitError("Acest interval a fost rezervat între timp. Te rugăm să alegi alt interval.");
      } else {
        setSubmitError("A apărut o eroare. Te rugăm să încerci din nou.");
      }
      return;
    }

    const reference = (data as { reference?: string; id: string })?.reference ?? (data as { id: string }).id;
    navigate({ to: "/confirmare", search: { reference } as never });
  }

  // ---------- Render ----------
  if (loading) {
    return (
      <Shell>
        <div className="container mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">
          Se încarcă…
        </div>
      </Shell>
    );
  }

  if (notFound || !room) {
    return (
      <Shell>
        <div className="container mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Sala nu a fost găsită</h1>
          <Link to="/sali" className="mt-4 inline-block text-primary hover:underline">
            Înapoi la săli
          </Link>
        </div>
      </Shell>
    );
  }

  if (!paramsValid || !dateObj) {
    return (
      <Shell>
        <div className="container mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Date de rezervare lipsă</h1>
          <p className="mt-2 text-muted-foreground">
            Te rugăm să alegi o dată și un interval orar de pe pagina sălii.
          </p>
          <Link
            to="/sali/$slug"
            params={{ slug: room.slug }}
            className="mt-4 inline-block text-primary hover:underline"
          >
            Înapoi la {room.name}
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Link
          to="/sali/$slug"
          params={{ slug: room.slug }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Înapoi la sală
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight">Finalizează rezervarea</h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          {/* ===== Left: Summary ===== */}
          <aside className="lg:order-1">
            <div className="sticky top-6 rounded-xl border border-border bg-background p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Rezumat rezervare</h2>
              <p className="mt-1 text-sm text-muted-foreground">{room.name}</p>
              {(room.neighbourhood || room.city) && (
                <p className="text-xs text-muted-foreground">
                  {[room.neighbourhood, room.city].filter(Boolean).join(", ")}
                </p>
              )}

              <div className="mt-5 space-y-3 text-sm">
                <Row label="Data" value={formatDateRO(dateObj)} />
                <Row label="Interval" value={`${search.start}–${search.end}`} />
                <Row
                  label="Durată"
                  value={`${search.duration} ${search.duration === 1 ? "oră" : "ore"}`}
                />
                <Row label="Subtotal" value={`${subtotal} ${currency}`} />

                {voucher && (
                  <Row
                    label={
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Tag className="h-3 w-3" />
                        Voucher {voucher.code}
                      </span>
                    }
                    value={<span className="text-primary">−{discountAmount} {currency}</span>}
                  />
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-base font-semibold">Total</span>
                <span className="text-2xl font-bold text-primary">
                  {finalTotal} {currency}
                </span>
              </div>

              {room.booking_type !== "instant" && (
                <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  Această sală necesită confirmarea proprietarului. Vei primi un răspuns în scurt timp.
                </p>
              )}
            </div>
          </aside>

          {/* ===== Right: Form ===== */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date personale */}
            <section className="rounded-xl border border-border bg-background p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Datele tale</h2>
              <div className="mt-4 grid gap-4">
                <div>
                  <Label htmlFor="name">Nume complet *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                    autoComplete="name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={255}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefon *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="07xxxxxxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      maxLength={20}
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Voucher */}
            <section className="rounded-xl border border-border bg-background p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Voucher</h2>
              {voucher ? (
                <div className="mt-3 flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-medium">{voucher.code}</span>
                    <span className="text-muted-foreground">aplicat (−{discountAmount} {currency})</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeVoucher}
                    className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    Elimină
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Cod voucher"
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                      maxLength={50}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={applyVoucher}
                      disabled={voucherLoading}
                      className="cursor-pointer"
                    >
                      {voucherLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplică"}
                    </Button>
                  </div>
                  {voucherError && (
                    <p className="mt-2 text-xs text-destructive">{voucherError}</p>
                  )}
                </>
              )}
            </section>

            {/* Plată */}
            <section className="rounded-xl border border-border bg-background p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Plată</h2>
              <div className="mt-4 space-y-3">
                <label className="flex cursor-not-allowed items-start gap-3 rounded-md border border-border bg-muted/30 p-3 opacity-60">
                  <input type="radio" disabled className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Plătesc online acum</span>
                      <Badge variant="secondary" className="text-xs">În curând</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Plată cu cardul prin Stripe.</p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-primary bg-primary/5 p-3">
                  <input
                    type="radio"
                    name="payment"
                    checked
                    readOnly
                    className="mt-1 cursor-pointer accent-primary"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Plătesc la sală</div>
                    <p className="text-xs text-muted-foreground">
                      Plătești cu cardul sau cash la sosirea în sală.
                    </p>
                  </div>
                </label>
              </div>
            </section>

            {/* Factură */}
            <section className="rounded-xl border border-border bg-background p-6 shadow-sm">
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={needsInvoice}
                  onCheckedChange={(c) => setNeedsInvoice(c === true)}
                  className="cursor-pointer"
                />
                <span className="text-sm font-medium">Am nevoie de factură</span>
              </label>

              {needsInvoice && (
                <div className="mt-4 grid gap-4">
                  <div>
                    <Label htmlFor="invoice-name">Nume / firmă *</Label>
                    <Input
                      id="invoice-name"
                      value={invoiceName}
                      onChange={(e) => setInvoiceName(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <Label htmlFor="invoice-vat">CUI (opțional)</Label>
                    <Input
                      id="invoice-vat"
                      value={invoiceVat}
                      onChange={(e) => setInvoiceVat(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Label htmlFor="invoice-address">Adresă facturare *</Label>
                    <Input
                      id="invoice-address"
                      value={invoiceAddress}
                      onChange={(e) => setInvoiceAddress(e.target.value)}
                      maxLength={300}
                    />
                  </div>
                </div>
              )}
            </section>

            {submitError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full cursor-pointer text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se procesează…
                </>
              ) : (
                `Confirmă rezervarea · ${finalTotal} ${currency}`
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Prin confirmarea rezervării accepți termenii și condițiile.
            </p>
          </form>
        </div>
      </div>
    </Shell>
  );
}

// ---------- Subcomponents ----------
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
