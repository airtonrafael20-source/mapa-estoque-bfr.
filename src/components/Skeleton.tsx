export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-md bg-surface-2 ${className}`}
      style={{ animation: "skeleton-pulso 1.3s ease-in-out infinite" }}
    />
  );
}

export function SkeletonCards({ quantidade = 6 }: { quantidade?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLinhas({ quantidade = 5 }: { quantidade?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: quantidade }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
