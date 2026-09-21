import type { Metadata } from "next";

// Título próprio da aba (a página é um client component e não exporta metadata).
export const metadata: Metadata = {
  title: "Recuperar senha",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
