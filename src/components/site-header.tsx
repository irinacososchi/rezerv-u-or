import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Music2 } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Music2 className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">Rezervări Săli</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" asChild className="text-foreground/80">
            <Link to="/sali">Săli</Link>
          </Button>
          <Button variant="outline" asChild className="hidden sm:inline-flex">
            <a href="#autentificare">Autentificare</a>
          </Button>
          <Button asChild>
            <a href="#listeaza">Listează sala ta</a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
