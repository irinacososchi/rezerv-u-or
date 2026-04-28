import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Sparkles, Calendar, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RoomCard, type Room } from "@/components/room-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchRooms } from "@/data/rooms";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rezervări Săli — Găsește sala perfectă pentru dans" },
      {
        name: "description",
        content:
          "Descoperă și rezervă săli de dans din toată țara. Alege ziua și intervalul, rezervă pe loc.",
      },
      { property: "og:title", content: "Rezervări Săli — Săli de dans de închiriat" },
      {
        property: "og:description",
        content: "Găsește sala perfectă pentru repetiții, cursuri sau evenimente.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [query, setQuery] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms(6).then(setRooms).catch((e) => console.error("fetchRooms", e));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/sali", search: { city: query } as never });
  };

  const steps = [
    { n: "1", title: "Caută o sală", icon: Search, desc: "După oraș sau cartier." },
    { n: "2", title: "Alege intervalul", icon: Calendar, desc: "Zi și oră potrivite." },
    { n: "3", title: "Rezervă pe loc", icon: CheckCircle2, desc: "Confirmare instant." },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section
          className="border-b border-border/60"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          <div className="container mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Săli de dans verificate
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                Găsește sala perfectă pentru nevoile tale
              </h1>
              <p className="mt-5 text-base text-muted-foreground sm:text-lg">
                Repetiții, cursuri, ateliere sau evenimente — rezervă o sală cu echipare
                completă în câteva minute.
              </p>

              <form
                onSubmit={handleSearch}
                className="mx-auto mt-8 flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-soft)] sm:flex-row"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Oraș sau cartier (ex: București, Floreasca)"
                    className="h-12 border-0 pl-9 shadow-none focus-visible:ring-0"
                  />
                </div>
                <Button type="submit" size="lg" className="h-12 px-6">
                  Caută
                </Button>
              </form>
            </div>
          </div>
        </section>

        {/* Cum funcționează */}
        <section className="container mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Cum funcționează
            </h2>
            <p className="mt-3 text-muted-foreground">Trei pași simpli până la rezervare.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground font-semibold">
                    {s.n}
                  </span>
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Săli disponibile */}
        <section className="border-t border-border/60 bg-muted/30">
          <div className="container mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <div className="mb-10 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Săli disponibile
                </h2>
                <p className="mt-2 text-muted-foreground">O selecție de săli populare.</p>
              </div>
              <Button variant="outline" asChild className="hidden sm:inline-flex">
                <a href="/sali">Vezi toate</a>
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((r) => (
                <RoomCard key={r.id} room={r} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
