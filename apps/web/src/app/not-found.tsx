import Link from "next/link";
import ThemedLogo from "@/components/themed-logo";

export const metadata = {
  title: "Página não encontrada — Moedin.IA",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] px-6 py-16 text-center text-[var(--text)]">
      <Link href="/" className="inline-flex" aria-label="Moedin.IA">
        <ThemedLogo className="h-10 w-[120px]" />
      </Link>
      <p className="font-display text-6xl font-bold text-[var(--brand-strong)]">404</p>
      <h1 className="font-display text-2xl font-bold">Essa página a gente não achou.</h1>
      <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
        O link pode estar quebrado ou a página foi movida. Volte para o começo e siga daqui.
      </p>
      <Link href="/" className="btn-primary px-5 py-3">
        Voltar para o início
      </Link>
    </main>
  );
}
