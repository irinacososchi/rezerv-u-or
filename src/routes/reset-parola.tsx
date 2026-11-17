import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { sendPasswordResetLink } from "@/lib/password-reset";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/external-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-parola")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { title: "Resetare parolă — Rezervări Săli" },
      { name: "description", content: "Setează o parolă nouă pentru contul tău." },
    ],
  }),
  component: ResetParolaPage,
});

// Captured at module evaluation in the browser, before Supabase cleans the URL.
function urlHasRecoveryToken(): boolean {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("type") === "recovery" || query.has("code") || query.get("type") === "recovery";
}
const initialRecoveryFlag = urlHasRecoveryToken();

function ResetParolaPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recovery, setRecovery] = useState(initialRecoveryFlag);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setHasSession(!!session);
      setEmail(session?.user?.email ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setEmail(session?.user?.email ?? null);
      // Give the code exchange a moment if a token was present in the URL.
      setTimeout(() => setChecking(false), session || !initialRecoveryFlag ? 0 : 2500);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const canReset = recovery && hasSession;

  async function handleSendNewLink() {
    if (!email) {
      navigate({ to: "/login" });
      return;
    }
    setSendingLink(true);
    const err = await sendPasswordResetLink(email);
    setSendingLink(false);
    if (err) toast.error(err);
    else toast.success(`Ți-am trimis un email la ${email}. Linkul expiră în 1 oră.`);
  }

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
    if (error) {
      setLoading(false);
      setError("Nu am putut schimba parola. Te rugăm să încerci din nou.");
      return;
    }
    await supabase.auth.signOut({ scope: "others" });
    setLoading(false);
    toast.success("Parola a fost schimbată");
    navigate({ to: "/cont" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            {checking ? (
              <p className="text-center text-sm text-muted-foreground">
                Se verifică linkul de resetare...
              </p>
            ) : !canReset ? (
              <div className="space-y-4 text-center">
                <h1 className="text-xl font-bold tracking-tight">
                  Linkul este invalid sau a expirat
                </h1>
                <p className="text-sm text-muted-foreground">
                  Solicită un link nou pentru a-ți seta parola.
                </p>
                <Button onClick={handleSendNewLink} disabled={sendingLink} className="w-full">
                  {sendingLink ? "Se trimite..." : "Trimite link nou"}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Parolă nouă</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Introdu noua ta parolă.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Parolă nouă</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minim 8 caractere"
                      required
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
                  <Label htmlFor="confirm">Confirmă parola</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repetă parola"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      aria-label={showConfirm ? "Ascunde parola" : "Arată parola"}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
