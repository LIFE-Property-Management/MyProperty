export default function RootLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="min-h-screen flex items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-muted-text text-sm">Loading…</p>
      </div>
    </div>
  );
}
