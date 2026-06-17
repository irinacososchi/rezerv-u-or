import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/external-client";

export type UserRoleState = {
  isOwner: boolean;
  isRenter: boolean;
  isAdmin: boolean;
  loading: boolean;
};

const EMPTY: UserRoleState = {
  isOwner: false,
  isRenter: false,
  isAdmin: false,
  loading: false,
};

const INITIAL: UserRoleState = {
  isOwner: false,
  isRenter: false,
  isAdmin: false,
  loading: true,
};

export function useUserRole(): UserRoleState {
  const [state, setState] = useState<UserRoleState>(INITIAL);
  const [userId, setUserId] = useState<string | null>(null);

  // Track auth user id; re-run when identity changes (not on every render).
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Fetch role data when userId changes.
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (userId === null) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    (async () => {
      const [roomsRes, bookingsRes, profileRes] = await Promise.all([
        supabase
          .from("rooms")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("renter_id", userId),
        supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single(),
      ]);

      if (cancelled) return;

      setState({
        isOwner: (roomsRes.count ?? 0) > 0,
        isRenter: (bookingsRes.count ?? 0) > 0,
        isAdmin: (profileRes.data as { role: string | null } | null)?.role === "admin",
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state;
}
