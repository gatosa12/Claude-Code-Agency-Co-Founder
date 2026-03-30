---
name: agency-ops:follow-up
description: Process meeting notes into action items, draft follow-up email, and update client file
argument-hint: "<client-name>"
disable-model-invocation: true
---

## Follow-Up

**Status:** Coming in Phase 2

This skill will process meeting notes into actionable follow-ups by reading:
- `context/agency.md` for agency context
- `context/clients/{client}.md` for client details
- This skill's `learnings.md` for past improvements

### When Ready, This Skill Will:
1. Extract action items from meeting notes
2. Draft follow-up email matching your agency's tone
3. Auto-update the client context file with new commitments
4. Learn from your feedback to improve future output

Run `/agency-ops:onboarding` first to set up your agency context.
