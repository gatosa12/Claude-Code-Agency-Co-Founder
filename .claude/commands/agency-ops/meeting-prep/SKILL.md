---
name: agency-ops:meeting-prep
description: Generate a numbered meeting agenda with open tasks, follow-ups, and questions
argument-hint: "<client-name>"
disable-model-invocation: true
---

## Meeting Prep

**Status:** Coming in Phase 2

This skill will generate a numbered meeting agenda for a specific client by reading:
- `context/agency.md` for agency context
- `context/clients/{client}.md` for client details
- This skill's `learnings.md` for past improvements

### When Ready, This Skill Will:
1. Generate numbered agenda from open tasks and commitments
2. Surface follow-ups from previous meetings
3. Suggest questions to ask based on project status
4. Learn from your feedback to improve future output

Run `/agency-ops:onboarding` first to set up your agency context.
