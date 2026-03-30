---
name: agency-ops:voice-agent
description: Guide voice agent template selection and customization for a client
argument-hint: "<client-name>"
disable-model-invocation: true
---

## Voice Agent

**Status:** Coming in Phase 2

This skill will guide voice agent template selection and customization by reading:
- `context/agency.md` for agency context
- `context/clients/{client}.md` for client details
- This skill's `learnings.md` for past improvements

### When Ready, This Skill Will:
1. Select from inbound receptionist, speed-to-lead, and DBR templates
2. Customize template for client's niche
3. Generate system design document with call flow and integrations
4. Learn from your feedback to improve future output

Run `/agency-ops:onboarding` first to set up your agency context.
