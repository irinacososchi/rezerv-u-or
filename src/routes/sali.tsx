import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RoomCard, type Room } from "@/components/room-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { fetchRooms } from "@/data/rooms";
import { SearchX } from "lucide-react";

type SaliSearch = { city?: string };

export const Route = createFileRoute("/sali")({
  validateSearch: (search: Record<string, unknown>): SaliSearch => ({
    city: typeof search.city === "string" ? search.city : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Săli de dans disponibile — Rezervări Săli" },
      {
        name: "description",
        content: "Filtrează săli de dans după oraș, preț și dotări. Rezervă online.",
      },
      { property: "og:title", content: "Săli de dans disponibile" },
      {
        property: "og:description",
        content: "Filtrează după oraș, preț și dotări. Găsește sala potrivită.",
      },
    ],
  }),
  component: SaliPage,
});

function SaliPage() {
  const search = Route.useSearch();
  const [city, setCity] = useState(search.city ?? "");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [mirrors, setMirrors] = useState(false);
  const [sound, setSound] = useState(false);
  const [barre, setBarre] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    fetchRooms().then(setRooms).catch((e) => console.error("fetchRooms", e));
  }, []);

  const filtered = useMemo(() => {
    const min = priceMin ? Number(priceMin) : undefined;
    const max = priceMax ? Number(priceMax) : undefined;
    return rooms.filter((r) => {
      if (city) {
        const q = city.toLowerCase();
        if (
          !r.city.toLowerCase().includes(q) &&
          !r.neighbourhood.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (min !== undefined && r.priceMax < min) return false;
      if (max !== undefined && r.priceMin > max) return false;
      if (mirrors && !r.hasMirrors) return false;
      if (sound && !r.hasSound) return false;
      if (barre && !r.hasBarre) return false;
      return true;
    });
  }, [rooms, city, priceMin, priceMax, mirrors, sound, barre]);

  const reset = () => {
    setCity("");
    setPriceMin("");
    setPriceMax("");
    setMirrors(false);
    setSound(false);
    setBarre(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="container mx-auto max-w-6xl px-4 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Săli disponibile</h1>
            <p className="mt-2 text-muted-foreground">
              Filtrează după oraș, preț și dotări.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            {/* Sidebar filters */}
            <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] lg:sticky lg:top-20">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Filtre</h2>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Resetează
                </Button>
              </div>

              <div className="mt-5 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="city">Oraș</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="ex: București"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Interval preț (RON/oră)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Min"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Max"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <Label className="text-sm text-muted-foreground">Dotări</Label>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={mirrors}
                      onCheckedChange={(v) => setMirrors(Boolean(v))}
                    />
                    Oglinzi
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={sound}
                      onCheckedChange={(v) => setSound(Boolean(v))}
                    />
                    Sistem de sunet
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={barre}
                      onCheckedChange={(v) => setBarre(Boolean(v))}
                    />
                    Bară de balet
                  </label>
                </div>
              </div>
            </aside>

            {/* Results */}
            <section>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <SearchX className="h-6 w-6 text-muted-foreground" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">Niciun rezultat</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Nu am găsit săli care să corespundă filtrelor selectate. Încearcă să
                    ajustezi criteriile.
                  </p>
                  <Button onClick={reset} variant="outline" className="mt-5">
                    Resetează filtrele
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {filtered.map((r) => (
                    <RoomCard key={r.id} room={r} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
