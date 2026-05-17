import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cont/rezervari")({
  beforeLoad: () => {
    throw redirect({ to: "/rezervari", replace: true });
  },
});
