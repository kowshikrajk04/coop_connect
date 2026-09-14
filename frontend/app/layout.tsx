import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "CoopConnect – AI-Powered Cooperative Workforce Marketplace",
  description: "Fair Work • Stronger Communities. Connecting verified cooperative workers with fair AI allocation, transparent pricing, and welfare funds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-white">
      <body className="min-h-screen bg-white text-slate-800 flex flex-col antialiased selection:bg-blue-100 selection:text-blue-900">
        <Navbar />
        <main className="flex-1 bg-white">
          {children}
        </main>
        
        {/* Simple Trustworthy Footer */}
        <footer className="bg-white border-t border-gray-200 py-8 px-4 text-center text-sm text-gray-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <span className="font-bold text-gray-900 text-base">CoopConnect</span>
              <p className="text-xs text-gray-500">Registered Labour Cooperative Federation Portal • Made for Indian Workers & Communities</p>
            </div>
            <div className="text-xs text-gray-400">
              Fair AI Allocation • Digital Invoicing • Transparent Welfare Pool
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
