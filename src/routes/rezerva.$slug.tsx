import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Tag, Check, Loader2, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, X, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  formatDateISO,
  parseISODate,
  getDayOfWeek,
  DAY_NAMES_RO,
} from "@/lib/date-utils";
import {
  intervalsOverlap,
  slotFromTime,
  SLOT_GRANULARITY_MINUTES,
  timeToMinutes,
  minutesToTime,
} from "@/lib/time-slots";

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
  google_maps_url: string | null;
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
type ParsedSlot = { date: string; start: string; end: string };

function slotKey(s: ParsedSlot): string {
  return `${s.date}|${s.start}|${s.end}`;
}

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
  slotStart: string,
  rules: PricingRule[],
): PricingRule | null {
  const dayOfWeek = getDayOfWeek(date);
  const slotTime = `${slotStart}:00`;
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

function getPriceForSlot(date: Date, slotStart: string, rules: PricingRule[]): number {
  const r = pickActivePricing(date, slotStart, rules);
  // price_per_hour is hourly; scale to slot granularity.
  return r ? (Number(r.price_per_hour) * SLOT_GRANULARITY_MINUTES) / 60 : 0;
}

function getPriceForSlotDetailed(
  date: Date,
  slotStart: string,
  rules: PricingRule[],
): { price: number; label: string | null } {
  const r = pickActivePricing(date, slotStart, rules);
  return {
    price: r ? (Number(r.price_per_hour) * SLOT_GRANULARITY_MINUTES) / 60 : 0,
    label: r?.label ?? null,
  };
}

function calcSlotTotal(s: ParsedSlot, rules: PricingRule[]): number {
  const startMin = timeToMinutes(s.start);
  const endMin = timeToMinutes(s.end);
  const date = parseISODate(s.date);
  let total = 0;
  for (let m = startMin; m < endMin; m += SLOT_GRANULARITY_MINUTES) {
    total += getPriceForSlot(date, minutesToTime(m), rules);
  }
  return total;
}

function calcSlotPricing(
  s: ParsedSlot,
  rules: PricingRule[],
): { totalPrice: number; labels: string[] } {
  const startMin = timeToMinutes(s.start);
  const endMin = timeToMinutes(s.end);
  const date = parseISODate(s.date);
  const labelsSet = new Set<string>();
  let total = 0;
  for (let m = startMin; m < endMin; m += SLOT_GRANULARITY_MINUTES) {
    const detail = getPriceForSlotDetailed(date, minutesToTime(m), rules);
    total += detail.price;
    if (detail.label) labelsSet.add(detail.label);
  }
  return { totalPrice: total, labels: Array.from(labelsSet) };
}

type PricingSubInterval = {
  start: string;
  end: string;
  price: number;
  label: string | null;
};

function splitSlotByPricing(s: ParsedSlot, rules: PricingRule[]): PricingSubInterval[] {
  const startMin = timeToMinutes(s.start);
  const endMin = timeToMinutes(s.end);
  const date = parseISODate(s.date);

  const subIntervals: PricingSubInterval[] = [];
  let currentLabel: string | null = null;
  let currentStartMin = startMin;
  let currentSum = 0;

  for (let m = startMin; m < endMin; m += SLOT_GRANULARITY_MINUTES) {
    const detail = getPriceForSlotDetailed(date, minutesToTime(m), rules);
    if (m === startMin) {
      currentLabel = detail.label;
      currentStartMin = m;
      currentSum = detail.price;
    } else if (detail.label !== currentLabel) {
      subIntervals.push({
        start: minutesToTime(currentStartMin),
        end: minutesToTime(m),
        price: currentSum,
        label: currentLabel,
      });
      currentLabel = detail.label;
      currentStartMin = m;
      currentSum = detail.price;
    } else {
      currentSum += detail.price;
    }
  }

  if (endMin > startMin) {
    subIntervals.push({
      start: minutesToTime(currentStartMin),
      end: minutesToTime(endMin),
      price: currentSum,
      label: currentLabel,
    });
  }
  return subIntervals;
}


function BookingSlotsPreview({
  allSlots,
  excludedKeys,
  onToggleExclusion,
  busyKeys,
  pricing,
  currency,
}: {
  allSlots: ParsedSlot[];
  excludedKeys: Set<string>;
  onToggleExclusion: (s: ParsedSlot) => void;
  busyKeys: Set<string>;
  pricing: PricingRule[];
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, ParsedSlot[]>();
    for (const s of allSlots) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allSlots]);

  // Apare preview-ul dacă:
  //  - sunt multiple slot-uri, SAU
  //  - un singur slot care acoperă mai multe pricing rules, SAU
  //  - există slot-uri ocupate (chiar și single)
  const hasMultipleSlots = allSlots.length > 1;
  const hasBusyAny = allSlots.some((s) => busyKeys.has(slotKey(s)));
  const hasMixedPricing =
    allSlots.length === 1 &&
    (() => {
      const s = allSlots[0];
      const labelsSet = new Set<string | null>();
      const startMin = timeToMinutes(s.start);
      const endMin = timeToMinutes(s.end);
      const date = parseISODate(s.date);
      for (let m = startMin; m < endMin; m += SLOT_GRANULARITY_MINUTES) {
        const detail = getPriceForSlotDetailed(date, minutesToTime(m), pricing);
        labelsSet.add(detail.label);
      }
      return labelsSet.size > 1;
    })();

  if (!hasMultipleSlots && !hasMixedPricing && !hasBusyAny) return null;

  const includedCount = allSlots.filter((s) => !excludedKeys.has(slotKey(s))).length;
  const excludedCount = allSlots.length - includedCount;
  const busyIncludedCount = allSlots.filter(
    (s) => busyKeys.has(slotKey(s)) && !excludedKeys.has(slotKey(s)),
  ).length;

  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 hover:bg-secondary/50 transition cursor-pointer"
      >
        <div className="text-left">
          <div className="font-medium text-sm">
            {hasMultipleSlots
              ? `Detalii rezervări (${includedCount} ${includedCount === 1 ? "rezervare" : "rezervări"})`
              : "Defalcare tarife"}
          </div>
          <div className="text-xs mt-0.5 space-y-0.5">
            {excludedCount > 0 && (
              <div className="text-muted-foreground">
                {excludedCount} {excludedCount === 1 ? "exclusă" : "excluse"} manual
              </div>
            )}
            {busyIncludedCount > 0 && (
              <div className="text-destructive font-medium">
                ⚠ {busyIncludedCount} slot{busyIncludedCount === 1 ? "" : "-uri"} ocupat{busyIncludedCount === 1 ? "" : "e"} — exclude pentru a continua
              </div>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border bg-background p-3 max-h-96 overflow-y-auto">
          {allSlots.length > 1 && (
            <p className="text-xs text-muted-foreground mb-3">
              Click pe orice rezervare pentru a o exclude din acest checkout. Slot-urile excluse vor fi sărite la submit.
            </p>
          )}
          <ul className="space-y-3">
            {groupedByDate.map(([date, slots]) => {
              const dateObj = parseISODate(date);
              const dow = getDayOfWeek(dateObj);
              return (
                <li key={date}>
                  <div className="text-sm font-medium mb-1">
                    {DAY_NAMES_RO[dow]}, {dateObj.getDate()}.
                    {String(dateObj.getMonth() + 1).padStart(2, "0")}.
                    {dateObj.getFullYear()}
                  </div>
                  <ul className="space-y-1 ml-2">
                    {slots.map((s, i) => {
                      const isExcluded = excludedKeys.has(slotKey(s));
                      const isBusy = busyKeys.has(slotKey(s));
                      const { totalPrice, labels } = calcSlotPricing(s, pricing);
                      const isReadOnly = allSlots.length === 1;

                      if (isReadOnly) {
                        const subIntervals = splitSlotByPricing(s, pricing);
                        if (subIntervals.length > 1) {
                          return (
                            <li key={i} className="space-y-1">
                              {subIntervals.map((sub, j) => (
                                <div
                                  key={j}
                                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                                >
                                  <span className="font-medium">
                                    {sub.start}–{sub.end}
                                  </span>
                                  <div className="flex flex-col items-end">
                                    <span className="font-medium">
                                      {sub.price} {currency}
                                    </span>
                                    {sub.label && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {sub.label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </li>
                          );
                        }
                        return (
                          <li
                            key={i}
                            className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                              isBusy
                                ? "border-destructive/40 bg-destructive/5"
                                : "border-border bg-background"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isBusy && (
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              )}
                              <span className="font-medium">
                                {s.start}–{s.end}
                              </span>
                              {isBusy && (
                                <span className="ml-1 inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                                  Ocupat
                                </span>
                              )}
                            </span>
                            <div className="flex flex-col items-end">
                              <span className="font-medium">
                                {totalPrice} {currency}
                              </span>
                              {labels.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {labels.join(", ")}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      }

                      return (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => onToggleExclusion(s)}
                            className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm transition cursor-pointer ${
                              isExcluded
                                ? "border-border bg-muted/40 text-muted-foreground line-through"
                                : isBusy
                                  ? "border-destructive/40 bg-destructive/5 hover:border-destructive/60"
                                  : "border-border bg-background hover:border-primary"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isExcluded ? (
                                <X className="h-3.5 w-3.5 text-destructive" />
                              ) : isBusy ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              )}
                              <span className="font-medium">
                                {s.start}–{s.end}
                              </span>
                              {isBusy && !isExcluded && (
                                <span className="ml-1 inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                                  Ocupat
                                </span>
                              )}
                            </span>
                            <div className="flex flex-col items-end">
                              <span className={isExcluded ? "text-muted-foreground/60" : "font-medium"}>
                                {totalPrice} {currency}
                              </span>
                              {labels.length > 0 && (
                                <span className={`text-[10px] ${isExcluded ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                                  {labels.join(", ")}
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
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

  // ---------- Auth / profile prefill ----------
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [renterUserId, setRenterUserId] = useState<string | null>(null);
  const [, setProfileLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setIsLoggedIn(false);
        setRenterUserId(null);
        setProfileLoaded(true);
        return;
      }
      setIsLoggedIn(true);
      setRenterUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      setName((profile?.full_name ?? "").trim());
      setEmail((profile?.email ?? user.email ?? "").trim());
      setPhone((profile?.phone ?? "").trim());
      setProfileLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ---------- Parse slots (new multi-day format) with fallbacks ----------
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
        .select("id, slug, name, address, city, neighbourhood, google_maps_url, booking_type, currency")
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
  const dateObj = paramsValid ? parseISODate(firstDate) : null;
  const slotStart = paramsValid ? slotFromTime(effectiveStart) : "";
  const activeRule = useMemo(() => {
    if (!dateObj || !pricing.length) return null;
    return pickActivePricing(dateObj, slotStart, pricing);
  }, [dateObj, slotStart, pricing]);

  const isRecurrentSearch = search.recurrent === "true";
  const isRecurringView =
    isRecurrentSearch && (search.recurrenceCount ?? 0) > 0 && !isMultiDay;

  // ---------- Build full list of slots that WILL be created (incl recurrence) ----------
  const allSlotsToCreate = useMemo<ParsedSlot[]>(() => {
    const slots: ParsedSlot[] = [...parsedSlots];
    const recurrenceCount = search.recurrenceCount ?? 0;
    if (isRecurrentSearch && recurrenceCount > 1 && !isMultiDay && parsedSlots.length > 0) {
      const baseDate = parseISODate(parsedSlots[0].date);
      for (let i = 1; i < recurrenceCount; i++) {
        const nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + i * 7);
        const dateStr = formatDateISO(nextDate);
        for (const slot of parsedSlots) {
          slots.push({ ...slot, date: dateStr });
        }
      }
    }
    return slots;
  }, [parsedSlots, isRecurrentSearch, search.recurrenceCount, isMultiDay]);

  const [excludedSlotKeys, setExcludedSlotKeys] = useState<Set<string>>(new Set());

  // ---------- Availability check (3C.3) ----------
  const [busySlotKeys, setBusySlotKeys] = useState<Set<string>>(new Set());
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const finalSlotsToCreate = useMemo(
    () => allSlotsToCreate.filter((s) => !excludedSlotKeys.has(slotKey(s))),
    [allSlotsToCreate, excludedSlotKeys],
  );

  function toggleSlotExclusion(s: ParsedSlot) {
    const key = slotKey(s);
    setExcludedSlotKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const busyIncludedSlots = useMemo(
    () => finalSlotsToCreate.filter((s) => busySlotKeys.has(slotKey(s))),
    [finalSlotsToCreate, busySlotKeys],
  );
  const hasBusyConflicts = busyIncludedSlots.length > 0;

  const checkSlotAvailability = async (
    slotsToCheck: ParsedSlot[],
  ): Promise<Set<string>> => {
    if (slotsToCheck.length === 0 || !room) return new Set();
    const dates = Array.from(new Set(slotsToCheck.map((s) => s.date)));
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    const { data, error } = await supabase
      .from("bookings")
      .select("booking_date, start_time, end_time, status")
      .eq("room_id", room.id)
      .gte("booking_date", minDate)
      .lte("booking_date", maxDate)
      .not("status", "in", '("refuzată","anulată","expirată")');

    if (error) {
      console.error("availability check error:", error);
      throw error;
    }

    const existingBookings = (data ?? []) as {
      booking_date: string;
      start_time: string;
      end_time: string;
    }[];
    const busy = new Set<string>();

    for (const slot of slotsToCheck) {
      const conflict = existingBookings.some((b) => {
        if (b.booking_date !== slot.date) return false;
        return intervalsOverlap(
          slot.start,
          slot.end,
          slotFromTime(b.start_time),
          slotFromTime(b.end_time),
        );
      });
      if (conflict) busy.add(slotKey(slot));
    }
    return busy;
  };

  useEffect(() => {
    let cancelled = false;
    async function runInitialCheck() {
      if (allSlotsToCreate.length === 0 || !room) return;
      setCheckingAvailability(true);
      setAvailabilityError(null);
      try {
        const busy = await checkSlotAvailability(allSlotsToCreate);
        if (!cancelled) setBusySlotKeys(busy);
      } catch {
        if (!cancelled)
          setAvailabilityError("Nu am putut verifica disponibilitatea. Reîncearcă.");
      } finally {
        if (!cancelled) setCheckingAvailability(false);
      }
    }
    runInitialCheck();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSlotsToCreate.length, room?.id]);

  // ---------- Self-overlap check (warning, non-blocking) ----------
  type SelfConflict = { date: string; start: string; end: string };
  const [selfConflicts, setSelfConflicts] = useState<SelfConflict[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!renterUserId || finalSlotsToCreate.length === 0) {
        setSelfConflicts([]);
        return;
      }
      const dates = Array.from(new Set(finalSlotsToCreate.map((s) => s.date)));
      const { data, error } = await supabase
        .from("bookings")
        .select("booking_date, start_time, end_time, status, room_id")
        .eq("renter_id", renterUserId)
        .in("status", ["în așteptare", "confirmată"])
        .in("booking_date", dates);
      if (cancelled) return;
      if (error) {
        setSelfConflicts([]);
        return;
      }
      const existing = (data ?? []) as {
        booking_date: string;
        start_time: string;
        end_time: string;
        room_id: string;
      }[];
      const conflicts: SelfConflict[] = [];
      for (const s of finalSlotsToCreate) {
        const hit = existing.some((b) => {
          if (b.booking_date !== s.date) return false;
          // Skip if same room+exact same slot (means it's already-this-booking edge);
          // since this is pre-insert, normally no match — but guard just in case.
          if (
            b.room_id === room?.id &&
            slotFromTime(b.start_time) === s.start &&
            slotFromTime(b.end_time) === s.end
          ) {
            return true;
          }
          return intervalsOverlap(
            s.start,
            s.end,
            slotFromTime(b.start_time),
            slotFromTime(b.end_time),
          );
        });
        if (hit) conflicts.push({ date: s.date, start: s.start, end: s.end });
      }
      setSelfConflicts(conflicts);
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renterUserId, finalSlotsToCreate, room?.id]);

  const recalculatedTotal = useMemo(() => {
    return finalSlotsToCreate.reduce((sum, s) => sum + calcSlotTotal(s, pricing), 0);
  }, [finalSlotsToCreate, pricing]);

  const recalculatedDuration = useMemo(() => {
    return finalSlotsToCreate.reduce((sum, s) => {
      return sum + (timeToMinutes(s.end) - timeToMinutes(s.start)) / 60;
    }, 0);
  }, [finalSlotsToCreate]);

  const voucherDisabled =
    isMultiSlot || isMultiDay || isRecurrentSearch || finalSlotsToCreate.length !== 1;

  const subtotal = recalculatedTotal;
  const discountAmount = useMemo(() => {
    if (!voucher || finalSlotsToCreate.length !== 1) return 0;
    if (voucher.discount_type === "procent") {
      return Math.round((subtotal * voucher.discount_value) / 100);
    }
    return Math.min(subtotal, voucher.discount_value);
  }, [voucher, subtotal, finalSlotsToCreate.length]);
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

    const _isRecurrentEarly = search.recurrent === "true" && search.recurrenceCount > 1;
    console.warn("=== HANDLE SUBMIT START ===", {
      parsedSlotsCount: parsedSlots?.length,
      finalSlotsToCreateCount: finalSlotsToCreate?.length,
      isRecurrent: _isRecurrentEarly,
      isRecurrenceCheckout: _isRecurrentEarly && search.recurrenceCount > 1,
      recurrenceCount: search.recurrenceCount,
    });

    if (!room || !paramsValid || !dateObj) {
      console.warn("=== EARLY RETURN ===", { reason: "missing_room_or_params" });
      setSubmitError("Date de rezervare incomplete.");
      return;
    }
    if (!name.trim()) {
      console.warn("=== EARLY RETURN ===", { reason: "validation_failed_name" });
      return setSubmitError(
        isLoggedIn
          ? "Numele lipsește din contul tău. Te rugăm să-l completezi în Cont înainte de a continua."
          : "Completează numele complet.",
      );
    }
    if (!isValidEmail(email)) {
      console.warn("=== EARLY RETURN ===", { reason: "validation_failed_email" });
      return setSubmitError(
        isLoggedIn
          ? "Emailul lipsește din contul tău. Te rugăm să-l completezi în Cont înainte de a continua."
          : "Email invalid.",
      );
    }
    if (!isValidPhone(phone)) {
      console.warn("=== EARLY RETURN ===", { reason: "validation_failed_phone" });
      return setSubmitError(
        isLoggedIn
          ? "Telefonul lipsește din contul tău. Te rugăm să-l completezi în Cont înainte de a continua."
          : "Telefon invalid (minim 10 cifre).",
      );
    }

    const isRecurrent = search.recurrent === "true" && search.recurrenceCount > 1;

    // Use precomputed finalSlotsToCreate (already accounts for recurrence and exclusions)
    const allDateIntervals: { date: string; start: string; end: string }[] =
      finalSlotsToCreate.map((s) => ({ date: s.date, start: s.start, end: s.end }));

    if (allDateIntervals.length === 0) {
      console.warn("=== EARLY RETURN ===", { reason: "no_final_slots" });
      setSubmitError("Niciun interval selectat.");
      return;
    }
    if (allDateIntervals.length > 50) {
      console.warn("=== EARLY RETURN ===", { reason: "too_many_slots", count: allDateIntervals.length });
      setSubmitError(
        `Prea multe rezervări (${allDateIntervals.length}). Limita e 50. Reduce numărul de intervale sau perioada de recurență.`,
      );
      return;
    }

    setSubmitting(true);

    // Revalidare disponibilitate înainte de submit (race condition guard)
    try {
      const freshBusy = await checkSlotAvailability(finalSlotsToCreate);
      if (freshBusy.size > 0) {
        console.warn("=== EARLY RETURN ===", { reason: "precheck_busy", count: freshBusy.size });
        setBusySlotKeys((prev) => {
          const merged = new Set(prev);
          freshBusy.forEach((k) => merged.add(k));
          return merged;
        });
        setSubmitting(false);
        setSubmitError(
          `Au apărut conflicte de ultim moment — ${freshBusy.size} slot${freshBusy.size === 1 ? "" : "-uri"} ` +
            `${freshBusy.size === 1 ? "a fost rezervat" : "au fost rezervate"} de altcineva între timp. ` +
            `Verifică preview-ul și exclude slot-urile marcate ca ocupate.`,
        );
        return;
      }
    } catch {
      console.warn("=== EARLY RETURN ===", { reason: "precheck_threw" });
      setSubmitting(false);
      setSubmitError("Nu am putut verifica disponibilitatea. Reîncearcă peste câteva secunde.");
      return;
    }


    // Recurrence record (only when recurrence active, single-day, single interval)
    let recurrenceId: string | null = null;
    const recurrenceDateCount = isMultiDay
      ? 0
      : isRecurrent
        ? search.recurrenceCount
        : 1;
    if (isRecurrent && !isMultiDay && parsedSlots.length === 1 && recurrenceDateCount > 1) {
      const dayOfWeek = getDayOfWeek(dateObj);
      console.warn("=== INSERT RECURRENCES START ===", {
        isRecurrenceCheckout: isRecurrent && search.recurrenceCount > 1,
        room_id: room.id,
        day_of_week: dayOfWeek,
        total_bookings: recurrenceDateCount,
        first_date: allDateIntervals[0].date,
        last_date: allDateIntervals[allDateIntervals.length - 1].date,
      });
      const { data: rec, error: recError } = await supabase
        .from("recurrences")
        .insert({
          room_id: room.id,
          created_by_email: email.trim(),
          frequency: "saptamanal",
          day_of_week: dayOfWeek,
          start_time: `${parsedSlots[0].start}:00`,
          end_time: `${parsedSlots[0].end}:00`,
          first_date: allDateIntervals[0].date,
          last_date: allDateIntervals[allDateIntervals.length - 1].date,
          total_bookings: recurrenceDateCount,
        })
        .select()
        .single();
      console.warn("=== INSERT RECURRENCES RESULT ===", {
        data: rec,
        error: recError,
        errorMessage: recError?.message,
        errorCode: (recError as { code?: string } | null)?.code,
      });
      if (recError || !rec) {
        console.warn("=== EARLY RETURN ===", { reason: "recurrences_insert_failed", error: recError?.message });
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

    const isRecurrenceCheckout = isRecurrent && search.recurrenceCount > 1;

    const results: {
      slot: { date: string; start: string; end: string };
      success: boolean;
      reference?: string;
      error?: string;
    }[] = [];

    for (let idx = 0; idx < allDateIntervals.length; idx++) {
      const slot = allDateIntervals[idx];
      const slotDateObj = parseISODate(slot.date);
      const startMin = timeToMinutes(slot.start);
      const endMin = timeToMinutes(slot.end);
      const intervalMinutes = endMin - startMin;
      const intervalHours = intervalMinutes / 60;

      // Compute subtotal for this interval by summing per-slot prices.
      let intervalSubtotal = 0;
      let firstRule = null as PricingRule | null;
      for (let m = startMin; m < endMin; m += SLOT_GRANULARITY_MINUTES) {
        const slotStartStr = minutesToTime(m);
        const r = pickActivePricing(slotDateObj, slotStartStr, pricing);
        if (!firstRule) firstRule = r;
        intervalSubtotal += r
          ? (Number(r.price_per_hour) * SLOT_GRANULARITY_MINUTES) / 60
          : 0;
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
        is_recurring: isRecurrenceCheckout,
        guest_name: name.trim(),
        guest_email: email.trim(),
        guest_phone: phone.trim(),
        booking_date: slot.date,
        start_time: `${slot.start}:00`,
        end_time: `${slot.end}:00`,
        duration_hours: intervalHours,
        duration_minutes: intervalMinutes,
        price_per_hour: intervalPricePerHour,
        pricing_rule_label: firstRule?.label ?? null,
        subtotal: intervalSubtotal,
        discount_amount: intervalDiscount,
        voucher_code_id: applyVoucher ? voucher?.id ?? null : null,
        voucher_code_used: applyVoucher ? voucher?.code ?? null : null,
        total_amount: intervalTotal,
        status: recurrenceId ? "în așteptare" : (room.booking_type === "instant" ? "confirmată" : "în așteptare"),
        payment_method: paymentMethod,
        payment_status: "neplatit",
        needs_invoice: needsInvoice,
        invoice_name: needsInvoice ? invoiceName.trim() : null,
        invoice_vat: needsInvoice ? invoiceVat.trim() || null : null,
        invoice_address: needsInvoice ? invoiceAddress.trim() : null,
      };

      console.warn("=== DEBUG SUBMIT ===", {
        is_recurring: payload.is_recurring,
        booking_group_id: payload.booking_group_id,
        isRecurrent: isRecurrent,
        isRecurrenceCheckout: isRecurrenceCheckout,
        recurrenceCount: search.recurrenceCount,
        searchRecurrent: search.recurrent,
      });

      console.warn("=== PAYLOAD CHEI ===", Object.keys(payload));

      const { data: insertData, error: insErr } = await supabase
        .from("bookings")
        .insert(payload)
        .select()
        .single();

      console.warn("=== INSERT BOOKING RESULT ===", {
        bookingId: (insertData as { id?: string } | null)?.id,
        is_recurring_returned: (insertData as { is_recurring?: boolean } | null)?.is_recurring,
        booking_group_id_returned: (insertData as { booking_group_id?: string } | null)?.booking_group_id,
        error: insErr?.message,
      });

      if (insErr) {
        console.warn("=== EARLY RETURN (per-slot) ===", { reason: "booking_insert_failed", slot, error: insErr.message });
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
        recurrenceCount: isRecurrent ? recurrenceDateCount : 0,
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
              {(room.neighbourhood || room.city) &&
                (() => {
                  const fullAddress = [room.neighbourhood, room.city].filter(Boolean).join(", ");
                  const cls = "text-xs text-muted-foreground";
                  return room.google_maps_url ? (
                    <a
                      href={room.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${cls} hover:underline`}
                    >
                      {fullAddress}
                    </a>
                  ) : (
                    <p className={cls}>{fullAddress}</p>
                  );
                })()}

              {!isRecurringView && (
                <>
                  <div className="mt-5 space-y-3 text-sm">
                    {isMultiDay ? (
                      <div>
                        <span className="text-sm text-muted-foreground">
                          Rezervări ({parsedSlots.length} intervale în {uniqueDates.length} zile)
                        </span>
                        <ul className="mt-2 space-y-2">
                          {uniqueDates.map((d) => {
                            const slotsForDate = parsedSlots.filter((s) => s.date === d);
                            const dObj = parseISODate(d);
                            return (
                              <li key={d} className="border-b border-border pb-2 last:border-0">
                                <div className="text-sm font-medium">
                                  {formatDateRO(dObj)}
                                </div>
                                <ul className="ml-3 mt-1">
                                  {slotsForDate.map((s, i) => (
                                    <li key={i} className="text-sm">
                                      {s.start}–{s.end}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <>
                        <Row label="Data" value={formatDateRO(dateObj)} />
                        {isMultiSlot ? (
                          <div>
                            <span className="text-sm text-muted-foreground">
                              Intervale ({parsedSlots.length})
                            </span>
                            <ul className="mt-1 space-y-0.5">
                              {parsedSlots.map((iv, i) => (
                                <li key={i} className="text-sm font-medium">
                                  {iv.start}–{iv.end}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <Row label="Interval" value={`${effectiveStart}–${effectiveEnd}`} />
                        )}
                      </>
                    )}
                    <Row
                      label="Durată"
                      value={`${recalculatedDuration} ${recalculatedDuration === 1 ? "oră" : "ore"}`}
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

                  {recalculatedTotal !== (search.total ?? 0) && (
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      Total actualizat după excluderea manuală a unor slot-uri.
                    </p>
                  )}
                </>
              )}

              {!isRecurringView && (() => {
                const allLabels = new Set<string>();
                for (const s of finalSlotsToCreate) {
                  const startMin = timeToMinutes(s.start);
                  const endMin = timeToMinutes(s.end);
                  const date = parseISODate(s.date);
                  for (let m = startMin; m < endMin; m += SLOT_GRANULARITY_MINUTES) {
                    const detail = getPriceForSlotDetailed(date, minutesToTime(m), pricing);
                    if (detail.label) allLabels.add(detail.label);
                  }
                }
                if (allLabels.size === 0) return null;
                return (
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    Tarife aplicate: {Array.from(allLabels).join(", ")}
                  </p>
                );
              })()}

              {checkingAvailability && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Se verifică disponibilitatea slot-urilor...
                </div>
              )}

              {availabilityError && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-medium">Eroare la verificare</p>
                  <p className="mt-1 text-xs">{availabilityError}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      setCheckingAvailability(true);
                      setAvailabilityError(null);
                      try {
                        const busy = await checkSlotAvailability(allSlotsToCreate);
                        setBusySlotKeys(busy);
                      } catch {
                        setAvailabilityError("Nu am putut verifica disponibilitatea. Reîncearcă.");
                      } finally {
                        setCheckingAvailability(false);
                      }
                    }}
                    className="mt-2 text-xs underline hover:no-underline cursor-pointer"
                  >
                    Reîncearcă
                  </button>
                </div>
              )}

              {!isRecurringView && (
                <BookingSlotsPreview
                  allSlots={allSlotsToCreate}
                  excludedKeys={excludedSlotKeys}
                  onToggleExclusion={toggleSlotExclusion}
                  busyKeys={busySlotKeys}
                  pricing={pricing}
                  currency={currency}
                />
              )}

              {!isRecurringView && hasBusyConflicts && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setExcludedSlotKeys((prev) => {
                        const next = new Set(prev);
                        busyIncludedSlots.forEach((s) => next.add(slotKey(s)));
                        return next;
                      });
                    }}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    Exclude automat toate slot-urile ocupate ({busyIncludedSlots.length})
                  </button>
                </div>
              )}

              {isRecurringView && (
                <div className="mt-5 rounded-md bg-primary/5 border border-primary/20 p-4 text-sm space-y-3">
                  {(() => {
                    const startDate = parseISODate(firstDate);
                    const weekday = DAY_NAMES_RO[getDayOfWeek(startDate)];
                    const monthMap = new Map<string, number>();
                    for (const s of finalSlotsToCreate) {
                      const d = parseISODate(s.date);
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                      monthMap.set(key, (monthMap.get(key) ?? 0) + calcSlotTotal(s, pricing));
                    }
                    const sortedKeys = Array.from(monthMap.keys()).sort();
                    const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
                    const proRataCurrentMonth = monthMap.get(startMonthKey) ?? 0;
                    const firstFullMonthKey = sortedKeys.find((k) => k > startMonthKey);
                    const monthlyPrice = firstFullMonthKey ? (monthMap.get(firstFullMonthKey) ?? 0) : 0;
                    const startsFirstOfMonth = startDate.getDate() === 1;
                    return (
                      <>
                        <div className="space-y-2">
                          <Row label="Data început" value={formatDateRO(startDate)} />
                          <Row label="Interval" value={`${effectiveStart}–${effectiveEnd}`} />
                          <Row
                            label="Recurență"
                            value={`În fiecare ${weekday}, se reînnoiește lunar`}
                          />
                        </div>
                        <div className="space-y-2 border-t border-primary/10 pt-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">Preț lunar:</span>
                            <span className="text-right font-semibold text-primary">
                              {monthlyPrice.toFixed(2)} {currency}
                            </span>
                          </div>
                          {!startsFirstOfMonth && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">Luna curentă (pro-rata):</span>
                              <span className="text-right font-medium">
                                {proRataCurrentMonth.toFixed(2)} {currency}
                              </span>
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                            Prima plată include luna curentă pro-rata. Apoi se facturează lunar.
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {search.recurrent === "true" && search.recurrenceCount > 1 && !isMultiDay && room.booking_type === "instant" && (
                <Alert className="mt-3 border-blue-200 bg-blue-50 text-blue-900 [&>svg]:text-blue-600">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs text-blue-900">
                    Rezervările recurente necesită aprobarea proprietarului. Vei primi o confirmare după ce proprietarul acceptă seria.
                  </AlertDescription>
                </Alert>
              )}

              {room.booking_type !== "instant" && !(search.recurrent === "true" && search.recurrenceCount > 1) && (
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
                    readOnly={isLoggedIn}
                    disabled={isLoggedIn}
                    className={isLoggedIn ? "bg-muted/40 text-foreground/80 cursor-not-allowed focus-visible:ring-0" : ""}
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
                      readOnly={isLoggedIn}
                      disabled={isLoggedIn}
                      className={isLoggedIn ? "bg-muted/40 text-foreground/80 cursor-not-allowed focus-visible:ring-0" : ""}
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
                      readOnly={isLoggedIn}
                      disabled={isLoggedIn}
                      className={isLoggedIn ? "bg-muted/40 text-foreground/80 cursor-not-allowed focus-visible:ring-0" : ""}
                    />
                  </div>
                </div>
                {isLoggedIn && (
                  <p className="text-xs text-muted-foreground">
                    Aceste date sunt preluate din contul tău.{" "}
                    <Link to="/cont" className="text-primary hover:underline">
                      Modifică în Cont →
                    </Link>
                  </p>
                )}
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
                      Voucherele se aplică doar la rezervări cu un singur interval, fără recurență sau multi-zi.
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

            {selfConflicts.length > 0 && (() => {
              const isRecurring = search.recurrent === "true" && search.recurrenceCount > 1;
              const fmt = (c: SelfConflict) => {
                const d = parseISODate(c.date);
                const dd = String(d.getDate()).padStart(2, "0");
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                return `${dd}.${mm}.${d.getFullYear()} · ${c.start}–${c.end}`;
              };
              const shown = selfConflicts.slice(0, 5);
              const extra = selfConflicts.length - shown.length;
              return (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm text-amber-900">
                    {isRecurring || selfConflicts.length > 1 ? (
                      <>
                        <div className="font-medium">Unele date se suprapun cu rezervările tale</div>
                        <div className="mt-1">
                          {selfConflicts.length} din sesiunile recurente se suprapun cu rezervări existente:
                        </div>
                        <ul className="mt-1 list-disc pl-5 text-xs">
                          {shown.map((c) => (
                            <li key={`${c.date}-${c.start}-${c.end}`}>{fmt(c)}</li>
                          ))}
                        </ul>
                        {extra > 0 && (
                          <div className="mt-1 text-xs">și încă {extra}</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="font-medium">Suprapunere cu o altă rezervare</div>
                        <div className="mt-1">
                          Ai deja o rezervare în acest interval. Poți continua, dar verifică să nu fie o greșeală.
                        </div>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              );
            })()}



            <Button
              type="submit"
              size="lg"
              disabled={
                submitting ||
                finalSlotsToCreate.length === 0 ||
                hasBusyConflicts ||
                checkingAvailability
              }
              className="w-full cursor-pointer text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se procesează…
                </>
              ) : checkingAvailability ? (
                "Se verifică disponibilitatea..."
              ) : hasBusyConflicts ? (
                `Exclude ${busyIncludedSlots.length} slot${busyIncludedSlots.length === 1 ? "" : "-uri"} ocupat${busyIncludedSlots.length === 1 ? "" : "e"} pentru a continua`
              ) : finalSlotsToCreate.length === 0 ? (
                "Selectează cel puțin o rezervare"
              ) : finalSlotsToCreate.length === 1 ? (
                `Confirmă rezervarea · ${finalTotal} ${currency}`
              ) : (
                `Rezervă ${finalSlotsToCreate.length} intervale · ${finalTotal} ${currency}`
              )}
            </Button>

            {hasBusyConflicts && (
              <p className="text-center text-xs text-destructive">
                Ai {busyIncludedSlots.length} slot{busyIncludedSlots.length === 1 ? "" : "-uri"} ocupat{busyIncludedSlots.length === 1 ? "" : "e"}. Te rugăm să le excluzi din preview ca să continui.
              </p>
            )}

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
