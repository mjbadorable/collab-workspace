import { useId } from "react";

// Brand mark: a burgundy hexagon, a bold white "C" and an amber accent in the lower-right corner.
// `full` adds the wordmark. `onDark` is for the burgundy sidebar / dark panels (white wordmark text).
export default function CollabLogo({
  variant = "mark",
  onDark = false,
  className = "h-8 w-8",
}: {
  variant?: "mark" | "full";
  onDark?: boolean;
  // Sizes the hexagon mark only.
  className?: string;
}) {
  const gradientId = useId();
  const mark = (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} aria-hidden={variant === "full" ? true : undefined} role={variant === "full" ? undefined : "img"} aria-label={variant === "full" ? undefined : "Collab Workspace"}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6E1220" />
          <stop offset="1" stopColor="#5C0F1B" />
        </linearGradient>
      </defs>
      {/* The faint light edge keeps the burgundy mark visible on the burgundy sidebar. */}
      <polygon points="24,2 43,13 43,35 24,46 5,35 5,13" fill={`url(#${gradientId})`} stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M31 17 A10 10 0 1 0 31 31" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <polygon points="30,38 38,33.5 38,36.5 30,41" fill="#F59E0B" />
    </svg>
  );
  if (variant === "mark") return mark;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {mark}
      <span className="min-w-0 leading-tight">
        <span className={`block truncate text-sm font-semibold ${onDark ? "text-white" : "text-neutral-900"}`}>Collab Workspace</span>
        <span className={`block truncate text-[10px] font-medium tracking-[0.14em] ${onDark ? "text-amber-300" : "text-amber-600"}`}>BUILD • MANAGE • DEPLOY</span>
      </span>
    </span>
  );
}
