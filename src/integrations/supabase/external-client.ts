import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ctvbcywmyigggwmozevr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dmJjeXdteWlnZ2d3bW96ZXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODgyNDIsImV4cCI6MjA5Mjk2NDI0Mn0.ityBWV-a-N0sD_6GwUYyTx4SgQtVLfIu8cLaPt3wLbE";

const REMEMBER_KEY = "rzrv-remember-me";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
  global: {
    headers: {},
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
