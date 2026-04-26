# TubeForge AI

AI-powered YouTube growth platform. Five tools that take you from blank page to upload-ready: idea finder, script writer, SEO pack, thumbnail concepts, channel analyzer.

Built on Next.js 14 + Anthropic Claude. Deploy to Vercel in 60 seconds.

## Quick start

```bash
cd web
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
```

Open http://localhost:3000.

## Demo mode (no API key)

The app boots without an API key — every tool returns a placeholder fixture so you can click through the UX. Add `ANTHROPIC_API_KEY=...` to `.env.local` to switch on real generation.

Get a key at https://console.anthropic.com/. Cost runs ~$0.01–0.05 per generation.

### Real thumbnail images (optional)

Add `OPENAI_API_KEY=...` to enable real preview-image rendering for the Thumbnail tool. Without it, the tool still returns concepts + ready-to-paste image-gen prompts; with it, it renders actual previews you can download. ~$0.50 per generation (3 images).

## What's inside

| Route | Tool |
|-------|------|
| `/` | Marketing landing page |
| `/pricing` | Pricing tiers |
| `/dashboard` | Tool overview |
| `/dashboard/ideas` | Niche → 10+ video ideas with hooks + difficulty |
| `/dashboard/script` | Topic → retention-optimized long-form script |
| `/dashboard/seo` | Topic → 5 titles, description, 25 tags, hashtags, chapters |
| `/dashboard/thumbnail` | Title → 3 thumbnail concepts with image-gen prompts |
| `/dashboard/channel` | Channel info → reverse-engineered playbook |

API routes mirror each tool at `/api/<tool>`.

## Branding

Set `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_TAGLINE` in `.env.local` to rebrand.

## Project persistence

V1 uses `localStorage` (browser-side). To persist across devices, add Supabase env vars and swap `lib/storage.ts` for a Supabase client (the interface is intentionally small).

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS (dark theme baseline)
- Anthropic SDK (Claude Sonnet 4.6 by default)
- lucide-react icons
- Zero database in v1 (localStorage)

## Deploy

```bash
npm run build
```

Push to a GitHub repo, import on Vercel, set `ANTHROPIC_API_KEY` in the env. Done.

## Roadmap

V2 (post-MVP):
- Auth + multi-user via Supabase
- Stripe checkout (env vars already wired)
- Voiceover generation (ElevenLabs)
- Image generation for thumbnails (DALL-E / Replicate)
- Video scene generation
- AI avatars

The lib/ai.ts pattern makes adding new providers a 1-file change.
