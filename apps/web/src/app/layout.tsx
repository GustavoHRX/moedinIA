import type { Metadata } from "next";
import TermsConsentPopup from "@/components/terms-consent-popup";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moedin.IA",
  description: "Controle financeiro inteligente para vida real.",
  icons: {
    icon: "/moedinhagrande.png",
    shortcut: "/moedinhagrande.png",
    apple: "/moedinhagrande.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <TermsConsentPopup />
        </ThemeProvider>
      </body>
    </html>
  );
}
