import type { Metadata } from "next";
import "./globals.css";
import { appName, appTagline } from "@/lib/utils";

export const metadata: Metadata = {
  title: `${appName()} — ${appTagline()}`,
  description: appTagline(),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
