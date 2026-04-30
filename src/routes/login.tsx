import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/external-client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Autentificare — Rezervări Săli" },
      { name: "description", content: "Conectează-te în contul tău pentru a rezerva săli." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setLoading(false);
      if (profile?.role === "owner" || profile?.role === "admin") {
        navigate({ to: "/proprietar/dashboard" });
        return;
      }
    } else {
      setLoading(false);
    }
    navigate({ to: "/" });
  };

  async function handlePasswordReset(e: FormEvent) {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-parola`,
    });

    setResetLoading(false);

    if (error) {
      setResetError("Eroare: " + error.message);
      return;
    }

    setResetSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            {!showReset ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight">Bine ai revenit</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conectează-te pentru a continua.
                </p>

                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nume@exemplu.ro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Parolă</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Se conectează..." : "Conectează-te"}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowReset(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      Am uitat parola
                    </button>
                  </div>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Nu ai cont?{" "}
                  <Link to="/signup" className="font-medium text-primary hover:underline">
                    Creează unul
                  </Link>
                </p>
              </>
            ) : !resetSent ? (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Resetează parola</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Introdu adresa de email și îți trimitem un link de resetare.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="email@exemplu.ro"
                    required
                  />
                </div>

                {resetError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {resetError}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? "Se trimite..." : "Trimite link de resetare"}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setShowReset(false);
                    setResetError(null);
                  }}
                  className="block w-full text-center text-sm text-muted-foreground hover:text-primary"
                >
                  Înapoi la login
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Email trimis!</h2>
                <p className="text-sm text-muted-foreground">
                  Am trimis un link de resetare la <strong>{resetEmail}</strong>. Verifică
                  și folderul Spam dacă nu îl găsești.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowReset(false);
                    setResetSent(false);
                    setResetEmail("");
                  }}
                >
                  Înapoi la login
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
