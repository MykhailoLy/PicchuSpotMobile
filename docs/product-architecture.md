# PicchuSpot Mobile Product Architecture

## Purpose

PicchuSpot Mobile is an offline-first companion app for real-estate property capture and ordering.

The app should let a user create a property shoot, capture or import media, organize that media locally, then turn selected photos into PicchuSpot service orders.

The mobile app is not a second PicchuSpot backend.

## System boundary

### Mobile owns

- local shoot creation
- local property metadata
- local imported/captured media
- capture preferences
- offline persistence
- future upload/sync queue
- mobile navigation and order preparation UX

### Existing PicchuSpot web/backend owns

Repository: `MykhailoLy/real-estate-visual-studio`

- authentication
- service catalog/source IDs
- order drafts
- upload authorization
- order submission/finalization
- server-authoritative pricing
- payments
- order statuses
- client jobs
- deliverables
- legal/consent rules

Before implementing a server-backed mobile feature, inspect the current web/backend implementation rather than recreating its logic.

## Current local architecture

Target local architecture:

~~~text
SQLite
  shoots
  shoot_assets
  future capture_sets
  future exposure_assets
  future upload_jobs

Document storage
  picchuspot/
    shoots/
      <shoot-id>/
        <owned image files>
~~~

SQLite is the single source of truth for local metadata.

The filesystem stores binary media.

Do not keep a parallel `manifest.json` metadata store.

## Core user flow

~~~text
Shoots
  -> New Shoot
  -> Property details
  -> Capture / Import
  -> Shoot gallery
  -> Select photos
  -> Assign one or more services
  -> Configure service-specific options
  -> Review order
  -> Authenticate if required
  -> Server quote / submit / payment
  -> Orders
  -> Deliverables
~~~

Local capture/import must work before authentication.

Authentication becomes necessary when server-owned identity, pricing, sync, submission, payment, order status, or deliverables are needed.

## Navigation

Persistent top-level destinations:

- Shoots
- Orders
- Account

New-shoot, gallery, capture, service configuration, and review screens should live outside the tab navigator when they represent a focused task flow.

## Local shoot lifecycle

A local Shoot should support:

- create
- list
- reopen
- rename
- delete
- add imported media
- add captured media later
- remove media
- preserve ordering
- survive app restart

Deletion must only remove files owned by that shoot.

## Order preparation model

A single user-visible photo may receive more than one service.

Example:

~~~text
Photo A
  - Image Enhancement
  - Virtual Staging
~~~

Batch assignment should be possible for services that commonly apply to multiple images.

Service-specific option schemas should eventually follow the existing PicchuSpot order system rather than inventing mobile-only fields.

## Server integration rules

When integration begins:

1. Reuse existing PicchuSpot authenticated API contracts where suitable.
2. Keep pricing server-authoritative.
3. Preserve existing draft/submission idempotency and finalization semantics.
4. Use authorized/signed upload flows rather than writing directly to storage.
5. Do not trust mobile-supplied ownership, price, role, or user identity.
6. Keep retryable local upload state so capture is never blocked by network availability.

## Design direction

PicchuSpot Mobile should remain visually consistent with the website while being optimized for on-site property work.

Brand contract:

- Deep Navy `#071A2B`
- Warm Ivory `#F4EFE8`
- PicchuSpot Gold `#C7A94E`
- Soft Line `#DED3C6`
- white default surface

Use photography as the main visual content.

Prioritize clarity, large touch targets, readable status, and reliable one-handed navigation.

## Development phases

### Phase 1 - Local foundation

- persistent shoots
- persistent imported photos
- reopen/rename/delete
- stable gallery
- no server dependency

### Phase 2 - Capture foundation

- capture settings
- camera shell
- grid
- zoom
- timer
- orientation guidance
- capture data model

### Phase 3 - Native multi-exposure capture

- physical-device validation
- Quick / Balanced / Pro
- CaptureSet / ExposureAsset persistence
- interruption recovery

### Phase 4 - Order preparation

- photo selection
- service assignment
- service options
- notes/references/markup
- review

### Phase 5 - PicchuSpot backend integration

- auth
- draft sync
- uploads
- server quote
- submit/payment
- order statuses
- deliverables

## Current WIP warning

The current `wip/local-photo-storage` branch contains both:

- a newer SQLite + filesystem local model
- an older `manifest.json`-based path in `shoot-media.tsx`

These must be consolidated before further feature work.

The SQLite + filesystem model is the target.
