import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/external-client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Creează cont — Rezervări Săli" },
      { name: "description", content: "Creează un cont pentru a rezerva sau lista săli." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [isOver16, setIsOver16] = useState(false);
  const [showConsentHint, setShowConsentHint] = useState(false);

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
    setShowConsentHint(false);

    if (!agreedToLegal || !isOver16) {
      setShowConsentHint(true);
      return;
    }
    if (!fullName.trim()) { setError("Completează numele."); return; }
    if (password.length < 6) { setError("Parola trebuie să aibă minim 6 caractere."); return; }
    if (password !== confirm) { setError("Parolele nu coincid."); return; }
    if (emailExists) { setError("Emailul este deja înregistrat."); return; }


    setLoading(true);

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
        data: {
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        },
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
        },
        { onConflict: "id" },
      );
    }

    setLoading(false);

    if (data.session) {
      navigate({ to: "/" });
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
            <h1 className="text-2xl font-bold tracking-tight">Creează cont</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Un singur cont - poți rezerva locații sau să listezi propriile tale săli.
            </p>

            <form onSubmit={handleSignup} className="mt-6 space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07xxxxxxxx"
                />
                <p className="text-xs text-muted-foreground">
                  Util pentru notificări la rezervări.
                </p>
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minim 6 caractere"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    aria-label={showPassword ? "Ascunde parola" : "Arată parola"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmă parola *</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repetă parola"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    aria-label={showConfirmPassword ? "Ascunde parola" : "Arată parola"}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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

              <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="agreedToLegal"
                  checked={agreedToLegal}
                  onCheckedChange={(v) => {
                    setAgreedToLegal(v === true);
                    setShowConsentHint(false);
                  }}
                />
                  <label htmlFor="agreedToLegal" className="text-sm leading-tight text-muted-foreground">
                    Sunt de acord cu{" "}
                    <a
                      href="/termeni-si-conditii"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      Termenii și Condițiile
                    </a>{" "}
                    și{" "}
                    <a
                      href="/politica-confidentialitate"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      Politica de Confidențialitate
                    </a>
                    .
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="isOver16"
                    checked={isOver16}
                    onCheckedChange={(v) => {
                      setIsOver16(v === true);
                      setShowConsentHint(false);
                    }}
                  />
                  <label htmlFor="isOver16" className="text-sm leading-tight text-muted-foreground">
                    Confirm că am cel puțin 16 ani.
                  </label>
                </div>
                {showConsentHint && (
                  <p className="text-sm text-destructive">
                    Trebuie să bifezi ambele opțiuni pentru a crea contul.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || emailExists || checkingEmail || !agreedToLegal || !isOver16}
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
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
