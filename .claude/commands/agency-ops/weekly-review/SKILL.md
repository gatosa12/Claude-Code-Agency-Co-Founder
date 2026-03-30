---
name: agency-ops:weekly-review
description: Cross-client summary of what happened, what is due, what is at risk
disable-model-invocation: true
---

## Weekly Review

**Status:** Coming in Phase 2

This skill will produce a cross-client summary of your agency's status by reading:
- `context/agency.md` for agency context
- `context/clients/*.md` for all client details
- This skill's `learnings.md` for past improvements

### When Ready, This Skill Will:
1. Read all client files and produce cross-client summary
2. Flag stale client files (14+ days without update)
3. Surface forgotten commitments and upcoming deadlines
4. Learn from your feedback to improve future output

Run `/agency-ops:onboarding` first to set up your agency context.
