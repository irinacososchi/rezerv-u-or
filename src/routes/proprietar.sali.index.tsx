import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OwnerLayout } from "@/components/owner-layout";
import { supabase } from "@/integrations/supabase/external-client";
import { Building2, Link as LinkIcon, Calendar, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/proprietar/sali/")({
  component: RoomsPage,
});

type RoomPhoto = { storage_url: string | null; is_cover: boolean | null };
type Room = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  neighbourhood: string | null;
  is_active: boolean;
  booking_type: string | null;
  created_at: string;
  room_photos: RoomPhoto[] | null;
};

function getCover(room: Room): string | null {
  const photos = room.room_photos ?? [];
  const cover = photos.find((p) => p.is_cover) ?? photos[0];
  return cover?.storage_url ?? null;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function RoomsPage() {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadRooms() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("rooms")
      .select(
        `id, name, slug, address, city, neighbourhood, is_active, booking_type, created_at,
         room_photos(storage_url, is_cover)`,
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Nu am putut încărca sălile.");
    }
    setRooms((data ?? []) as Room[]);
    setLoading(false);
  }

  useEffect(() => {
    loadRooms();
  }, []);

  async function handleToggleActive(room: Room) {
    setTogglingId(room.id);
    const { error } = await supabase
      .from("rooms")
      .update({ is_active: !room.is_active })
      .eq("id", room.id);
    setTogglingId(null);
    if (error) {
      toast.error("Nu am putut actualiza sala.");
      return;
    }
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, is_active: !r.is_active } : r)),
    );
    toast.success(!room.is_active ? "Sala este activă." : "Sala este inactivă.");
  }

  function handleCopyLink(slug: string) {
    const url = `${window.location.origin}/sali/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiat!");
  }

  return (
    <OwnerLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">Sălile mele</h1>
            <p className="text-muted-foreground mt-1">Administrează sălile pe care le închiriezi.</p>
          </div>
          <Button asChild>
            <a href="/proprietar/sali/nou">
              <Plus className="h-4 w-4" />
              Adaugă sală nouă
            </a>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="max-w-xl mx-auto text-center py-20 space-y-4">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Nu ai adăugat nicio sală încă.</h2>
            <p className="text-muted-foreground">
              Adaugă prima ta sală pentru a începe să primești rezervări.
            </p>
            <Button asChild>
              <a href="/proprietar/sali/nou">Adaugă prima sală</a>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => {
              const cover = getCover(room);
              const addressLine = [room.address, room.neighbourhood, room.city]
                .filter(Boolean)
                .join(", ");
              const isInstant = room.booking_type === "instant";
              return (
                <Card key={room.id}>
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                    {/* Photo */}
                    <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                      {cover ? (
                        <img
                          src={cover}
                          alt={room.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-muted-foreground">
                          {getInitials(room.name)}
                        </span>
                      )}
                    </div>

                    {/* Name + address */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{room.name}</p>
                        <span
                          className={
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium " +
                            (isInstant
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-orange-100 text-orange-800 border-orange-200")
                          }
                        >
                          {isInstant ? "Instant" : "Manual"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {addressLine || "Fără adresă"}
                      </p>
                    </div>

                    {/* Active toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={room.is_active}
                        onCheckedChange={() => handleToggleActive(room)}
                        disabled={togglingId === room.id}
                        aria-label="Activ"
                      />
                      <span className="text-sm text-muted-foreground">
                        {room.is_active ? "Activ" : "Inactiv"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(room.slug)}
                      >
                        <LinkIcon className="h-4 w-4" />
                        Copiază link
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/proprietar/sali/${room.id}/calendar`}>
                          <Calendar className="h-4 w-4" />
                          Calendar
                        </a>
                      </Button>
                      <Button size="sm" asChild>
                        <a href={`/proprietar/sali/${room.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                          Editează
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </OwnerLayout>
  );
}
