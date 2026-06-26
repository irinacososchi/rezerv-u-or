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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/external-client";
import { formatDateRO, parseISODate, formatDateISO, addDays } from "@/lib/date-utils";

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

type CancelMode = "single" | "future" | "suspend";

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
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [mode, setMode] = useState<CancelMode>("single");
  const [untilDate, setUntilDate] = useState<string>("");
  const [busy, setBusy] = useState(false);

  if (!booking) return null;

  const todayISO = new Date().toISOString().split("T")[0];
  const cancellable =
    (booking.status === "confirmată" || booking.status === "în așteptare") &&
    booking.booking_date >= todayISO;

  const durationMinutes =
    booking.duration_minutes ?? Math.round((booking.duration_hours ?? 0) * 60);

  const isRecurring = !!booking.recurrence_id;
  const minUntilDate = formatDateISO(addDays(new Date(), 1));

  async function cancelSingle() {
    if (!booking) return false;
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: booking.id,
      p_guest_email: userEmail || booking.guest_email,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Rezervarea a fost anulată.");
    return true;
  }

  async function handleSimpleCancel() {
    setBusy(true);
    const ok = await cancelSingle();
    setBusy(false);
    if (ok) {
      setConfirmOpen(false);
      onCancelled();
      onClose();
    }
  }

  function handleAnulareClick() {
    if (isRecurring) {
      setMode("single");
      setUntilDate("");
      setRecurringOpen(true);
    } else {
      setConfirmOpen(true);
    }
  }

  async function executeRecurringChoice() {
    if (!booking) return;
    setBusy(true);
    let ok = false;
    let successMsg = "";
    if (mode === "single") {
      ok = await cancelSingle();
    } else if (mode === "future") {
      const { data, error } = await supabase.rpc("cancel_booking_and_future", {
        p_booking_id: booking.id,
        p_owner_override: false,
      });
      if (error) {
        toast.error(error.message);
      } else {
        ok = true;
        successMsg = typeof data === "string" ? data : "Sesiunile viitoare au fost anulate.";
      }
    } else if (mode === "suspend") {
      const { data, error } = await supabase.rpc("suspend_recurrence_until", {
        p_recurrence_id: booking.recurrence_id!,
        p_until_date: untilDate,
        p_owner_override: false,
      });
      if (error) {
        toast.error(error.message);
      } else {
        ok = true;
        successMsg = typeof data === "string" ? data : "Seria a fost suspendată.";
      }
    }
    setBusy(false);
    if (ok) {
      if (successMsg) toast.success(successMsg);
      setRecurringOpen(false);
      onCancelled();
      onClose();
    }
  }

  function handleConfirmRecurring() {
    executeRecurringChoice();
  }

  const confirmDisabled = busy || (mode === "suspend" && !untilDate);

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
                onClick={handleAnulareClick}
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
                handleSimpleCancel();
              }}
              disabled={busy}
            >
              {busy ? "Se anulează..." : "Da, anulează"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={recurringOpen} onOpenChange={(o) => !busy && setRecurringOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cum vrei să anulezi?</DialogTitle>
            <DialogDescription>
              Această rezervare face parte dintr-o serie recurentă.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as CancelMode)}
            className="gap-3"
          >
            <label className="flex gap-3 items-start cursor-pointer rounded-md border p-3 hover:bg-muted/40">
              <RadioGroupItem value="single" id="cm-single" className="mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Doar această sesiune</div>
                <div className="text-xs text-muted-foreground">
                  Anulezi doar rezervarea din această zi. Restul seriei rămâne.
                </div>
              </div>
            </label>
            <label className="flex gap-3 items-start cursor-pointer rounded-md border p-3 hover:bg-muted/40">
              <RadioGroupItem value="future" id="cm-future" className="mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Această sesiune și toate viitoarele</div>
                <div className="text-xs text-muted-foreground">
                  Anulezi de azi înainte. Sesiunile trecute rămân.
                </div>
              </div>
            </label>
            <label className="flex gap-3 items-start cursor-pointer rounded-md border p-3 hover:bg-muted/40">
              <RadioGroupItem value="suspend" id="cm-suspend" className="mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="text-sm font-medium">Suspendă temporar (vacanță)</div>
                <div className="text-xs text-muted-foreground">
                  Anulezi sesiunile până la o dată, apoi seria continuă automat.
                </div>
                {mode === "suspend" && (
                  <div className="pt-2 space-y-1">
                    <Label className="text-xs">Seria se reia de la data:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !untilDate && "text-muted-foreground",
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {untilDate ? format(parseISODate(untilDate), "dd.MM.yyyy") : "Alege o dată"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
                        <Calendar
                          mode="single"
                          selected={untilDate ? parseISODate(untilDate) : undefined}
                          onSelect={(d) => d && setUntilDate(format(d, "yyyy-MM-dd"))}
                          disabled={(d) => booking ? d < parseISODate(booking.booking_date) : false}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </label>
          </RadioGroup>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setRecurringOpen(false)}
              disabled={busy}
            >
              Înapoi
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRecurring}
              disabled={confirmDisabled}
            >
              {busy ? "Se procesează..." : "Confirmă anularea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
