export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--bg-soft)] ${className}`} />;
}

// Lista de "cards" de lançamento/registro enquanto carrega
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// Bloco para áreas de gráfico
export function SkeletonBlock({ className = "h-[300px]" }: { className?: string }) {
  return <Skeleton className={`w-full ${className}`} />;
}
