import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/proprietar/")({
  component: () => <Navigate to="/proprietar/dashboard" />,
});
