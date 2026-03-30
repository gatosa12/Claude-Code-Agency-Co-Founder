---
name: agency-ops:proposal
description: Generate proposal artifacts, SOW, and service agreements
argument-hint: "<client-name>"
disable-model-invocation: true
---

## Proposal

**Status:** Coming in Phase 2

This skill will generate proposal artifacts for clients by reading:
- `context/agency.md` for agency context
- `context/clients/{client}.md` for client details
- This skill's `learnings.md` for past improvements

### When Ready, This Skill Will:
1. Generate Claude artifact prompts for interactive proposals
2. Create SOW with scope, deliverables, timeline, pricing
3. Draft post-discovery follow-up emails
4. Learn from your feedback to improve future output

Run `/agency-ops:onboarding` first to set up your agency context.
