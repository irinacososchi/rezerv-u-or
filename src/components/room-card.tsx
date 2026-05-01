import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export interface Room {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  city: string;
  priceMin: number;
  priceMax: number;
  image: string;
  hasMirrors: boolean;
  hasSound: boolean;
  hasBarre: boolean;
  isActive: boolean;
}

export function RoomCard({ room }: { room: Room }) {
  const navigate = useNavigate();
  const inactive = !room.isActive;

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition cursor-pointer ${
        inactive
          ? "border-border/60 opacity-80 hover:opacity-100"
          : "border-border hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
      }`}
      onClick={() => navigate({ to: "/sali/$slug", params: { slug: room.slug } })}
      aria-label={inactive ? `${room.name} (inactivă)` : room.name}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <img
          src={room.image}
          alt={room.name}
          loading="lazy"
          width={1280}
          height={832}
          className={`h-full w-full object-cover transition duration-500 ${
            inactive ? "grayscale" : "group-hover:scale-[1.03]"
          }`}
        />
        {inactive && (
          <>
            <div className="absolute inset-0 bg-background/40" aria-hidden="true" />
            <span className="absolute left-3 top-3 inline-flex items-center rounded-md bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground shadow">
              Inactivă
            </span>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{room.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {room.neighbourhood}, {room.city}
          </p>
          {inactive && (
            <p className="mt-2 text-xs font-medium text-destructive">
              Momentan nu acceptă rezervări
            </p>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm">
            <span className="font-semibold text-foreground">
              {room.priceMin === room.priceMax ? `${room.priceMin} RON` : `${room.priceMin}–${room.priceMax} RON`}
            </span>
            <span className="text-muted-foreground">/oră</span>
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate({ to: "/sali/$slug", params: { slug: room.slug } });
            }}
          >
            Vezi detalii
          </Button>
        </div>
      </div>
    </article>
  );
}
