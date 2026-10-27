import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type Crumb = { label: string; href?: string };

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
  breadcrumbs?: Crumb[];
  backHref?: string;
  backLabel?: string;
};

export default function PlaceholderView({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  backHref = "/",
  backLabel = "Back to Home",
}: Props) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-neutral-900">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-neutral-900">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <h1 className="text-xl font-semibold">{title}</h1>

      <div className="mt-6 flex flex-col items-center rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
        <Icon className="h-8 w-8 text-neutral-400" aria-hidden />
        <h2 className="mt-3 text-base font-medium">Feature coming soon in next milestone</h2>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
        <Link
          href={backHref}
          className="mt-5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
