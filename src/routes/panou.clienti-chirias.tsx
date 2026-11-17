import { createFileRoute } from "@tanstack/react-router";
import { ClientList } from "@/components/clients/ClientList";

export const Route = createFileRoute("/panou/clienti-chirias")({
  staticData: { sitemap: false },
  component: ClientiChiriasPage,
});

function ClientiChiriasPage() {
  return <ClientList context="renter" pageTitle="Clienții mei" />;
}
