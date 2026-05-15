import { RotateCw } from "lucide-react";

interface Props {
  /** Numărul de rezervări din serie (opțional). */
  count?: number;
  size?: "sm" | "md";
}

export function RecurringBadge({ count, size = "sm" }: Props) {
  const sizeClasses =
    size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 font-medium ${sizeClasses}`}
      title={
        count
          ? `Parte din serie recurentă de ${count} rezervări`
          : "Rezervare recurentă"
      }
    >
      <RotateCw className="h-3 w-3" />
      {count ? `Recurență · ${count}` : "Recurență"}
    </span>
  );
}
