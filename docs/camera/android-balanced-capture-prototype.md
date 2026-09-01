# Android Balanced capture prototype

Status: development-only Camera2 comparison harness. Physical acceptance was
completed on the Galaxy S25 Ultra across 2026-08-31 and 2026-09-01. This is not
a production Balanced mode, does not define a product bracket count or EV
spacing, and does not create `Photo`, `CaptureSet`, or `ExposureAsset` records.

## Scope and safety boundary

`PicchuSpotBalancedPrototype` is an Android-local Expo module. Its full Camera2
implementation is compiled only from `android/src/debug`. The release source
set contains only an inert module and native-view stub; it has no Camera2,
`ImageReader`, sensor, JPEG-writing, or capture-burst implementation.

The development harness is reachable only through the `__DEV__` Account link.
It selects logical camera `0` at zoom ratio `1.0` and owns its Camera2 preview;
it never mounts Expo Camera at the same time. The normal Quick Camera route,
Shoot Gallery, local Shoot SQLite model, uploads, and all backend systems are
outside this prototype.

JPEGs are written under the app-private cache subdirectory
`balanced-capture-prototype`. They are visible only to the harness for temporary
thumbnail/full-frame inspection and can be cleared there. They are not added to
the media library, `shoot_assets`, or any queue, and are never uploaded.

## Architecture

```text
Development-only harness route
  -> Expo native view: Camera2 TextureView preview
  -> selected logical camera 0 / zoom 1.0
  -> Camera2 session: preview surface + full-resolution JPEG ImageReader
  -> cache-only frame files + native measurement record
  -> React Native temporary inspection UI
```

The preview selects a practical 4:3 `SurfaceTexture` output. `TextureView`
applies the Camera2 sensor orientation; the prototype applies only the active
Android display rotation and sets the matching `JPEG_ORIENTATION`. The image
source remains the actual Camera2 surface, not a transformed screenshot. The
harness renders a 3:4 viewport in portrait and 4:3 in both landscape
directions without stretching the native surface.

The full-resolution JPEG size is selected at runtime as the largest advertised
4:3 Camera2 JPEG size. The earlier S25 Ultra capability probe recorded
`4080 × 3060` for logical camera `0`; that is a device observation, not a
hard-coded universal value. See
[`android-s25-ultra-camera2-capabilities.md`](android-s25-ultra-camera2-capabilities.md).

## Comparison protocol

### AE sequence

The harness temporarily requests three diagnostic comparison points near `-2`,
`0`, and `+2 EV`. Each point uses Camera2 AE, waits for three consecutive
preview observations with AE/AF/AWB stability and no active-physical-camera
change, then captures one full-resolution Camera2 JPEG. It records the
convergence frame count/time even when a point times out; it does not optimize
away slow AE behavior.

### Manual burst

The successful AE `0 EV` JPEG supplies the temporary manual baseline. The
harness derives approximate `-2 / 0 / +2 EV` intents by varying exposure time
and, when a time target is clamped, ISO. Both values are clamped to the
advertised manual ranges. It explicitly records clamping and does not assume an
AE ISO outside the manual sensitivity range is reproducible.

The three full-resolution JPEG requests are submitted in exactly one Camera2
`captureBurst()` call. This is only a diagnostic three-request set, not a
decision about a final Balanced bracket.

### Focus, white balance, and movement

Before each comparison, the harness establishes a preview baseline. It attempts
temporary AF lock when focusing is supported and attempts AWB lock only when
the characteristic advertises it; success/failure and the actual AF/AWB states
are recorded. AE stays enabled for the AE-sequence strategy.

Timestamped public gyroscope and linear-acceleration samples are collected for
the separate AE-sequence and manual-burst windows. The result includes sample
rates, RMS/peak movement magnitudes, and raw timestamped samples. No movement
threshold or production warning is implemented.

## Per-frame record

Every returned frame includes:

- app-private cache file URI and filename, dimensions, byte size, and JPEG orientation;
- requested controls plus actual exposure, ISO, AE/AF/AWB states, zoom, focal
  length, active physical-camera result, and frame number;
- sensor and completion timestamps, shutter-to-complete timing, completion
  order, and any failure;
- per-strategy sensor timestamp spacing, callback spacing, convergence timing,
  and total duration.

The timestamp source is reported because shutter-to-complete arithmetic is only
directly comparable where the device reports a compatible source. The S25 Ultra
capability spike observed `REALTIME`; that must be re-recorded by this harness
on its own physical test run.

## Required physical evidence

The following sections must be completed only from the development build on the
physical Galaxy S25 Ultra. Do not infer missing values from the earlier
capability probe.

### Device and build

