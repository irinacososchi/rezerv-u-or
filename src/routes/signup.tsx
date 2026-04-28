import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
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
  const [role, setRole] = useState<Role>("renter");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: fullName, role },
      },
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Try to upsert profile (works if session exists immediately or later via trigger).
    if (data.user) {
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email,
          full_name: fullName,
          role,
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
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <h1 className="text-2xl font-bold tracking-tight">Creează cont</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Alege tipul de cont și completează datele.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setRole("renter")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  role === "renter"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Chiriaș
              </button>
              <button
                type="button"
                onClick={() => setRole("owner")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  role === "owner"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Proprietar
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nume complet</Label>
                <Input
                  id="fullName"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ion Popescu"
                />
              </div>
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              {info && (
                <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                  {info}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Se creează contul..." : "Creează cont"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Ai deja cont?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Conectează-te
              </Link>
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
