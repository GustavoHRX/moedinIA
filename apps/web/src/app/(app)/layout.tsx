import type { Metadata } from "next";
import AppShell from "@/components/app-shell";
import { AppDataProvider } from "@/components/app-data-provider";
import { ConfirmProvider } from "@/components/confirm-dialog";

// AUDITORIA M-5: área logada nunca deve ser indexada.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppDataProvider>
      <ConfirmProvider>
        <AppShell>{children}</AppShell>
      </ConfirmProvider>
    </AppDataProvider>
  );
}
