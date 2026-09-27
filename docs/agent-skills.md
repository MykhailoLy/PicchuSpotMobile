# PicchuSpotMobile agent skills

Reviewed: **2026-09-27**. Initial code baseline: `37f9895807f6aeb73a60e1d2831608f454bab076`.

## What is installed

Four **original, project-owned workflows**, informed by the reviewed sources below and the existing repository contracts. These are not unmodified official Expo/Callstack packages, do not represent upstream endorsement and do not install the LobeHub marketplace client.

| Skill | Purpose | Explicit invocation |
| --- | --- | --- |
| [Mobile UI](../.agents/skills/picchuspot-mobile-ui/SKILL.md) | Native screens, brand, navigation, forms and accessibility | `$picchuspot-mobile-ui` |
| [Mobile debugging](../.agents/skills/picchuspot-mobile-debugging/SKILL.md) | Compiler/build/Metro/Camera2/lifecycle issues and measured performance | `$picchuspot-mobile-debugging` |
| [Offline media](../.agents/skills/picchuspot-offline-media/SKILL.md) | SQLite/filesystem ownership, failure recovery and local draft boundaries | `$picchuspot-offline-media` |
| [Mobile verification](../.agents/skills/picchuspot-mobile-verification/SKILL.md) | Task-specific checks, native QA, release isolation and truthful handoff | `$picchuspot-mobile-verification` |

The root [AGENTS.md](../AGENTS.md) remains the repository-wide authority under higher-priority instructions. Load only matching workflows, not the entire collection for every question. Skills do not grant credentials, tools, extra permissions, subscriptions or approval for production changes. They do not fix an app simply by being present.

## Discovery and use

