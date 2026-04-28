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
}

export function RoomCard({ room }: { room: Room }) {
  const navigate = useNavigate();

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] cursor-pointer"
      onClick={() => navigate({ to: "/sali/$slug", params: { slug: room.slug } })}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
        <img
          src={room.image}
          alt={room.name}
          loading="lazy"
          width={1280}
          height={832}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{room.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {room.neighbourhood}, {room.city}
          </p>
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
