import type { Metadata } from "next";
import AppToaster from "@/components/ui/AppToaster";
import AlertProvider from "@/components/ui/alerts/AlertProvider";
import FormNavigationProvider from "@/components/ui/form/FormNavigationProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lite-erp",
  description: "Versión 4 de lite-erp con tailwind",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-theme="corporate">
      <body className="h-dvh min-w-0 flex flex-col overflow-hidden p-1 bg-base-300">
        <AlertProvider>
          <FormNavigationProvider>
            {children}
            <AppToaster />
          </FormNavigationProvider>
        </AlertProvider>
      </body>
    </html>
  );
}
