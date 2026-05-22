import { useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useNotifications,
  type Notification,
} from "@/hooks/use-notifications";
import { formatRelativeRo } from "@/lib/format-time";
import { cn } from "@/lib/utils";

const ACTIVE = "#009f89";
const BG_SOFT = "#e8faf5";

function deepLinkFor(
  n: Notification,
): { path: string; search: Record<string, string> } | null {
  if (!n.booking_id) return null;
  switch (n.type) {
    // Owner-facing -> owner requests list
    case "booking_cancelled_by_renter":
    case "booking_request_new":
    case "booking_instant_new":
      return {
        path: "/proprietar/cereri",
        search: { bookingId: n.booking_id },
      };
    // Renter-facing -> renter bookings list
    case "booking_confirmed":
    case "booking_refused":
    case "booking_cancelled_by_owner":
    case "booking_rescheduled":
      return {
        path: "/rezervari",
        search: { bookingId: n.booking_id },
      };
    default:
      return null;
  }
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } =
    useNotifications();

  const hasUnread = unreadCount > 0;

  async function handleClick(n: Notification) {
    if (!n.is_read) void markAsRead(n.id);
    setOpen(false);
    const link = deepLinkFor(n);
    if (link) {
      navigate({ to: link.path, search: link.search } as never);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificări"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-90"
          style={{ backgroundColor: hasUnread ? BG_SOFT : "transparent" }}
        >
          <Bell
            className="h-5 w-5"
            style={{
              color: hasUnread ? ACTIVE : "hsl(var(--muted-foreground))",
            }}
            strokeWidth={hasUnread ? 2.25 : 2}
          />
          {hasUnread && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
              aria-label={`${unreadCount} notificări necitite`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Notificări</div>
          {hasUnread && (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="text-xs text-primary hover:underline"
            >
              Marchează toate ca citite
            </button>
          )}
        </div>

        <div className="max-h-[24rem] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Se încarcă…
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nu ai notificări.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void handleClick(n)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition hover:bg-muted/40",
                      !n.is_read && "border-l-2",
                    )}
                    style={
                      !n.is_read
                        ? { borderLeftColor: ACTIVE, backgroundColor: "#f0fbf8" }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold leading-tight">
                        {n.title}
                      </div>
                      {!n.is_read && (
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: ACTIVE }}
                          aria-hidden
                        />
                      )}
                    </div>
                    {n.body && (
                      <div className="mt-1 text-xs text-muted-foreground leading-snug">
                        {n.body}
                      </div>
                    )}
                    <div className="mt-1.5 text-[11px] text-muted-foreground/80">
                      {formatRelativeRo(n.created_at)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
