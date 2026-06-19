import rzrvLogo from "@/assets/rzrv-logo.png";

export function LinkedBadge() {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-background ring-1 ring-border align-middle"
      title="Cont RZRV"
      aria-label="Cont RZRV"
    >
      <img src={rzrvLogo} alt="" className="h-3.5 w-3.5 object-contain" />
    </span>
  );
}
