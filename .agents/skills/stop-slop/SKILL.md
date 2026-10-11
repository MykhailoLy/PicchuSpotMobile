---
name: stop-slop
description: "Draft, edit or review English-language prose, social posts, captions, marketing copy or messages to reduce formulaic AI phrasing while preserving factual meaning and voice. Not for code or non-English prose."
metadata:
  source: https://github.com/hardikpandya/stop-slop
  source_revision: "8da1f030185bdfe8471220585162991eaeb970e9"
  license: MIT
  adapted: "Editorial guardrails for cross-project use"
---

# Stop Slop

## Scope and precedence for this installation

This is an **adaptation** of Hardik Pandya's Stop Slop skill for use across different repositories.
Use it selectively for **English-language** human-facing prose: social posts and replies, marketing
copy, emails, articles, landing-page copy, and conversational documentation. The pattern checks are
English-specific; for non-English writing, use suitable language-specific guidance instead.
Do not apply it to source code, exact API or schema identifiers, logs, commands, tests, or technical
strings simply to satisfy a writing rule.

**Project instructions, verified facts, the author's intent, accuracy, accessibility, and the target
platform's requirements take precedence over this skill.** Never invent personal experience,
customer results, statistics, testimonials, or product claims to make text sound more natural.
Do not insert intentional typos or force controversy. Preserve quotes, precise legal wording,
brand terminology, and meaningful distinctions.

The categorical wording in the original rules below is a *diagnostic heuristic*, not a blanket
ban. Keep a helpful adverb, passive construction, question opener, em dash, three-part list,
or honest "X, not Y" contrast when it improves clarity, accuracy, rhythm, or authentic voice.
Do not rewrite strong natural wording just to meet a pattern checklist or numeric score.

**Workflow:** Draft for the user's audience and purpose; check for formulaic AI phrasing;
revise only the affected parts; verify facts and voice; return the clean result. For Threads
and Reddit, prefer a natural conversation over a sales pitch, and comply with community norms.
The skill does not authorize automated posting, replies, or any external account action.

**Attribution:** Adapted from [hardikpandya/stop-slop at 8da1f030185b](https://github.com/hardikpandya/stop-slop/tree/8da1f030185bdfe8471220585162991eaeb970e9), MIT.
The skill and reference material are modified to preserve meaning and factual qualifiers; see [LICENSE](LICENSE).

Eliminate predictable AI writing patterns from prose.

## Core Rules

1. **Cut filler phrases.** Remove throat-clearing openers, empty emphasis and unnecessary adverbs. Preserve informative qualifiers. See [references/phrases.md](references/phrases.md).

2. **Break formulaic structures.** Review mechanical contrasts, negative listings, dramatic fragmentation, empty rhetorical setups and confusing agency. Keep meaningful contrasts. See [references/structures.md](references/structures.md).

3. **Prefer clear agency.** Use active voice when it reveals who acted. Keep natural passive voice when the actor is unknown, irrelevant or deliberately backgrounded. Natural metaphors are fine.

4. **Be specific.** No vague declaratives ("The reasons are structural"). Name the specific thing. No lazy extremes ("every," "always," "never") doing vague work.

5. **Be concrete.** Favor specific experience over vague generalizations. Do not force "you" into every sentence.

6. **Vary rhythm.** Mix sentence lengths and paragraph endings. Three-item lists and em dashes are acceptable where they improve communication.

7. **Trust readers.** State facts directly. Skip softening, justification, hand-holding.

8. **Avoid manufactured quotables.** Keep concise, memorable wording if it genuinely expresses the author's point.

## Quick Checks

Before delivering prose:

- Any filler adverbs? Remove those adding no meaning; retain factual degree or uncertainty.
- Any passive voice obscuring a relevant actor? Name the actor when known.
- Confusing false agency ("the decision emerges")? Clarify who acted when relevant.
- Empty Wh- opener? Restructure only formulaic setups; keep genuine questions.
- Any "here's what/this/that" throat-clearing? Cut to the point.
- Repetitive "not X, it's Y" contrast? Keep it if the distinction itself is useful.
- Monotonous run of similarly sized sentences? Vary rhythm if helpful.
- Each paragraph ends in a forced punch line? Break the pattern.
- Overused em dashes? Replace only those that hurt clarity.
- Vague declarative ("The implications are significant")? Name the specific implication.
- Narrator-from-a-distance ("Nobody designed this")? Put the reader in the scene.
- Meta-joiners ("The rest of this essay...")? Delete. Let the essay move.

## Scoring

Rate 1-10 on each dimension:

| Dimension | Question |
|-----------|----------|
| Directness | Statements or announcements? |
| Rhythm | Varied or metronomic? |
| Trust | Respects reader intelligence? |
| Authenticity | Sounds human? |
| Density | Anything cuttable? |

Below 35/50: consider improving weak dimensions. Do not rewrite accurate natural prose solely to improve the score.

## Examples

See [references/examples.md](references/examples.md) for before/after transformations.

## License

MIT
