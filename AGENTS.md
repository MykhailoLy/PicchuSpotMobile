# PicchuSpot Mobile Agent Instructions

## Expo SDK

Expo SDK 57 has changed. Before using Expo APIs, read the exact versioned documentation for SDK 57 rather than relying on memory:

https://docs.expo.dev/versions/v57.0.0/

## Project

PicchuSpotMobile is the mobile companion application for PicchuSpot.

Mobile repository:

`MykhailoLy/PicchuSpotMobile`

Existing PicchuSpot web/backend repository:

`MykhailoLy/real-estate-visual-studio`

Production website:

`https://picchuspot.com`

Technology:

- React Native
- Expo SDK 57
- Expo Router
- TypeScript
- SQLite for local metadata
- app document storage for local media

## Product boundary

The existing PicchuSpot web application and backend are the source of truth for:

- authentication
- service definitions
- order drafts
- order submission/finalization
- upload APIs and storage rules
- pricing and discounts
- payments
- order statuses
- client jobs and deliverables
- legal/consent rules

Do not create a parallel mobile backend.

Do not duplicate pricing calculations in React Native.

Do not insert production orders directly into Supabase from the mobile app.

When mobile integration work reaches server-backed features, inspect the current implementation in `MykhailoLy/real-estate-visual-studio` first and reuse its contracts wherever possible.

## Git workflow

For a new task:

1. Start from the latest requested base branch.
2. Create one focused branch.
3. Make only task-related changes.
4. Run required validation.
5. Commit and push the branch.
6. Open one pull request into the requested base branch.
7. Do not merge unless the user explicitly asks.

If the task explicitly says to continue an existing WIP branch, continue that branch or branch from it rather than restarting from `main`.

Do not overwrite unrelated user changes.

## Local-first architecture

Property capture must work without a network connection.

Use:

- SQLite as the single source of truth for local shoot/media metadata.
- Expo app document storage for persistent local image binaries.

Do not maintain a second metadata database in `manifest.json` or another parallel persistence format.

Imported/captured files must survive:

- screen navigation
- app backgrounding
- app restarts

Deleting a photo must remove both its metadata and its owned local file.

Deleting a shoot must clean up its owned local media without touching unrelated files.

Future upload/sync should be modeled as a queue layered on top of the local model, not as a prerequisite for capture.

## Capture model

Treat one user-visible property photo separately from the raw exposures that may create it.

Future native capture should support a model equivalent to:

- Shoot
- Photo
- CaptureSet
- ExposureAsset

Do not hard-code Balanced or Pro bracket counts until they are validated on physical devices.

Quick may use a single exposure. Balanced and Pro are intended for multi-exposure capture, but exact counts and EV spacing require device testing.

Do not implement native bracket capture unless the task explicitly requests it.

## UX direction

PicchuSpot Mobile should feel like the mobile extension of the PicchuSpot brand, not a copy of another product.

Primary navigation:

- Shoots
- Orders
- Account

Core capture flow:

- Shoots
- New Shoot
- Property details
- Capture / Import
- Shoot gallery
- Select photos for order
- Assign services
- Configure service options
- Review
- Authenticate/sync when required

Local capture should not be blocked by authentication.

Keep the UI:

- clean
- premium
- editorial
- photo-led
- mobile-first
- accessible

Avoid generic SaaS card grids, excessive decoration, unnecessary gradients, and noisy animations.

Competitor screenshots are UX references only. Do not reproduce competitor branding, artwork, layouts, copy, or proprietary visual assets.

## Brand

The current web design-system contract is:

`MykhailoLy/real-estate-visual-studio/docs/BRAND-PALETTE.md`

Use these fixed brand colors:

- Deep Navy: `#071A2B`
- Warm Ivory: `#F4EFE8`
- PicchuSpot Gold: `#C7A94E`
- Soft Line: `#DED3C6`
- Default light surface/background: `#FFFFFF`

Gold is an accent and should not be used as normal-size body text on white.

If another older file contains different navy/gold values, prefer the current `docs/BRAND-PALETTE.md` contract.

## Protected systems

Do not modify these unless the task explicitly requires it and the user has approved the risk:

- production Supabase schema or data
- RLS policies
- order submission/finalization
- production upload APIs or storage paths
- pricing logic
- payments
- authentication contracts
- environment variables
- secrets
- transactional email
- production deployment

Never expose service-role keys, API secrets, tokens, private environment values, or customer data.

## Task-specific agent skills

Use the matching repo-local workflow; do not load all skills for every task:

- Native screen/component design, gallery UI, forms or accessibility: [picchuspot-mobile-ui](.agents/skills/picchuspot-mobile-ui/SKILL.md).
- Build/compiler/Metro/ADB problems, native camera bugs or measured performance: [picchuspot-mobile-debugging](.agents/skills/picchuspot-mobile-debugging/SKILL.md).
- Shoot/photo filesystem and SQLite ownership, recovery or local draft state: [picchuspot-offline-media](.agents/skills/picchuspot-offline-media/SKILL.md).
- Change/PR acceptance and handoff: [picchuspot-mobile-verification](.agents/skills/picchuspot-mobile-verification/SKILL.md). Docs/skill-only changes use its documentation checks, not a claim of native verification.

Read these files directly if the client has no skill selector. Skills remain subordinate to the task's scope, these repository rules and higher-priority instructions; they do not authorize production writes, new services, destructive cleanup or merging. Keep reviews read-only unless fixes are requested.

Source selection, usage and unexecuted client acceptance prompts: [Agent skills](docs/agent-skills.md).

## Code quality

Preserve the existing Expo Router structure and current design direction.

Reuse existing components, helpers, types, and persistence functions before creating duplicates.

Keep TypeScript types explicit.

Avoid `any` unless unavoidable and documented.

Do not disable lint rules or suppress TypeScript errors merely to pass validation.

For filesystem/database operations, handle partial failure so metadata and owned files do not silently diverge.

## Required validation

Before completing a coding task, run:

~~~bash
npm.cmd run lint
npx.cmd tsc --noEmit
npx.cmd expo-doctor@latest
~~~

If the execution environment is not Windows, use the equivalent `npm`/`npx` commands.

Do not report a check as passed unless it actually completed successfully.

## Device verification

For capture, image-picker, filesystem, camera, or native behavior, automated checks are not enough.

Clearly state what still requires verification on a physical Android/iOS device.

## Final report

Always include:

1. Summary
2. Exact implementation
3. Files changed
4. Diff statistics (files changed, additions, deletions)
5. Lint result
6. TypeScript result
7. Expo Doctor result
8. Device verification still required
9. Protected/production systems touched
10. Risks or deferred work
11. Commit hash
12. Pull request link
13. Confirmation that the PR was not merged
