"use client";

import { Check } from "lucide-react";
import { useGymBadges, XP_PER_LEVEL, type BadgeState } from "@/lib/badges";

function BadgeGlyph({ badge }: { badge: BadgeState }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-12 w-12"
      aria-hidden
      style={badge.unlocked ? { filter: `drop-shadow(0 0 6px ${badge.color})` } : undefined}
    >
      <path
        d={badge.path}
        fillRule="evenodd"
        fill={badge.unlocked ? badge.color : "#374151"}
        stroke={badge.unlocked ? "#fef3c7" : "#1f2937"}
        strokeWidth="1"
        strokeLinejoin="round"
        opacity={badge.unlocked ? 1 : 0.7}
      />
    </svg>
  );
}

// Eight Kanto badges that unlock by themselves from what is on the workspace, plus the XP they feed.
export default function GymBadgeCase() {
  const state = useGymBadges();

  if (!state) return <div className="h-56 rounded-xl border border-neutral-200" aria-hidden />;

  const { badges, unlockedCount, level, xp, xpIntoLevel } = state;

  return (
    <section aria-labelledby="gym-case" className="rounded-xl border border-neutral-700 bg-linear-to-br from-neutral-900 to-neutral-800 p-5 text-neutral-100 shadow-md">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="gym-case" className="text-sm font-semibold">
          Gym Badge Case
        </h2>
        <span className="text-xs text-neutral-300">
          {unlockedCount}/{badges.length} badges · {xp} XP
        </span>
      </div>

      <div className="mt-3">
        <p className="text-sm font-medium">
          Level {level} · {xpIntoLevel} / {XP_PER_LEVEL} XP to next rank
        </p>
        <div
          role="progressbar"
          aria-label="Progress to the next level"
          aria-valuemin={0}
          aria-valuemax={XP_PER_LEVEL}
          aria-valuenow={xpIntoLevel}
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-700"
        >
          <div className="h-full rounded-full bg-linear-to-r from-red-500 to-amber-400" style={{ width: `${(xpIntoLevel / XP_PER_LEVEL) * 100}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">10 XP per open task · 50 XP per completed task · 100 XP per badge</p>
      </div>

      <ul className="mt-5 grid grid-cols-4 gap-x-2 gap-y-5">
        {badges.map((b) => (
          <li key={b.id} tabIndex={0} aria-label={`${b.name}, ${b.unlocked ? "unlocked" : "locked"}: ${b.description}`} className="group relative flex flex-col items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
            <span className="relative">
              <BadgeGlyph badge={b} />
              {b.unlocked && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-neutral-900 ring-2 ring-neutral-900">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
              )}
            </span>
            <span className={`text-center text-[10px] leading-tight ${b.unlocked ? "font-medium text-neutral-100" : "text-neutral-500"}`}>{b.name.replace(" Badge", "")}</span>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-44 -translate-x-1/2 rounded-md bg-black px-2 py-1.5 text-center text-[11px] leading-snug text-white shadow-lg group-hover:block group-focus-visible:block"
            >
              <strong>{b.name}</strong> · {b.gym}
              <br />
              {b.unlocked ? b.description : `To unlock: ${b.description}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
