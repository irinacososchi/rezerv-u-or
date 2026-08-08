import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="bg-muted/30">
      <div className="container mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
          <Link to="/termeni-si-conditii" className="transition-colors hover:text-foreground">
            Termeni și Condiții
          </Link>
          <Link to="/politica-confidentialitate" className="transition-colors hover:text-foreground">
            Politica de Confidențialitate
          </Link>
          <Link to="/politica-cookies" className="transition-colors hover:text-foreground">
            Politica de Cookies
          </Link>
          <Link to="/contact" className="transition-colors hover:text-foreground">
            Contact
          </Link>
        </nav>
        <div className="flex flex-col items-center gap-1 text-center text-xs sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>COSOSCHI GHEORGHE-ALEXANDRU PFA · CUI 48240601 · contact@rzrv.ro</p>
          <p>© 2026 RZRV. Toate drepturile rezervate.</p>
        </div>
      </div>
    </footer>
  );
}
