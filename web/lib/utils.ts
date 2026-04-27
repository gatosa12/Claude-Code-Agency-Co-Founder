import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function appName() {
  return process.env.NEXT_PUBLIC_APP_NAME || "TubeForge AI";
}

export function appTagline() {
  return (
    process.env.NEXT_PUBLIC_APP_TAGLINE ||
    "Grow your YouTube channel 10x faster with AI"
  );
}
