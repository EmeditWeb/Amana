"use client";

import { useOffline } from "@/hooks/useOffline";

export function NetworkStatusBanner() {
  const { isOffline, wasOffline, retryOnline } = useOffline();

  if (!isOffline && !wasOffline) return null;

  return (
    <div
      className={
        isOffline
          ? "bg-warning/15 border-b border-warning/40 text-warning"
          : "bg-status-success/15 border-b border-status-success/40 text-status-success"
      }
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex min-h-10 max-w-7xl items-center justify-between gap-4 px-4 py-2 text-sm">
        <span>
          {isOffline
            ? "You are offline. Live balances and trade updates may be unavailable."
            : "Connection restored. Live data is available again."}
        </span>
        {isOffline && (
          <button
            type="button"
            onClick={() => void retryOnline()}
            className="shrink-0 rounded-md border border-current px-3 py-1 font-semibold hover:bg-warning/10"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
