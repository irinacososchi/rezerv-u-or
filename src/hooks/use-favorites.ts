import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/external-client";

/**
 * Faza 1: favorite doar pentru utilizatorii autentificați.
 * Faza 2 va adăuga suport pentru vizitatori (localStorage).
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setUserId(null);
          setFavorites(new Set());
          return;
        }
        setUserId(user.id);

        const { data, error } = await supabase
          .from("favorites")
          .select("room_id")
          .eq("renter_id", user.id);
        if (cancelled) return;
        if (error) {
          console.error("useFavorites load", error);
          setFavorites(new Set());
          return;
        }
        setFavorites(
          new Set(
            ((data ?? []) as { room_id: string | null }[])
              .map((r) => r.room_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
      } catch (e) {
        if (!cancelled) {
          console.error("useFavorites", e);
          setFavorites(new Set());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isFavorite = useCallback(
    (roomId: string) => favorites.has(roomId),
    [favorites],
  );

  const toggleFavorite = useCallback(
    async (roomId: string) => {
      if (!userId) return; // Faza 2: favorite pentru vizitatori
      const wasFavorite = favorites.has(roomId);

      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(roomId);
        else next.add(roomId);
        return next;
      });

      try {
        if (wasFavorite) {
          const { error } = await supabase
            .from("favorites")
            .delete()
            .eq("renter_id", userId)
            .eq("room_id", roomId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("favorites")
            .insert({ renter_id: userId, room_id: roomId });
          if (error) throw error;
        }
      } catch (e) {
        console.error("toggleFavorite", e);
        setFavorites((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(roomId);
          else next.delete(roomId);
          return next;
        });
      }
    },
    [favorites, userId],
  );

  return { favorites, isFavorite, toggleFavorite, loading, isLoggedIn: !!userId };
}
