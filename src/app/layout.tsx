import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "eSocial Doméstico — Gestão", template: "%s · eSocial Doméstico" },
  description: "Gestão de consultoria de eSocial Doméstico: cadastros, cálculos, rotina mensal, ponto e portal do cliente.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Ponto Doméstico", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f58bd",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
