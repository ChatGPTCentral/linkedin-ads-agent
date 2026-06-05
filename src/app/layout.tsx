import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { seed } from "@/data/seed";

export const metadata: Metadata = {
  title: "AI Central — LinkedIn Ads Campaign Designer",
  description:
    "Design high-converting LinkedIn Ads from real Stripe conversion data: ICP analysis, audience targeting, copy, creative & landing-page briefs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-50 font-sans text-zinc-900">
        <header className="no-print sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-600 text-xs font-bold text-white">in</span>
              <span className="text-sm font-semibold text-zinc-900">AI Central · LinkedIn Ads Designer</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
        <footer className="no-print mx-auto max-w-6xl px-5 pb-10 pt-4 text-xs leading-relaxed text-zinc-400">
          Built from the AI Central CRM enrichment pipeline · aggregated &amp; anonymized · data baked {seed.meta.generatedAt}. No
          customer PII is stored in this app.
        </footer>
      </body>
    </html>
  );
}
