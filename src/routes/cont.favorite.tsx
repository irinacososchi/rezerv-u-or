import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Heart } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { RoomCard, type Room } from "@/components/room-card";
import { supabase } from "@/integrations/supabase/external-client";

export const Route = createFileRoute("/cont/favorite")({
  head: () => ({
    meta: [{ title: "Săli favorite — RZRV" }],
  }),
  component: FavoriteContPage,
});

type FavRow = {
  id: string;
  created_at: string;
  rooms: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    city: string | null;
    neighbourhood: string | null;
    is_active?: boolean | null;
    room_photos: { storage_url: string; is_cover: boolean | null }[];
    pricing_rules: { price_per_hour: number; is_active: boolean }[];
  } | null;
};

function FavoriteContPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigate({ to: "/login" });
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", u.id)
        .single();
      if (cancelled) return;
      if (!p) {
        navigate({ to: "/login" });
        return;
      }

      const { data } = await supabase
        .from("favorites")
        .select(`
          id,
          created_at,
          rooms(
            id, name, slug, address, city, neighbourhood, is_active,
            room_photos(storage_url, is_cover),
            pricing_rules(price_per_hour, is_active)
          )
        `)
        .eq("renter_id", u.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      setFavorites((data ?? []) as unknown as FavRow[]);
      setLoading(false);
    }
    checkAuth();
    return () => { cancelled = true; };
  }, [navigate]);

  async function removeFavorite(favoriteId: string) {
    await supabase.from("favorites").delete().eq("id", favoriteId);
    setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
  }

  if (loading) {
    return (
      <Shell>
        <div className="container mx-auto max-w-5xl px-4 py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="flex-1">
        <div className="container mx-auto max-w-5xl px-4 py-10">
          <h1 className="text-3xl font-bold tracking-tight">Sălile mele favorite</h1>
          <p className="mt-2 text-muted-foreground">
            Sălile pe care le-ai salvat pentru rezervări viitoare.
          </p>

          {favorites.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
              <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Nu ai salvat nicio sală la favorite.
              </p>
              <Button asChild className="mt-5">
                <Link to="/sali">Descoperă săli</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {favorites
                .filter((f) => f.rooms)
                .map((f) => {
                  const r = f.rooms!;
                  const cover =
                    r.room_photos?.find((p) => p.is_cover)?.storage_url ??
                    r.room_photos?.[0]?.storage_url ??
                    "";
                  const prices = (r.pricing_rules ?? [])
                    .filter((p) => p.is_active)
                    .map((p) => Number(p.price_per_hour))
                    .filter((n) => !Number.isNaN(n));
                  const priceMin = prices.length ? Math.min(...prices) : 0;
                  const priceMax = prices.length ? Math.max(...prices) : 0;
                  const room: Room = {
                    id: r.id,
                    name: r.name,
                    slug: r.slug,
                    neighbourhood: r.neighbourhood ?? "",
                    city: r.city ?? "",
                    countyName: "",
                    cityId: null,
                    countyId: null,
                    priceMin,
                    priceMax,
                    image: cover,
                    hasMirrors: false,
                    hasSound: false,
                    hasBarre: false,
                    isActive: r.is_active ?? true,
                  };
                  return (
                    <div key={f.id} className="relative">
                      <RoomCard room={room} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFavorite(f.id);
                        }}
                        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50/95 px-2.5 py-1 text-xs font-medium text-red-600 shadow-sm backdrop-blur hover:bg-red-100"
                        aria-label="Elimină din favorite"
                      >
                        <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                        Elimină
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
