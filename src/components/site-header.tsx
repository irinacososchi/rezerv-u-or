import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Disc3 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/external-client";

export function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Disc3 className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">Rezervări Săli</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" asChild className="text-foreground/80">
            <Link to="/sali">Săli</Link>
          </Button>

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
