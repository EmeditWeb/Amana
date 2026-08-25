export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-gold">
        Offline
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-text-primary">
        Amana is unavailable right now
      </h1>
      <p className="mt-4 text-text-secondary">
        Your cached pages remain available. Reconnect to the internet to refresh
        trade status, submit transactions, or sync dispute updates.
      </p>
    </div>
  );
}
