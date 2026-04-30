import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/external-client";
import logoUrl from "@/assets/rzrv-logo.png";

export function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUserRole(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setUserRole(profile?.role ?? null);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <img src={logoUrl} alt="RZRV" className="h-28 w-auto" />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" asChild className="text-foreground/80">
            <Link to="/">Acasă</Link>
          </Button>
          <Button variant="ghost" asChild className="text-foreground/80">
            <Link to="/sali">Săli</Link>
          </Button>

          {(userRole === "owner" || userRole === "admin") && (
            <a
              href="/proprietar/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition"
            >
              <LayoutDashboard className="h-4 w-4" />
              Panoul meu
            </a>
          )}

          {!loading && !user && (
            <>
              <Button variant="outline" asChild className="hidden sm:inline-flex">
                <Link to="/login">Autentificare</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Creează cont</Link>
              </Button>
            </>
          )}

          {!loading && user && (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
              <Button variant="outline" onClick={handleLogout}>
                Ieși din cont
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
