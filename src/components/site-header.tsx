import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/external-client";
import logoUrl from "@/assets/rzrv-logo.png";

export function SiteHeader() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ full_name: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(u: any) {
      if (!u) {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) setUser(u);
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email, role")
        .eq("id", u.id)
        .single();
      if (cancelled) return;
      setProfile(
        p
          ? {
              full_name: p.full_name ?? "",
              email: p.email ?? u.email ?? "",
              role: p.role ?? "",
            }
          : { full_name: "", email: u.email ?? "", role: "" },
      );
      setLoading(false);
    }

    // Set up listener FIRST (catches SIGNED_OUT, TOKEN_REFRESHED, INITIAL_SESSION)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user ?? null);
    });

    // THEN read existing session — getSession never throws on missing/invalid token
    supabase.auth.getSession().then(({ data }) => {
      loadProfile(data.session?.user ?? null);
    }).catch(() => {
      if (!cancelled) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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

          {(profile?.role === "owner" || profile?.role === "admin") && (
            <a
              href="/proprietar/dashboard"
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
                  <div className="border-b border-border px-4 py-3">
                    <div className="font-medium text-sm">{profile?.full_name || "Fără nume"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                  </div>

                  <div className="px-4 py-3 border-b border-border">
                    <EditNameSection
                      currentName={profile?.full_name ?? ""}
                      onSave={async (newName) => {
                        await supabase
                          .from("profiles")
                          .update({ full_name: newName })
                          .eq("id", user.id);
                        setProfile((p) => (p ? { ...p, full_name: newName } : p));
                      }}
                    />
                  </div>

                  <div className="px-4 py-3 border-b border-border">
                    <ChangePasswordSection userId={user.id} />
                  </div>

                  {(profile?.role === "owner" || profile?.role === "admin") && (
                    <div className="px-4 py-2">
                      <a
                        href="/proprietar/dashboard"
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-primary transition"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Panoul meu
                      </a>
                    </div>
                  )}

                  <div className="border-t border-border px-4 py-2">
                    <button
                      onClick={async () => {
                        setDropdownOpen(false);
                        try {
                          await supabase.auth.signOut();
                        } catch {
                          // ignore — we'll force-clear below
                        }
                        if (typeof window !== "undefined") {
                          // Purge any orphaned auth tokens from both storages
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

function EditNameSection({
  currentName,
  onSave,
}: {
  currentName: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-2">Numele meu</div>
      {!editing ? (
        <div className="flex items-center justify-between">
          <span className="text-sm">{currentName || "Fără nume"}</span>
          <button
            onClick={() => {
              setName(currentName);
              setEditing(true);
            }}
            className="text-xs text-primary hover:underline"
          >
            Modifică
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            autoFocus
            maxLength={100}
          />
          <button
            onClick={async () => {
              if (!name.trim()) return;
              setSaving(true);
              await onSave(name.trim());
              setSaving(false);
              setEditing(false);
            }}
            disabled={saving}
            className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
          >
            {saving ? "..." : "Salvează"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-md border border-border px-2 py-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function ChangePasswordSection({ userId: _userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleChange() {
    setError(null);
    if (password.length < 8) {
      setError("Minim 8 caractere.");
      return;
    }
    if (password !== confirm) {
      setError("Parolele nu coincid.");
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess(true);
    setPassword("");
    setConfirm("");
    setTimeout(() => {
      setSuccess(false);
      setOpen(false);
    }, 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Parolă</span>
        <button
          onClick={() => {
            setOpen(!open);
            setError(null);
          }}
          className="text-xs text-primary hover:underline"
        >
          {open ? "Anulează" : "Schimbă parola"}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parolă nouă (minim 8 caractere)"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmă parola"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-primary">Parolă schimbată cu succes!</p>}
          <button
            onClick={handleChange}
            disabled={saving}
            className="w-full rounded-md bg-primary py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition"
          >
            {saving ? "Se salvează..." : "Salvează parola nouă"}
          </button>
        </div>
      )}
    </div>
  );
}
