import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/cont")({
  staticData: { sitemap: "exclude-subtree" },
  component: () => <Outlet />,
});
