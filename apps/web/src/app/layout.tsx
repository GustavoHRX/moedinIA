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

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Moedin.IA — seu dinheiro, sem mistério",
    template: "%s — Moedin.IA",
  },
  description:
    "Registre gastos pelo WhatsApp em segundos e acompanhe seu mês num painel claro. Controle financeiro pessoal com IA, sem planilha e sem economês.",
  applicationName: "Moedin.IA",
  keywords: ["controle financeiro", "finanças pessoais", "gastos", "WhatsApp", "orçamento", "IA"],
  authors: [{ name: "Equipe Moedin" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Moedin.IA",
    title: "Moedin.IA — seu dinheiro, sem mistério",
    description:
      "Registre gastos pelo WhatsApp e acompanhe seu mês num painel claro. Controle financeiro pessoal com IA.",
    images: [{ url: "/moedinhagrande.png", width: 512, height: 512, alt: "Moedin.IA" }],
  },
  twitter: {
    card: "summary",
    title: "Moedin.IA — seu dinheiro, sem mistério",
    description: "Controle financeiro pessoal com IA e WhatsApp.",
    images: ["/moedinhagrande.png"],
  },
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
