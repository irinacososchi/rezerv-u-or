import { supabase } from "@/integrations/supabase/external-client";
import type { Room } from "@/components/room-card";
import sala1 from "@/assets/sala-1.jpg";
import sala2 from "@/assets/sala-2.jpg";
import sala3 from "@/assets/sala-3.jpg";

const FALLBACK_IMAGES = [sala1, sala2, sala3];

type RoomRow = {
  id: string;
  slug: string | null;
  name: string;
  city: string;
  neighbourhood: string | null;
  has_mirrors: boolean | null;
  has_sound_system: boolean | null;
  has_ballet_barre: boolean | null;
  is_active: boolean | null;
  room_photos: { storage_url: string; is_cover: boolean | null; sort_order: number | null }[] | null;
  pricing_rules: { price_per_hour: number; is_active: boolean | null }[] | null;
};

function pickImage(row: RoomRow, idx: number): string {
  const photos = row.room_photos ?? [];
  if (photos.length > 0) {
    const cover = photos.find((p) => p.is_cover);
    if (cover) return cover.storage_url;
    const sorted = [...photos].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    return sorted[0].storage_url;
  }
  return FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length];
}

function priceRange(row: RoomRow): { min: number; max: number } {
  const prices = (row.pricing_rules ?? [])
    .filter((p) => p.is_active !== false)
    .map((p) => Number(p.price_per_hour))
    .filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export async function fetchRooms(
  limit = 6,
  options: { activeOnly?: boolean } = {},
): Promise<Room[]> {
  const { activeOnly = true } = options;
  let query = supabase
    .from("rooms")
    .select(
      `id, name, slug, city, neighbourhood, has_mirrors, has_sound_system, has_ballet_barre, is_active, room_photos(storage_url, is_cover, sort_order), pricing_rules(price_per_hour, is_active)`,
    )
    .limit(limit);

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchRooms error:", error.message);
    return [];
  }

  const rows = (data ?? []) as RoomRow[];
  // Active rooms first, then inactive
  rows.sort((a, b) => Number(b.is_active ?? false) - Number(a.is_active ?? false));
  return rows.map((row, idx) => {
    const { min, max } = priceRange(row);
    return {
      id: row.id,
      slug: row.slug ?? "",
      name: row.name,
      city: row.city ?? "",
      neighbourhood: row.neighbourhood ?? "",
      priceMin: min,
      priceMax: max,
      image: pickImage(row, idx),
      hasMirrors: !!row.has_mirrors,
      hasSound: !!row.has_sound_system,
      hasBarre: !!row.has_ballet_barre,
      isActive: !!row.is_active,
    };
  });
}
