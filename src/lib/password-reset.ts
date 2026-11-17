import { supabase } from "@/integrations/supabase/external-client";

/** Sends the password-reset email; returns a Romanian error message or null. */
export async function sendPasswordResetLink(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-parola`,
  });
  if (!error) return null;
  const msg = (error.message || "").toLowerCase();
  if (error.status === 429 || msg.includes("rate") || msg.includes("security purposes")) {
    return "Ai cerut prea multe linkuri într-un timp scurt. Te rugăm să aștepți câteva minute și să încerci din nou.";
  }
  return "Nu am putut trimite emailul. Te rugăm să încerci din nou.";
}
