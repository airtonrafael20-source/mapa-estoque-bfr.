import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mapa de Estoque — BFR Fanáticos",
  description: "Localização em tempo real de produtos no almoxarifado (colunas, andares e quantidade).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121213",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="overflow-x-hidden">{children}</body>
    </html>
  );
}
