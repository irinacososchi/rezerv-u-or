import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, LogOut, Calendar, Heart, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { supabase } from "@/integrations/supabase/external-client";
import { useUserRole } from "@/hooks/use-user-role";
import logoUrl from "@/assets/rzrv-logo.png";

type Profile = { full_name: string | null; email: string | null };


export function SiteHeader() {
  const navigate = useNavigate();
  const { isOwner, isRenter, isAdmin, loading: roleLoading } = useUserRole();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasBookings, setHasBookings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function loadUserData() {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) {
      setUser(null);
      setProfile(null);
      setHasBookings(false);
      setLoading(false);
      return;
    }
    setUser(u);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", u.id)
      .single();
    setProfile((profileData as Profile) ?? { full_name: null, email: u.email ?? null });

    const { count: bookingsByRenterId } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("renter_id", u.id);

    let totalBookings = bookingsByRenterId ?? 0;

    const email = profileData?.email ?? u.email;
    if (email) {
      const { count: bookingsByEmail } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("guest_email", email);
      totalBookings += bookingsByEmail ?? 0;
    }

    setHasBookings(totalBookings > 0);
    setLoading(false);
  }

  useEffect(() => {
    loadUserData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUserData();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showPanoulMeu = !roleLoading && (isOwner || isRenter || isAdmin);


  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold shrink-0">
          <img
            src={logoUrl}
            alt="RZRV"
            className="h-16 sm:h-20 md:h-24 w-auto object-contain shrink-0"
          />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" asChild className="text-foreground/80">
            <Link to="/">Acasă</Link>
          </Button>
          <Button variant="ghost" asChild className="text-foreground/80">
            <Link to="/sali">Săli</Link>
          </Button>
          <Button variant="ghost" asChild className="text-foreground/80 hidden sm:inline-flex">
            <Link to="/rezervari">Rezervarea mea</Link>
          </Button>

          {showPanoulMeu && (
            <a
              href="/panou/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition"
            >
              <LayoutDashboard className="h-4 w-4" />
              Panoul meu
            </a>
          )}

          {!loading && !user && (
            <>
              <Button variant="outline" asChild className="hidden sm:inline-flex">
                <Link to="/login">Autentificare</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Creează cont</Link>
              </Button>
            </>
          )}

          {user && <NotificationBell />}

          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/40 transition"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {profile?.full_name?.charAt(0).toUpperCase() ?? user.email?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <span className="hidden sm:block max-w-[120px] truncate">
                  {profile?.full_name || user.email}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-background shadow-lg z-50">
                  {/* Header */}
                  <div className="border-b border-border px-4 py-3">
                    <div className="font-medium text-sm">{profile?.full_name || "Fără nume"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                  </div>

                  {/* Account links */}
                  <div className="px-2 py-2">
                    <Link
                      to="/cont"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-primary transition"
                    >
                      <Settings className="h-4 w-4" />
                      Contul meu
                    </Link>
                    {hasBookings && (
                      <Link
                        to="/rezervari"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-primary transition"
                      >
                        <Calendar className="h-4 w-4" />
                        Rezervările mele
                      </Link>
                    )}
                    <Link
                      to="/cont/favorite"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-primary transition"
                    >
                      <Heart className="h-4 w-4" />
                      Săli favorite
                    </Link>
                    {showPanoulMeu && (
                      <a
                        href="/panou/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-primary transition"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Panoul meu
                      </a>
                    )}
                  </div>

                  {/* List a room */}
                  <div className="border-t border-border px-2 py-2">
                    <a
                      href="/panou/sali/nou"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-primary transition"
                    >
                      <Plus className="h-4 w-4" />
                      {isOwner ? "Adaugă încă o sală" : "Listează o sală"}
                    </a>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-border px-2 py-2">
                    <button
                      onClick={async () => {
                        setDropdownOpen(false);
                        try {
                          await supabase.auth.signOut();
                        } catch {
                          // ignore — we'll force-clear below
                        }
                        if (typeof window !== "undefined") {
                          const purge = (s: Storage) => {
                            const keys: string[] = [];
                            for (let i = 0; i < s.length; i++) {
                              const k = s.key(i);
                              if (k && (k.startsWith("sb-") || k.includes("supabase.auth"))) keys.push(k);
                            }
                            keys.forEach((k) => s.removeItem(k));
                          };
                          purge(window.localStorage);
                          purge(window.sessionStorage);
                          window.location.replace("/");
                        } else {
                          setUser(null);
                          setProfile(null);
                          navigate({ to: "/" });
                        }
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition"
                    >
                      <LogOut className="h-4 w-4" />
                      Deconectare
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
