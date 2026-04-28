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
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BL3tvAeYOMXsRbtGuvLgqQ_HBqf9NL3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
