import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/external-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-parola")({
  head: () => ({
    meta: [
      { title: "Resetare parolă — Rezervări Săli" },
      { name: "description", content: "Setează o parolă nouă pentru contul tău." },
    ],
  }),
  component: ResetParolaPage,
});

function ResetParolaPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    // Verificăm dacă există deja o sesiune (link-ul de email setează automat sesiunea)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValidSession(true);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Parola trebuie să aibă minim 8 caractere.");
      return;
    }
    if (password !== confirm) {
      setError("Parolele nu coincid.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("Eroare: " + error.message);
      return;
    }

    setDone(true);
    setTimeout(() => navigate({ to: "/login" }), 3000);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            {!validSession ? (
              <p className="text-center text-sm text-muted-foreground">
                Se verifică linkul de resetare...
              </p>
            ) : !done ? (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Parolă nouă</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Introdu noua ta parolă.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Parolă nouă</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minim 8 caractere"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmă parola</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repetă parola"
                    required
                  />
                </div>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Se salvează..." : "Salvează parola nouă"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Parolă schimbată!</h2>
                <p className="text-sm text-muted-foreground">
                  Ești redirecționat către login...
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
