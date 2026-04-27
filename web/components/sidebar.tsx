"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Lightbulb,
  FileText,
  Tags,
  Image as ImageIcon,
  Search,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { cn, appName } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/ideas", label: "Idea Finder", icon: Lightbulb },
  { href: "/dashboard/script", label: "Script Writer", icon: FileText },
  { href: "/dashboard/seo", label: "SEO Pack", icon: Tags },
  { href: "/dashboard/thumbnail", label: "Thumbnails", icon: ImageIcon },
  { href: "/dashboard/channel", label: "Channel Analyzer", icon: Search },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-zinc-900/80 bg-card/40 md:flex md:flex-col">
      <Link
        href="/"
        className="flex h-16 items-center gap-2 border-b border-zinc-900/80 px-6 font-semibold"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-amber-500 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-zinc-100">{appName()}</span>
      </Link>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-brand-950/60 text-brand-300"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-900/80 p-3">
        <Link
          href="/pricing"
          className="block rounded-lg border border-brand-800/40 bg-gradient-to-br from-brand-950/40 to-card p-3 text-xs"
        >
          <p className="font-semibold text-brand-300">Upgrade to Pro</p>
          <p className="mt-1 text-muted">Unlimited generations + 30-min scripts.</p>
        </Link>
      </div>
    </aside>
  );
}
