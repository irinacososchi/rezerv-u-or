import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendPasswordResetLink } from "@/lib/password-reset";

const COOLDOWN = 60;

export function PasswordResetLinkSection({ email }: { email: string | null | undefined }) {
  const [sending, setSending] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function handleSend() {
    if (!email) return;
    setSending(true);
    const err = await sendPasswordResetLink(email);
    setSending(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(`Ți-am trimis un email la ${email}. Linkul expiră în 1 oră.`);
    setLeft(COOLDOWN);
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Schimbă parola</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Îți vom trimite un link pe email pentru a seta o parolă nouă.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={handleSend}
        disabled={sending || left > 0 || !email}
      >
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Se trimite...
          </>
        ) : left > 0 ? (
          `Retrimite în ${left}s`
        ) : (
          "Trimite link de schimbare"
        )}
      </Button>
    </div>
  );
}
