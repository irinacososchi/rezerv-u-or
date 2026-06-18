import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/panou/sali")({
  component: () => <Outlet />,
});
