"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const LINKS = [
  { href: "/", label: "Cockpit" },
  { href: "/settings", label: "Settings" },
];

// Settings sub-routes still highlight the Settings tab.
const SETTINGS_ROUTES = ["/settings", "/insights", "/icp", "/audiences", "/brief", "/connect", "/methodology"];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((l) => {
        const active =
          l.href === "/"
            ? pathname === "/"
            : SETTINGS_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
