import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/sali")({
  staticData: { sitemap: false },
  component: () => <Outlet />,
});
