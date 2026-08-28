import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/external-client";

/**
 * Înlocuiește supabase.auth.getUser() în UI: citește sesiunea din storage
 * (fără apel de rețea), evitând contenția pe lock-ul de autentificare când
 * mai multe componente verifică utilizatorul în paralel.
 */
export async function getSessionUser(): Promise<{ data: { user: User | null } }> {
  const { data } = await supabase.auth.getSession();
  return { data: { user: data.session?.user ?? null } };
}
