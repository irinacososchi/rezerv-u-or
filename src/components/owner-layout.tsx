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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const navItems = [
  { to: "/proprietar/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/proprietar/sali", icon: Building2, label: "Sălile mele" },
  { to: "/proprietar/calendar", icon: Calendar, label: "Calendar" },
  { to: "/proprietar/cereri", icon: HandMetal, label: "Cereri" },
  { to: "/proprietar/vouchere", icon: Ticket, label: "Vouchere" },
  { to: "/proprietar/cont", icon: Settings, label: "Cont" },
] as const;

const SIDEBAR_STORAGE_KEY = "owner-sidebar-collapsed";

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ownerName, setOwnerName] = useState("");
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
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

        if (cancelled) return;
        if (!profile || !["owner", "admin"].includes(profile.role)) {
          navigate({ to: "/" });
          return;
        }
        setOwnerName(profile.full_name ?? "Proprietar");
      } catch (err) {
        console.error("Auth check failed:", err);
        if (!cancelled) navigate({ to: "/login" });
      } finally {
        if (!cancelled) setChecking(false);
      }
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

  const sidebarWidth = collapsed ? "md:w-16" : "md:w-64";
  const contentMargin = collapsed ? "md:ml-16" : "md:ml-64";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside
        className={`hidden md:flex ${sidebarWidth} md:flex-col md:fixed md:inset-y-0 border-r bg-card transition-[width] duration-200`}
      >
        <div
          className={`border-b flex items-center ${
            collapsed ? "justify-center px-2 py-4" : "justify-between px-4 py-5 gap-2"
          }`}
        >
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-base font-semibold truncate">Rezervări Săli</p>
              <p className="text-sm text-muted-foreground truncate">{ownerName}</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            title={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <a
                key={item.to}
                href={item.to}
                title={collapsed ? item.label : undefined}
                className={
                  "flex items-center gap-3 rounded-md text-sm transition-colors " +
                  (collapsed ? "justify-center px-2 py-2 " : "px-3 py-2 ") +
                  (active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted")
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </a>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t">
          <button
            onClick={handleLogout}
            title={collapsed ? "Deconectare" : undefined}
            className={
              "w-full flex items-center gap-3 rounded-md text-sm text-foreground hover:bg-muted transition-colors " +
              (collapsed ? "justify-center px-2 py-2" : "px-3 py-2")
            }
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Deconectare</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 ${contentMargin} flex flex-col min-h-screen transition-[margin] duration-200`}>
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
