import Link from "next/link";
import { ArrowRight, Sparkles, Play } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { LandingFeatures } from "@/components/landing-features";
import { PricingCards } from "@/components/pricing-cards";
import { appName, appTagline } from "@/lib/utils";

export default function Home() {
  return (
    <>
      <Navbar />

      <section className="relative gradient-bg">
        <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-800/60 bg-brand-950/40 px-3 py-1 text-xs font-medium text-brand-300">
              <Sparkles className="h-3 w-3" /> Powered by Claude Sonnet 4.6
            </span>
            <h1 className="mt-6 text-5xl font-bold tracking-tight text-zinc-100 md:text-6xl lg:text-7xl">
              {appTagline().split(" with ")[0]}{" "}
              <span className="gradient-text">with AI</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 md:text-xl">
              {appName()} writes your scripts, packages your videos, and finds
              your next viral idea — so you ship more and grow faster.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/dashboard">
                <Button size="lg">
                  Start creating free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#how">
                <Button size="lg" variant="outline">
                  <Play className="h-4 w-4" /> See how it works
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">
              No credit card required. Bring your own Claude API key.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-zinc-900/80 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
              Every tool you need to ship YouTube videos
            </h2>
            <p className="mt-4 text-muted">
              From idea to upload — five focused AI tools, one dashboard.
            </p>
          </div>
          <LandingFeatures />
        </div>
      </section>

      <section id="how" className="border-t border-zinc-900/80 bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
              From blank page to upload in 30 minutes
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Find your idea",
                d: "Drop in your niche. Get 10+ data-informed ideas with hooks and difficulty.",
              },
              {
                n: "02",
                t: "Write & package",
                d: "Generate the script, then a full SEO pack and 3 thumbnail concepts.",
              },
              {
                n: "03",
                t: "Ship & iterate",
                d: "Copy, edit, upload. Every generation is saved — refine and regenerate.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-xl border border-zinc-800 bg-card p-7"
              >
                <span className="font-mono text-sm text-brand-500">{s.n}</span>
                <h3 className="mt-3 text-xl font-semibold text-zinc-100">
                  {s.t}
                </h3>
                <p className="mt-2 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-900/80 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
              Simple pricing
            </h2>
            <p className="mt-4 text-muted">
              Start free. Upgrade when you're ready to ship daily.
            </p>
          </div>
          <PricingCards />
        </div>
      </section>

      <footer className="border-t border-zinc-900/80 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted md:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {appName()}. Built with Claude.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="hover:text-zinc-200">
              Pricing
            </Link>
            <Link href="/dashboard" className="hover:text-zinc-200">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
