import AppShell from "@/components/app-shell";
import { AppDataProvider } from "@/components/app-data-provider";
import { ConfirmProvider } from "@/components/confirm-dialog";

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
