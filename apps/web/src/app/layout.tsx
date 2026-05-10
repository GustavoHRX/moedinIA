import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import TermsConsentPopup from "@/components/terms-consent-popup";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["600", "700", "800", "900"],
});

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
      <body className={`${inter.variable} ${montserrat.variable}`}>
        <ThemeProvider>
          {children}
          <TermsConsentPopup />
        </ThemeProvider>
      </body>
    </html>
  );
}
