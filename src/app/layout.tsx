import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accounting Event Exporter — Awakens",
  description: "Export protocol-defined accounting events into Awakens-compatible CSV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise bg-[var(--surface-0)] text-[var(--text-primary)] antialiased min-h-screen ledger-bg">
        {children}
      </body>
    </html>
  );
}
