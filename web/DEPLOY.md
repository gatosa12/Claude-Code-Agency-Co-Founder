# Deploy TubeForge AI

Two paths: **Vercel** (recommended, ~60 sec) or **anywhere Node runs**.

## Path 1 — Vercel (recommended)

1. Push this repo to GitHub (you've already done this if you're reading the repo).
2. Go to https://vercel.com/new and import the repo.
3. **Root Directory**: set to `web`.
4. Framework preset auto-detects as **Next.js**. Leave defaults.
5. Add environment variables:

   | Key | Required? | Notes |
   |-----|-----------|-------|
   | `ANTHROPIC_API_KEY` | yes | https://console.anthropic.com/ |
   | `ANTHROPIC_MODEL` | no | defaults to `claude-sonnet-4-6` |
   | `OPENAI_API_KEY` | optional | enables real thumbnail rendering |
   | `OPENAI_IMAGE_MODEL` | no | defaults to `gpt-image-1` |
   | `NEXT_PUBLIC_APP_NAME` | no | rebrand the product |
   | `NEXT_PUBLIC_APP_TAGLINE` | no | rebrand the tagline |

6. Click **Deploy**. You're live at `your-project.vercel.app` in ~60 seconds.

### Custom domain
Vercel project → **Settings → Domains** → add your domain → follow DNS prompts.

## Path 2 — anywhere Node runs

```bash
cd web
npm install
npm run build
npm start          # serves on :3000
```

For production, put it behind a reverse proxy (Caddy, Nginx) and a process manager (pm2, systemd).

```bash
# Example pm2
npm install -g pm2
pm2 start "npm start" --name tubeforge
pm2 save
```

## Cost expectations

Per generation, with default models:

| Tool | Cost (Claude only) | + OpenAI image gen |
|------|-------------------:|-------------------:|
| Idea Finder | ~$0.02 | — |
| Script Writer | ~$0.05 | — |
| SEO Pack | ~$0.02 | — |
| Thumbnail Concepts | ~$0.02 | + ~$0.50 for 3 images |
| Channel Analyzer | ~$0.02 | — |

You can pre-fund $20 on Anthropic and run the platform for hundreds of generations.

## Safety / limits

This MVP has **no auth and no rate limiting**. If you deploy publicly:

- Add a basic password page (Vercel password protection works) until you wire real auth, OR
- Put it behind Cloudflare Access, OR
- Ship it as a single-user tool (the most common path).

V2 stubs for Supabase auth and Stripe are already in `.env.example` — wire them when you're ready to charge.

## Troubleshooting

**"Demo mode" banner won't go away after adding the key**
Restart the dev server (`npm run dev`) — Next caches env vars at startup.

**Image rendering returns "Image gen failed"**
Check the OpenAI key is valid and has credits, and that `OPENAI_IMAGE_MODEL` is a model your account can access (`gpt-image-1` may require organization verification; `dall-e-3` is the safest fallback).

**Build hangs on Vercel**
Make sure **Root Directory** is set to `web`, otherwise Vercel can't find `package.json`.
