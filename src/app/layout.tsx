import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accounting Event Exporter — Awakens",
  description: "Export protocol-defined accounting events into Awakens-compatible CSV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-zinc-950 text-zinc-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
