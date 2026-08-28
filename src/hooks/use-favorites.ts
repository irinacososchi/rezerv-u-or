import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/external-client";

const STORAGE_KEY = "rzrv-favorites";

function readGuestFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writeGuestFavorites(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error("useFavorites: localStorage write", e);
  }
}

function clearGuestFavorites() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function fetchAccountFavorites(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select("room_id")
    .eq("renter_id", userId);
  if (error) throw error;
  return ((data ?? []) as { room_id: string | null }[])
    .map((r) => r.room_id)
    .filter((id): id is string => Boolean(id));
}

/**
 * Favorite pentru utilizatori autentificați (tabelul `favorites`) și
 * pentru vizitatori (localStorage), cu migrare automată la autentificare.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const migratedForUser = useRef<string | null>(null);
  const { userId: authUserId, loading: authLoading } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function syncForUser(user: { id: string } | null) {
      if (!user) {
        migratedForUser.current = null;
        setUserId(null);
        setFavorites(new Set(readGuestFavorites()));
        setLoading(false);
        return;
      }

      setUserId(user.id);

      try {
        let accountIds = await fetchAccountFavorites(user.id);

        // Migrare favorite vizitator -> cont (o singură dată per utilizator)
        const guestIds = readGuestFavorites();
        if (guestIds.length > 0 && migratedForUser.current !== user.id) {
          migratedForUser.current = user.id;
          const existing = new Set(accountIds);
          const missing = guestIds.filter((id) => !existing.has(id));
          try {
            if (missing.length > 0) {
              const { error } = await supabase
                .from("favorites")
                .insert(missing.map((room_id) => ({ renter_id: user.id, room_id })));
              if (error) throw error;
            }
            clearGuestFavorites();
            accountIds = await fetchAccountFavorites(user.id);
          } catch (e) {
            // Nu pierdem favoritele vizitatorului dacă migrarea eșuează
            console.error("useFavorites: migrare favorite", e);
            migratedForUser.current = null;
          }
        }

        if (cancelled) return;
        setFavorites(new Set(accountIds));
      } catch (e) {
        if (cancelled) return;
        console.error("useFavorites load", e);
        setFavorites(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Auth încă se citește — nu decidem încă între cont și vizitator.
    if (authLoading) return;

    void syncForUser(authUserId ? { id: authUserId } : null);

    return () => {
      cancelled = true;
    };
  }, [authUserId, authLoading]);

  const isFavorite = useCallback(
    (roomId: string) => favorites.has(roomId),
    [favorites],
  );

  const toggleFavorite = useCallback(
    async (roomId: string) => {
      const wasFavorite = favorites.has(roomId);
      const next = new Set(favorites);
      if (wasFavorite) next.delete(roomId);
      else next.add(roomId);
      setFavorites(next);

      if (!userId) {
        writeGuestFavorites(Array.from(next));
        return;
      }

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
          const revert = new Set(prev);
          if (wasFavorite) revert.add(roomId);
          else revert.delete(roomId);
          return revert;
        });
      }
    },
    [favorites, userId],
  );

  return { favorites, isFavorite, toggleFavorite, loading, isLoggedIn: !!userId };
}
