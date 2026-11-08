---
name: agency-ops:copywriting
description: Write ads and marketing copy using six persuasion techniques (PAS, AIDA, FOMO, Social Proof, Emotional Appeal, Storytelling)
argument-hint: "[pas | aida | fomo | social-proof | emotional | story | mix | review <copy> | frameworks] [for <client or offer>]"
disable-model-invocation: false
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

# Ad & Copywriting Studio

I write ads, hooks, landing-page sections, emails and video scripts using six proven persuasion techniques: **Pain-Agitate-Solve (PAS)**, **AIDA**, **FOMO**, **Social Proof**, **Emotional Appeal** and **Storytelling**. Every draft is checked against each technique's common pitfall before you see it.

The full playbook (structure, pitfalls, examples per technique) lives in `references/persuasion-frameworks.md`.

## Rules

1. Read `context/agency.md` first for niche, offer, pricing, communication style and stage
2. Read this skill's `learnings.md` BEFORE generating output
3. Read `references/persuasion-frameworks.md` before writing — it is the source of truth for each technique
4. If a client or offer is named (`for <name>`), read the matching file in `context/clients/` or `context/pipeline/` and use only facts found there
5. Parse `$ARGUMENTS` to determine the action:
   - `pas` | `aida` | `fomo` | `social-proof` | `emotional` | `story` -- write copy with that technique
   - `mix` -- write one variant per technique (or the user's chosen subset) for A/B testing
   - `review <copy>` -- diagnose existing copy: which technique it uses, which pitfalls it hits, a rewrite
   - `frameworks` -- show the technique table (below) adapted to the user's niche
   - No arguments -- ask what they are writing, then recommend a technique
6. Use AskUserQuestion for each missing brief field individually, never batch
7. **Never invent proof.** Testimonials, ratings, client counts, results and deadlines must come from the user or the context files. If none exist, leave a clearly marked placeholder like `[REAL TESTIMONIAL NEEDED]` and say so
8. **Never invent scarcity.** FOMO copy needs a real deadline, cap or price change. If there is none, offer a cost-of-inaction angle instead (what waiting costs them), which needs no fake urgency
9. Copy is a draft for the user to approve. Do not post, schedule or send it anywhere (Act / Ask / Absorb: outreach and external writes are **Ask**)

## Technique Quick Reference

| Technique | Explanation | Common Pitfall | Example |
| --- | --- | --- | --- |
| Pain-Agitate-Solve (PAS) | Identify problem, deepen the pain, offer solution | Focusing too much on pain, not solving | "Struggling with weight? We can help!" |
| AIDA | Attention, Interest, Desire, Action | Missing one of the steps | From a headline to a CTA button |
| FOMO | Leverage the Fear Of Missing Out | Overuse, making it lose impact | "Limited offer, act now!" |
| Social Proof | Use testimonials, ratings, etc. | Using fake or unrelatable testimonials | "99% of users recommend us!" |
| Emotional Appeal | Target emotions rather than logic | Being overly sentimental | "Find your freedom, travel!" |
| Storytelling | Use a story to sell the product | Making the story too long or irrelevant | "Meet Sarah, a satisfied customer..." |

## Brief (gather before writing)

Collect what is not already in the context files, one question at a time:

1. **What are you promoting?** (your agency offer, or a client's product/service)
2. **Who is it for?** (audience + their #1 problem in their own words)
3. **Format & platform** -- offer options: Meta/Instagram ad, Google search ad, LinkedIn post/ad, TikTok/Reels script, cold email, landing page section, YouTube ad
4. **Goal / CTA** -- book a call, request a demo, try the AI receptionist, buy, sign up
5. **Proof available** -- real testimonials, numbers, case studies (or "none yet")
6. **Real urgency?** -- a genuine deadline, limited slots or price change (or "none")

## Choosing a Technique

If the user does not pick one, recommend based on the brief:

| Situation | Best fit |
| --- | --- |
| Audience feels a clear, painful problem (missed calls, no-shows, slow lead response) | PAS |
| Cold audience, longer format (landing page, video ad, long post) | AIDA |
| Genuine deadline, launch, limited onboarding slots | FOMO |
| You have real results or recognisable clients | Social Proof |
| Lifestyle / identity benefit (time back, less stress, family time) | Emotional Appeal |
| You have a real customer journey or founder story | Storytelling |

Techniques combine well: PAS or Storytelling as the body, Social Proof as the evidence, FOMO only in the CTA line. Use `mix` to test them against each other.

## Write Flow

1. Confirm the brief and the chosen technique in one line
2. Draft using the technique's structure from `references/persuasion-frameworks.md`
3. Adapt length and format to the platform limits in the reference file
4. Run the **Pitfall Check** (below) and fix anything that fails before showing the draft
5. Present output in this format:

```
## [Technique] — [Format] for [Offer]

**Variant A**
[copy]

**Variant B** (different hook, same technique)
[copy]

**Why it works:** [1–2 lines mapping the copy to the technique's steps]
**Pitfall check:** [pass / what was adjusted]
**Placeholders to fill:** [any [REAL ...] markers, or "none"]
```

6. Ask if they want a different technique, a shorter version, or a `mix` set for A/B testing

## Pitfall Check (run on every draft)

- **PAS** -- Is the Solve section at least as long and concrete as the Pain + Agitate? Does it end on the solution, not the problem?
- **AIDA** -- Are all four steps present? Is there one specific CTA (not "learn more" plus three others)?
- **FOMO** -- Is the urgency real and specific (date, number of slots)? Is it used once, not in every line?
- **Social Proof** -- Is every testimonial, number and logo real and approved? Is the person relatable to this audience (same niche, size, problem)?
- **Emotional Appeal** -- Is the emotion tied to a concrete outcome? Is it free of clichés and over-the-top sentiment?
- **Storytelling** -- Does the story get to the turning point fast (3–5 sentences for ads)? Is the hero like the audience and the product the turning point?
- **Platform policy** -- Meta ads must not assert or imply personal attributes ("Struggling with your weight?", "Are you in debt?"). Rewrite as a general statement ("Weight-loss plans that fit busy schedules"). Health, finance and before/after claims need extra care.
- **Brand voice** -- Matches the communication style in `context/agency.md` and any voice notes in `learnings.md`

## Review Flow

When `$ARGUMENTS` starts with `review`:

1. Identify which technique(s) the copy uses (or "none clear")
2. List the pitfalls it hits, quoting the exact words
3. Flag any claims that need proof or break platform policy
4. Give a rewrite using the best-fit technique, keeping all real numbers, names and dates unchanged

## Mix Flow

When `$ARGUMENTS` is `mix`:

1. Gather the brief once
2. Write one short variant per technique (skip FOMO if there is no real urgency; skip Social Proof if there is no real proof — say which were skipped and why)
3. Present as a table: Technique | Hook | Body | CTA
4. Suggest which two to A/B test first, based on the audience temperature

## Saving Copy

If the user wants to keep the copy, save it to `context/clients/<client>/copy/` (client work) or `context/marketing/copy/` (agency's own marketing) as `YYYY-MM-DD-<technique>-<format>.md`. Create the directory with `mkdir -p` if needed.

## Self-Learning

After the user approves, edits or rejects copy, add an entry to `learnings.md`:

- Which technique and format they chose, and what they changed (tone, length, words they cut)
- Which variants performed best if they report results (e.g., "PAS beat AIDA on Meta for dental, 2.1% vs 1.3% CTR #niche")
- Words or phrases they love or ban (#style)

Respect the 30-entry cap; when full, merge the oldest Situational entries into one line under Pruned.
