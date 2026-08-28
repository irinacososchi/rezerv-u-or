import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Trash2, Lock, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/external-client";
import { getSessionUser } from "@/lib/auth-user";

export const Route = createFileRoute("/cont/")({
  head: () => ({
    meta: [{ title: "Contul meu — RZRV" }],
  }),
  component: ContPage,
});

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  billing_address?: string | null;
  company_vat?: string | null;
  company_name?: string | null;
  role: string;
};

function ContPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [companyVat, setCompanyVat] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Password change
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      const { data: { user: u } } = await getSessionUser();
      if (!u) {
        navigate({ to: "/login" });
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single();
      if (cancelled) return;
      if (!p) {
        navigate({ to: "/login" });
        return;
      }
      setUser({ id: u.id, email: u.email ?? "" });
      const prof = p as Profile;
      setProfile(prof);
      setFullName(prof.full_name ?? "");
      setPhone(prof.phone ?? "");
      setBillingAddress(prof.billing_address ?? "");
      setCompanyVat(prof.company_vat ?? "");
      setCompanyName(prof.company_name ?? "");
      setLoading(false);
    }
    checkAuth();
    return () => { cancelled = true; };
  }, [navigate]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccess(null);
    if (!fullName.trim()) {
      setError("Numele complet este obligatoriu.");
      return;
    }
    setSaving(true);
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        billing_address: billingAddress.trim() || null,
        company_vat: companyVat.trim() || null,
        company_name: companyName.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setSuccess("Profil actualizat!");
    setTimeout(() => setSuccess(null), 3000);
  }

  async function handleChangePassword() {
    setPwMsg(null);
    if (newPw.length < 8) {
      setPwMsg({ type: "err", text: "Parola trebuie să aibă minim 8 caractere." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "err", text: "Parolele nu coincid." });
      return;
    }
    setPwSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (err) {
      setPwMsg({ type: "err", text: err.message });
      return;
    }
    setPwMsg({ type: "ok", text: "Parolă schimbată cu succes!" });
    setNewPw("");
    setConfirmPw("");
    setTimeout(() => {
      setPwOpen(false);
      setPwMsg(null);
    }, 2000);
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);
    // Soft-delete: anonymize profile and sign out (admin.deleteUser requires service role)
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        full_name: "Cont șters",
        phone: null,
        billing_address: null,
        company_vat: null,
        company_name: null,
      })
      .eq("id", user.id);
    if (updErr) {
      setDeleting(false);
      setDeleteError(updErr.message);
      return;
    }
    await supabase.auth.signOut();
    navigate({ to: "/" });
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

  if (!user || !profile) return null;

  const initial = (fullName || user.email || "?").charAt(0).toUpperCase();

  return (
    <Shell>
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-3xl font-bold tracking-tight">Contul meu</h1>
          <p className="mt-2 text-muted-foreground">
            Gestionează informațiile personale și securitatea contului.
          </p>

          {/* Card 1 — Personal info */}
          <form
            onSubmit={handleSave}
            className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                {initial}
              </div>
              <div>
                <h2 className="text-lg font-semibold">Informații personale</h2>
                <p className="text-sm text-muted-foreground">
                  Aceste date apar pe rezervările tale.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <Label>Email</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input value={user.email} readOnly disabled className="bg-muted/50" />
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground whitespace-nowrap">
                    Nu poate fi modificat
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="fullName">Nume complet *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07xxxxxxxx"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="billingAddress">Adresă facturare (opțional)</Label>
                <Input
                  id="billingAddress"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="companyName">Nume firmă (opțional)</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="companyVat">CUI firmă (opțional)</Label>
                  <Input
                    id="companyVat"
                    value={companyVat}
                    onChange={(e) => setCompanyVat(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {success}
                </div>
              )}

              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Se salvează...
                  </>
                ) : (
                  "Salvează modificările"
                )}
              </Button>
            </div>
          </form>

          {/* Card 2 — Security */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-semibold">Securitate și cont</h2>

            <div className="mt-5 space-y-4">
              {/* Password */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Parolă</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPwOpen(!pwOpen);
                      setPwMsg(null);
                    }}
                  >
                    {pwOpen ? "Anulează" : "Schimbă parola"}
                  </Button>
                </div>
                {pwOpen && (
                  <div className="mt-4 space-y-3">
                    <Input
                      type="password"
                      placeholder="Parolă nouă (minim 8 caractere)"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder="Confirmă parola"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                    />
                    {pwMsg && (
                      <p
                        className={`text-xs ${pwMsg.type === "ok" ? "text-primary" : "text-destructive"}`}
                      >
                        {pwMsg.text}
                      </p>
                    )}
                    <Button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={pwSaving}
                      size="sm"
                    >
                      {pwSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Se salvează...
                        </>
                      ) : (
                        "Salvează parola nouă"
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Delete */}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                {!deleteOpen ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Șterge contul
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-destructive">
                      Ești sigur că vrei să ștergi contul?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Datele personale vor fi anonimizate iar tu vei fi deconectat. Această acțiune nu poate fi anulată.
                    </p>
                    {deleteError && (
                      <p className="text-xs text-destructive">{deleteError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Se șterge...
                          </>
                        ) : (
                          "Da, șterge contul"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteOpen(false)}
                        disabled={deleting}
                      >
                        Anulează
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
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
