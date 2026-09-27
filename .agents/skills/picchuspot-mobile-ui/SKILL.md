---
name: picchuspot-mobile-ui
description: Build or refine PicchuSpotMobile React Native/Expo screens, navigation, branded components, gallery selection, settings and service forms. Use for mobile UI implementation or visual/accessibility review, not Next.js pages, camera-engine fixes or unapproved backend integration.
---

# PicchuSpot mobile UI

Read [AGENTS.md](../../../AGENTS.md) first. This workflow does not expand the task's permissions or scope. Implementation requires an implementation request; a review stays read-only.

## Establish the screen contract

- Inspect the actual screen, adjacent routes, shared components, `package.json` and `app.json`. Use the installed Expo SDK's versioned documentation, not a marketplace example or `latest` API by default.
- Preserve Expo Router and the current styling approach. Do not import web DOM, shadcn, browser CSS or a new styling library into native screens. Do not migrate working components merely to match an upstream skill's preferences.
- Read [product architecture](../../../docs/product-architecture.md) and [capture model](../../../docs/capture-model.md). Distinguish implemented behavior from future design notes and unmerged proposals.
- State the user's primary task, the data source, the save boundary and the minimum change. Read-only review should identify concrete file/behavior evidence, not speculative redesign opportunities.

## Design inside the existing brand

Use the brand contract in AGENTS and existing tokens; inspect `src/constants/theme.ts` and `src/features/camera/quick-camera-theme.ts`. Do not silently adopt old scaffold colors or introduce a second theme. Flag conflicts and change only the scoped values.

Keep the photography dominant. Give the screen one clear primary action, readable text, restrained decoration and consistent spacing. Keep navy/ivory/gold; gold is not normal-size text on white. Reuse existing fonts and components rather than importing a catalog palette or a new font.

Use native interactions appropriate to each platform. Keep `StyleSheet` where the project uses it. Inspect already-installed `@expo/ui` before adding a new dependency, but adopt a component only after verifying its installed-version API, Android/iOS behavior, accessibility and fit with the existing screen. A skill is not a library-migration mandate.

## Make the task work, not just the screenshot

- Keep Shoots / Orders / Account navigation. Respect the current portrait screens and explicitly configured camera orientation exceptions; do not change global orientation for a layout fix.
- Handle safe areas without double insets, keyboard overlap, system Back, dismiss and draft preservation. Use current window geometry rather than fixed S25 pixels.
- Model relevant loading, empty, error, content, saving and retry states. An enabled control must perform its labelled action; never use a success alert as a substitute for saving.
- For galleries, preserve image aspect ratio, stable identity and ordering. Use thumbnail-sized rendering and virtualized lists when the data size requires them; do not nest a long same-direction list in a ScrollView. Measure before replacing a working list implementation.
- Keep one visible Photo separate from its bracket sources. Excluding an image from an order must not delete it from the Shoot. Notes, references and markup must not overwrite source images.
- For an approved service-form task, distinguish capture preferences, editing defaults, per-photo overrides and submitted instructions. Confirm allowed fields/combinations against the existing web/backend contract before server integration; do not copy competitor prices, wallet rules or delivery promises.

## Accessibility and acceptance

Prefer a 48-logical-unit hit area for new shared controls as a project design target. Supply accessible labels, roles and selected/disabled/busy states, including icon-only actions. Do not communicate errors or selection through color alone. Allow text scaling and reflow rather than disabling scaling to fit a design.

Exercise long property names, missing images, an empty Shoot, keyboard-open forms, larger system text and both supported platforms where available. A browser preview does not prove native interaction or physical camera behavior.

Finish with `$picchuspot-mobile-verification` for implementation changes. Report the screen/task, changed files, actual screenshots or interaction evidence, the failure path checked and untested device/platform states. Do not declare a layout physically verified from code inspection.

Selection rationale and source boundaries: [agent skills](../../../docs/agent-skills.md).
