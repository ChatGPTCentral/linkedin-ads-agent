import type { Metadata, Viewport } from "next";
import { Open_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { seed } from "@/data/seed";
import { SAFE_MODE } from "@/lib/safe";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-opensans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plexmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Central — Campaign Cockpit",
  description:
    "Live LinkedIn Ads cockpit: real-time campaign health, spend & cost-per-quiz, one-tap pause/resume — plus the ICP insights and connections behind it.",
};

// Mobile-first: render edge-to-edge on iPhone with no zoom-out.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${openSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="app-layout">
          <Sidebar />
          <div className="main-content">
            {SAFE_MODE && (
              <div className="no-print bg-amber-100 px-5 py-1.5 text-center text-xs text-amber-900">
                Demo mode — absolute revenue &amp; customer counts are hidden; percentages &amp; relative comparisons only.
              </div>
            )}
            <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10">{children}</main>
            <footer className="no-print mx-auto max-w-6xl px-5 pb-10 pt-2 text-xs leading-relaxed text-zinc-400 lg:px-10">
              Built from the AI Central CRM enrichment pipeline · aggregated &amp; anonymized · data baked {seed.meta.generatedAt}. No
              customer PII is stored in this app.
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
