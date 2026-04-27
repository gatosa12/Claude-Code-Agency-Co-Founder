import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "brand";
const tones: Record<Tone, string> = {
  default: "bg-zinc-800 text-zinc-300 border-zinc-700",
  success: "bg-emerald-900/30 text-emerald-400 border-emerald-800/50",
  warning: "bg-amber-900/30 text-amber-400 border-amber-800/50",
  danger: "bg-red-900/30 text-red-400 border-red-800/50",
  brand: "bg-brand-900/40 text-brand-300 border-brand-800/60",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
