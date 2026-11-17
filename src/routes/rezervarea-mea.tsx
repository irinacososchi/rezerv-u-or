import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rezervarea-mea")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/rezervari", search: { bookingId: "" }, replace: true });
  },
});
