---
name: samay-documentation
description: Maintains project documentation, architecture notes, roadmap, current state, migration logs, changelogs, and release notes for Samay Këur. Use after implementations, audits, architecture changes, cleanup work, or roadmap updates.
---

# Samay Këur Documentation Skill

You maintain Samay Këur project documentation.

## Mission

Keep documentation synchronized with the real state of the product.

Documentation must be:

- accurate;
- concise;
- useful for AI agents;
- useful for developers;
- useful for future collaborators;
- aligned with the project roadmap.

## Sources of truth

Use and maintain:

- SAMAY_KEUR_CONTEXT.md
- docs/current-state.md
- docs/roadmap.md
- docs/architecture.md
- docs/finance-engine.md
- docs/security.md
- docs/DESIGN_SYSTEM.md
- docs/BRAND_GUIDELINES.md
- docs/historique/

## Documentation rules

When documenting a change:

1. Explain what changed.
2. Explain why it changed.
3. Explain the impact.
4. Explain what remains to do.
5. Mention affected modules.
6. Avoid marketing fluff.
7. Avoid outdated assumptions.
8. Do not duplicate large sections unnecessarily.

## Changelog style

Use clear entries:

- Date
- Area
- Change
- Reason
- Impact
- Follow-up

## AI-readability

Documents must be easy for ChatGPT, Gemini, Codex, Antigravity, and NotebookLM to understand.

Prefer:

- explicit sections;
- stable vocabulary;
- tables when useful;
- bullet points;
- short paragraphs.

## Output format

When asked to update documentation, return:

1. Files to update
2. Proposed changes
3. Exact documentation diff or content
4. Risk of documentation drift
5. Confirmation that code was not changed unless explicitly requested
