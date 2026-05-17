import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rezervarea-mea")({
  beforeLoad: () => {
    throw redirect({ to: "/rezervari", replace: true });
  },
});