Codex documents repository skills in `.agents/skills/<name>/SKILL.md`, with `name` and `description` frontmatter; `agents/openai.yaml` provides optional display/invocation metadata. See [OpenAI skill documentation](https://developers.openai.com/codex/skills/). These files follow that layout without tool dependencies or executable hooks.

After this PR is reviewed and merged, update the local repository normally (first inspect worktree status, preserve local changes, then fast-forward the appropriate branch). Start Codex inside PicchuSpotMobile and inspect its skill selector or use an explicit `$skill-name`. A review on the feature branch can use the files before merge. If the client does not discover them, refresh/restart that session and inspect the client's documented skill support; do not claim they are active solely because GitHub contains the files.

Other agents can read the Markdown through the AGENTS routing section, but their automatic discovery paths may differ. This change does not install a global Claude/Cursor plugin or duplicate the skill bodies under `.claude/skills`.

Examples:

```text
Use $picchuspot-mobile-ui to improve the Shoot Gallery selection UI.
Keep its persistence and capture behavior unchanged.
Finish with $picchuspot-mobile-verification.
```

```text
Use $picchuspot-mobile-debugging for the Kotlin compiler error.
Read the first causal error and current working directory before patching.
```

```text
Use $picchuspot-offline-media to review interruption recovery.
Review only; do not change SQLite, delete photos or create a PR.
```

## Selection record: directory versus original source

The user supplied [LobeHub UI search](https://lobehub.com/ru/skills?q=UI). Its listings and the [Expo Building Native UI entry](https://lobehub.com/skills/expo-skills-building-native-ui) were read for discovery. The current Expo source uses `expo-native-ui`; marketplace names/content can lag upstream. Selection was based on source content and project fit, not star counts or install counts.

| Source reviewed | Version/provenance | Decision |
| --- | --- | --- |
| [Expo native UI](https://github.com/expo/skills/blob/efa52f0a9d2176db75992736281c77da1b714fa3/plugins/expo/skills/expo-native-ui/SKILL.md) | Manifest 1.1.1; declares MIT; blob `8c805803530a67f90585c74a1847b1fe916bf61f` | Useful native UI/behavior reference. Our workflow retains PicchuSpot tokens, existing styling and custom native development builds. |
| [Expo design system](https://github.com/expo/skills/blob/efa52f0a9d2176db75992736281c77da1b714fa3/plugins/expo/skills/expo-design-system/SKILL.md) | Manifest 1.0.0; declares MIT; same pinned Expo revision | Useful existing-theme/component-convention reference. No new token system, automatic platform palette or whole-app migration is introduced. |
| [Expo dev client](https://github.com/expo/skills/blob/efa52f0a9d2176db75992736281c77da1b714fa3/plugins/expo/skills/expo-dev-client/SKILL.md) | Manifest 1.1.0; declares MIT; blob `03607c0bc9585edac6c1c6ac4ed7843a9fca0e02` | Development-build concepts only. Its EAS submit/update/credentials and feedback commands are not imported or authorized. |
| [Callstack React Native best practices](https://github.com/callstackincubator/agent-skills/blob/main/skills/react-native-best-practices/SKILL.md) | Manifest declares MIT; fetched file blob `86ec5ab5a4cadf454db8013293679891098efce1` on review date | Performance reference for scoped investigation. No agent-device, inspector, FlashList, state-management or native-library generator is installed. Verify source/version before later use. |
| [LobeHub UI/UX Pro Max listing](https://lobehub.com/skills/nextlevelbuilder-ui-ux-pro-max-skill-ui-ux-pro-max) | Listing reviewed, not a full source/script/license audit | Not installed. Broad style/palette/stack selection is unnecessary for a fixed-brand native app; this is a fit decision, not a security verdict. |
| Web-only UI listings (Nuxt, MUI, shadcn) | Seen in the supplied UI search | Not selected as native screen implementation rules. No web-to-native migration is requested. |

The selected manifests were reviewed, not every file in their repositories. No upstream code example, complete skill body, asset, script or license text is vendored. These independently written local workflows use the repository's existing license. A future direct import of upstream files must retain its actual license/notices and be reviewed/pinned separately; do not automatically sync from `main` or run a marketplace installer.

Primary local sources are AGENTS, `docs/product-architecture.md`, `docs/capture-model.md`, `docs/android-local-persistence.md`, `docs/camera/*`, the current Quick hook/theme, and SQLite/filesystem helpers. The audit and competitor-guide addendum in PR #21 remain separate, unmerged reference work at creation time. These skills neither merge that PR nor turn its proposals into implementation approval. No PDF, competitor artwork or private photo is copied into this set.

## Deliberate project boundaries

- Keep React Native / Expo / TypeScript, current Router and CNG. Check the installed SDK docs before using APIs. No automatic switch to Flutter, NativeWind, new UI kit or another navigation stack.
- Existing Quick behavior and debug-only Balanced experiments remain distinct. Physical camera acceptance cannot be replaced by an emulator, a screenshot or an API capability flag.
- Local media stays local-first; the existing web/backend owns server contracts and pricing. No generic 'data-fetching' skill is allowed to invent a second backend.
- No upstream auto-feedback submission, remote installer, new cloud account, telemetry, deploy hook, marketplace credentials or repository permission change is included.
- Source guidance informs a task; it cannot bypass its scope, protected systems, consent or explicit no-merge instruction.

## Validation and first-client acceptance

Static validation of the delivered files: four valid SKILL.md frontmatters with unique path-matching names/descriptions; four parseable openai.yaml files with matching explicit prompts; local Markdown links; UTF-8/newline/trailing-whitespace checks; additive AGENTS routing; diff/path allowlist; no runtime or dependency change.

This is **not** a claim that Codex routed a live task correctly or that application tests ran. The following are manual acceptance prompts for the next local Codex session, not already executed evaluations:

| Prompt | Expected workflow / boundary |
| --- | --- |
| Improve gallery selection spacing, no data changes | UI then verification; no persistence rewrite |
| Investigate Gradle compilation failure | Debugging then verification; inspect compiler output, no speculative firewall edits |
| Review interrupted photo save, read-only | Offline media plus verification; no device cleanup or commit |
| Investigate gallery memory growth | Debugging; comparable measurements before any library change |
| Validate a camera PR on S25 | Verification; actual device evidence or an explicit blocked result |
| Adjust this documentation paragraph | Docs-only verification, no native build or camera session |
| Add live payments without an approved contract | Identify protected boundary and missing authorization; do not perform live writes |
| Copy all competitor settings/screens exactly | Reuse approved product concepts, preserve brand and originals; no wholesale copy or scope expansion |

Maintenance: review descriptions after actual missed/incorrect invocations; trim overlap rather than adding a skill for every component. Update sources only through an explicit reviewed change. No additional paid subscription or application runtime dependency is introduced by these text files; using an agent still consumes its existing plan/usage budget.
