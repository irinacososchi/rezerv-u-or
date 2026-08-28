import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/external-client";
import { AuthContext } from "@/hooks/use-auth";

/**
 * Un singur getSession() + un singur onAuthStateChange pentru toată aplicația.
 * Evită contenția pe lock-ul gotrue-js (apeluri concurente getUser()).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Eroare tranzitorie — nu deconectăm utilizatorul.
          console.error("Auth: citirea sesiunii a eșuat", error);
        } else {
          setSession(data.session);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Auth: citirea sesiunii a eșuat", err);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (cancelled) return;
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "TOKEN_REFRESHED"
      ) {
        return;
      }
      setSession(s);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      userId: session?.user?.id ?? null,
      loading,
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
