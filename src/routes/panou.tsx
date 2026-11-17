import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/panou")({
  staticData: { sitemap: "exclude-subtree" },
  component: () => <Outlet />,
});
