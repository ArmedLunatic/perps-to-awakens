import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perps → Awakens CSV",
  description: "Convert perpetuals trading history to Awakens-compatible CSV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
