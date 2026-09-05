/**
 * Skeleton de navegação para as páginas internas (App Router loading.js).
 * Aparece instantaneamente ao trocar de página. Espelha a estrutura nova:
 * PageHeader enxuto + linha de números + cards. Sem sombra, raio unificado.
 */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-7" aria-hidden="true">
      <div className="mx-auto w-full max-w-app space-y-5">
        {/* PageHeader */}
        <div className="rounded-lg border border-line bg-surface px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Bar className="h-7 w-52" />
              <Bar className="h-4 w-72 max-w-full" />
            </div>
            <Bar className="h-10 w-full sm:w-48" />
          </div>
        </div>

        {/* Linha de números */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-4 sm:p-5">
              <Bar className="h-3 w-20" />
              <Bar className="mt-2 h-7 w-28" />
            </div>
          ))}
        </div>

        {/* Cards */}
        <div className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-4 sm:p-5">
              <Bar className="h-4 w-32" />
              <Bar className="mt-4 h-[200px] w-full" />
            </div>
          ))}
        </div>

        {/* Lista */}
        <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <Bar className="h-4 w-40" />
          <div className="mt-4 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border border-line px-4 py-3">
                <Bar className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Bar className="h-3.5 w-1/3" />
                  <Bar className="h-3 w-1/4" />
                </div>
                <Bar className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
