import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AuthState = {
  session: Session | null;
  user: User | null;
  userId: string | null;
  /** true cât timp sesiunea inițială e citită din storage */
  loading: boolean;
};

export const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  userId: null,
  loading: true,
});

/**
 * Sursa unică de adevăr pentru starea de autentificare.
 * NU apela supabase.auth.getUser()/getSession() în componente — folosește acest hook.
 */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
