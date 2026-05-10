import AppShell from "@/components/app-shell";
import { AppDataProvider } from "@/components/app-data-provider";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppDataProvider>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
