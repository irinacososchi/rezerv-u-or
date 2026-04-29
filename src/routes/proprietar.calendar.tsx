import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OwnerLayout } from "@/components/owner-layout";
import { supabase } from "@/integrations/supabase/external-client";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/proprietar/calendar")({
  component: CalendarRedirectPage,
});

function CalendarRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/auth/login" as never });
        return;
      }
      const { data } = await supabase
        .from("rooms")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data?.id) {
        navigate({
          to: "/proprietar/sali/$id/calendar",
          params: { id: data.id },
          replace: true,
        });
      }
    })();
  }, [navigate]);

  return (
    <OwnerLayout>
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <CalendarIcon className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-muted-foreground max-w-md">
          Nu ai încă nicio sală adăugată. Creează prima sală pentru a putea gestiona calendarul.
        </p>
        <Button asChild>
          <Link to="/proprietar/sali/nou">
            <Plus className="mr-2 h-4 w-4" />
            Adaugă o sală
          </Link>
        </Button>
      </div>
    </OwnerLayout>
  );
}
