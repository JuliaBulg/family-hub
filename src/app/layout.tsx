import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthShell from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "🏠 Family Home Hub",
  description: "Smart home management for Julia's family — pantry, meals, shopping & expenses",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Home Hub",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-800">
        <AuthProvider>
          <AuthShell>
            {children}
          </AuthShell>
        </AuthProvider>
      </body>
    </html>
  );
}
