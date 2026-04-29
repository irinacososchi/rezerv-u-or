import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/external-client";
import {
  LayoutDashboard,
  Building2,
  Calendar,
  HandMetal,
  Ticket,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { to: "/proprietar/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/proprietar/sali", icon: Building2, label: "Sălile mele" },
  { to: "/proprietar/calendar", icon: Calendar, label: "Calendar" },
  { to: "/proprietar/cereri", icon: HandMetal, label: "Cereri" },
  { to: "/proprietar/vouchere", icon: Ticket, label: "Vouchere" },
  { to: "/proprietar/cont", icon: Settings, label: "Cont" },
] as const;

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ownerName, setOwnerName] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("Auth user:", user);
      if (cancelled) return;
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();
      console.log("Profile:", profile);

      if (cancelled) return;
      if (!profile || !["owner", "admin"].includes(profile.role)) {
        navigate({ to: "/" });
        return;
      }
      setOwnerName(profile.full_name ?? "Proprietar");
      setChecking(false);
    }
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
        <div className="px-6 py-5 border-b">
          <p className="text-base font-semibold">Rezervări Săli</p>
          <p className="text-sm text-muted-foreground truncate">{ownerName}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <a
                key={item.to}
                href={item.to}
                className={
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors " +
                  (active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted")
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Deconectare
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-10">
          <p className="font-semibold">Rezervări Săli</p>
          <button
            onClick={handleLogout}
            aria-label="Deconectare"
            className="p-2 rounded-md hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t grid grid-cols-5 z-10">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <a
                key={item.to}
                href={item.to}
                className={
                  "flex flex-col items-center justify-center py-2 text-xs gap-1 " +
                  (active ? "text-primary" : "text-muted-foreground")
                }
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-[64px]">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
