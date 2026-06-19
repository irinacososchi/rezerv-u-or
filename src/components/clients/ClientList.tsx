import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Search, X, UserMinus, UserCheck, Users, Pencil } from "lucide-react";
import { toast } from "sonner";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/external-client";
import { ClientFormDialog, type Client } from "./ClientFormDialog";
import { LinkedBadge } from "./LinkedBadge";

type Props = {
  context: "owner" | "renter";
  pageTitle: string;
};

export function ClientList({ context, pageTitle }: Props) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  async function fetchClients() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("context", context)
      .order("name", { ascending: true });
    if (!error && data) setClients(data as Client[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  const activeCount = useMemo(() => clients.filter((c) => c.active).length, [clients]);
  const inactiveCount = clients.length - activeCount;

  const visibleClients = useMemo(() => {
    const base = clients.filter((c) => (activeTab === "active" ? c.active : !c.active));
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    );
  }, [clients, activeTab, search]);

  async function setActive(id: string, active: boolean) {
    const { error } = await supabase.from("clients").update({ active }).eq("id", id);
    if (error) {
      toast.error(active ? "Nu am putut reactiva." : "Nu am putut dezactiva.");
      return;
    }
    toast.success(active ? "Client reactivat." : "Client dezactivat.");
    fetchClients();
  }

  function openAdd() {
    setEditingClient(null);
    setDialogOpen(true);
  }
  function openEdit(c: Client) {
    setEditingClient(c);
    setDialogOpen(true);
  }

  const subtitle =
    context === "owner"
      ? "Persoanele care folosesc sălile tale."
      : "Cursanții tăi sau persoanele cu care lucrezi.";

  const showEmpty = !loading && visibleClients.length === 0;
  const totalActiveAll = activeCount;

  function renderActions(c: Client) {
    if (c.active) {
      return (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
            <Pencil /> Editează
          </Button>
          <Button size="sm" variant="outline" onClick={() => setActive(c.id, false)}>
            <UserMinus /> Dezactivează
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2 justify-end">
        <Button size="sm" onClick={() => setActive(c.id, true)}>
          <UserCheck /> Reactivează
        </Button>
      </div>
    );
  }

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "inactive")}>
            <TabsList>
              <TabsTrigger value="active">Activi ({activeCount})</TabsTrigger>
              <TabsTrigger value="inactive">Inactivi ({inactiveCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-1 items-center gap-2 lg:max-w-md lg:ml-auto">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 pr-8"
                placeholder="Caută după nume, telefon sau email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Şterge căutarea"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={openAdd}>
              <Plus /> Adaugă client
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : showEmpty ? (
          <EmptyState
            search={search}
            activeTab={activeTab}
            totalActive={totalActiveAll}
            onAdd={openAdd}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nume</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleClients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {c.name}
                          {c.linked_user_id && <LinkedBadge />}
                        </span>
                      </TableCell>
                      <TableCell>{c.phone || "—"}</TableCell>
                      <TableCell>{c.email || "—"}</TableCell>
                      <TableCell className="max-w-[280px]">
                        <span className="line-clamp-1 text-muted-foreground" title={c.notes ?? ""}>
                          {c.notes || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{renderActions(c)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {visibleClients.map((c) => (
                <div key={c.id} className="border rounded-lg bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.linked_user_id && <LinkedBadge />}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Telefon: {c.phone || "—"}</div>
                    <div>Email: {c.email || "—"}</div>
                    {c.notes && <div className="line-clamp-2">Note: {c.notes}</div>}
                  </div>
                  {renderActions(c)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context={context}
        client={editingClient}
        onSaved={fetchClients}
      />
    </OwnerLayout>
  );
}

function EmptyState({
  search,
  activeTab,
  totalActive,
  onAdd,
}: {
  search: string;
  activeTab: "active" | "inactive";
  totalActive: number;
  onAdd: () => void;
}) {
  let message: string;
  let showCta = false;
  if (search.trim()) {
    message = "Niciun client nu corespunde căutării.";
  } else if (activeTab === "active" && totalActive === 0) {
    message = "Încă nu ai adăugat clienți.";
    showCta = true;
  } else {
    message = "Nu ai clienți dezactivați.";
  }

  return (
    <div className="border rounded-lg bg-card p-10 flex flex-col items-center text-center gap-3">
      <Users className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-muted-foreground">{message}</p>
      {showCta && (
        <Button onClick={onAdd}>
          <Plus /> Adaugă primul client
        </Button>
      )}
    </div>
  );
}
