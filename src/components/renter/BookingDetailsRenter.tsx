import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/external-client";
import { formatDateRO, parseISODate } from "@/lib/date-utils";

export type RenterBookingRow = {
  id: string;
  reference: string;
  room_name: string;
  room_slug?: string | null;
  room_address: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  duration_minutes?: number | null;
  total_amount: number;
  status: string;
  payment_status: string;
  guest_email: string;
  recurrence_id: string | null;
  is_recurring?: boolean | null;
};

type Props = {
  booking: RenterBookingRow | null;
  userEmail: string;
  onClose: () => void;
  onCancelled: () => void;
};

function formatDurationRO(minutes: number): string {
  if (minutes <= 0) return "0 minute";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minute`;
  const hourWord = hours === 1 ? "oră" : "ore";
  if (mins === 0) return `${hours} ${hourWord}`;
  return `${hours} ${hourWord} și ${mins} minute`;
}

function statusBadgeClass(status: string): string {
  if (status === "confirmată") return "bg-primary/10 text-primary";
  if (status === "în așteptare") return "bg-orange-500/10 text-orange-600";
  if (status === "finalizată") return "bg-muted text-muted-foreground";
  return "bg-destructive/10 text-destructive";
}

function paymentBadgeClass(payment: string): string {
  if (payment === "platit") return "bg-primary/10 text-primary";
  if (payment === "rambursat") return "bg-muted text-muted-foreground";
  return "bg-amber-500/10 text-amber-700";
}

export function BookingDetailsRenter({ booking, userEmail, onClose, onCancelled }: Props) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!booking) return null;

  const todayISO = new Date().toISOString().split("T")[0];
  const cancellable =
    (booking.status === "confirmată" || booking.status === "în așteptare") &&
    booking.booking_date >= todayISO;

  const durationMinutes =
    booking.duration_minutes ?? Math.round((booking.duration_hours ?? 0) * 60);

  async function handleCancel() {
    if (!booking) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: booking.id,
      p_guest_email: userEmail || booking.guest_email,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rezervarea a fost anulată.");
    setConfirmOpen(false);
    onCancelled();
    onClose();
  }

  return (
    <>
      <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{booking.room_name}</DialogTitle>
            {booking.room_address && (
              <DialogDescription>{booking.room_address}</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(booking.status)}`}>
                {booking.status}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentBadgeClass(booking.payment_status)}`}>
                {booking.payment_status}
              </span>
              {booking.is_recurring && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-500/10 text-sky-700">
                  Parte din serie
                </span>
              )}
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Data</dt>
              <dd className="font-medium capitalize">
                {formatDateRO(parseISODate(booking.booking_date))}
              </dd>
              <dt className="text-muted-foreground">Interval</dt>
              <dd className="font-medium">
                {booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)}
              </dd>
              <dt className="text-muted-foreground">Durată</dt>
              <dd className="font-medium">{formatDurationRO(durationMinutes)}</dd>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium">{booking.total_amount} RON</dd>
              <dt className="text-muted-foreground">Referință</dt>
              <dd className="font-mono text-xs">{booking.reference}</dd>
            </dl>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {booking.room_slug && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/sali/$slug" params={{ slug: booking.room_slug }}>
                    Vezi sala
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigate({ to: "/rezervari", search: { bookingId: booking.id } });
                  onClose();
                }}
              >
                Vezi rezervarea
              </Button>
            </div>
            {cancellable && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
              >
                Anulează
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulează rezervarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Sigur vrei să anulezi această rezervare? Această acțiune nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Înapoi</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={busy}
            >
              {busy ? "Se anulează..." : "Da, anulează"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
