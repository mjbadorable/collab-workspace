import { initials } from "@/lib/mock-data";

export default function Avatar({ url, name, className = "h-8 w-8" }: { url: string | null; name: string; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- a small data URL; next/image adds nothing here
    return <img src={url} alt={name} className={`${className} shrink-0 rounded-full border border-neutral-200 object-cover`} />;
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700`}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}
