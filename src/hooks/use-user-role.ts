import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/external-client";
import { useAuth } from "@/hooks/use-auth";

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
  const { userId: authUserId, loading: authLoading } = useAuth();
  // undefined = auth încă se citește; null = neautentificat
  const userId = authLoading ? undefined : authUserId;

  // Fetch role data when userId changes.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Auth still being checked — keep loading: true, don't emit EMPTY yet.
    if (userId === undefined) {
      setState(INITIAL);
      return;
    }

    // Auth checked, no user — emit EMPTY with loading: false.
    if (userId === null) {
      setState(EMPTY);
      return;
    }

    // We have a user id — fetch real roles.
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
