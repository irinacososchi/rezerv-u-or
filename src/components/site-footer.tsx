export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Rezervări Săli. Toate drepturile rezervate.</p>
        <p>Platformă pentru închirierea sălilor de dans.</p>
      </div>
    </footer>
  );
}
