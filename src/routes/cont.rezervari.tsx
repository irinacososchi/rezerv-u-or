import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarX, Calendar as CalendarIcon } from "lucide-react";
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

export const Route = createFileRoute("/cont/rezervari")({
  head: () => ({
    meta: [{ title: "Rezervările mele — RZRV" }],
  }),
  component: RezervariContPage,
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

function RezervariContPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ id: string; msg: string } | null>(null);
  const [seriesDialog, setSeriesDialog] = useState<{ booking: Booking } | null>(null);
  const [seriesScope, setSeriesScope] = useState<"this" | "future">("this");
  const [seriesBusy, setSeriesBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigate({ to: "/login" });
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", u.id)
        .single();
      if (cancelled) return;
      if (!p) {
        navigate({ to: "/login" });
        return;
      }
      const usr = { id: u.id, email: u.email ?? "" };
      setUser(usr);
      await fetchBookings(usr);
      if (!cancelled) setLoading(false);
    }
    checkAuth();
    return () => { cancelled = true; };
  }, [navigate]);

  async function fetchBookings(usr: { id: string; email: string }) {
    const { data } = await supabase
      .from("bookings_full")
      .select("*")
      .or(`renter_id.eq.${usr.id},guest_email.ilike.${usr.email}`)
      .not("status", "eq", "blocată")
      .order("booking_date", { ascending: false });
    setBookings((data ?? []) as Booking[]);
  }

  const todayISO = new Date().toISOString().split("T")[0];

  const upcoming = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.booking_date >= todayISO &&
          !["anulată", "refuzată", "expirată"].includes(b.status),
      ),
    [bookings, todayISO],
  );
  const past = useMemo(
    () => bookings.filter((b) => b.booking_date < todayISO || b.status === "finalizată"),
    [bookings, todayISO],
  );

  const visible = tab === "upcoming" ? upcoming : tab === "past" ? past : bookings;

  async function handleCancel(b: Booking) {
    if (!user) return;
    setCancelLoading(b.id);
    setCancelError(null);
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: b.id,
      p_guest_email: user.email,
    });
    setCancelLoading(null);
    if (error) {
      setCancelError({ id: b.id, msg: error.message });
      return;
    }
    await fetchBookings(user);
  }

  async function handleSeriesCancel() {
    if (!user || !seriesDialog) return;
    const b = seriesDialog.booking;

    if (seriesScope === "this") {
      setSeriesBusy(true);
      const { error } = await supabase.rpc("cancel_booking", {
        p_booking_id: b.id,
        p_guest_email: user.email,
      });
      setSeriesBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Rezervarea a fost anulată.");
      setSeriesDialog(null);
      await fetchBookings(user);
      return;
    }

    // future
    if (!b.recurrence_id) return;
    const { data: viitoare, error: fetchErr } = await supabase
      .from("bookings")
      .select("id")
      .eq("recurrence_id", b.recurrence_id)
      .gte("booking_date", b.booking_date)
      .in("status", ["în așteptare", "confirmată"])
      .order("booking_date", { ascending: true });

    if (fetchErr) {
      toast.error(fetchErr.message);
      return;
    }
    const ids = ((viitoare ?? []) as { id: string }[]).map((x) => x.id);
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
          p_guest_email: user.email,
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
    await fetchBookings(user);
  }

  if (loading) {
    return (
      <Shell>
        <div className="container mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-10">
          <h1 className="text-3xl font-bold tracking-tight">Rezervările mele</h1>
          <p className="mt-2 text-muted-foreground">
            Toate rezervările făcute cu acest cont.
          </p>

          {/* Tabs */}
          <div className="mt-6 flex gap-2 border-b border-border">
            {([
              { key: "upcoming", label: `Viitoare (${upcoming.length})` },
              { key: "past", label: `Trecute (${past.length})` },
              { key: "all", label: `Toate (${bookings.length})` },
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

          {/* List */}
          <div className="mt-6 space-y-4">
            {visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
                <CalendarX className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  {tab === "upcoming"
                    ? "Nu ai rezervări viitoare. Caută o sală!"
                    : tab === "past"
                      ? "Nu ai rezervări trecute."
                      : "Nu ai nicio rezervare încă."}
                </p>
                {tab !== "past" && (
                  <Button asChild className="mt-5">
                    <Link to="/sali">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Caută o sală
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              visible.map((b) => (
                <article
                  key={b.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
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
                      {b.recurrence_id && (
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                          ↻ Recurentă
                        </span>
                      )}
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
                        {b.duration_hours} {b.duration_hours === 1 ? "oră" : "ore"}
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

                  {cancelError?.id === b.id && (
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
                        <>
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
                          {b.recurrence_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSeriesScope("this");
                                setSeriesDialog({ booking: b });
                              }}
                              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              Anulează în serie...
                            </Button>
                          )}
                        </>
                      )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </main>

      <Dialog open={!!seriesDialog} onOpenChange={(o) => !o && setSeriesDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anulează rezervări recurente</DialogTitle>
            <DialogDescription>
              Această rezervare face parte dintr-o serie recurentă. Alege ce vrei să anulezi:
            </DialogDescription>
          </DialogHeader>
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
