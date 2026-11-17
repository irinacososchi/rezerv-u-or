import { createFileRoute } from "@tanstack/react-router";
import { ClientList } from "@/components/clients/ClientList";

export const Route = createFileRoute("/panou/clienti-proprietar")({
  staticData: { sitemap: false },
  component: ClientiProprietarPage,
});

function ClientiProprietarPage() {
  return <ClientList context="owner" pageTitle="Clienții mei" />;
}
