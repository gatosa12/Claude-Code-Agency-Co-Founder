import { Navbar } from "@/components/navbar";
import { PricingCards } from "@/components/pricing-cards";

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-100 md:text-5xl">
              Pricing built for creators
            </h1>
            <p className="mt-4 text-lg text-muted">
              Start free. Upgrade when you're ready to ship daily.
            </p>
          </div>
          <PricingCards />
          <div className="mx-auto mt-16 max-w-2xl rounded-xl border border-zinc-800 bg-card p-6 text-sm text-muted">
            <p className="text-zinc-200">
              <strong>BYO API key (optional):</strong>
            </p>
            <p className="mt-2">
              You can run this on your own Claude API key for unlimited
              generation at API cost (~$0.01–0.05 per generation). Add{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
                ANTHROPIC_API_KEY
              </code>{" "}
              to your environment and you're set.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
