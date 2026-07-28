import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "@tanstack/react-router";
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
  Users,
  CalendarDays,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import logoUrl from "@/assets/rzrv-logo-2.png.asset.json";
import { NotificationBell } from "@/components/notification-bell";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useUserRole } from "@/hooks/use-user-role";

type NavItem = { to: string; icon: LucideIcon; label: string };

const OWNER_ITEMS: NavItem[] = [
  { to: "/panou/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/panou/sali", icon: Building2, label: "Sălile mele" },
  { to: "/panou/calendar", icon: Calendar, label: "Calendar" },
  { to: "/panou/cereri", icon: HandMetal, label: "Cereri" },
  { to: "/panou/vouchere", icon: Ticket, label: "Vouchere" },
  { to: "/panou/clienti-proprietar", icon: Users, label: "Clienții mei" },
];

const RENTER_ITEMS: NavItem[] = [
  { to: "/panou/orarul-meu", icon: CalendarDays, label: "Orarul meu" },
  { to: "/panou/clienti-chirias", icon: Users, label: "Clienții mei" },
];

const COMMON_BOTTOM: NavItem[] = [
  { to: "/panou/cont", icon: Settings, label: "Cont" },
];

const SIDEBAR_STORAGE_KEY = "owner-sidebar-collapsed";
const GROUP_OWNER_KEY = "sidebar-group-owner-expanded";
const GROUP_RENTER_KEY = "sidebar-group-renter-expanded";

function readBool(key: string, def: boolean): boolean {
  if (typeof window === "undefined") return def;
  const v = window.localStorage.getItem(key);
  if (v === null) return def;
  return v === "1";
}

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ownerName, setOwnerName] = useState("");
  const [checking, setChecking] = useState(true);
  const { isOwner, isRenter, isAdmin, loading: roleLoading } = useUserRole();
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readBool(SIDEBAR_STORAGE_KEY, false),
  );
  const [ownerOpen, setOwnerOpen] = useState<boolean>(() =>
    readBool(GROUP_OWNER_KEY, true),
  );
  const [renterOpen, setRenterOpen] = useState<boolean>(() =>
    readBool(GROUP_RENTER_KEY, true),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GROUP_OWNER_KEY, ownerOpen ? "1" : "0");
  }, [ownerOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GROUP_RENTER_KEY, renterOpen ? "1" : "0");
  }, [renterOpen]);

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
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (cancelled) return;
        setOwnerName(profile?.full_name ?? "Proprietar");
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

  const isActive = (to: string) => {
    if (to === "/panou/calendar") {
      return location.pathname.includes("/calendar");
    }
    if (to === "/panou/sali") {
      return (
        location.pathname === to ||
        (location.pathname.startsWith(to + "/") && !location.pathname.includes("/calendar"))
      );
    }
    return location.pathname === to || location.pathname.startsWith(to + "/");
  };

  // Decide structure based on roles
  const showBoth = isOwner && isRenter;
  const showOwnerOnly = (isOwner && !isRenter) || (isAdmin && !isOwner && !isRenter);
  const showRenterOnly = !isOwner && isRenter;
  const showNothing = !isOwner && !isRenter && !isAdmin;

  // Flat sidebar list per case (used for desktop flat cases & mobile bottom nav)
  let flatItems: NavItem[];
  if (showBoth) {
    flatItems = [...OWNER_ITEMS, ...RENTER_ITEMS, ...COMMON_BOTTOM];
  } else if (showRenterOnly) {
    flatItems = [...RENTER_ITEMS, ...COMMON_BOTTOM];
  } else if (showOwnerOnly) {
    flatItems = [...OWNER_ITEMS, ...COMMON_BOTTOM];
  } else if (showNothing || roleLoading) {
    flatItems = [...COMMON_BOTTOM];
  } else {
    flatItems = [...COMMON_BOTTOM];
  }

  // Desktop navigation excludes the bottom-account item so it can be rendered
  // right above the logout button in the fixed bottom section.
  const desktopNavItems = flatItems.filter((item) => item.to !== "/panou/cont");

  // Mobile bottom nav selection (max 5)
  let mobileItems: NavItem[];
  if (showBoth) {
    mobileItems = [
      OWNER_ITEMS[0], // Dashboard
      OWNER_ITEMS[1], // Sălile mele
      OWNER_ITEMS[2], // Calendar
      OWNER_ITEMS[3], // Cereri
      RENTER_ITEMS[0], // Orarul meu
    ];
  } else if (showRenterOnly) {
    mobileItems = [...RENTER_ITEMS, ...COMMON_BOTTOM];
  } else {
    // owner only, admin, nothing/loading
    mobileItems = flatItems.slice(0, 5);
  }

  const sidebarWidth = collapsed ? "md:w-16" : "md:w-64";
  const contentMargin = collapsed ? "md:ml-16" : "md:ml-64";

  const renderItem = (item: NavItem) => {
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
  };

  const renderGroup = (
    label: string,
    items: NavItem[],
    open: boolean,
    setOpen: (v: boolean) => void,
  ) => {
    if (collapsed) {
      // When sidebar is icon-only, drop group titles and just render items
      return <div className="space-y-1">{items.map(renderItem)}</div>;
    }
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full flex items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          {label}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pt-1">
          {items.map(renderItem)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

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
            <div className="min-w-0 flex items-center gap-2">
              <Link to="/" className="shrink-0">
                <img src={logoUrl.url} alt="RZRV" className="h-12 w-auto object-contain shrink-0" />
              </Link>
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
          {showBoth ? (
            <>
              <div className="pt-2">
                {renderGroup("PROPRIETAR", OWNER_ITEMS, ownerOpen, setOwnerOpen)}
              </div>
              <div className="pt-2">
                {renderGroup("CHIRIAȘ", RENTER_ITEMS, renterOpen, setRenterOpen)}
              </div>
            </>
          ) : (
            desktopNavItems.map(renderItem)
          )}
        </nav>
        <div className="px-3 py-4 border-t space-y-1">
          {COMMON_BOTTOM.map(renderItem)}
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
        {/* Desktop top bar */}
        <div className="hidden md:flex h-12 items-center justify-end px-6 border-b bg-card/60 sticky top-0 z-10">
          <NotificationBell />
        </div>

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-10">
          <Link to="/">
            <img src={logoUrl.url} alt="RZRV" className="h-12 w-auto object-contain shrink-0" />
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={handleLogout}
              aria-label="Deconectare"
              className="p-2 rounded-md hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 md:pb-0 min-w-0 overflow-x-hidden">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t grid z-10"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
        >
          {mobileItems.map((item) => {
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
