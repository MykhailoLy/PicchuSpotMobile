---
name: stop-slop
description: "Review or draft user-facing prose, posts, captions, articles, marketing copy and messages to reduce formulaic AI phrasing while preserving voice and facts. Do not invoke for code-only tasks."
metadata:
  source: https://github.com/hardikpandya/stop-slop
  license: MIT
  adapted: "Editorial guardrails for cross-project use"
---

# Stop Slop

## Scope and precedence for this installation

This is an **adaptation** of Hardik Pandya's Stop Slop skill for use across different repositories.
Use it selectively for human-facing prose: social posts and replies, marketing copy, emails, articles,
landing-page copy, and conversational documentation. Do not apply it to source code, exact API or
schema identifiers, logs, commands, tests, or technical strings simply to satisfy a writing rule.

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

**Attribution:** Adapted from [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop), MIT.
The supporting reference files are reproduced from the source. See [LICENSE](LICENSE).

Eliminate predictable AI writing patterns from prose.

## Core Rules

1. **Cut filler phrases.** Remove throat-clearing openers, emphasis crutches, and all adverbs. See [references/phrases.md](references/phrases.md).

2. **Break formulaic structures.** Avoid binary contrasts, negative listings, dramatic fragmentation, rhetorical setups, false agency. See [references/structures.md](references/structures.md).

3. **Use active voice.** Every sentence needs a human subject doing something. No passive constructions. No inanimate objects performing human actions ("the complaint becomes a fix").

4. **Be specific.** No vague declaratives ("The reasons are structural"). Name the specific thing. No lazy extremes ("every," "always," "never") doing vague work.

5. **Put the reader in the room.** No narrator-from-a-distance voice. "You" beats "People." Specifics beat abstractions.

6. **Vary rhythm.** Mix sentence lengths. Two items beat three. End paragraphs differently. No em dashes.

7. **Trust readers.** State facts directly. Skip softening, justification, hand-holding.

8. **Cut quotables.** If it sounds like a pull-quote, rewrite it.

## Quick Checks

Before delivering prose:

- Any adverbs? Kill them.
- Any passive voice? Find the actor, make them the subject.
- Inanimate thing doing a human verb ("the decision emerges")? Name the person.
- Sentence starts with a Wh- word? Restructure it.
- Any "here's what/this/that" throat-clearing? Cut to the point.
- Any "not X, it's Y" contrasts? State Y directly.
- Three consecutive sentences match length? Break one.
- Paragraph ends with punchy one-liner? Vary it.
- Em-dash anywhere? Remove it.
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

Below 35/50: revise.

## Examples

See [references/examples.md](references/examples.md) for before/after transformations.

## License

MIT
