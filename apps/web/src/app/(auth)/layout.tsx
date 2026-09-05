import type { Metadata } from "next";

// AUDITORIA M-5: páginas de autenticação não devem ser indexadas.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
