// External Supabase client — connects to the user's own Supabase project
// (NOT the Lovable Cloud managed instance).
//
// Project URL: https://ctvbcywmyigggwmozevr.supabase.co
// Anon/publishable key is safe to expose in client code (RLS protects data).
//
// Usage:
//   import { supabase } from "@/integrations/supabase/external-client";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ctvbcywmyigggwmozevr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dmJjeXdteWlnZ2d3bW96ZXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODgyNDIsImV4cCI6MjA5Mjk2NDI0Mn0.ityBWV-a-N0sD_6GwUYyTx4SgQtVLfIu8cLaPt3wLbE";

const REMEMBER_KEY = "rzrv-remember-me";

// Hybrid storage: writes go to localStorage when "remember me" is enabled,
// otherwise to sessionStorage (which clears on browser close).
// Reads check both, preferring whichever currently has the value.
const hybridStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    const remember = window.localStorage.getItem(REMEMBER_KEY) === "true";
    if (remember) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? hybridStorage : undefined,
  },
});

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    window.localStorage.setItem(REMEMBER_KEY, "true");
  } else {
    window.localStorage.removeItem(REMEMBER_KEY);
  }
}
