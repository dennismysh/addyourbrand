import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "addyourbrand — your templates, your brand",
  description:
    "Drop in any Pinterest-style template. Get back a 2:3 design rebranded with your fonts, colors, and voice — ready for Canva.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
