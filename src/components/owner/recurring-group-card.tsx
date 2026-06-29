import { useState } from "react";
import { ChevronDown, ChevronUp, Check, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RecurringBadge } from "./recurring-badge";
import {
  getGroupStatusSummary,
  getGroupStatusLabel,
  type Booking,
} from "@/lib/group-recurring-bookings";
import { getDayOfWeek, DAY_NAMES_RO, parseISODate } from "@/lib/date-utils";


interface Props {
  groupId: string;
  bookings: Booking[];
  onApproveAll: (groupId: string) => Promise<void>;
  onRefuseAll: (groupId: string) => Promise<void>;
  onApproveSelected: (bookingIds: string[]) => Promise<void>;
  onRefuseSelected: (bookingIds: string[]) => Promise<void>;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}.${d.getFullYear()}`;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    "în așteptare": { label: "În așteptare", cls: "bg-amber-100 text-amber-800" },
    "confirmată": { label: "Aprobată", cls: "bg-emerald-100 text-emerald-800" },
    "refuzată": { label: "Refuzată", cls: "bg-red-100 text-red-700" },
    "anulată": { label: "Anulată", cls: "bg-gray-100 text-gray-600" },
  };
  const v = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${v.cls}`}>
      {v.label}
    </span>
  );
}

export function RecurringGroupCard({
  groupId,
  bookings,
  onApproveAll,
  onRefuseAll,
  onApproveSelected,
  onRefuseSelected,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const summary = getGroupStatusSummary(bookings);
  const statusLabel = getGroupStatusLabel(summary);
  const rep = bookings[0];

  const renterName = rep.guest_name || rep.renter_name || "—";
  const renterPhone = rep.guest_phone || rep.renter_phone || "";

  const firstDate = bookings[0].booking_date;
  const lastDate = bookings[bookings.length - 1].booking_date;
  const totalAmount = bookings.reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
  const currency = rep.room_currency ?? "RON";

  const pendingBookings = bookings.filter((b) => b.status === "în așteptare");
  const canApprove = pendingBookings.length > 0;

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAllPending() {
    setSelectedIds(new Set(pendingBookings.map((b) => b.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleApproveAll() {
    setProcessing(true);
    try {
      await onApproveAll(groupId);
    } finally {
      setProcessing(false);
    }
  }

  async function handleRefuseAll() {
    setProcessing(true);
    try {
      await onRefuseAll(groupId);
    } finally {
      setProcessing(false);
    }
  }

  async function handleApproveSelected() {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      await onApproveSelected(Array.from(selectedIds));
      clearSelection();
      setSelectionMode(false);
    } finally {
      setProcessing(false);
    }
  }

  async function handleRefuseSelected() {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      await onRefuseSelected(Array.from(selectedIds));
      clearSelection();
      setSelectionMode(false);
    } finally {
      setProcessing(false);
    }
  }

  const variantCls: Record<string, string> = {
    warning: "text-amber-700",
    success: "text-emerald-700",
    destructive: "text-red-700",
    muted: "text-gray-500",
    mixed: "text-muted-foreground",
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <RecurringBadge count={bookings.length} size="md" />
          <span className={`text-xs font-medium ${variantCls[statusLabel.variant]}`}>
            {statusLabel.label}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? "Ascunde" : "Detalii"}
        </button>
      </div>

      <div className="space-y-1 mb-3">
        <div className="font-medium">{rep.room_name ?? "Sală"}</div>
        <div className="text-sm text-muted-foreground">
          {formatDateShort(firstDate)} → {formatDateShort(lastDate)} ·{" "}
          {rep.start_time.slice(0, 5)}–{rep.end_time.slice(0, 5)}
        </div>
        <div className="text-sm">
          Chiriaș: <span className="font-medium">{renterName}</span>
          {renterPhone && (
            <span className="text-muted-foreground"> · {renterPhone}</span>
          )}
        </div>
        <div className="text-sm">
          Total:{" "}
          <span className="font-medium">
            {totalAmount.toFixed(2)} {currency}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-blue-200 pt-3 mb-3 space-y-2">
          {selectionMode && (
            <div className="flex gap-2 text-xs">
              <button
                onClick={selectAllPending}
                className="text-primary hover:underline"
              >
                Selectează toate în așteptare ({pendingBookings.length})
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                onClick={clearSelection}
                className="text-muted-foreground hover:underline"
              >
                Deselectează tot
              </button>
            </div>
          )}
          <div className="space-y-1">
            {bookings.map((b) => {
              const isSelected = selectedIds.has(b.id);
              const selectable = selectionMode && b.status === "în așteptare";
              return (
                <div
                  key={b.id}
                  onClick={() => selectable && toggleSelection(b.id)}
                  className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                    selectable ? "cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="accent-primary"
                      />
                    )}
                    <span className="font-medium">{formatDateShort(b.booking_date)}</span>
                    <span className="text-muted-foreground">
                      {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs">
                      {Number(b.total_amount ?? 0).toFixed(0)} {currency}
                    </span>
                    {statusBadge(b.status)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!selectionMode ? (
          <>
            {canApprove && (
              <button
                onClick={handleApproveAll}
                disabled={processing}
                className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Aprobă tot ({pendingBookings.length})
              </button>
            )}
            {canApprove && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={processing}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Refuză tot
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sigur vrei să refuzi seria?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Vei refuza {pendingBookings.length} rezervări în așteptare ale
                      chiriașului {renterName}. Cele deja procesate (aprobate, anulate)
                      rămân neschimbate.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anulează</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRefuseAll}>
                      Da, refuză {pendingBookings.length} rezervări
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canApprove && (
              <button
                onClick={() => {
                  setSelectionMode(true);
                  setExpanded(true);
                }}
                disabled={processing}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
              >
                Modifică selecția
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={handleApproveSelected}
              disabled={processing || selectedIds.size === 0}
              className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Aprobă selecția ({selectedIds.size})
            </button>
            <button
              onClick={handleRefuseSelected}
              disabled={processing || selectedIds.size === 0}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Refuză selecția ({selectedIds.size})
            </button>
            <button
              onClick={() => {
                setSelectionMode(false);
                clearSelection();
              }}
              disabled={processing}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
            >
              Anulează
            </button>
          </>
        )}
      </div>
    </div>
  );
}
