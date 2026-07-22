import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "G&K Shop Tracker",
  description: "POS, inventory, expenses, and live P&L for G&K shop — works offline.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "G&K Tracker" },
};

export const viewport: Viewport = {
  themeColor: "#10b981", // emerald — matches manifest.json
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // POS forms shouldn't pinch-zoom mid-entry at the counter
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster theme="dark" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
