import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/external-client";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — RZRV" },
      {
        name: "description",
        content:
          "Contactează echipa RZRV: raportează probleme sau propune idei noi pentru platformă.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Te rugăm să completezi numele.");
      return;
    }
    if (!email.trim() || !isValidEmail(email)) {
      toast.error("Te rugăm să introduci o adresă de email validă.");
      return;
    }
    if (!description.trim()) {
      toast.error("Te rugăm să completezi descrierea.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-contact-email",
        {
          body: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            description: description.trim(),
          },
        },
      );

      if (error) throw new Error(error.message || "Eroare la trimitere.");
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }

      toast.success("Mesajul a fost trimis! Te contactăm în curând.");
      setName("");
      setEmail("");
      setPhone("");
      setDescription("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "A apărut o eroare.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-12 md:py-16">
          <div className="mb-8 md:mb-10 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Contact
            </h1>
            <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
              Ai găsit ceva ce nu funcționează, vrei sa colaborezi cu noi sau
              poate ai idei noi pe care am putea să le implementăm?
              <br />
              Trimite formularul cu o descriere amănunțită și te contactăm noi pentru detalii.{"\u00a0"}
            </p>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Nume și prenume</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ion Popescu"
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nume@exemplu.ro"
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Număr de telefon{" "}
                    <span className="text-muted-foreground font-normal">
                      (opțional)
                    </span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07xxxxxxxx"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descriere</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrie cât mai detaliat ce ai găsit sau ce idee ai..."
                    rows={6}
                    required
                    disabled={submitting}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Se trimite...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Trimite mesajul
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
