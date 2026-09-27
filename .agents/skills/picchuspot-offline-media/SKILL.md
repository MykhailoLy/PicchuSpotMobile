---
name: picchuspot-offline-media
description: Implement or review PicchuSpotMobile Shoot/photo persistence, import, delete, draft instructions, CaptureSet ownership, interruption recovery and local upload-queue boundaries. Use for SQLite/filesystem durability or local order-preparation state, not camera optics, visual-only changes or unauthorized backend writes.
---

# PicchuSpot offline media

Read [AGENTS.md](../../../AGENTS.md), [capture model](../../../docs/capture-model.md) and [product architecture](../../../docs/product-architecture.md). Read actual implementations before treating a design document as current behavior. Do not expand a local task into server integration.

## Trace ownership first

Inspect `src/lib/local-files.ts`, `src/lib/local-shoots.ts`, the calling screen/hook and any existing migrations. Identify what is owned by the Shoot, what is an imported original, what is temporary cache and what is a reference/annotation/deliverable. Record the success boundary and every failure between receiving bytes and showing saved UI.

SQLite remains the local metadata authority; persistent app document storage owns media binaries. Do not introduce a parallel JSON metadata database. A diagnostic JSON report is evidence, not a second production Shoot store. Never make login or network availability a prerequisite for local capture/import.

## Implement only the approved state change

- Copy/import into an owned persistent destination before accepting the asset as durable. Do not treat a picker URI or a camera-cache URI as a durable source without checking its ownership/lifetime.
- Treat file I/O and database changes as separate failure boundaries. A SQLite transaction alone does not roll back external files. Preserve existing rollback behavior; add recovery/journaling or schema migrations only when in the approved task.
- For an approved CaptureSet change, separate a visible Photo from its ExposureAssets. Preserve existing Quick/import data, stable IDs and ordering; state how interrupted/partial sets are handled instead of silently presenting them as complete.
- Scope deletion and cleanup to verified app-owned paths and entity IDs. Do not delete Gallery originals, another Shoot, customer references or all app data to repair a test. Cleanup must not race an active save/capture.
- For approved draft-service work, keep selection, instructions and markup distinct from the original photo. Verify the existing behavior for defaults, per-photo overrides and submitted snapshots; propose changes explicitly rather than silently reinterpreting old orders.

## Test the failure boundaries

Use isolated, identified test fixtures and the available repository test tools. Cover copy failure, database failure, partial write, low storage, duplicate command, interruption between steps, repeat startup, delete failure, missing file, invalid ownership path and migration from the previous schema when relevant.

An exception-path test does not prove recovery after process termination. Separate unit/fixture results from real app termination/reopen evidence. Check iOS sandbox/path behavior on a real iOS build before claiming Android persistence evidence applies to both platforms.

Do not delete the only evidence before verification. Retain small sanitized run records with build/contract identity; keep personal interior photos and customer data out of committed fixtures and external tools unless explicitly authorized.

## Future sync and orders are a protected boundary

Before any authorized server-backed work, read the current implementation in `MykhailoLy/real-estate-visual-studio`. Reuse its identities, service definitions, authorization, upload and order semantics. Do not insert production orders directly into Supabase, duplicate prices locally, embed secrets, or equate a local success flag with a completed payment.

A queue design must account for retry/idempotency, account changes, ownership and confirmed remote completion before local deletion. These are review questions, not permission to implement sync or pick a new backend. Missing server access or unclear ownership is a blocker to that integration, not a reason to invent a contract.

## Handoff

Run `$picchuspot-mobile-verification`. State touched entities, owned paths, migration/recovery behavior, negative tests, actual device results and remaining limits. Never promise survival after uninstall merely because process-restart tests passed.

Project-specific provenance: [agent skills](../../../docs/agent-skills.md).
