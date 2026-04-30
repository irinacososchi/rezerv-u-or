import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { OwnerLayout } from "@/components/owner-layout";
import { supabase } from "@/integrations/supabase/external-client";

export const Route = createFileRoute("/proprietar/cereri")({
  head: () => ({
    meta: [
      { title: "Cereri rezervări — Proprietar" },
      { name: "description", content: "Gestionează cererile de rezervare pentru sălile tale." },
    ],
  }),
  component: CereriPage,
});

type BookingFull = {
  id: string;
  reference: string | null;
  renter_name: string | null;
  renter_email: string | null;
  renter_phone: string | null;
  room_id: string;
  room_name: string | null;
  room_currency: string | null;
  booking_date: string;
  start_time: string | null;
  end_time: string | null;
  total_amount: number | null;
  status: string;
  payment_status: string;
  recurrence_id: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "în așteptare": "bg-amber-50 text-amber-800 border-amber-200",
    "confirmată": "bg-emerald-50 text-emerald-800 border-emerald-200",
    "anulată": "bg-gray-100 text-gray-600 border-gray-200",
    "refuzată": "bg-red-50 text-red-700 border-red-200",
    "finalizată": "bg-blue-50 text-blue-700 border-blue-200",
    "expirată": "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    neplatit: "bg-orange-50 text-orange-700 border-orange-200",
    platit: "bg-emerald-50 text-emerald-800 border-emerald-200",
    rambursat: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

function ActionButtons({
  booking,
  loading,
  onAction,
}: {
  booking: BookingFull;
  loading: boolean;
  onAction: (id: string, action: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {booking.status === "în așteptare" && (
        <>
          <button
            onClick={() => onAction(booking.id, "confirma")}
            disabled={loading}
            className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-xs text-primary hover:bg-primary/20 transition disabled:opacity-50"
          >
            Aprobă
          </button>
          <button
            onClick={() => onAction(booking.id, "refuza")}
            disabled={loading}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 transition disabled:opacity-50"
          >
            Refuză
          </button>
        </>
      )}
      {booking.status === "confirmată" && (
        <button
          onClick={() => onAction(booking.id, "anuleaza")}
          disabled={loading}
          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition disabled:opacity-50"
        >
          Anulează
        </button>
      {(booking.status === "anulată" || booking.status === "refuzată" || booking.status === "expirată") && (
        <>
          <button
            onClick={() => onAction(booking.id, "confirma")}
            disabled={loading}
            className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
          >
            Reactivează ca confirmată
          </button>
          <button
            onClick={() => onAction(booking.id, "in_asteptare")}
            disabled={loading}
            className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 transition disabled:opacity-50"
          >
            Pune în așteptare
          </button>
        </>
      )}
      {booking.payment_status === "neplatit" && booking.status === "confirmată" && (
        <button
          onClick={() => onAction(booking.id, "platit")}
          disabled={loading}
          className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-50"
        >
          Marchează plătit
        </button>
      )}
      {booking.payment_status === "platit" && (
        <button
          onClick={() => onAction(booking.id, "neplatit")}
          disabled={loading}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 transition disabled:opacity-50"
        >
          Marchează neplatit
        </button>
      )}
    </div>
  );
}

function CereriPage() {
  const [bookings, setBookings] = useState<BookingFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setUserId] = useState("");

  const [filterStatus, setFilterStatus] = useState("toate");
  const [filterRoom, setFilterRoom] = useState("toate");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: roomsData } = await supabase
        .from("rooms")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");
      setRooms(roomsData ?? []);

      await fetchBookings(user.id);
    }
    load();
  }, []);

  async function fetchBookings(ownerId: string) {
    setLoading(true);

    const { data: ownerRooms } = await supabase
      .from("rooms")
      .select("id")
      .eq("owner_id", ownerId);

    const roomIds = (ownerRooms ?? []).map((r) => r.id);
    if (roomIds.length === 0) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("bookings_full")
      .select("*")
      .in("room_id", roomIds)
      .not("status", "eq", "blocată")
      .order("booking_date", { ascending: false });

    setBookings((data as BookingFull[]) ?? []);
    setLoading(false);
  }

  const filtered = bookings.filter((b) => {
    if (filterStatus !== "toate" && b.status !== filterStatus) return false;
    if (filterRoom !== "toate" && b.room_id !== filterRoom) return false;
    if (filterDateFrom && b.booking_date < filterDateFrom) return false;
    if (filterDateTo && b.booking_date > filterDateTo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (b.renter_name ?? "").toLowerCase();
      const email = (b.renter_email ?? "").toLowerCase();
      const ref = (b.reference ?? "").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !ref.includes(q)) return false;
    }
    return true;
  });

  async function handleAction(bookingId: string, action: string) {
    setActionLoading(bookingId);

    const updates: Record<string, unknown> = {};
    switch (action) {
      case "confirma":
        updates.status = "confirmată";
        break;
      case "refuza":
        updates.status = "refuzată";
        break;
      case "anuleaza":
        updates.status = "anulată";
        break;
      case "platit":
        updates.payment_status = "platit";
        break;
      case "neplatit":
        updates.payment_status = "neplatit";
        break;
    }

    const { error } = await supabase.from("bookings").update(updates).eq("id", bookingId);

    setActionLoading(null);

    if (error) {
      console.error("Action error:", error);
      return;
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, ...updates } : b)),
    );
  }

  const hasActiveFilters =
    filterStatus !== "toate" ||
    filterRoom !== "toate" ||
    filterDateFrom !== "" ||
    filterDateTo !== "" ||
    searchQuery !== "";

  return (
    <OwnerLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Rezervări</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} din {bookings.length} rezervări
          </p>
        </div>
      </div>

      {/* Filtre */}
      <div className="rounded-xl border border-border bg-background p-4 mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <label className="text-xs text-muted-foreground">Caută</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nume, email, referință..."
                className="w-full rounded-md border border-border pl-8 pr-3 py-1.5 text-sm bg-background"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-1.5 text-sm bg-background"
            >
              <option value="toate">Toate statusurile</option>
              <option value="în așteptare">În așteptare</option>
              <option value="confirmată">Confirmată</option>
              <option value="anulată">Anulată</option>
              <option value="refuzată">Refuzată</option>
              <option value="finalizată">Finalizată</option>
              <option value="expirată">Expirată</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Sală</label>
            <select
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-1.5 text-sm bg-background"
            >
              <option value="toate">Toate sălile</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="text-xs text-muted-foreground">Interval dată</label>
            <div className="mt-1 flex gap-1 items-center min-w-0">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="flex-1 min-w-0 w-full rounded-md border border-border px-2 py-1.5 text-sm bg-background"
              />
              <span className="text-muted-foreground text-xs shrink-0">—</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="flex-1 min-w-0 w-full rounded-md border border-border px-2 py-1.5 text-sm bg-background"
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterStatus("toate");
              setFilterRoom("toate");
              setFilterDateFrom("");
              setFilterDateTo("");
              setSearchQuery("");
            }}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Resetează filtrele
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-background p-12 text-center text-muted-foreground">
          Se încarcă...
        </div>
      ) : (
        <>
          {/* Desktop — tabel */}
          <div className="hidden lg:block rounded-xl border border-border bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Referință</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chiriaș</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sală</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Interval</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plată</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      Nicio rezervare găsită.
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/20 transition"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">#{b.reference}</span>
                        {b.recurrence_id && <span className="ml-1 text-xs text-primary">↻</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.renter_name}</div>
                        <div className="text-xs text-muted-foreground">{b.renter_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{b.room_name}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(b.booking_date).toLocaleDateString("ro-RO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {b.start_time?.slice(0, 5)}–{b.end_time?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {b.total_amount} {b.room_currency}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentBadge status={b.payment_status} />
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          booking={b}
                          loading={actionLoading === b.id}
                          onAction={handleAction}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile — carduri */}
          <div className="lg:hidden space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-border bg-background p-8 text-center text-muted-foreground">
                Nicio rezervare găsită.
              </div>
            ) : (
              filtered.map((b) => (
                <div key={b.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">#{b.reference}</span>
                      {b.recurrence_id && <span className="ml-1 text-xs text-primary">↻</span>}
                      <div className="font-medium mt-0.5">{b.renter_name}</div>
                      <div className="text-xs text-muted-foreground">{b.renter_phone}</div>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">Sală: </span>
                      {b.room_name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total: </span>
                      <span className="font-medium">
                        {b.total_amount} {b.room_currency}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data: </span>
                      {new Date(b.booking_date).toLocaleDateString("ro-RO", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Interval: </span>
                      {b.start_time?.slice(0, 5)}–{b.end_time?.slice(0, 5)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <PaymentBadge status={b.payment_status} />
                    <ActionButtons
                      booking={b}
                      loading={actionLoading === b.id}
                      onAction={handleAction}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </OwnerLayout>
  );
}
