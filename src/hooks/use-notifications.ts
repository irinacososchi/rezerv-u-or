import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/external-client";
import { useAuth } from "@/hooks/use-auth";

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  booking_id: string | null;
  room_id: string | null;
  is_read: boolean;
  created_at: string;
};

const POLL_MS = 120_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);
  const { userId: authUserId, loading: authLoading } = useAuth();

  const fetchAll = useCallback(async () => {
    if (authLoading) return;
    if (!authUserId) {
      userIdRef.current = null;
      setNotifications([]);
      setLoading(false);
      return;
    }
    userIdRef.current = authUserId;
    const { data, error } = await supabase
      .from("app_notifications")
      .select("*")
      .eq("user_id", authUserId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setNotifications(data as unknown as Notification[]);
    setLoading(false);
  }, [authUserId, authLoading]);

  useEffect(() => {
    let cancelled = false;
    void fetchAll();

    const onFocus = () => {
      if (!cancelled) void fetchAll();
    };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      if (!cancelled) void fetchAll();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [fetchAll]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    await supabase.from("app_notifications").update({ is_read: true }).eq("id", id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from("app_notifications")
      .update({ is_read: true })
      .eq("user_id", uid)
      .eq("is_read", false);
  }, []);

  const unreadCount = notifications.reduce(
    (acc, n) => acc + (n.is_read ? 0 : 1),
    0,
  );

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchAll,
  };
}
