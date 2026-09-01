# Android Balanced compatibility contract

Status: Issue #18 development-only Android Camera2 compatibility probe. This is an engineering contract and diagnostic classification, not production feature gating or user-facing copy.

## Current candidate under validation

Issue #17 selected this current development candidate:

- one manual Camera2 `captureBurst()`;
- three full-resolution JPEG frames at `-2 / 0 / +2 EV`;
- temporary positive-EV shutter ceiling of approximately `1/30 s`;
- ISO redistribution when a positive target needs it;
- one selected rear Camera2 camera at 1x.

These are candidate inputs, not permanent product constants. The probe does not merge HDR, enhance images, define a movement threshold, or create production capture records.

## Development-only architecture

The probe extends `PicchuSpotBalancedPrototype` rather than duplicating its Camera2 preview, AF/AWB baseline, JPEG reader, manual planner, or burst implementation:

    Compatibility Probe route
      -> debug-only Camera2 preview and selected rear camera
      -> static characteristics and public-sensor inventory
      -> existing Issue #17 candidate baseline plus manual burst
      -> app-private compatibility-probe cache JSON and temporary JPEGs
      -> engineering classification only

The implementation is compiled only from Android `debug` sources. Release exposes inert unavailable operations required by autolinking; it opens no camera, writes no report, and executes no burst.

Quick Camera remains Expo Camera based and outside this module. The probe writes no Shoot SQLite rows, Gallery media, persistent user photos, uploads, backend data, telemetry, or analytics.

## Static capability contract

The report records manufacturer, model, Android release/API level, and build fingerprint for diagnostics only. They are never used for camera selection, rules, or classification. When several rear cameras exist, the probe ranks a camera satisfying the actual candidate contract above one that fails it, then breaks ties by hardware level and 4:3 JPEG area. It never uses a manufacturer/model allowlist.

For every independently openable rear camera, the report records camera ID; logical/physical topology; hardware level; `MANUAL_SENSOR`, `BURST_CAPTURE`, RAW, and logical-multi-camera flags; all JPEG sizes; exposure/ISO ranges; zoom range; AE compensation; AF modes; AWB/AE lock support; timestamp source; and gyro/linear-acceleration availability.

| Required rule | Purpose |
| --- | --- |
| Rear Camera2 camera | Any independently openable rear Camera2 camera is eligible; logical-multi-camera advertising is not required. |
| Non-LEGACY hardware level | Baseline Camera2 operation must not depend on legacy-only behavior. |
| `MANUAL_SENSOR` and `BURST_CAPTURE` | Required for the validated manual three-request burst. |
| Advertised 4:3 JPEG output | The runtime session selects its full-resolution JPEG target from actual outputs. |
| Usable manual exposure-time and ISO ranges | The existing planner derives and clamps three requests from the AE baseline. |
| 1x zoom support | Issue #17 validates the candidate at 1x; 0.6x is not a requirement. |
| AF baseline support | Fixed-focus cameras pass; adjustable-focus cameras must advertise AUTO AF for the existing lock attempt. |

Logical/physical multi-camera topology, RAW, AE compensation, AWB/AE lock, active physical camera ID, Camera2 timestamp source, gyroscope, and linear acceleration are diagnostics, not current static blockers. The existing baseline attempts AF/AWB locks only when the device advertises them, and Issue #18 adds no movement enforcement.

## Runtime validation contract

Capability flags alone are insufficient. With a mounted preview on the selected camera, the probe:

1. opens the existing preview plus full-resolution JPEG session;
2. establishes the existing AE/AF/AWB baseline;
3. submits exactly one existing `-2 / 0 / +2 EV` manual `captureBurst()` using the temporary `1/30 s` planner;
4. requires three JPEG results and three JPEG images;
5. requires exact JPEG/result sensor-timestamp pairing, not delivery-order fallback;
6. records request submission order and completion callback order as evidence, without treating callback order as a pass criterion;
7. records requested/actual shutter and ISO, JPEG dimensions/bytes, physical camera ID when exposed, timestamp intervals, burst duration, failures, and timeouts;
8. checks requested/actual shutter and ISO against a development-only 5% relative tolerance.

