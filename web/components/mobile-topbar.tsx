"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";
import { cn, appName } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/ideas", label: "Idea Finder" },
  { href: "/dashboard/script", label: "Script Writer" },
  { href: "/dashboard/seo", label: "SEO Pack" },
  { href: "/dashboard/thumbnail", label: "Thumbnails" },
  { href: "/dashboard/channel", label: "Channel Analyzer" },
];

export function MobileTopbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex flex-col border-b border-zinc-900/80 bg-card/40 md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-amber-500 text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-zinc-100">{appName()}</span>
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-zinc-900/80 px-2 py-2">
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-brand-950/60 text-brand-300"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
