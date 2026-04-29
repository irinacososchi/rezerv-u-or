import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/proprietar/sali")({
  component: () => <Outlet />,
});
