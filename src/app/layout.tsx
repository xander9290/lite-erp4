import type { Metadata } from "next";
import AppToaster from "@/components/ui/AppToaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lite-erp",
  description: "Versión 4 de lite-erp con tailwind",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="h-dvh min-w-0 flex flex-col overflow-hidden p-1 bg-base-300">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
