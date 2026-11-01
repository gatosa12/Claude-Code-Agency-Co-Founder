# Keyword-to-Short-Video Pipeline -- {{brand_name}}

**Tool:** [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) (free, open source, self-hosted)
**Brand / Client:** {{brand_name}}
**Use case:** {{use_case}} (agency social content, client niche explainers, ad-creative test batches)
**Output:** 9:16 MP4 with script, voiceover, subtitles, music and stock footage
**Date:** {{date}}

---

## Overview

MoneyPrinterTurbo takes one keyword or short phrase and builds a short video from it. It writes the script, picks search terms, downloads stock footage, records the voiceover, adds subtitles and music, and encodes the result with FFmpeg. You run it from a Streamlit web UI or a REST API.

**What it's good for in an agency:**
- Getting top-of-funnel social content out fast for your own brand ("3 signs your front desk is missing calls")
- Niche explainer drafts for clients (dental, HVAC, legal, and so on)
- Lots of cheap hook variations for ad-creative testing before you pay for a real shoot

**What it's not:** a finished-ad generator. The output is a **draft**. For a polished, branded software ad, use `software-installation-ad.md`.

---

## Step 1 -- Before You Start

| Requirement | Detail |
|-------------|--------|
| Software | Docker Desktop + Git. On Windows, set up WSL2 first. |
| Stock footage key | Free Pexels API key from [pexels.com/api](https://www.pexels.com/api/). Pixabay also works. |
| LLM key | Writes the script. See the lanes in Step 2. |
| RAM | 8 GB realistically. 4 GB only works if everything runs in the cloud. A local Ollama model needs 8-16 GB. |
| Disk | About 5 GB free. The Docker image is about 3 GB. |
| Time | 15-30 minutes for the first setup, mostly the Docker download. |

You need **two keys**: a Pexels key and an LLM key. Claims of "setup in 10 seconds" only count the time to type the command.

---

## Step 2 -- Pick an LLM Lane

| Lane | Providers | Cost | Trade-off |
|------|-----------|------|-----------|
| Free, cloud | Pollinations, ModelScope | $0 | Quality varies and it can be flaky |
| Free, local | Ollama | $0 | Needs 8-16 GB RAM; install Ollama separately |
| Paid, reliable | DeepSeek, OpenAI, Moonshot, AIHubMix | ~$0.001 per 60s video | Best script quality |

**Recommendation:** use DeepSeek for your first run. It has the best price-to-quality balance, and a few cents covers dozens of videos. For a strictly $0 path, use Pollinations with Pexels footage.

> Note: older guides list `g4f` as a free lane. It isn't in the current provider registry, so check `app/models/llm_provider.py` before you rely on it.

---

## Step 3 -- Clone and Configure

```bash
git clone https://github.com/harry0703/MoneyPrinterTurbo.git
```

```bash
cd MoneyPrinterTurbo
```

```bash
cp config.example.toml config.toml
```

On Windows, use `copy` instead of `cp`.

Open `config.toml`. The provider settings are **flat keys inside the `[app]` section**, each prefixed with the provider name. They are not separate `[deepseek]` blocks. Fill in three things:

```toml
[app]
# 1. Stock footage
video_source = "pexels"
pexels_api_keys = ["YOUR_PEXELS_KEY_HERE"]

# 2. Which LLM writes the script
llm_provider = "deepseek"   # or: openai, moonshot, ollama, pollinations, modelscope, ...

# 3. That provider's keys (prefix matches llm_provider)
deepseek_api_key = "YOUR_LLM_KEY_HERE"
deepseek_base_url = ""      # empty = registry default (https://api.deepseek.com)
deepseek_model_name = ""    # empty = registry default
```

These keys already exist in the file, so edit the ones that are there rather than adding duplicates. Leave `base_url` and `model_name` empty to use the defaults in `app/models/llm_provider.py`.

**Free local lane (Ollama):**

```toml
llm_provider = "ollama"
ollama_base_url = "http://host.docker.internal:11434/v1"
ollama_model_name = "llama3.1:8b"   # whatever `ollama list` shows
```

Never commit `config.toml`. It holds your keys.

---

## Step 4 -- Launch

Prebuilt image (faster, recommended):

```bash
docker compose -f docker-compose.release.yml up
```

Build locally (slower, only needed if you've changed the code):

```bash
docker compose up
```

The first run pulls about 3 GB, so expect 10-20 minutes. It starts two services, both bound to `127.0.0.1`:

| Service | URL |
|---------|-----|
| Web UI | http://localhost:8501 |
| REST API + docs | http://localhost:8080/docs |

Managing it:

```bash
docker compose ps
```

```bash
docker compose logs -f webui
```

```bash
docker compose down
```

---

## Step 5 -- Make Your First Video

Open http://localhost:8501 and set:

| Setting | Value |
|---------|-------|
| Topic | One concrete keyword or phrase, e.g. `{{topic}}` ("missed calls at dental offices", "morning routines", "space facts") |
| Language | English |
| Aspect ratio | 9:16 (Reels, Shorts, TikTok) |
| Voice | `en-US-AndrewNeural` or any free Edge TTS voice |
| Subtitles | `edge` (fast, no GPU). Switch to `whisper` later if accuracy matters more than speed. |

Click **Generate**. The UI streams each stage: script, then search terms, footage download, voiceover, subtitles, and the FFmpeg encode.

Output: `storage/tasks/<task_id>/final-1.mp4`

**Common gotchas:**
- **Chinese voices by default:** the maintainer is Chinese, so just pick an `en-US` voice in the dropdown.
- **Nothing generated or empty footage:** this is almost always the Pexels key, so check `storage/logs/`. Or the topic is too abstract; try a more concrete keyword.

---

## Step 6 -- REST API (Optional, for Batches)

Every UI capability is also a REST endpoint under `/api/v1` (interactive docs at `/docs`). The flow is: submit a task, poll it, download the MP4.

```bash
curl -X POST http://localhost:8080/api/v1/videos \
  -H "Content-Type: application/json" \
  -d '{"video_subject": "{{topic}}", "video_aspect": "9:16", "voice_name": "en-US-AndrewNeural-Male", "subtitle_enabled": true}'
```

```bash
curl http://localhost:8080/api/v1/tasks/<task_id>
```

When the task finishes, the response lists the video URLs. Download them from `/api/v1/download/...`. Check `/docs` for the exact voice-name format and the full parameter list (`video_script`, `video_terms`, `paragraph_number`, `bgm_volume`, font and subtitle styling).

This is the hook for automation. An n8n Schedule trigger can loop over a keyword list, POST each one, poll until the task is done, and then drop the MP4 into Drive for review. See `templates/systems/` for n8n patterns.

---

## Agency Workflow -- Draft to Publish

1. **Keyword list:** 10-20 concrete topics tied to the niche's pain points (pull from `context/agency.md` and the client file).
2. **Batch generate** with the API.
3. **Human review every video.** Stock-footage relevance varies a lot, and abstract themes often pull odd clips.
4. **Polish:** swap any off-topic clips, add the brand logo and end card, and fix the CTA. Use a custom `video_script` if the auto script is off-brand.
5. **Licensing:** Pexels and Pixabay are royalty-free for most uses, but check each clip's license before commercial or large-scale publishing. The task logs list the source URLs.
6. **Client approval** (Ask tier): never post to a client's channels without sign-off.

---

## Checklist

- [ ] Pexels key and LLM key in `config.toml` (not committed)
- [ ] Containers running (`docker compose ps`)
- [ ] English voice selected, 9:16 aspect
- [ ] Concrete topic, not an abstract one
- [ ] Every clip previewed for relevance
- [ ] Clip licenses checked for commercial use
- [ ] Branding and CTA added
- [ ] Client approval before publishing
