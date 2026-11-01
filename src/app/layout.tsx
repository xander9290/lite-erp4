import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lite-erp",
  description: "Versión 4 de lite-erp con tailwind",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-theme="corporate">
      <body className="h-screen flex flex-col overflow-hidden p-1 bg-base-300">{children}</body>
    </html>
  );
}
