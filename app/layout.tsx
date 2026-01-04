import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Shop to Field",
  description: "Shop to Field work management application",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="page-transition font-sans bg-[var(--brand-bg)] text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

