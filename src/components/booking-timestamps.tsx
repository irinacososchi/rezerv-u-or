import { formatRelativeRo, formatAbsoluteRo } from "@/lib/format-time";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  createdAt?: string | null;
  updatedAt?: string | null;
  className?: string;
}

export function BookingTimestamps({ createdAt, updatedAt, className }: Props) {
  if (!createdAt) return null;
  const wasModified =
    !!updatedAt &&
    new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`text-xs text-muted-foreground ${className ?? ""}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">
              Rezervat: {formatRelativeRo(createdAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent>{formatAbsoluteRo(createdAt)}</TooltipContent>
        </Tooltip>
        {wasModified && (
          <>
            <span> · </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  Modificat: {formatRelativeRo(updatedAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{formatAbsoluteRo(updatedAt)}</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
