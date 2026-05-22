import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarX, Calendar as CalendarIcon, Search } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/external-client";
import { BookingTimestamps } from "@/components/booking-timestamps";
import { RecurringSeriesCard } from "@/components/recurring-series-card";
import {
  groupByRecurrence,
  seriesStats,
  type RecurrenceInfo,
} from "@/lib/recurrence-series";

export const Route = createFileRoute("/rezervari")({
  validateSearch: (s: Record<string, unknown>) => ({
    bookingId: typeof s.bookingId === "string" ? s.bookingId : "",
  }),
  head: () => ({
    meta: [
      { title: "Rezervările mele — RZRV" },
      { name: "description", content: "Caută și gestionează rezervările tale." },
    ],
  }),
  component: RezervariPage,
});

type Booking = {
  id: string;
  reference: string;
  room_name: string;
  room_slug?: string | null;
  room_address: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  duration_minutes?: number | null;
  total_amount: number;
  status: string;
  payment_status: string;
  guest_email: string;
  recurrence_id: string | null;
  is_recurring?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

type Tab = "upcoming" | "past" | "all";

function RezervariPage() {
  const { bookingId: deepLinkBookingId } = Route.useSearch();
  const navigate = useNavigate();
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  // Guest search state
  const [searchType, setSearchType] = useState<"email" | "telefon">("email");
  const [searchValue, setSearchValue] = useState("");
  const [reference, setReference] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Common state
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [recurrences, setRecurrences] = useState<Map<string, RecurrenceInfo>>(new Map());
  const [tab, setTab] = useState<Tab>("upcoming");
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ id: string; msg: string } | null>(null);
  const [seriesDialog, setSeriesDialog] = useState<
    | { mode: "single"; booking: Booking }
    | { mode: "series"; recurrenceId: string; guestEmail: string }
    | null
  >(null);
  const [seriesScope, setSeriesScope] = useState<"this" | "future">("this");
  const [seriesBusy, setSeriesBusy] = useState(false);

  // Auth check + initial load for logged-in users
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (u) {
        const usr = { id: u.id, email: u.email ?? "" };
        setUser(usr);
        setLoading(true);
        await fetchUserBookings(usr);
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) setAuthChecked(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Deep-link handler: when ?bookingId=… present, scroll & highlight after load
  useEffect(() => {
    if (!deepLinkBookingId || loading) return;
    const found = bookings.find((b) => b.id === deepLinkBookingId);
    if (!found) return;
    const el = document.getElementById(`booking-row-${found.id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(found.id);
    const t = window.setTimeout(() => setHighlightId(null), 2500);
    navigate({
      to: "/rezervari",
      search: { bookingId: "" },
      replace: true,
    });
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkBookingId, loading, bookings]);



  async function loadRecurrences(list: Booking[]) {
    const recIds = Array.from(
      new Set(list.map((b) => b.recurrence_id).filter((x): x is string => !!x)),
    );
    if (recIds.length > 0) {
      const { data: recs } = await supabase
        .from("recurrences")
        .select(
          "id, frequency, day_of_week, start_time, end_time, first_date, last_date, total_bookings",
        )
        .in("id", recIds);
      const map = new Map<string, RecurrenceInfo>();
      for (const r of (recs ?? []) as RecurrenceInfo[]) map.set(r.id, r);
      setRecurrences(map);
    } else {
      setRecurrences(new Map());
    }
  }

  async function fetchUserBookings(usr: { id: string; email: string }) {
    const { data } = await supabase
      .from("bookings_full")
      .select("*")
      .or(`renter_id.eq.${usr.id},guest_email.ilike.${usr.email}`)
      .not("status", "eq", "blocată")
      .order("booking_date", { ascending: false });
    const list = (data ?? []) as Booking[];
    setBookings(list);
    await loadRecurrences(list);
  }

  async function handleGuestSearch() {
    setSearchError(null);
    setSearched(false);
    setBookings([]);
    setRecurrences(new Map());

    if (!searchValue.trim()) {
      setSearchError(`Completează ${searchType === "email" ? "emailul" : "telefonul"}.`);
      return;
    }
    setSearchLoading(true);
    let query = supabase
      .from("bookings_full")
      .select("*")
      .not("status", "eq", "blocată")
      .order("booking_date", { ascending: false });
    if (searchType === "email") {
      query = query.ilike("guest_email", searchValue.trim());
    } else {
      query = query.ilike("guest_phone", `%${searchValue.trim()}%`);
    }
    if (reference.trim()) {
      query = query.ilike("reference", `%${reference.trim()}%`);
    }
    const { data, error: fetchError } = await query;
    setSearchLoading(false);
    setSearched(true);
    if (fetchError) {
      setSearchError("A apărut o eroare. Încearcă din nou.");
      return;
    }
    const list = (data ?? []) as Booking[];
    setBookings(list);
    await loadRecurrences(list);
  }

  const todayISO = new Date().toISOString().split("T")[0];

  // For logged-in: client-side reference filter
  const visibleBookings = useMemo(() => {
    if (!user) return bookings;
    const q = reference.trim().toUpperCase();
    if (!q) return bookings;
    return bookings.filter((b) => b.reference?.toUpperCase().includes(q));
  }, [bookings, reference, user]);

  const { series: allSeries, singles: allSingles } = useMemo(
    () => groupByRecurrence(visibleBookings),
    [visibleBookings],
  );

  const filteredSingles = useMemo(() => {
    if (tab === "upcoming") {
      return allSingles.filter(
        (b) =>
          b.booking_date >= todayISO &&
          !["anulată", "refuzată", "expirată"].includes(b.status),
      );
    }
    if (tab === "past") {
      return allSingles.filter(
        (b) => b.booking_date < todayISO || b.status === "finalizată",
      );
    }
    return allSingles;
  }, [allSingles, tab, todayISO]);

  const filteredSeries = useMemo(() => {
    return allSeries.filter((s) => {
      const stats = seriesStats(s.bookings, todayISO);
      if (tab === "upcoming") return stats.hasUpcoming;
      if (tab === "past") return stats.hasPast;
      return true;
    });
  }, [allSeries, tab, todayISO]);

  const counts = useMemo(() => {
    const upcomingCount =
      allSingles.filter(
        (b) =>
          b.booking_date >= todayISO &&
          !["anulată", "refuzată", "expirată"].includes(b.status),
      ).length +
      allSeries.filter((s) => seriesStats(s.bookings, todayISO).hasUpcoming).length;
    const pastCount =
      allSingles.filter(
        (b) => b.booking_date < todayISO || b.status === "finalizată",
      ).length +
      allSeries.filter((s) => seriesStats(s.bookings, todayISO).hasPast).length;
    const allCount = allSingles.length + allSeries.length;
    return { upcoming: upcomingCount, past: pastCount, all: allCount };
  }, [allSingles, allSeries, todayISO]);

  type RenderItem =
    | { kind: "single"; b: Booking; anchor: string }
    | { kind: "series"; recurrenceId: string; bookings: Booking[]; anchor: string };

  const items: RenderItem[] = useMemo(() => {
    const out: RenderItem[] = [];
    for (const b of filteredSingles) {
      out.push({ kind: "single", b, anchor: b.booking_date });
    }
    for (const s of filteredSeries) {
      const stats = seriesStats(s.bookings, todayISO);
      let anchor: string;
      if (tab === "upcoming") {
        anchor = stats.nextDate ?? s.bookings[0].booking_date;
      } else if (tab === "past") {
        anchor = stats.lastPastDate ?? s.bookings[s.bookings.length - 1].booking_date;
      } else {
        anchor = stats.nextDate ?? s.bookings[0].booking_date;
      }
      out.push({
        kind: "series",
        recurrenceId: s.recurrenceId,
        bookings: s.bookings,
        anchor,
      });
    }
    out.sort((a, b) =>
      tab === "past" ? b.anchor.localeCompare(a.anchor) : a.anchor.localeCompare(b.anchor),
    );
    return out;
  }, [filteredSingles, filteredSeries, tab, todayISO]);

  function emailForCancel(b: Booking): string {
    return user?.email ?? b.guest_email;
  }

  async function refreshAfterCancel() {
    if (user) {
      await fetchUserBookings(user);
    } else if (searched && searchValue.trim()) {
      // Re-run the last guest search to refresh state
      await handleGuestSearch();
    }
  }

  async function handleCancel(b: Booking) {
    setCancelLoading(b.id);
    setCancelError(null);
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: b.id,
      p_guest_email: emailForCancel(b),
    });
    setCancelLoading(null);
    if (error) {
      setCancelError({ id: b.id, msg: error.message });
      return;
    }
    await refreshAfterCancel();
  }

  async function handleSeriesCancel() {
    if (!seriesDialog) return;

    let recurrenceId: string | null;
    let anchorDate: string;
    let guestEmail: string;
    let alsoSingleBookingId: string | null = null;

    if (seriesDialog.mode === "single") {
      const b = seriesDialog.booking;
      guestEmail = emailForCancel(b);
      if (seriesScope === "this") {
        setSeriesBusy(true);
        const { error } = await supabase.rpc("cancel_booking", {
          p_booking_id: b.id,
          p_guest_email: guestEmail,
        });
        setSeriesBusy(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Rezervarea a fost anulată.");
        setSeriesDialog(null);
        await refreshAfterCancel();
        return;
      }
      recurrenceId = b.recurrence_id;
      anchorDate = b.booking_date;
      alsoSingleBookingId = b.id;
    } else {
      recurrenceId = seriesDialog.recurrenceId;
      guestEmail = user?.email ?? seriesDialog.guestEmail;
      anchorDate = todayISO;
    }

    if (!recurrenceId) return;
    const { data: viitoare, error: fetchErr } = await supabase
      .from("bookings")
      .select("id")
      .eq("recurrence_id", recurrenceId)
      .gte("booking_date", anchorDate)
      .in("status", ["în așteptare", "confirmată"])
      .order("booking_date", { ascending: true });

    if (fetchErr) {
      toast.error(fetchErr.message);
      return;
    }
    const ids = ((viitoare ?? []) as { id: string }[]).map((x) => x.id);
    if (alsoSingleBookingId && !ids.includes(alsoSingleBookingId)) {
      ids.unshift(alsoSingleBookingId);
    }
    if (ids.length === 0) {
      toast.error("Nicio rezervare de anulat.");
      setSeriesDialog(null);
      return;
    }
    if (
      !confirm(
        `Ești pe cale să anulezi ${ids.length} ${ids.length === 1 ? "rezervare" : "rezervări"} din serie. Continui?`,
      )
    ) {
      return;
    }
    setSeriesBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) =>
        supabase.rpc("cancel_booking", {
          p_booking_id: id,
          p_guest_email: guestEmail,
        }),
      ),
    );
    setSeriesBusy(false);

    let success = 0;
    const errors: string[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && !(r.value as { error: unknown }).error) {
        success++;
      } else {
        const msg =
          r.status === "rejected"
            ? String(r.reason)
            : ((r.value as { error: { message?: string } }).error?.message ??
              "eroare necunoscută");
        errors.push(msg);
      }
    }

    if (success === ids.length) {
      toast.success(`Ai anulat ${success} ${success === 1 ? "rezervare" : "rezervări"} din serie.`);
    } else if (success > 0) {
      toast.warning(
        `Ai anulat ${success} din ${ids.length} rezervări. ${errors.length} nu au putut fi anulate (termenul de anulare gratuită a trecut pentru ele). Contactează proprietarul sălii dacă vrei să le anulezi totuși.`,
      );
    } else {
      toast.error(`Niciuna nu a putut fi anulată. Detalii: ${errors[0] ?? "?"}`);
    }
    setSeriesDialog(null);
    await refreshAfterCancel();
  }

  // ---------- RENDER ----------

  if (!authChecked) {
    return (
      <Shell>
        <div className="container mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      </Shell>
    );
  }

  const isLogged = !!user;
  const showList = isLogged || (searched && !searchLoading);

  return (
    <Shell>
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-10">
          <h1 className="text-3xl font-bold tracking-tight">
            {isLogged ? "Rezervările mele" : "Caută rezervarea ta"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isLogged
              ? "Toate rezervările făcute cu acest cont."
              : "Introdu emailul sau telefonul folosit la rezervare."}
          </p>

          {/* SEARCH SECTION */}
          {isLogged ? (
            <form
              className="mt-6 flex flex-col sm:flex-row gap-2 sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="flex-1 sm:max-w-xs">
                <label className="text-xs font-medium text-muted-foreground">
                  Referință rezervare (opțional)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  placeholder="ex: A3F9..."
                  maxLength={8}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/60"
                />
              </div>
              {reference && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReference("")}
                  className="sm:mb-0"
                >
                  Resetează
                </Button>
              )}
            </form>
          ) : (
            <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchType("email");
                    setSearchValue("");
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                    searchType === "email"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  Caută după email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchType("telefon");
                    setSearchValue("");
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                    searchType === "telefon"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  Caută după telefon
                </button>
              </div>
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGuestSearch();
                }}
              >
                <div>
                  <label className="text-sm font-medium">
                    {searchType === "email" ? "Adresa de email" : "Numărul de telefon"} *
                  </label>
                  <input
                    type={searchType === "email" ? "email" : "tel"}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={searchType === "email" ? "email@exemplu.ro" : "07xxxxxxxx"}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Referință rezervare (opțional)</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value.toUpperCase())}
                    placeholder="ex: A3F9..."
                    maxLength={8}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/60"
                  />
                </div>
                {searchError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                    {searchError}
                  </div>
                )}
                <Button type="submit" disabled={searchLoading} className="w-full">
                  {searchLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Se caută...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Caută
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Ai deja cont?{" "}
                  <Link to="/login" className="text-primary hover:underline">
                    Autentifică-te
                  </Link>{" "}
                  pentru a-ți vedea direct toate rezervările.
                </p>
              </form>
            </div>
          )}

          {/* TABS — visible only when there's a list to show */}
          {showList && (
            <div className="mt-6 flex gap-2 border-b border-border">
              {([
                { key: "upcoming", label: `Viitoare (${counts.upcoming})` },
                { key: "past", label: `Trecute (${counts.past})` },
                { key: "all", label: `Toate (${counts.all})` },
              ] as { key: Tab; label: string }[]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative px-4 py-2 text-sm font-medium transition ${
                    tab === t.key
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {tab === t.key && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* LIST */}
          {showList && (
            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
                  <CalendarX className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    {isLogged
                      ? reference.trim()
                        ? "Nu s-a găsit nicio rezervare cu această referință în contul tău."
                        : tab === "upcoming"
                          ? "Nu ai rezervări viitoare. Caută o sală!"
                          : tab === "past"
                            ? "Nu ai rezervări trecute."
                            : "Nu ai nicio rezervare încă."
                      : "Nicio rezervare găsită. Verifică datele introduse."}
                  </p>
                  {isLogged && tab !== "past" && !reference.trim() && (
                    <Button asChild className="mt-5">
                      <Link to="/sali">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Caută o sală
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                items.map((it) => {
                  if (it.kind === "series") {
                    const sampleEmail = it.bookings[0].guest_email;
                    const slug = it.bookings[0].room_slug;
                    return (
                      <RecurringSeriesCard
                        key={`series-${it.recurrenceId}`}
                        bookings={it.bookings}
                        recurrence={recurrences.get(it.recurrenceId)}
                        todayISO={todayISO}
                        tabContext={tab}
                        cancelLoadingId={cancelLoading}
                        onCancelSingle={(b) => handleCancel(b as Booking)}
                        onCancelSeries={() => {
                          setSeriesDialog({
                            mode: "series",
                            recurrenceId: it.recurrenceId,
                            guestEmail: sampleEmail,
                          });
                        }}
                        roomLink={
                          slug ? (
                            <Button asChild variant="outline" size="sm">
                              <Link to="/sali/$slug" params={{ slug }}>
                                Vezi sala
                              </Link>
                            </Button>
                          ) : null
                        }
                      />
                    );
                  }
                  const b = it.b;
                  return (
                    <article
                      key={b.id}
                      id={`booking-row-${b.id}`}
                      className={`rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition ${
                        highlightId === b.id ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs font-bold text-muted-foreground">
                            #{b.reference}
                          </div>
                          <h3 className="mt-1 font-semibold">{b.room_name}</h3>
                          {b.room_address && (
                            <p className="text-xs text-muted-foreground">{b.room_address}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              b.status === "confirmată"
                                ? "bg-primary/10 text-primary"
                                : b.status === "anulată" || b.status === "refuzată" || b.status === "expirată"
                                  ? "bg-destructive/10 text-destructive"
                                  : b.status === "finalizată"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-orange-500/10 text-orange-600"
                            }`}
                          >
                            {b.status}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs ${
                              b.payment_status === "platit"
                                ? "bg-primary/10 text-primary"
                                : b.payment_status === "rambursat"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-amber-500/10 text-amber-700"
                            }`}
                          >
                            {b.payment_status === "platit"
                              ? "Plătit"
                              : b.payment_status === "rambursat"
                                ? "Rambursat"
                                : "Neplătit"}
                          </span>
                        </div>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-xs text-muted-foreground">Data</dt>
                          <dd>
                            {new Date(b.booking_date).toLocaleDateString("ro-RO", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Interval</dt>
                          <dd>
                            {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Durată</dt>
                          <dd>
                            {(() => {
                              const m = b.duration_minutes ?? Math.round((b.duration_hours ?? 0) * 60);
                              const h = m / 60;
                              return `${h} ${h === 1 ? "oră" : "ore"}`;
                            })()}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Total</dt>
                          <dd className="font-semibold">{b.total_amount} RON</dd>
                        </div>
                      </dl>

                      <BookingTimestamps
                        createdAt={b.created_at}
                        updatedAt={b.updated_at}
                        className="mt-3"
                      />

                      {cancelError && cancelError.id === b.id && (
                        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                          {cancelError.msg}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {b.room_slug && (
                          <Button asChild variant="outline" size="sm">
                            <Link to="/sali/$slug" params={{ slug: b.room_slug }}>
                              Vezi sala
                            </Link>
                          </Button>
                        )}
                        {b.booking_date >= todayISO &&
                          (b.status === "confirmată" || b.status === "în așteptare") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(b)}
                              disabled={cancelLoading === b.id}
                              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              {cancelLoading === b.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Se anulează...
                                </>
                              ) : (
                                "Anulează"
                              )}
                            </Button>
                          )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!seriesDialog} onOpenChange={(o) => !o && setSeriesDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anulează rezervări recurente</DialogTitle>
            <DialogDescription>
              {seriesDialog?.mode === "series"
                ? "Vor fi anulate toate rezervările viitoare din această serie (de la data de azi). Acțiunea nu poate fi anulată."
                : "Această rezervare face parte dintr-o serie recurentă. Alege ce vrei să anulezi:"}
            </DialogDescription>
          </DialogHeader>
          {seriesDialog?.mode === "single" && (
            <RadioGroup
              value={seriesScope}
              onValueChange={(v) => setSeriesScope(v as "this" | "future")}
              className="gap-3"
            >
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="this" className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Doar această rezervare</div>
                  <div className="text-xs text-muted-foreground">
                    Anulează un singur booking din serie.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="future" className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Aceasta și toate viitoarele</div>
                  <div className="text-xs text-muted-foreground">
                    Anulează toate aparițiile din serie începând cu această dată.
                  </div>
                </div>
              </label>
            </RadioGroup>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSeriesDialog(null)}
              disabled={seriesBusy}
            >
              Renunță
            </Button>
            <Button
              variant="destructive"
              onClick={handleSeriesCancel}
              disabled={seriesBusy}
            >
              {seriesBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se anulează...
                </>
              ) : (
                "Da, anulează"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
