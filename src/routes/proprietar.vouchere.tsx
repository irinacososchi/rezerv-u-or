import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OwnerLayout } from "@/components/owner-layout";
import { supabase } from "@/integrations/supabase/external-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tag } from "lucide-react";

export const Route = createFileRoute("/proprietar/vouchere")({
  component: VouchersPage,
});

type Room = { id: string; name: string };
type Voucher = {
  id: string;
  code: string;
  discount_type: "procent" | "suma_fixa";
  discount_value: number;
  room_id: string | null;
  max_uses: number | null;
  used_count: number | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  rooms: { name: string } | null;
};

function VouchersPage() {
  const [userId, setUserId] = useState<string>("");
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"procent" | "suma_fixa">("procent");
  const [discountValue, setDiscountValue] = useState("");
  const [roomScope, setRoomScope] = useState<"all" | "specific">("all");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: vouchersData } = await supabase
        .from("voucher_codes")
        .select("*, rooms(name)")
        .eq("created_by_id", user.id)
        .order("created_at", { ascending: false });

      const { data: roomsData } = await supabase
        .from("rooms")
        .select("id, name")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .order("name");

      setVouchers((vouchersData as Voucher[] | null) ?? []);
      setRooms((roomsData as Room[] | null) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function refreshVouchers(uid: string) {
    const { data } = await supabase
      .from("voucher_codes")
      .select("*, rooms(name)")
      .eq("created_by_id", uid)
      .order("created_at", { ascending: false });
    setVouchers((data as Voucher[] | null) ?? []);
  }

  async function handleCreate() {
    setCreateError(null);

    if (!code.trim()) {
      setCreateError("Completează codul voucher.");
      return;
    }
    if (code.length < 3) {
      setCreateError("Codul trebuie să aibă minim 3 caractere.");
      return;
    }
    if (!discountValue || Number(discountValue) <= 0) {
      setCreateError("Completează valoarea reducerii.");
      return;
    }
    if (discountType === "procent" && Number(discountValue) > 100) {
      setCreateError("Procentul nu poate depăși 100%.");
      return;
    }
    if (roomScope === "specific" && !selectedRoomId) {
      setCreateError("Selectează sala.");
      return;
    }

    setCreating(true);

    const { error } = await supabase.from("voucher_codes").insert({
      created_by_id: userId,
      code: code.trim(),
      discount_type: discountType,
      discount_value: Number(discountValue),
      room_id: roomScope === "specific" ? selectedRoomId : null,
      max_uses: maxUses ? Number(maxUses) : null,
      valid_from: new Date().toISOString(),
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      is_active: true,
    });

    setCreating(false);

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        setCreateError("Acest cod există deja. Încearcă altul.");
      } else {
        setCreateError("Eroare: " + error.message);
      }
      return;
    }

    setCode("");
    setDiscountValue("");
    setMaxUses("");
    setValidUntil("");
    setRoomScope("all");
    setSelectedRoomId("");

    await refreshVouchers(userId);
  }

  async function toggleVoucher(voucherId: string, currentStatus: boolean) {
    await supabase
      .from("voucher_codes")
      .update({ is_active: !currentStatus })
      .eq("id", voucherId);

    setVouchers((prev) =>
      prev.map((v) => (v.id === voucherId ? { ...v, is_active: !currentStatus } : v)),
    );
  }

  function formatDiscount(v: Voucher) {
    return v.discount_type === "procent" ? `${v.discount_value}%` : `${v.discount_value} RON`;
  }

  function formatScope(v: Voucher) {
    if (!v.room_id) return "Toate sălile mele";
    return v.rooms?.name ?? "—";
  }

  function formatUses(v: Voucher) {
    const used = v.used_count ?? 0;
    return v.max_uses ? `${used} / ${v.max_uses}` : `${used} / ∞`;
  }

  function formatDate(d: string | null) {
    if (!d) return "Fără expirare";
    return new Date(d).toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <OwnerLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Vouchere</h1>
          <p className="text-sm text-muted-foreground">
            Creează coduri de reducere pentru sălile tale.
          </p>
        </div>

        {/* Create voucher card */}
        <Card>
          <CardHeader>
            <CardTitle>Creează cod nou</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Code */}
              <div className="sm:col-span-2">
                <Label>Cod voucher *</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
                    }
                    placeholder="ex: DANS20"
                    maxLength={20}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
                      setCode(random);
                    }}
                  >
                    Generează
                  </Button>
                </div>
              </div>

              {/* Discount type */}
              <div>
                <Label>Tip reducere *</Label>
                <div className="mt-2 flex gap-3">
                  <label
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 cursor-pointer text-sm transition ${
                      discountType === "procent"
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={discountType === "procent"}
                      onChange={() => setDiscountType("procent")}
                    />
                    % Procent
                  </label>
                  <label
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 cursor-pointer text-sm transition ${
                      discountType === "suma_fixa"
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={discountType === "suma_fixa"}
                      onChange={() => setDiscountType("suma_fixa")}
                    />
                    RON Sumă fixă
                  </label>
                </div>
              </div>

              {/* Value */}
              <div>
                <Label>Valoare *</Label>
                <div className="relative mt-1.5">
                  <Input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "procent" ? "ex: 20" : "ex: 50"}
                    min={1}
                    max={discountType === "procent" ? 100 : undefined}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {discountType === "procent" ? "%" : "RON"}
                  </span>
                </div>
              </div>

              {/* Scope */}
              <div className="sm:col-span-2">
                <Label>Aplicabil la</Label>
                <div className="mt-2 flex gap-3">
                  <label
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 cursor-pointer text-sm transition ${
                      roomScope === "all"
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={roomScope === "all"}
                      onChange={() => setRoomScope("all")}
                    />
                    Toate sălile mele
                  </label>
                  <label
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 cursor-pointer text-sm transition ${
                      roomScope === "specific"
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={roomScope === "specific"}
                      onChange={() => setRoomScope("specific")}
                    />
                    O sală specifică
                  </label>
                </div>

                {roomScope === "specific" && (
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    <option value="">Selectează sala...</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Max uses */}
              <div>
                <Label>Utilizări maxime</Label>
                <Input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Nelimitat"
                  min={1}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Lasă gol pentru utilizări nelimitate.
                </p>
              </div>

              {/* Valid until */}
              <div>
                <Label>Valabil până la</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Lasă gol dacă nu expiră.
                </p>
              </div>
            </div>

            {createError && <p className="mt-3 text-sm text-destructive">{createError}</p>}

            <Button className="mt-4" onClick={handleCreate} disabled={creating}>
              {creating ? "Se creează..." : "Creează voucher"}
            </Button>
          </CardContent>
        </Card>

        {/* List existing vouchers */}
        <Card>
          <CardHeader>
            <CardTitle>Voucherele tale</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Se încarcă...</p>
            ) : vouchers.length === 0 ? (
              <div className="py-12 text-center">
                <Tag className="h-12 w-12 mx-auto text-muted-foreground/40" />
                <p className="mt-4 text-sm font-medium">Nu ai creat niciun voucher încă.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Creează primul tău cod de reducere folosind formularul de mai sus.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cod</TableHead>
                      <TableHead>Reducere</TableHead>
                      <TableHead>Aplicabil la</TableHead>
                      <TableHead>Utilizări</TableHead>
                      <TableHead>Valabil până la</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-bold">{v.code}</TableCell>
                        <TableCell>{formatDiscount(v)}</TableCell>
                        <TableCell>{formatScope(v)}</TableCell>
                        <TableCell>{formatUses(v)}</TableCell>
                        <TableCell>{formatDate(v.valid_until)}</TableCell>
                        <TableCell>
                          {v.is_active ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-transparent">
                              Activ
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactiv</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleVoucher(v.id, v.is_active)}
                          >
                            {v.is_active ? "Dezactivează" : "Activează"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </OwnerLayout>
  );
}
