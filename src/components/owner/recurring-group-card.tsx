import { useState } from "react";
import { Check, X } from "lucide-react";
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

export function RecurringGroupCard({
  groupId,
  bookings,
  onApproveAll,
  onRefuseAll,
  onApproveSelected,
  onRefuseSelected,
}: Props) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const summary = getGroupStatusSummary(bookings);
  const statusLabel = getGroupStatusLabel(summary);
  const rep = bookings[0];

  const renterName = rep.guest_name || rep.renter_name || "—";
  const renterPhone = rep.guest_phone || rep.renter_phone || "";

  const firstDate = bookings[0].booking_date;
  const currency = rep.room_currency ?? "RON";

  const monthMap = new Map<string, number>();
  for (const b of bookings) {
    const d = parseISODate(b.booking_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(b.total_amount ?? 0));
  }

  const startDate = parseISODate(firstDate);
  const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
  const sortedKeys = Array.from(monthMap.keys()).sort();
  const firstFullMonthKey = sortedKeys.find((k) => k > startMonthKey);
  const monthlyPrice = firstFullMonthKey
    ? (monthMap.get(firstFullMonthKey) ?? 0)
    : (monthMap.get(startMonthKey) ?? 0);

  const weekday = DAY_NAMES_RO[getDayOfWeek(parseISODate(firstDate))];
  const timeRange = `${rep.start_time.slice(0, 5)}–${rep.end_time.slice(0, 5)}`;

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
          <RecurringBadge size="md" />
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
          În fiecare {weekday}, {timeRange}
        </div>
        <div className="text-sm">
          Chiriaș: <span className="font-medium">{renterName}</span>
          {renterPhone && (
            <span className="text-muted-foreground"> · {renterPhone}</span>
          )}
        </div>
        <div className="text-sm">
          Preț lunar:{" "}
          <span className="font-medium">
            {monthlyPrice.toFixed(2)} {currency}
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
                Aprobă seria
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
                    Refuză seria
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sigur vrei să refuzi seria?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Vei refuza această serie recurentă. Cele deja procesate rămân neschimbate.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anulează</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRefuseAll}>
                      Da, refuză seria
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
                Gestionează serie
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
