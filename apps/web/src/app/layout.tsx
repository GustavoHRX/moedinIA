import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Poppins } from "next/font/google";
import TermsConsentPopup from "@/components/terms-consent-popup";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-jetbrains",
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
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${poppins.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider>
          {children}
          <TermsConsentPopup />
        </ThemeProvider>
      </body>
    </html>
  );
}
