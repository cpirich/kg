import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/layout/providers";
import { SidebarInset } from "@/components/ui/sidebar";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge Gap Finder",
  description:
    "Upload academic papers and discover knowledge gaps, contradictions, and research opportunities.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <AppSidebar />
          <SidebarInset>
            <AppHeader />
            <div className="flex-1 overflow-auto p-6">{children}</div>
          </SidebarInset>
        </Providers>
      </body>
    </html>
  );
}
