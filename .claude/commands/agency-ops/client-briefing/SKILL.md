---
name: agency-ops:client-briefing
description: Generate a comprehensive briefing for a specific client before meetings or context-switching
argument-hint: "<client-name>"
disable-model-invocation: true
---

## Client Briefing

**Status:** Coming in Phase 2

This skill will generate a comprehensive briefing for a specific client by reading:
- `context/agency.md` for agency context
- `context/clients/{client}.md` for client details
- This skill's `learnings.md` for past improvements

### When Ready, This Skill Will:
1. Summarize client status, open commitments, and recent activity
2. Surface key talking points for upcoming interactions
3. Flag stale or at-risk items
4. Learn from your feedback to improve future output

Run `/agency-ops:onboarding` first to set up your agency context.
