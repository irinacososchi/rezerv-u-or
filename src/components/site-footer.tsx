import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© 2026 Cososchi Gheorghe Alexandru PFA. Toate drepturile rezervate.</p>
        <div className="flex items-center gap-4">
          <Link to="/contact" className="hover:text-foreground transition-colors">
            Contact
          </Link>
          <span>Platformă pentru închiriere săli.</span>
        </div>
      </div>
    </footer>
  );
}
