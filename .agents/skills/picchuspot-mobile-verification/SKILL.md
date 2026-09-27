---
name: picchuspot-mobile-verification
description: Verify a PicchuSpotMobile change or PR with scope-appropriate static checks, tests, native builds, Android/iOS UX and device evidence. Use before handoff of mobile code/config changes and for explicit QA/review; for documentation or skill-only changes validate the files without claiming native tests ran.
---

# PicchuSpot mobile change verification

Read [AGENTS.md](../../../AGENTS.md). This is the acceptance workflow, not implementation or release authorization. A requested review is read-only; do not commit fixes or merge unless explicitly requested. Device tests must use authorized test data, not destructive operations on the owner's existing Shoots.

## Identify what changed

Record exact base/head, worktree state, changed paths and diff statistics. Separate application code, native module/config/dependency changes, storage/migrations, service integration, and documentation-only changes. Inspect the actual diff and open review threads; a mergeable PR and an empty status list do not mean CI passed.

If unexpected files, credentials or production contract changes appear, stop the handoff and explain them. Preserve unrelated work. Do not claim unmerged audit recommendations are approved requirements.

## Choose evidence for the scope

| Change | Required acceptance evidence |
| --- | --- |
| Docs / agent skills only | Frontmatter/YAML parse where applicable; names/paths/local links; diff/whitespace; no unexpected runtime files; distinguish instructions from executed checks. No claim that application tests ran. |
| TypeScript / native UI | Repository-required lint, typecheck and Expo Doctor; relevant existing tests; manual/native interaction checks for the changed task. Do not substitute browser screenshots for native behavior. |
| Kotlin / native config / dependency | Applicable debug and release module/app builds from the current source; install/use the intended artifact; affected physical regression; verify CNG and identifiers. JS export alone is not a native compile. |
| Camera / persistence | Relevant deterministic failure fixtures plus physical capture/import/restart/ownership tests. Record exact device/build and separate native sensor rotation from display overrides. |
| Approved backend / payment boundary | Current web contract review, isolated test environment, authorization/ownership/idempotency and failure tests; no production writes or live charges implied by a mobile task. |

For coding tasks use the commands required by AGENTS: `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npx.cmd expo-doctor@latest` on Windows, or host equivalents. Discover actual scripts before using them: no `build`/`test` script is not a passed test and not itself a compiler failure. Never install a test framework or suppress checks just to produce a green report without task justification.

Use the existing Gradle/Expo workflow with an explicit working directory. Differentiate compile, APK assembly, installation, runtime acceptance and signing/store readiness. Do not publish to EAS/App Store/Google Play, start paid builds, update credentials or change environments under a verification instruction alone.

## Native UX checklist

For the affected screen, check primary action plus one failure/recovery path; loading vs empty; safe areas; keyboard-open action access; system Back/dismiss; draft retention; long names; missing images; text scaling; accessible labels/roles/state and adequate touch targets. Check both platforms only if tested; otherwise label the untested platform.

For camera/native changes, select applicable Quick regression steps: preview, portrait 3:4, both real landscape 4:3 orientations, upright output, one real saved capture, count/order, Done/Back restoring portrait, restart persistence and scoped cleanup. Do not retest every historical case for a text-only change, but do not waive a relevant check merely because the Quick source file was unchanged.

For debug diagnostics, inspect release source and the appropriate built artifact for the diagnostic classes/entry paths. Scope the bytecode claim to the custom diagnostic implementation: the whole app may legitimately contain camera APIs through Quick. A release stub must not be mistaken for a working internal QA probe; a Metro-dependent dev build must not be called a standalone beta.

## Report without overstating

For every check use one of: PASS, FAIL, BLOCKED, NOT RUN or NOT APPLICABLE, with a reason. Name the command/artifact/device, not just 'tested'. Keep measured facts, static-review risks, hypotheses and future recommendations separate.

Include issue/branch/head, files/diff, protected-system impact, validation, device results, release-boundary evidence where applicable, unresolved limitations and one next action. If authorized to open/update a PR, use the one task branch and leave it unmerged. Only report an external write after its successful result.

For performance changes include comparable baseline/after measurements via `$picchuspot-mobile-debugging`; for storage use `$picchuspot-offline-media`. Sources and activation checks: [agent skills](../../../docs/agent-skills.md).
