# PicchuSpot Mobile

PicchuSpot Mobile is the mobile companion app for PicchuSpot real-estate media services.

The current focus is a local-first property capture workflow: create a Shoot, import or capture property media, keep it available offline, and prepare it for the existing PicchuSpot order flow.

## Current foundation

Implemented and physically verified on Android:

- Shoots as the primary local entity
- SQLite as the single source of truth for local Shoot and media metadata
- PicchuSpot-owned document storage for imported media
- multi-photo gallery import
- persistent Shoot list with cover image and photo count
- reopen existing Shoots
- rename Shoots
- remove photos without deleting gallery originals
- delete Shoots with scoped cleanup of owned files only
- persistence across navigation and app restarts
- project-specific Android development build with stable native identity
- stable USB-based development-client testing on physical Android

Native camera capture and server-backed order integration are intentionally deferred to later phases.

## Stack

- React Native
- Expo SDK 57
- Expo Dev Client
- Expo Router
- TypeScript
- Expo SQLite
- Expo FileSystem

The existing PicchuSpot web/backend remains the source of truth for authentication, order drafts, uploads, pricing, payments, statuses, deliverables and related production contracts.

## Project structure

```text
src/app/                 Expo Router screens
src/lib/local-shoots.ts  SQLite-backed local Shoot/media metadata
src/lib/local-files.ts   PicchuSpot-owned local media storage
docs/                    Product, capture and persistence architecture notes
scripts/                  Local development helpers
```

Key architecture documents:

- [Product architecture](./docs/product-architecture.md)
- [Capture model](./docs/capture-model.md)
- [Android local persistence testing](./docs/android-local-persistence.md)
- [Competitor UX reference study](./docs/boxbrownie-reference-flow.md)

## Local development

Install dependencies:

```powershell
npm.cmd install
```

Compile and install the development build on a connected Android device:

```powershell
npx.cmd expo run:android --device
```

For subsequent USB development sessions:

```powershell
npm.cmd run android:usb
```

The USB helper discovers an authorized Android device, configures `adb reverse` for port 8082 and starts Metro for the installed PicchuSpot development build using `127.0.0.1`. See [Android local persistence testing](./docs/android-local-persistence.md) for Android SDK setup, first-build steps, rebuild rules and the physical-device persistence checklist.

## Validation

Run before completing a coding task:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npx.cmd expo-doctor@latest
```

For Android bundle validation:

```powershell
npx.cmd expo export --platform android
```

Filesystem, image picker, camera and other native/device behavior must also be verified on a physical device.

## Development direction

Planned next steps:

1. establish the camera foundation;
2. add Quick single-exposure capture;
3. validate Balanced and Pro multi-exposure behavior on physical devices before fixing bracket counts or EV spacing;
4. integrate with the existing PicchuSpot backend contracts for upload, order review, authentication and payment.

Do not create a parallel mobile backend or duplicate server-authoritative pricing logic in the app.

## Protected systems

Changes affecting production Supabase data/schema, RLS, order submission/finalization, upload APIs, pricing, payments, authentication contracts, environment variables, transactional email or production deployment require explicit approval and compatibility review first.

## Related project

Website and production backend: [picchuspot.com](https://picchuspot.com)

Web/backend repository: `MykhailoLy/real-estate-visual-studio`
