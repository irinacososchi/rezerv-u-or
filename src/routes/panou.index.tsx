import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/panou/")({
  component: () => <Navigate to="/panou/dashboard" />,
});
