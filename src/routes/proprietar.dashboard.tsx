import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OwnerLayout } from "@/components/owner-layout";
import { supabase } from "@/integrations/supabase/external-client";
import { Calendar, Clock, TrendingUp, Building2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateRO, parseISODate } from "@/lib/date-utils";

export const Route = createFileRoute("/proprietar/dashboard")({
  component: DashboardPage,
});

type BookingFull = {
  id: string;
  reference: string | null;
  room_id: string;
  room_name: string | null;
  renter_name: string | null;
  renter_email: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  total: number | null;
  total_amount: number | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  created_at: string;
};

type Room = { id: string; name: string; is_active: boolean };

const statusVariant: Record<string, { label: string; className: string }> = {
  "în așteptare": { label: "în așteptare", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  "confirmată": { label: "confirmată", className: "bg-green-100 text-green-800 border-green-200" },
  "refuzată": { label: "refuzată", className: "bg-red-100 text-red-800 border-red-200" },
  "anulată": { label: "anulată", className: "bg-gray-100 text-gray-700 border-gray-200" },
  "finalizată": { label: "finalizată", className: "bg-blue-100 text-blue-800 border-blue-200" },
  "expirată": { label: "expirată", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

const paymentVariant: Record<string, string> = {
  neplatit: "bg-orange-100 text-orange-800 border-orange-200",
  platit: "bg-green-100 text-green-800 border-green-200",
  rambursat: "bg-gray-100 text-gray-700 border-gray-200",
};

function StatusBadge({ status }: { status: string }) {
  const v = statusVariant[status] ?? { label: status, className: "bg-muted text-foreground" };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${v.className}`}>{v.label}</span>;
}

function PaymentBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const className = paymentVariant[status] ?? "bg-muted text-foreground";
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}>{status}</span>;
}

function formatTimeRange(start: string, end: string) {
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

function formatRON(v: number | null | undefined) {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("ro-RO")} RON`;
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

function totalOf(b: BookingFull) {
  return b.total_amount ?? b.total ?? null;
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRooms, setActiveRooms] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [pendingList, setPendingList] = useState<BookingFull[]>([]);
  const [monthCount, setMonthCount] = useState(0);
  const [recentList, setRecentList] = useState<BookingFull[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const todayISO = new Date().toISOString().split("T")[0];
    const firstOfMonth = todayISO.slice(0, 7) + "-01";

    const { data: ownerRooms } = await supabase
      .from("rooms")
      .select("id, name, is_active")
      .eq("owner_id", user.id);

    const list = (ownerRooms ?? []) as Room[];
    setRooms(list);
    const roomIds = list.map((r) => r.id);

    if (roomIds.length === 0) {
      setLoading(false);
      return;
    }

    const [todayRes, pendingRes, monthRes, recentRes] = await Promise.all([
      supabase
        .from("bookings_full")
        .select("*")
        .in("room_id", roomIds)
        .eq("booking_date", todayISO)
        .not("status", "in", '("refuzată","anulată","expirată","blocată")'),
      supabase
        .from("bookings_full")
        .select("*")
        .in("room_id", roomIds)
        .eq("status", "în așteptare"),
      supabase
        .from("bookings_full")
        .select("*")
        .in("room_id", roomIds)
        .gte("booking_date", firstOfMonth)
        .not("status", "in", '("refuzată","anulată","expirată","blocată")'),
      supabase
        .from("bookings_full")
        .select("*")
        .in("room_id", roomIds)
        .not("status", "in", '("blocată")')
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    setActiveRooms(list.filter((r) => r.is_active).length);
    setTodayCount((todayRes.data ?? []).length);
    setPendingList((pendingRes.data ?? []) as BookingFull[]);
    setMonthCount((monthRes.data ?? []).length);
    setRecentList((recentRes.data ?? []) as BookingFull[]);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDecision(id: string, status: "confirmată" | "refuzată") {
    setActionId(id);
    await supabase.from("bookings").update({ status }).eq("id", id);
    setActionId(null);
    await loadDashboard();
  }

  if (loading) {
    return (
      <OwnerLayout>
        <div className="p-6 md:p-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </OwnerLayout>
    );
  }

  if (rooms.length === 0) {
    return (
      <OwnerLayout>
        <div className="p-6 md:p-8 max-w-2xl mx-auto text-center space-y-4 py-20">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Nu ai adăugat nicio sală încă.</h1>
          <p className="text-muted-foreground">Adaugă prima ta sală pentru a începe să primești rezervări.</p>
          <Button asChild>
            <a href="/proprietar/sali/nou">Adaugă prima sală</a>
          </Button>
        </div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout>
      <div className="p-6 md:p-8 space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Privire de ansamblu asupra rezervărilor tale.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Rezervări azi" value={todayCount} icon={<Calendar className="h-5 w-5" />} accent="text-primary" />
          <StatCard
            label="În așteptare"
            value={pendingList.length}
            icon={<Clock className="h-5 w-5" />}
            accent="text-orange-600"
            highlight={pendingList.length > 0}
          />
          <StatCard label="Luna aceasta" value={monthCount} icon={<TrendingUp className="h-5 w-5" />} accent="text-foreground" />
          <StatCard label="Săli active" value={activeRooms} icon={<Building2 className="h-5 w-5" />} accent="text-foreground" />
        </div>

        {/* Pending */}
        {pendingList.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Cereri în așteptare</h2>
              <Badge className="bg-orange-100 text-orange-800 border-orange-200" variant="outline">
                {pendingList.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {pendingList.map((b) => (
                <Card key={b.id} className="border-orange-200">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium">{b.renter_name ?? b.renter_email ?? "Chiriaș"}</p>
                      <p className="text-sm text-muted-foreground">
                        {b.room_name} · {formatDateRO(parseISODate(b.booking_date))} · {formatTimeRange(b.start_time, b.end_time)}
                      </p>
                      <p className="text-sm font-semibold text-primary">{formatRON(b.total)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleDecision(b.id, "confirmată")}
                        disabled={actionId === b.id}
                      >
                        <Check className="h-4 w-4" />
                        Aprobă
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecision(b.id, "refuzată")}
                        disabled={actionId === b.id}
                        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                        Refuză
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Recent */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Rezervări recente</h2>
          {recentList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nicio rezervare încă.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Referință</th>
                      <th className="px-3 py-2 font-medium">Sală</th>
                      <th className="px-3 py-2 font-medium">Chiriaș</th>
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Interval</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Plată</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentList.map((b) => (
                      <tr key={b.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{b.reference ?? "—"}</td>
                        <td className="px-3 py-2">{b.room_name}</td>
                        <td className="px-3 py-2">{b.renter_name ?? b.renter_email ?? "—"}</td>
                        <td className="px-3 py-2">{b.booking_date}</td>
                        <td className="px-3 py-2">{formatTimeRange(b.start_time, b.end_time)}</td>
                        <td className="px-3 py-2 font-medium">{formatRON(b.total)}</td>
                        <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                        <td className="px-3 py-2"><PaymentBadge status={b.payment_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {recentList.map((b) => (
                  <Card key={b.id}>
                    <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                      <div>
                        <CardTitle className="text-sm">{b.room_name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{b.renter_name ?? b.renter_email ?? "—"}</p>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">{b.reference ?? ""}</span>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-2">
                      <p className="text-sm">{b.booking_date} · {formatTimeRange(b.start_time, b.end_time)}</p>
                      <p className="text-sm font-semibold text-primary">{formatRON(b.total)}</p>
                      <div className="flex gap-2 flex-wrap">
                        <StatusBadge status={b.status} />
                        <PaymentBadge status={b.payment_status} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </OwnerLayout>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-orange-300" : ""}>
      <CardContent className="p-4 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`text-3xl font-bold mt-2 ${accent}`}>{value}</p>
        </div>
        <div className={accent}>{icon}</div>
      </CardContent>
    </Card>
  );
}
