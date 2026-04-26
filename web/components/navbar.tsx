import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appName } from "@/lib/utils";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-900/80 bg-app/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-amber-500 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-zinc-100">{appName()}</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <Link href="/#features" className="hover:text-zinc-100">
            Features
          </Link>
          <Link href="/#how" className="hover:text-zinc-100">
            How it works
          </Link>
          <Link href="/pricing" className="hover:text-zinc-100">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden text-sm text-zinc-400 hover:text-zinc-100 md:inline"
          >
            Sign in
          </Link>
          <Link href="/dashboard">
            <Button size="sm">Start free</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