| Field | Measured value |
| --- | --- |
| Device / Android build | Samsung SM-S938B (Galaxy S25 Ultra), Android 16, `BP4A.251205.006.S938BXXSBCZG3`, security patch 2026-07-05 |
| Development build identifier | `com.picchuspot.app` 1.0.0, installed 2026-08-31 20:57 local time |
| Logical camera / zoom | `0` / `1.0` |
| Selected JPEG size | `4080 × 3060` |
| Portrait preview upright / 3:4 | Passed after the TextureView display-rotation correction |
| Clockwise landscape, right edge down / 4:3 | Passed; physical device reported `ROTATION_270` |
| Counterclockwise landscape, left edge down / 4:3 | Passed; physical device reported `ROTATION_90` |

### Scene 1 — high-dynamic-range real-estate interior

Use a bright window/opening, darker interior, and visible vertical architecture.
Capture one stabilized comparison and, if practical, one handheld comparison at
the same composition.

| Observation | AE sequence | Manual burst |
| --- | --- | --- |
| Total duration | 4351.091 ms | 556.120 ms |
| JPEG dimensions / byte sizes | Three `4080 × 3060`: 3,680,108 / 4,633,812 / 3,521,795 B | Three `4080 × 3060`: 8,375,189 / 8,820,552 / 5,431,054 B |
| Requested versus actual exposure / ISO | `-2 / 0 / +2 EV`; 9.991 ms / ISO 55, 9.991 ms / ISO 231, 50.036 ms / ISO 299 | Derived `-2 / 0 / +2 EV`; 2.498 ms / ISO 230, 9.991 ms / ISO 230, 39.965 ms / ISO 230 |
| Sensor / completion intervals | 1299.446 / 1742.968 ms; 1273.996 / 1640.553 ms | 42.489 / 90.187 ms; 37.450 / 18.753 ms |
| AF/AWB state changes | AF focused-locked and AWB locked; AE converged for all frames | Baseline retained from the successful AE `0 EV` frame |
| Active physical-camera result | Physical camera `5` for all frames | Physical camera `5` for all frames |
| Movement window | Gyro: 216 @ 49.62 Hz, RMS 0.00599, peak 0.01647. Linear: 216 @ 49.62 Hz, RMS 0.03902, peak 0.08980 | Gyro: 27 @ 49.62 Hz, RMS 0.00328, peak 0.00551. Linear: 26 @ 49.62 Hz, RMS 0.02209, peak 0.03619 |
| Uprightness and architecture | Portrait JPEG upright; door, cabinetry, and hallway verticals are preserved | Portrait JPEG upright; camera result matched the preview orientation |
| Bright-window / dark-interior visual observation | Bright white foreground/cabinetry and darker hallway were captured; this is an unmerged diagnostic JPEG, not HDR output | Same scene; no merge or tone mapping was performed |
| Failures | None; all three JPEGs linked by sensor timestamp | None; all three JPEGs linked by sensor timestamp |

### Scene 2 — normal, evenly lit interior

Use approximately the same composition for both strategies, with a stabilized
set and a handheld set if practical.

| Observation | AE sequence | Manual burst |
| --- | --- | --- |
| Total duration | 3773.317 ms | 538.616 ms |
| JPEG dimensions / byte sizes | Three `4080 × 3060`: 3,893,369 / 4,673,577 / 6,309,925 B | Three `4080 × 3060`: 7,813,981 / 8,417,745 / 6,263,575 B |
| Requested versus actual exposure / ISO | `-2 / 0 / +2 EV`; 9.991 ms / ISO 34, 9.991 ms / ISO 141, 19.983 ms / ISO 278 | Derived `-2 / 0 / +2 EV`; 2.498 ms / ISO 140, 9.991 ms / ISO 140, 39.965 ms / ISO 140 |
| Sensor / completion intervals | 1299.446 / 1389.412 ms; 1312.669 / 1152.096 ms | 42.489 / 90.187 ms; 32.354 / 19.458 ms |
| AF/AWB state changes | AF focused-locked and AWB locked; AE converged for all frames | Baseline retained from the successful AE `0 EV` frame |
| Active physical-camera result | Physical camera `5` for all frames | Physical camera `5` for all frames |
| Movement window | Gyro: 187 @ 49.63 Hz, RMS 0.00338, peak 0.00635. Linear: 187 @ 49.63 Hz, RMS 0.00740, peak 0.01561 | Gyro: 27 @ 49.62 Hz, RMS 0.00323, peak 0.00523. Linear: 27 @ 49.62 Hz, RMS 0.00861, peak 0.01399 |
| Uprightness / normal-interior visual observation | Upright full-resolution JPEG; evenly lit hallway with visible vertical architecture | Same orientation and scene; no merge or tone mapping was performed |
| Failures | None; all three JPEGs linked by sensor timestamp | None; all three JPEGs linked by sensor timestamp |

The first Scene 2 attempt was intentionally retained as diagnostic evidence: its
`+2 EV` point timed out at the three-consecutive-frame stability gate after
3500 ms, while the manual burst completed. A second stabilized attempt
completed both sets; that successful repeat is the accepted Scene 2 result
above. No strategy, AF/AWB behavior, or product policy was changed to hide the
initial timeout.

