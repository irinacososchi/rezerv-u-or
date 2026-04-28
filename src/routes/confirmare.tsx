import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

const confirmSearchSchema = z.object({
  reference: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/confirmare")({
  validateSearch: zodValidator(confirmSearchSchema),
  head: () => ({
    meta: [
      { title: "Rezervare confirmată — Rezervări Săli" },
      { name: "description", content: "Rezervarea ta a fost înregistrată cu succes." },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { reference } = Route.useSearch();

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            Rezervarea ta a fost înregistrată!
          </h1>
          <p className="mt-3 text-muted-foreground">
            Vei primi un email de confirmare cu toate detaliile rezervării.
          </p>
          {reference && (
            <div className="mt-6 inline-block rounded-lg border border-border bg-background px-5 py-3 text-sm">
              <span className="text-muted-foreground">Referință: </span>
              <span className="font-mono font-semibold">{reference}</span>
            </div>
          )}
          <div className="mt-8">
            <Link to="/sali">
              <Button size="lg" className="cursor-pointer">Înapoi la săli</Button>
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