That tolerance is a probe implementation check, not a photographic-quality criterion or production policy. Raw requested/actual values remain in the JSON for later evidence-based revision.

JSON and temporary JPEGs are app-private cache files under `balanced-compatibility-probe`. The harness displays only the newest filename-prefixed, schema-valid `android-balanced-compatibility-probe` report; it never substitutes an `experiment-*.json`. Cleanup clears only that directory.

## Classification

| Engineering status | Rule | Current behavior |
| --- | --- | --- |
| `FULL_BALANCED` | All required static rules pass and the runtime candidate burst passes. | Compatibility evidence exists for this candidate only; no production UI or gate changes. |
| `LIMITED` | A rear camera exists, but static rules or runtime validation cannot guarantee the candidate. | Quick/import remain available; no unvalidated fallback is invented. |
| `UNSUPPORTED` | No rear Camera2 camera exists for a safe candidate probe. | Quick/import remain unaffected; this is not a generic device-usability judgment. |

The status is intentionally conservative: not a device allowlist, product entitlement, image-quality score, or cross-device promise.

## S25 Ultra measured result

This result is copied only from the local Issue #18 compatibility JSON, `compatibility-921668114148153.json`, captured at `2026-09-01T10:41:25.576Z`; it is not reconstructed from Issue #17 evidence. The run was a stable, normally lit handheld validation on the physical device.

| Evidence field | Measured result |
| --- | --- |
| Device | Samsung `SM-S938B` (Galaxy S25 Ultra), Android 16 / API 36 |
| Selected rear camera | Camera ID `0`; `LEVEL_3`; logical multi-camera with physical IDs `2`, `5`, `6`, and `7` (topology diagnostic, not a requirement). |
| Static result | Passed: manual sensor, burst capture, 4:3 JPEG, usable exposure/ISO ranges, 1x, and AF baseline support. `REALTIME` timestamp source was recorded diagnostically. |
| Output | 4080 × 3060 JPEG; advertised ISO 12–3200; advertised exposure 83,490–176,037,266 ns; 0.6–10 zoom range. |
| Candidate / planner | Three frames at `-2 / 0 / +2 EV`; temporary positive-EV ceiling 33,333,333 ns (approximately 1/30 s). |
| AF / AWB / AE baseline | AF locked; AWB locked; AE baseline stable. |
| Request/completion order | `[0, 1, 2]` / `[0, 1, 2]`; all result-to-JPEG pairs used sensor timestamps. |
| Active physical camera | `5` for all three frames (an observed HAL result, not a lens-name promise). |
| Burst timing | 945.213 ms total; sensor intervals 71.722 and 100.346 ms; completion intervals 232.494 and 223.492 ms. |
| Classification | `FULL_BALANCED`; no runtime failures. |

| Index / EV | Requested → actual shutter | Requested → actual ISO | JPEG bytes | Correlation |
| --- | --- | --- | --- | --- |
| 0 / -2 | 4,995,662 → 4,995,662 ns | 278 → 277 | 4,424,862 | `sensor-timestamp` |
| 1 / 0 | 19,982,648 → 19,982,648 ns | 278 → 277 | 4,940,413 | `sensor-timestamp` |
| 2 / +2 | 33,333,333 → 33,333,333 ns | 667 → 664 | 3,765,262 | `sensor-timestamp` |

All three delivered JPEGs were 4080 × 3060 and met the development-only 5% requested-versus-actual shutter/ISO tolerance. The app kept this JSON and the four temporary JPEGs (one AE baseline plus three candidate frames) only in its app-private compatibility-probe cache; it creates no Shoot/SQLite/Gallery/upload record.

### Corrected-contract S25 rerun

After the selection, timestamp-source, completion-order, and evidence-reader corrections, a second stable local run produced schema-valid `compatibility-923268670003688.json` at `2026-09-01T11:08:06Z`. It remained `FULL_BALANCED` on selected rear camera `0`, with request/completion evidence `[0, 1, 2]` / `[0, 1, 2]`, three 4080 × 3060 JPEGs, and three required `sensor-timestamp` associations. Completion order is recorded here as device evidence, not as a compatibility pass condition.

