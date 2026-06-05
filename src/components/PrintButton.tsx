"use client";

import { cn } from "./ui";

export function PrintButton({ label = "Print / PDF", className }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50",
        className
      )}
    >
      {label}
    </button>
  );
}
