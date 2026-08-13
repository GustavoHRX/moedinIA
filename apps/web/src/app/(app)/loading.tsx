/**
 * Skeleton de navegação para as páginas internas (App Router loading.js).
 * Aparece instantaneamente ao trocar de página, enquanto o conteúdo carrega,
 * espelhando o layout padrão (PageHeader + grade de cards). Server Component
 * estático — nenhuma dependência de dados, então é prefetchado e imediato.
 */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-8" aria-hidden="true">
      <div className="mx-auto w-full max-w-[1720px] space-y-6">
        {/* PageHeader */}
        <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-5 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Bar className="h-3 w-28" />
              <Bar className="h-9 w-64" />
              <Bar className="h-4 w-80 max-w-full" />
            </div>
            <Bar className="h-12 w-full sm:w-52" />
          </div>
        </div>

        {/* Faixa de destaque / resumo */}
        <div className="rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Bar className="h-10 w-40" />
              <Bar className="h-4 w-64 max-w-full" />
              <div className="flex gap-2 pt-1">
                <Bar className="h-7 w-32" />
                <Bar className="h-7 w-32" />
              </div>
            </div>
            <div className="flex gap-4">
              <Bar className="h-24 w-40" />
              <Bar className="h-24 w-40" />
            </div>
          </div>
        </div>

        {/* Grade de cards */}
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-6">
              <Bar className="h-3 w-24" />
              <Bar className="mt-3 h-6 w-40" />
              <Bar className="mt-6 h-[220px] w-full" />
            </div>
          ))}
        </div>

        {/* Lista */}
        <div className="rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-6">
          <Bar className="h-6 w-48" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Bar className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bar className="h-4 w-1/2" />
                  <Bar className="h-3 w-1/3" />
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
