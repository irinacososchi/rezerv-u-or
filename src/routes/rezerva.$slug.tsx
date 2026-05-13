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
  intervals: string;
  slots: string;
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
    intervals: typeof raw.intervals === "string" ? raw.intervals : "",
    slots: typeof raw.slots === "string" ? raw.slots : "",
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

  // ---------- Parse slots (new multi-day format) with fallbacks ----------
  type ParsedSlot = { date: string; start: string; end: string };

  const parsedSlots: ParsedSlot[] = useMemo(() => {
    // Format nou (multi-day): "DATE:HH:MM-HH:MM,DATE:HH:MM-HH:MM,..."
    if (search.slots) {
      return search.slots
        .split(",")
        .filter(Boolean)
        .map((s: string) => {
          // First ":" separates DATE from TIME-RANGE (HH:MM-HH:MM contains ":")
          const colonIdx = s.indexOf(":");
          const date = s.slice(0, colonIdx);
          const timeRange = s.slice(colonIdx + 1);
          const [start, end] = timeRange.split("-");
          return { date, start, end };
        });
    }
    // Format vechi (single-day): date + intervals
    if (search.intervals && search.date) {
      return search.intervals
        .split(",")
        .filter(Boolean)
        .map((s: string) => {
          const [start, end] = s.split("-");
          return { date: search.date, start, end };
        });
    }
    // Format mai vechi: date + start + end
    if (search.date && search.start && search.end) {
      return [{ date: search.date, start: search.start, end: search.end }];
    }
    return [];
  }, [search.slots, search.intervals, search.date, search.start, search.end]);

  const isMultiSlot = parsedSlots.length > 1;
  const uniqueDates = Array.from(new Set(parsedSlots.map((s) => s.date)));
  const isMultiDay = uniqueDates.length > 1;
  const firstDate = parsedSlots[0]?.date ?? "";
  const effectiveStart = parsedSlots[0]?.start ?? "";
  const effectiveEnd = parsedSlots[parsedSlots.length - 1]?.end ?? "";

  // ---------- Validation of incoming params ----------
  const paramsValid = !!(
    firstDate && parsedSlots.length > 0 && search.duration > 0
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
  const startHour = paramsValid ? parseInt(effectiveStart.slice(0, 2), 10) : 0;
  const activeRule = useMemo(() => {
    if (!dateObj || !pricing.length) return null;
    return pickActivePricing(dateObj, startHour, pricing);
  }, [dateObj, startHour, pricing]);

  const isRecurrentSearch = search.recurrent === "true";
  const voucherDisabled = isMultiSlot || isRecurrentSearch;

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

    const isRecurrent = search.recurrent === "true" && search.recurrenceCount > 1;

    // Build (date, interval) cartesian list: recurrence weeks × intervals
    const dates: string[] = [search.date];
    if (isRecurrent) {
      const baseDate = parseISODate(search.date);
      for (let i = 1; i < search.recurrenceCount; i++) {
        const next = new Date(baseDate);
        next.setDate(next.getDate() + i * 7);
        const y = next.getFullYear();
        const m = String(next.getMonth() + 1).padStart(2, "0");
        const d = String(next.getDate()).padStart(2, "0");
        dates.push(`${y}-${m}-${d}`);
      }
    } else if (search.recurrenceEnd) {
      // Backward compat: if old flow used recurrenceEnd
      const all = generateWeeklyDates(search.date, search.recurrenceEnd);
      dates.length = 0;
      dates.push(...all);
    }

    const allDateIntervals: { date: string; start: string; end: string }[] = [];
    for (const d of dates) {
      for (const iv of parsedIntervals) {
        allDateIntervals.push({ date: d, start: iv.start, end: iv.end });
      }
    }

    if (allDateIntervals.length === 0) {
      setSubmitError("Niciun interval selectat.");
      return;
    }
    if (allDateIntervals.length > 50) {
      setSubmitError(
        `Prea multe rezervări (${allDateIntervals.length}). Limita e 50. Reduce numărul de intervale sau perioada de recurență.`,
      );
      return;
    }

    setSubmitting(true);

    // Recurrence record (only when more than one date AND single interval per day, kept for compat)
    let recurrenceId: string | null = null;
    if (isRecurrent && dates.length > 1 && parsedIntervals.length === 1) {
      const dayOfWeek = getDayOfWeek(dateObj);
      const { data: rec, error: recError } = await supabase
        .from("recurrences")
        .insert({
          room_id: room.id,
          created_by_email: email.trim(),
          frequency: "saptamanal",
          day_of_week: dayOfWeek,
          start_time: `${parsedIntervals[0].start}:00`,
          end_time: `${parsedIntervals[0].end}:00`,
          first_date: dates[0],
          last_date: dates[dates.length - 1],
          total_bookings: dates.length,
        })
        .select()
        .single();
      if (recError || !rec) {
        setSubmitting(false);
        setSubmitError("Eroare la crearea rezervării recurente.");
        return;
      }
      recurrenceId = (rec as { id: string }).id;
    }

    const bookingGroupId =
      allDateIntervals.length > 1 ? crypto.randomUUID() : null;

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const renterId = currentUser?.id ?? null;

    // Voucher applies only for single booking (1 interval, no recurrence)
    const applyVoucher =
      allDateIntervals.length === 1 && !!voucher && discountAmount > 0;

    const results: {
      slot: { date: string; start: string; end: string };
      success: boolean;
      reference?: string;
      error?: string;
    }[] = [];

    for (let idx = 0; idx < allDateIntervals.length; idx++) {
      const slot = allDateIntervals[idx];
      const slotDateObj = parseISODate(slot.date);
      const startHourN = parseInt(slot.start.slice(0, 2), 10);
      const endHourN = parseInt(slot.end.slice(0, 2), 10);
      const intervalHours = endHourN - startHourN;

      // Compute subtotal for this interval by summing per-hour prices
      let intervalSubtotal = 0;
      let firstRule = null as PricingRule | null;
      for (let h = startHourN; h < endHourN; h++) {
        const r = pickActivePricing(slotDateObj, h, pricing);
        if (!firstRule) firstRule = r;
        intervalSubtotal += r ? Number(r.price_per_hour) : 0;
      }
      const intervalDiscount = applyVoucher ? discountAmount : 0;
      const intervalTotal = Math.max(0, intervalSubtotal - intervalDiscount);
      const intervalPricePerHour =
        intervalHours > 0 ? intervalSubtotal / intervalHours : 0;

      const payload = {
        room_id: room.id,
        renter_id: renterId,
        recurrence_id: recurrenceId,
        recurrence_index: recurrenceId ? idx + 1 : null,
        booking_group_id: bookingGroupId,
        guest_name: name.trim(),
        guest_email: email.trim(),
        guest_phone: phone.trim(),
        booking_date: slot.date,
        start_time: `${slot.start}:00`,
        end_time: `${slot.end}:00`,
        duration_hours: intervalHours,
        price_per_hour: intervalPricePerHour,
        pricing_rule_label: firstRule?.label ?? null,
        subtotal: intervalSubtotal,
        discount_amount: intervalDiscount,
        voucher_code_id: applyVoucher ? voucher?.id ?? null : null,
        voucher_code_used: applyVoucher ? voucher?.code ?? null : null,
        total_amount: intervalTotal,
        status: room.booking_type === "instant" ? "confirmată" : "în așteptare",
        payment_method: paymentMethod,
        payment_status: "neplatit",
        needs_invoice: needsInvoice,
        invoice_name: needsInvoice ? invoiceName.trim() : null,
        invoice_vat: needsInvoice ? invoiceVat.trim() || null : null,
        invoice_address: needsInvoice ? invoiceAddress.trim() : null,
      };

      const { error: insErr } = await supabase
        .from("bookings")
        .insert(payload);

      if (insErr) {
        results.push({ slot, success: false, error: insErr.message });
        continue;
      }

      // Fetch reference best-effort
      const { data: refRow } = await supabase
        .from("bookings")
        .select("reference")
        .eq("guest_email", email.trim().toLowerCase())
        .eq("booking_date", slot.date)
        .eq("start_time", `${slot.start}:00`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      results.push({
        slot,
        success: true,
        reference: refRow?.reference ?? undefined,
      });
    }

    setSubmitting(false);

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (succeeded.length === 0) {
      setSubmitError(
        "Niciuna dintre rezervări nu s-a putut crea. " +
          "Posibil ca intervalele să fie ocupate între timp. " +
          (failed[0]?.error ? `Detalii: ${failed[0].error}` : ""),
      );
      return;
    }

    if (failed.length > 0) {
      const list = failed
        .map((f) => `• ${f.slot.date} ${f.slot.start}–${f.slot.end}`)
        .join("\n");
      alert(
        `Am creat ${succeeded.length} din ${allDateIntervals.length} rezervări.\n\n` +
          `Următoarele intervale nu s-au putut crea (probabil ocupate între timp):\n${list}`,
      );
    }

    navigate({
      to: "/confirmare",
      search: {
        reference: succeeded[0].reference ?? "",
        group: bookingGroupId ?? "",
        recurrent: isRecurrent ? "true" : "false",
        recurrenceCount: isRecurrent ? dates.length : 0,
      } as never,
    });
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
                {isMultiSlot ? (
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Intervale ({parsedIntervals.length})
                    </span>
                    <ul className="mt-1 space-y-0.5">
                      {parsedIntervals.map((iv, i) => (
                        <li key={i} className="text-sm font-medium">
                          {iv.start}–{iv.end}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <Row label="Interval" value={`${effectiveStart}–${effectiveEnd}`} />
                )}
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

              {search.recurrent === "true" && search.recurrenceCount > 0 && (
                <div className="mt-3 rounded-md bg-primary/5 border border-primary/20 p-3 text-sm">
                  <div className="font-medium text-primary">
                    Rezervare recurentă săptămânală
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {search.recurrenceCount} apariții
                    {search.recurrenceEnd && (
                      <>
                        {" "}· până în{" "}
                        {parseISODate(search.recurrenceEnd).toLocaleDateString("ro-RO")}
                      </>
                    )}
                  </div>
                  <div className="font-semibold text-primary mt-1">
                    Total: {search.recurrenceCount * finalTotal} {currency}
                  </div>
                </div>
              )}

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
                      placeholder={voucherDisabled ? "Voucherele nu se aplică aici" : "Cod voucher"}
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                      maxLength={50}
                      disabled={voucherDisabled}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={applyVoucher}
                      disabled={voucherLoading || voucherDisabled}
                      className="cursor-pointer"
                    >
                      {voucherLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplică"}
                    </Button>
                  </div>
                  {voucherError && (
                    <p className="mt-2 text-xs text-destructive">{voucherError}</p>
                  )}
                  {voucherDisabled && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Voucherele se aplică doar la rezervări cu un singur interval, fără recurență.
                    </p>
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

            {/* Factură — în curând */}
            <section
              aria-disabled="true"
              className="rounded-xl border border-border bg-muted/30 p-6 shadow-sm opacity-60 pointer-events-none select-none"
            >
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-3">
                  <Checkbox checked={false} disabled />
                  <span className="text-sm font-medium text-muted-foreground">
                    Am nevoie de factură
                  </span>
                </label>
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  În curând
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Emiterea facturilor va fi disponibilă într-o versiune viitoare.
              </p>
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
