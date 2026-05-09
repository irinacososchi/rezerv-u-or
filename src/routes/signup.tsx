import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/external-client";

type Role = "renter" | "owner";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Creează cont — Rezervări Săli" },
      { name: "description", content: "Creează un cont de chiriaș sau proprietar." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  async function checkEmailExists(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    setCheckingEmail(true);
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", trimmed)
      .maybeSingle();
    setCheckingEmail(false);
    setEmailExists(!!data);
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!selectedRole) return;
    if (!fullName.trim()) { setError("Completează numele."); return; }
    if (!phone.trim()) { setError("Completează telefonul."); return; }
    if (password.length < 8) { setError("Parola trebuie să aibă minim 8 caractere."); return; }
    if (password !== confirm) { setError("Parolele nu coincid."); return; }
    if (emailExists) { setError("Emailul este deja înregistrat."); return; }

    setLoading(true);

    // Final email check
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (existing) {
      setEmailExists(true);
      setError("Acest email este deja asociat unui cont.");
      setLoading(false);
      return;
    }

    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: fullName.trim(), role: selectedRole },
      },
    });

    if (signupError) {
      setLoading(false);
      const msg = signupError.message.toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already been registered") ||
        msg.includes("user already exists")
      ) {
        setEmailExists(true);
        setError("Acest email este deja asociat unui cont. Autentifică-te sau resetează parola.");
      } else {
        setError(signupError.message);
      }
      return;
    }

    // Supabase returns a "fake" user with empty identities when the email
    // already exists but is unconfirmed (security obfuscation). Detect this.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setLoading(false);
      setEmailExists(true);
      setError("Acest email este deja înregistrat. Autentifică-te sau resetează parola.");
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email: email.trim(),
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          business_name:
            selectedRole === "owner" ? businessName.trim() || null : null,
          role: selectedRole,
        },
        { onConflict: "id" },
      );
    }

    setLoading(false);

    if (data.session) {
      if (selectedRole === "owner") {
        navigate({ to: "/proprietar/dashboard" });
      } else {
        navigate({ to: "/rezervarea-mea" });
      }
    } else {
      setInfo(
        "Cont creat. Verifică-ți emailul pentru a confirma adresa, apoi conectează-te.",
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            {!selectedRole ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight">Creează cont</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ce tip de cont dorești?
                </p>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole("renter")}
                    className="flex w-full items-start gap-4 rounded-xl border-2 border-border bg-background p-4 text-left transition hover:border-primary hover:bg-primary/5"
                  >
                    <div className="text-3xl">🧑</div>
                    <div>
                      <div className="font-semibold">Vreau să închiriez săli</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Caută și rezervă săli de dans pentru repetiții sau cursuri
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole("owner")}
                    className="flex w-full items-start gap-4 rounded-xl border-2 border-border bg-background p-4 text-left transition hover:border-primary hover:bg-primary/5"
                  >
                    <div className="text-3xl">🏢</div>
                    <div>
                      <div className="font-semibold">Am o sală de închiriat</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Listează sala ta și primește rezervări online
                      </div>
                    </div>
                  </button>
                </div>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Ai deja cont?{" "}
                  <Link to="/login" className="font-medium text-primary hover:underline">
                    Autentifică-te
                  </Link>
                </p>
              </>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="text-muted-foreground transition hover:text-primary"
                    aria-label="Înapoi"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium">
                    {selectedRole === "renter" ? "🧑 Cont chiriaș" : "🏢 Cont proprietar"}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Nume complet *</Label>
                  <Input
                    id="fullName"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Numele tău"
                  />
                </div>

                {selectedRole === "owner" && (
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Numele afacerii (opțional)</Label>
                    <Input
                      id="businessName"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="ex: Studio Dans SRL"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07xxxxxxxx"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailExists(false);
                      }}
                      onBlur={() => checkEmailExists(email)}
                      placeholder="email@exemplu.ro"
                      className={
                        emailExists
                          ? "border-destructive pr-10 focus-visible:ring-destructive"
                          : "pr-10"
                      }
                    />
                    {checkingEmail && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {emailExists && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Email deja înregistrat.{" "}
                        <button
                          type="button"
                          onClick={() => navigate({ to: "/login" })}
                          className="font-medium underline hover:no-underline"
                        >
                          Autentifică-te
                        </button>
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Parolă *</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minim 8 caractere"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmă parola *</Label>
                  <Input
                    id="confirm"
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repetă parola"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {info && (
                  <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                    {info}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || emailExists || checkingEmail}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Se creează contul...
                    </>
                  ) : (
                    "Creează cont"
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Ai deja cont?{" "}
                  <Link to="/login" className="font-medium text-primary hover:underline">
                    Autentifică-te
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
