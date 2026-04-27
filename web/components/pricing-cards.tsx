import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Tier = {
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

export const TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$0",
    period: "/mo",
    tagline: "Try every tool. No credit card.",
    features: [
      "5 video idea generations / day",
      "1 script per day (up to 8 min)",
      "5 SEO packages / day",
      "3 thumbnail concepts / day",
      "1 saved project",
    ],
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    tagline: "For serious creators chasing 10k subs.",
    features: [
      "Unlimited idea generation",
      "Unlimited scripts (up to 30 min)",
      "Unlimited SEO packages",
      "Unlimited thumbnail concepts",
      "Channel analyzer",
      "20 saved projects",
      "Priority generation queue",
    ],
    cta: "Get Pro",
    highlight: true,
  },
  {
    name: "Premium",
    price: "$79",
    period: "/mo",
    tagline: "For agencies and channel networks.",
    features: [
      "Everything in Pro",
      "Unlimited saved projects",
      "5 collaboration seats",
      "Bulk batch generation",
      "Advanced channel deep-dives",
      "Custom prompt presets",
      "Early access to new tools",
    ],
    cta: "Get Premium",
  },
];

export function PricingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {TIERS.map((t) => (
        <div
          key={t.name}
          className={cn(
            "relative flex flex-col rounded-2xl border p-7",
            t.highlight
              ? "border-brand-600/60 bg-gradient-to-b from-brand-950/40 to-card shadow-2xl shadow-brand-900/30"
              : "border-zinc-800 bg-card"
          )}
        >
          {t.highlight && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
              Most Popular
            </span>
          )}
          <h3 className="text-lg font-semibold text-zinc-100">{t.name}</h3>
          <p className="mt-1 text-sm text-muted">{t.tagline}</p>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-zinc-100">{t.price}</span>
            <span className="text-sm text-muted">{t.period}</span>
          </div>
          <ul className="mt-6 space-y-3">
            {t.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href="/dashboard" className="mt-7">
            <Button
              variant={t.highlight ? "primary" : "outline"}
              className="w-full"
            >
              {t.cta}
            </Button>
          </Link>
        </div>
      ))}
    </div>
  );
}
