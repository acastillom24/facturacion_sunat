import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.emitesunat.com"),
  title: "EmiteSunat | Facturación electrónica SUNAT para tu negocio",
  description: "Emite boletas y facturas electrónicas, carga masiva desde Excel y anulaciones. Escríbenos por WhatsApp +51 952 520 362.",
  openGraph: { title: "EmiteSunat | Facturación electrónica SUNAT", description: "Factura sin complicaciones. Vende sin límites.", url: "https://www.emitesunat.com", locale: "es_PE", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
