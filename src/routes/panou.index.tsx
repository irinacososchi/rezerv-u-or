import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/panou/")({
  staticData: { sitemap: false },
  component: () => <Navigate to="/panou/dashboard" />,
});
