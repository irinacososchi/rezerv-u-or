import { createFileRoute } from "@tanstack/react-router";
import { OwnerLayout } from "@/components/owner-layout";

export const Route = createFileRoute("/proprietar/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <OwnerLayout>
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Bun venit! Conținutul urmează.</p>
      </div>
    </OwnerLayout>
  );
}
