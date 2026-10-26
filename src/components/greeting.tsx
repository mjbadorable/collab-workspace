"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function timeOfDay(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// The server snapshot is a neutral "Hello" so server and first client render match;
// the time-based greeting swaps in after hydration.
export default function Greeting({ name }: { name: string }) {
  const salutation = useSyncExternalStore(subscribe, timeOfDay, () => "Hello");
  return (
    <h1 className="text-2xl font-semibold">
      {salutation}, {name}
    </h1>
  );
}
