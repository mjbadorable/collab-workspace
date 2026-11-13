import { useId } from "react";

// Brand mark: an interlocking hexagon: burgundy frame, white C-ribbon and an amber ribbon on the lower-right edge.
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
          <stop offset="0" stopColor="#7F1D1D" />
          <stop offset="1" stopColor="#430A13" />
        </linearGradient>
      </defs>
      {/* Outer frame. The faint light edge keeps it visible on dark surfaces. */}
      <polygon points="24,2 43,13 43,35 24,46 5,35 5,13" fill={`url(#${gradientId})`} stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.2" strokeLinejoin="round" />
      {/* White C-ribbon: top-right, over the top, down the left, curling into the centre. */}
      <path d="M26 24 Q33.5 23 35.7 17.25 L24 10.5 L12.3 17.25 L12.3 30.75 L24 37.5" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Amber ribbon completing the lower-right edge; the dark halo underneath makes it read as interlocking with the C. */}
      <path d="M24 37.5 L35.7 30.75 L35.7 21.5" fill="none" stroke="#5C0F1B" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 37.5 L35.7 30.75 L35.7 21.5" fill="none" stroke="#F59E0B" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
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
