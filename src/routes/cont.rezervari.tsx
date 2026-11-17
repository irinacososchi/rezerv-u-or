import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cont/rezervari")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/rezervari", search: { bookingId: "" }, replace: true });
  },
});
