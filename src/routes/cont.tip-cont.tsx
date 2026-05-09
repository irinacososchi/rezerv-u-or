import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/external-client";

export const Route = createFileRoute("/cont/tip-cont")({
  head: () => ({
    meta: [{ title: "Schimbă tipul contului — RZRV" }],
  }),
  component: TipContPage,
});

type Profile = { id: string; role: string };

function TipContPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();
      if (!cancelled && data) setProfile(data as Profile);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  async function handleSwitch() {
    if (!profile) return;
    setLoading(true);
    const newRole = profile.role === "renter" ? "owner" : "renter";
    await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profile.id);
    setLoading(false);
    // Force a full reload so the header re-reads the new role from the DB
    if (typeof window !== "undefined") {
      window.location.href = newRole === "owner" ? "/proprietar/dashboard" : "/cont/rezervari";
    } else if (newRole === "owner") {
      navigate({ to: "/proprietar/dashboard" });
    } else {
      navigate({ to: "/cont/rezervari" });
    }
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1" />
        <SiteFooter />
      </div>
    );
  }

  const isRenter = profile.role === "renter";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mb-4 text-5xl">{isRenter ? "🏢" : "🧑"}</div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isRenter ? "Listează o sală" : "Treci la cont chiriaș"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isRenter
                ? "Contul tău va fi transformat în cont de proprietar. Vei putea adăuga și gestiona săli de dans."
                : "Contul tău va reveni la cont de chiriaș. Vei putea căuta și rezerva săli."}
            </p>

            {!confirmed ? (
              <div className="mt-6 space-y-2">
                <Button className="w-full" onClick={() => setConfirmed(true)}>
                  {isRenter ? "Da, vreau să listez o sală" : "Da, trec la cont chiriaș"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate({ to: isRenter ? "/" : "/proprietar/cont" })}
                >
                  Anulează
                </Button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Ești sigur?{" "}
                  {isRenter
                    ? "Datele tale de chiriaș rămân salvate."
                    : "Sălile tale rămân salvate, doar nu le mai poți gestiona."}
                </p>
                <Button className="w-full" onClick={handleSwitch} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Se actualizează...
                    </>
                  ) : (
                    "Confirmă schimbarea"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setConfirmed(false)}
                >
                  Înapoi
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