### Scene 2 — deliberate handheld comparison

The same Scene 2 composition was then captured while the tester made a small,
deliberate handheld sway. This is a measured comparison rather than a
sharpness, image-quality, or product-threshold assessment.

| Observation | AE sequence | Manual burst |
| --- | --- | --- |
| Comparison record / status | `comparison-908532508779153.json`; completed | Same record; completed |
| Total duration | 4329.474 ms | 786.273 ms |
| JPEG dimensions / byte sizes | Three `4080 × 3060`: 3,331,218 / 3,937,610 / 5,490,383 B | Three `4080 × 3060`: 8,489,230 / 8,988,097 / 8,502,396 B |
| Requested versus actual exposure / ISO | `-2 / 0 / +2 EV`; 9.991 ms / ISO 331, 29.994 ms / ISO 435, 59.988 ms / ISO 919 | Derived `-2 / 0 / +2 EV`; 7.499 ms / ISO 433, 29.994 ms / ISO 433, 119.977 ms / ISO 433 |
| Sensor / completion intervals | 1446.037 / 1582.970 ms; 1388.730 / 1292.878 ms | 67.736 / 270.221 ms; 17.826 / 363.986 ms |
| AF/AWB / active physical camera | AF focused-locked, AWB locked, AE converged; physical camera `5` for all frames | AF focused-locked and AWB locked; physical camera `5` for all frames |
| JPEG/result correlation and failure | All three linked by `sensor-timestamp`; none | All three linked by `sensor-timestamp`; none |
| Movement window | Gyro: 215 @ 49.65 Hz, RMS 0.05249, peak 0.12940. Linear: 215 @ 49.65 Hz, RMS 0.39734, peak 1.17715 | Gyro: 39 @ 49.63 Hz, RMS 0.05284, peak 0.10570. Linear: 38 @ 49.63 Hz, RMS 0.37029, peak 0.86855 |

## Quick regression evidence

On the same installed development build, the unchanged normal Expo Camera was
opened from the existing local **Villa** Shoot. The portrait 3:4 preview was
Ready with zero session captures. One real Quick capture was then taken: the
camera UI reported `3060 × 4080`, 2.8 MB, and showed an upright thumbnail.

- Both physical landscape directions were tested without ADB rotation:
  landscape-left reported `ROTATION_90`, landscape-right reported
  `ROTATION_270`; each showed an upright 4:3 preview.
- After returning to portrait (`ROTATION_0`) with **Done**, Shoot Gallery showed
  six photos, increasing the pre-test count of five by one. The new thumbnail
  was upright.
- After force-stop and normal dev-client relaunch, the Shoots list still showed
  **Villa — 6 photos**. The app-private persisted JPEG remained present with a
  byte size of 2,974,924 B and its 2026-09-01 09:05 local modification time.

Quick Camera source and behavior were not changed for this Issue #15 work.

## Release gating audit

- `:picchuspotbalancedprototype:compileReleaseKotlin` and
  `:app:assembleRelease` passed after the final preview fix.
- The release source set contains only the inert module/native-view stubs; a
  source audit found no `Camera2`, `ImageReader`, sensor, AE-sequence,
  manual-burst, or motion-recorder implementation symbols.
- The release APK contains no Balanced prototype implementation symbols:
  `BalancedPrototypeCamera`, `captureAeSequence`, `captureManualBurst`, and
  `PublicMotionRecorder` were absent from all five DEX files. Generic Camera2
  and `ImageReader` strings remain elsewhere in the application and are not
  evidence of this development-only prototype.

## Evidence classification and recommendation

### Measured facts

The Scene 1, stabilized Scene 2, and deliberate-handheld Scene 2 values above
are copied from named cache-only comparison records produced by the physical
SM-S938B. Each accepted comparison completed with three AE and three manual
full-resolution JPEGs, all linked by sensor timestamp. The movement values are
the harness's persisted public-sensor samples for their respective capture
windows. The Quick results are observations from the same physical device's
screen and app-private file metadata.

### Android API guarantees and device-reported capabilities

Camera2 exposes the requested controls, per-frame capture results,
`SENSOR_TIMESTAMP`, active physical-camera result where available, advertised
output sizes/ranges, and the JPEG image timestamp used by this harness for
correlation. `TextureView` owns the sensor-buffer presentation transform; the
prototype supplies only the current display rotation. These API semantics and
device-reported capabilities are not guarantees of image quality, timing,
physical-camera choice across all devices, or product suitability.

### Engineering inference

Both diagnostic strategies completed in the two stabilized scenes and the
handheld comparison, and the handheld movement magnitudes were numerically
higher than their stabilized Scene 2 counterparts. That limited evidence does
not establish a movement threshold, product bracket policy, HDR merge quality,
or a production Balanced mode.

Recommendation: **release gate passes for the development-only prototype**.
Do not promote either diagnostic strategy to a production Balanced mode without
separate product-policy, image-quality, handheld-motion, and full
data-persistence validation.
