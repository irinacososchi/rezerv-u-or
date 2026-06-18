import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/panou")({
  component: () => <Outlet />,
});
