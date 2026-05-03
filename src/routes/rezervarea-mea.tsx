import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarX, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/external-client";

export const Route = createFileRoute("/rezervarea-mea")({
  head: () => ({
    meta: [
      { title: "Rezervarea mea — Rezervări Săli" },
      { name: "description", content: "Caută rezervările tale după email sau telefon." },
    ],
  }),
  component: RezervareaMeaPage,
});

type Booking = {
  id: string;
  reference: string;
  room_name: string;
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
};

function RezervareaMeaPage() {
  const [searchType, setSearchType] = useState<"email" | "telefon">("email");
  const [searchValue, setSearchValue] = useState("");
  const [reference, setReference] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ id: string; msg: string } | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  async function handleSearch() {
    setError(null);
    setSearched(false);
    setBookings([]);

    if (!searchValue.trim()) {
      setError(`Completează ${searchType === "email" ? "emailul" : "telefonul"}.`);
      return;
    }

    setLoading(true);

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
      query = query.ilike("reference", reference.trim());
    }

    const { data, error: fetchError } = await query;

    setLoading(false);
    setSearched(true);

    if (fetchError) {
      setError("A apărut o eroare. Te rugăm să încerci din nou.");
      return;
    }

    setBookings((data ?? []) as Booking[]);
  }

  async function handleCancel(bookingId: string, guestEmail: string) {
    setCancelLoading(bookingId);
    setCancelError(null);
    setCancelSuccess(null);

    const { error: rpcError } = await supabase.rpc("cancel_booking", {
      p_booking_id: bookingId,
      p_guest_email: guestEmail,
    });

    setCancelLoading(null);

    if (rpcError) {
      setCancelError({ id: bookingId, msg: rpcError.message });
      return;
    }

    setCancelSuccess(bookingId);
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: "anulată" } : b)),
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-[600px] px-4 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Rezervarea mea</h1>
            <p className="mt-3 text-muted-foreground">
              Caută rezervările tale după email sau telefon.
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-background p-6 shadow-sm">
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
                handleSearch();
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
                  placeholder="ex: A3F9B2C1 — lasă gol pentru toate rezervările"
                  maxLength={8}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Referința se găsește în emailul de confirmare.
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se caută...
                  </>
                ) : (
                  "Caută rezervările mele"
                )}
              </button>
            </form>
          </div>

          {searched && !loading && (
            <div className="mt-8">
              {bookings.length === 0 ? (
                <div className="rounded-xl border border-border bg-background p-10 text-center shadow-sm">
                  <CalendarX className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h2 className="mt-4 text-lg font-semibold">Nicio rezervare găsită</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Verifică că ai introdus corect{" "}
                    {searchType === "email" ? "emailul" : "telefonul"}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    {bookings.length}{" "}
                    {bookings.length === 1 ? "rezervare găsită" : "rezervări găsite"}
                  </div>

                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-xl border border-border bg-background p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm font-bold">#{b.reference}</div>
                          <h3 className="mt-1 font-semibold">{b.room_name}</h3>
                          {b.room_address && (
                            <p className="text-xs text-muted-foreground">{b.room_address}</p>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            b.status === "confirmată"
                              ? "bg-primary/10 text-primary"
                              : b.status === "anulată"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-orange-500/10 text-orange-600"
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm border-t border-border pt-4">
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
                        <div>
                          <dt className="text-xs text-muted-foreground">Plată</dt>
                          <dd>
                            {b.payment_status === "platit"
                              ? "Plătit"
                              : b.payment_status === "rambursat"
                                ? "Rambursat"
                                : "Neplatit — la sală"}
                          </dd>
                        </div>
                        {b.recurrence_id && (
                          <div>
                            <dt className="text-xs text-muted-foreground">Tip</dt>
                            <dd>↻ Recurentă</dd>
                          </div>
                        )}
                      </dl>

                      {cancelError?.id === b.id && (
                        <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                          {cancelError.msg}
                        </div>
                      )}
                      {cancelSuccess === b.id && (
                        <div className="mt-4 rounded-md bg-primary/10 border border-primary/30 p-3 text-sm text-primary">
                          Rezervarea a fost anulată cu succes.
                        </div>
                      )}

                      {(b.status === "confirmată" || b.status === "în așteptare") && (
                        <div className="mt-4 border-t border-border pt-4">
                          <button
                            onClick={() => handleCancel(b.id, b.guest_email)}
                            disabled={cancelLoading === b.id}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition disabled:opacity-60"
                          >
                            {cancelLoading === b.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Se anulează...
                              </>
                            ) : (
                              "Anulează această rezervare"
                            )}
                          </button>
                          <p className="mt-2 text-xs text-muted-foreground text-center">
                            Anularea este posibilă conform politicii sălii.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
