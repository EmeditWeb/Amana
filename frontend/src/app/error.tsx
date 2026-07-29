"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { OfflineState } from "@/components/ui/OfflineState";
import { useOffline } from "@/hooks/useOffline";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { isOffline, retryOnline } = useOffline();

  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  if (isOffline) {
    return (
      <OfflineState
        className="min-h-[60vh]"
        onRetry={() => void retryOnline().then(reset)}
      />
    );
  }

  return (
    <ErrorState
      className="min-h-[60vh]"
      variant="card"
      title="We could not load this page"
      message="The service may be temporarily unavailable. Your data is safe; retry the request in a moment."
      onRetry={reset}
    />
  );
}