| Index / EV | Requested → actual shutter | Requested → actual ISO | JPEG bytes | Correlation |
| --- | --- | --- | --- | --- |
| 0 / -2 | 4,995,662 → 4,995,662 ns | 315 → 313 | 4,039,692 | `sensor-timestamp` |
| 1 / 0 | 19,982,648 → 19,982,648 ns | 315 → 313 | 4,462,551 | `sensor-timestamp` |
| 2 / +2 | 33,333,333 → 33,333,333 ns | 755 → 751 | 3,776,682 | `sensor-timestamp` |

The rerun reported a 1,227.798 ms manual-burst duration, 121.701/160.554 ms sensor intervals, 312.078/258.495 ms completion intervals, physical camera `5` for all frames, and no failure. Its selected camera reported `REALTIME` as a diagnostic timestamp source; this did not participate in the static pass.

## Facts, API guarantees, and inference

### Measured facts

Only values copied from generated compatibility JSON are device facts. Preserve selected camera ID, topology, timestamp source, static result, request/completion order, requested/actual controls, JPEG dimensions, sensor correlation, total burst timing, failures, and classification for each acceptance device.

### Android API and device guarantees

Camera2 characteristics advertise supported controls and outputs, and `captureBurst()` returns per-request callbacks. They do not guarantee every shutter/ISO combination, callback order, timing, physical-camera routing, application correlation correctness, thermal stability, or image quality. Timestamp source identifies a clock domain; it is not required here because the implementation directly correlates each JPEG with its capture result by sensor timestamp. Physical IDs exposed by a logical camera are not marketing lens labels.

### Engineering inference

A `FULL_BALANCED` result means the current candidate executed on one device in one runtime condition. It does not prove merge quality, noise, ghosting resistance, handheld suitability, lifecycle recovery, or production readiness.

## False positives and false negatives

False positives remain possible after thermal load, changed focus/lighting, lifecycle interruption, HAL updates, or image-quality/merge evaluation. Timestamp pairing proves source association, not alignment or merge quality. Remote labs can prove contract execution without proving a physically handled real-estate image is acceptable.

False negatives can arise from temporary permission, camera-service contention, lifecycle timeout, or environmental setup. Keep failed JSON evidence; retry only after recording the original result and identifying an environmental cause. Do not silently upgrade a classification.

## Emulator and representative real-device procedure

Emulators may validate UI, navigation, permission, lifecycle, orientation, and local-cache behavior. Emulator camera behavior is not evidence that the Camera2 candidate is physically compatible.

For a remote or borrowed real device:

1. Install the same Android development build and open **Account → Balanced compatibility probe**.
2. Grant Camera permission, wait for preview, then inspect static capabilities.
3. Allow a remount if the probe selects a different rear camera.
4. Run the runtime validation once in a stable, normally lit scene.
5. Read and retain the generated JSON before clearing cache.
6. Record device/build identity, class, static reasons, requested/actual values, timing, correlation, and failures.
7. Run Quick separately. Remote execution does not prove photographic quality.

Samsung Remote Test Lab should cover recent and older Galaxy S flagships, Galaxy FE, and Galaxy A-series classes where available. Other real-device clouds, borrowed devices, or beta devices should cover Pixel flagship/midrange, Xiaomi/Redmi, OnePlus/Oppo, Motorola, an older flagship, and a low/mid-range device. This is a HAL-diversity matrix, not exhaustive model coverage.

If a remote Galaxy S25 Ultra is available, compare broad static shape, class, and runtime evidence with the local S25 result. Do not claim remote image-quality equivalence.

## Exact next production step

After multiple representative real devices have produced reports, create a separately approved production-design proposal for evidence-driven candidate gating without model allowlists. It must separately address persistent CaptureSet/ExposureAsset ownership, lifecycle recovery, image-quality/merge validation, limited-device UX, telemetry/privacy, and iOS. None of those production changes are implemented here.
