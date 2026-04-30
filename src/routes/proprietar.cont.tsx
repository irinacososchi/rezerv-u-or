import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { OwnerLayout } from "@/components/owner-layout";
import { supabase } from "@/integrations/supabase/external-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/proprietar/cont")({
  component: AccountPage,
});

type Profile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  website: string | null;
  role: string | null;
};

function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email, phone, business_name, website, role")
        .eq("id", user.id)
        .single();

      setUser(user);
      setProfile(p as Profile | null);
      setFullName(p?.full_name ?? "");
      setPhone(p?.phone ?? "");
      setBusinessName(p?.business_name ?? "");
      setWebsite(p?.website ?? "");
      setLoading(false);
    }
    loadProfile();
  }, []);

  async function handleSaveProfile() {
    setError(null);
    setSuccess(null);
    if (!fullName.trim()) {
      setError("Numele este obligatoriu.");
      return;
    }
    if (!user) return;

    setSaving(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        business_name: businessName.trim() || null,
        website: website.trim() || null,
      })
      .eq("id", user.id);

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setProfile((p) =>
      p
        ? {
            ...p,
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            business_name: businessName.trim() || null,
            website: website.trim() || null,
          }
        : p,
    );
    setSuccess("Profil actualizat cu succes!");
    setTimeout(() => setSuccess(null), 3000);
  }

  async function handleSavePassword() {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword.length < 8) {
      setPasswordError("Minim 8 caractere.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Parolele nu coincid.");
      return;
    }

    setPasswordSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (err) {
      setPasswordError(err.message);
      return;
    }

    setPasswordSuccess("Parolă schimbată cu succes!");
    setNewPassword("");
    setConfirmPassword("");
    setChangingPassword(false);
    setTimeout(() => setPasswordSuccess(null), 3000);
  }

  const initial =
    (fullName || profile?.full_name || user?.email || "?").charAt(0).toUpperCase();
  const isOwner = profile?.role === "owner" || profile?.role === "admin";

  return (
    <OwnerLayout>
      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cont</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestionează informațiile contului și securitatea.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* Card 1 — Informații cont */}
            <Card>
              <CardHeader>
                <CardTitle>Informații cont</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {fullName || "Fără nume"}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {user?.email}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                    <span className="text-sm text-muted-foreground truncate">
                      {user?.email}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Nu poate fi modificat
                    </span>
                  </div>
                </div>

                <div className="border-t border-border" />

                <div className="space-y-2">
                  <Label htmlFor="full_name">Nume complet</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                    placeholder="Numele tău"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={30}
                    placeholder="07xx xxx xxx"
                  />
                </div>

                {isOwner && (
                  <>
                    <div className="border-t border-border" />
                    <div className="space-y-2">
                      <Label htmlFor="business_name">
                        Numele afacerii <span className="text-muted-foreground">(opțional)</span>
                      </Label>
                      <Input
                        id="business_name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        maxLength={150}
                        placeholder="Ex: Studio Dans SRL"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">
                        Website <span className="text-muted-foreground">(opțional)</span>
                      </Label>
                      <Input
                        id="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        maxLength={200}
                        placeholder="https://..."
                      />
                    </div>
                  </>
                )}

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                {success && (
                  <p className="text-sm text-green-600">{success}</p>
                )}

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? "Se salvează..." : "Salvează modificările"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 2 — Securitate */}
            <Card>
              <CardHeader>
                <CardTitle>Securitate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-sm">Parolă</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Ultima modificare: necunoscut
                    </div>
                  </div>
                  {!changingPassword && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setChangingPassword(true);
                        setPasswordError(null);
                        setPasswordSuccess(null);
                      }}
                    >
                      Schimbă parola
                    </Button>
                  )}
                </div>

                {passwordSuccess && (
                  <p className="text-sm text-green-600">{passwordSuccess}</p>
                )}

                {changingPassword && (
                  <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="new_password">Parolă nouă</Label>
                      <Input
                        id="new_password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minim 8 caractere"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirmă parola</Label>
                      <Input
                        id="confirm_password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repetă parola"
                      />
                    </div>
                    {passwordError && (
                      <p className="text-sm text-destructive">{passwordError}</p>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setChangingPassword(false);
                          setNewPassword("");
                          setConfirmPassword("");
                          setPasswordError(null);
                        }}
                      >
                        Anulează
                      </Button>
                      <Button onClick={handleSavePassword} disabled={passwordSaving}>
                        {passwordSaving ? "Se salvează..." : "Salvează parola nouă"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </OwnerLayout>
  );
}
