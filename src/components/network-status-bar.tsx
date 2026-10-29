"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const RESTORED_MS = 4000;

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// Assumed online on the server, so the first paint never flashes the offline pill.
const useOnline = () =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );

// Shows an amber pill while the browser reports no connection, and a green one for 4 seconds once it is back.
// Work items, diagrams and designs are kept in localStorage, so going offline loses nothing; this just says so.
export default function NetworkStatusBar() {
  const online = useOnline();
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onOnline = () => {
      setRestored(true);
      clearTimeout(timer);
      timer = setTimeout(() => setRestored(false), RESTORED_MS);
    };
    const onOffline = () => {
      clearTimeout(timer);
      setRestored(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const visible = !online || restored;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4" role="status" aria-live="polite">
      {/* Always mounted so it can slide out; `invisible` also hides it from assistive tech once the fade ends. */}
      <p
        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-md transition-all duration-300 ${
          visible ? "visible translate-y-0 opacity-100" : "invisible -translate-y-3 opacity-0"
        } ${
          online ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"
        }`}
      >
        {online ? "✓ Reconnected — cloud sync resumed" : "⚡ Offline mode — changes saved locally in browser"}
      </p>
    </div>
  );
}
