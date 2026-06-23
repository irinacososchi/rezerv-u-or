import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/external-client";
import { LinkedBadge } from "./LinkedBadge";

export type Client = {
  id: string;
  owner_id: string;
  context: "owner" | "renter";
  linked_user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: "owner" | "renter";
  client: Client | null;
  onSaved: (newClientId?: string) => void;
  initialName?: string;
};

const PHONE_RE = /^(\+?40|0)[237][0-9]{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ClientFormDialog({ open, onOpenChange, context, client, onSaved, initialName }: Props) {
  const isEdit = client !== null;
  const isLinked = isEdit && client.linked_user_id !== null;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (open) {
      setName(client?.name ?? initialName ?? "");
      setPhone(client?.phone ?? "");
      setEmail(client?.email ?? "");
      setNotes(client?.notes ?? "");
      setSaving(false);
      setSyncing(false);
    }
  }, [open, client, initialName]);

  async function handleSyncFromProfile() {
    if (!client?.linked_user_id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", client.linked_user_id)
        .single();

      if (error || !data) {
        toast.error("Nu am putut prelua datele din cont.");
        return;
      }

      setName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setEmail(data.email ?? "");
      toast.success("Date preluate. Apasă Salvează pentru a aplica.");
    } catch {
      toast.error("Nu am putut prelua datele din cont.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedNotes = notes.trim();

    if (trimmedName.length === 0) {
      toast.error("Numele este obligatoriu.");
      return;
    }
    if (trimmedPhone && !PHONE_RE.test(trimmedPhone)) {
      toast.error("Format telefon invalid.");
      return;
    }
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      toast.error("Format email invalid.");
      return;
    }

    setSaving(true);
    try {
      if (!isEdit) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Sesiune expirată.");
          return;
        }
        const { data: inserted, error } = await supabase.from("clients").insert({
          owner_id: user.id,
          context,
          linked_user_id: null,
          name: trimmedName,
          phone: trimmedPhone || null,
          email: trimmedEmail || null,
          notes: trimmedNotes || null,
          active: true,
        }).select("id").single();
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            toast.error("Există deja un client cu acest număr de telefon în această listă.");
            return;
          }
          toast.error("Nu am putut salva clientul.");
          return;
        }
        toast.success("Client adăugat");
        onSaved(inserted?.id);
        onOpenChange(false);
        return;
      } else {
        const update: Record<string, unknown> = {
          name: trimmedName,
          phone: trimmedPhone || null,
          email: trimmedEmail || null,
          notes: trimmedNotes || null,
        };
        const { error } = await supabase.from("clients").update(update).eq("id", client!.id);
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            toast.error("Există deja un client cu acest număr de telefon în această listă.");
            return;
          }
          toast.error("Nu am putut salva clientul.");
          return;
        }
        toast.success("Client actualizat");
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? "Editează client" : "Adaugă client"}
            {isLinked && <LinkedBadge />}
          </DialogTitle>
          {isLinked && (
            <DialogDescription>
              Acest client are cont RZRV. Modificările tale aici sunt private — ele nu vor afecta contul lui de pe platformă.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {isLinked && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LinkedBadge />
                <span>Acest client are cont RZRV.</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSyncFromProfile}
                disabled={syncing || saving}
              >
                {syncing ? "Se preia..." : "Preia datele din cont"}
              </Button>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="client-name">Nume *</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              maxLength={120}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-phone">Telefon</Label>
            <Input
              id="client-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saving}
              placeholder="07xxxxxxxx"
              maxLength={20}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-email">Email</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
              maxLength={255}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-notes">Note</Label>
            <Textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              rows={4}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Anulează
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Se salvează..." : isEdit ? "Salvează" : "Adaugă"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
