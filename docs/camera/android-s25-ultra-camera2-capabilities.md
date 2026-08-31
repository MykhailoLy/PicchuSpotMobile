# Android S25 Ultra Camera2 capability spike

Status: development-only diagnostic spike. This document is the evidence record
for the native Camera2 probe in `PicchuSpotCameraDiagnostics`. It deliberately
does not define production Balanced or Pro bracket counts, EV spacing, lens
labels, storage, upload, or order behavior.

## Scope and constraints

The probe enumerates every rear-facing ID returned by `CameraManager`, records
the advertised `CameraCharacteristics`, and, on API 29+, also queries every
physical ID backing a logical rear camera even when that physical ID is not
independently openable. It runs temporary Camera2 sessions on one selected rear
logical camera. The session uses a small `YUV_420_888`
`ImageReader`; each frame is closed immediately and no image is encoded or
written. The camera probe's only persisted diagnostic artifact is a JSON report
in the app's private cache, identified to JavaScript by filename only. The sensor probe uses
the same cache-only report pattern.

The separate level/movement probe uses public Android `SensorManager` and
`Sensor` APIs. It preserves raw sensor timestamps and samples in a second
app-private cache report. The module does not use Samsung or other
vendor-private APIs, change the existing Quick Camera implementation, write
Shoot SQLite rows, write Gallery media, or upload anything.

Android source sets enforce the development-only boundary at compile time: the
full Camera2 and Sensor implementation is in `src/debug/java`. The release
variant contains only a same-name Expo module registration stub that returns
`diagnostics-unavailable-in-release`; it has no Camera2 session, sensor
collection, report-writing, or probe implementation.

## How to collect evidence

1. Build and install the Android development build from this branch on the
   physical S25 Ultra.
2. Grant camera permission, open **Account → Camera2 diagnostics**, and tap
   **Refresh inventory**.
3. Record the complete **Rear camera inventory** JSON, including all camera IDs,
   physical-camera IDs, openability, capability values, ranges, and output
   sizes.
4. Tap **Run diagnostics** once, without changing the camera app or moving the
   phone during the run. Record the complete **Dynamic results** JSON.
5. Repeat the dynamic run once if a phase times out. Keep both runs if their
   values differ; timing and convergence are device/environment observations.
6. Tap **Run level + movement probe**, hold the handset still for 3 seconds,
   use the 1.5-second transition to prepare, then deliberately move it for 3
   seconds. Record the sensor inventory, level jitter, movement metrics, and
   timestamped-sample counts.
7. Regress Quick Camera separately: preview, portrait 3:4, landscape 4:3, one
   capture, persistence after restart, and **Done → Gallery**.

The harness selects a logical rear camera when `LOGICAL_MULTI_CAMERA` is
advertised. Ties are resolved by hardware level, pixel array area, and camera
ID. This is an engineering test-selection rule, not a lens mapping.

## Measured facts

The entries below were copied from the physical-device harness output. A blank
or `unknown` value is evidence that the device did not expose that field; it
must not be replaced with a guessed value.

### Run metadata

| Field | Measured value |
| --- | --- |
| Device manufacturer/model | `samsung` / `SM-S938B` |
| Android release/API level | Android `16` / API `36` |
| Camera permission | Granted (`true`) |
| Camera diagnostic report | `diagnostic-1788137843354.json`; app-private cache only |
| Camera report captured at (UTC) | `2026-08-31T00:57:17.119Z` |
| Sensor diagnostic report | `sensor-diagnostic-1788137729125.json`; app-private cache only |
| Sensor report captured at (UTC) | `2026-08-31T00:55:21.572Z` |

### Rear camera inventory

Record one row per item in `cameraInventory.rearCameras`. Do not rename an ID
to a focal-length or marketing label.

| Camera ID | Topology | Physical camera IDs | Hardware level | MANUAL_SENSOR | BURST_CAPTURE | RAW | LOGICAL_MULTI_CAMERA | Focal lengths (mm) | Apertures | Minimum focus distance | OIS | Flash | Max digital zoom | AE compensation integer range / step / EV range | Exposure time range (ns) | ISO range | Max frame duration (ns) | AE lock | AE modes | Antibanding | FPS ranges | Active array | Pixel array | Physical size / orientation | JPEG sizes | RAW sizes | YUV sizes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `0` | logical; mapping not assigned | `2, 5, 6, 7` | `LEVEL_3` (raw `3`) | yes | yes | yes | yes | `6.3000002` | `1.7000000` | `10` diopters | `OFF` | yes | `8` | `-20..20` / `1/10` / `-2..2 EV` | `83,490..176,037,266` | `12..3,200` | `255,142,810` | yes | `OFF, ON, ON_AUTO_FLASH, ON_ALWAYS_FLASH` | `OFF, 50HZ, 60HZ, AUTO` | `15-15, 24-24, 15-30, 30-30, 15-60, 60-60` | `0,0..4080,3060` | `4080×3060` | `9.792×7.344 mm / 90°` | 29 sizes; see list below | `4080×3060` | 29 sizes; see list below |
| `2` | physical-or-single; mapping not assigned | none | `LIMITED` (raw `0`) | yes | yes | yes | no | `2.2000000` | `1.9000000` | `20` diopters | `OFF` | yes | `8` | `-20..20` / `1/10` / `-2..2 EV` | `83,490..176,037,266` | `19..3,200` | `176,102,264` | yes | `OFF, ON, ON_AUTO_FLASH, ON_ALWAYS_FLASH` | `OFF, 50HZ, 60HZ, AUTO` | `15-15, 15-24, 24-24, 15-30, 30-30, 15-60, 60-60` | `0,0..4080,3060` | `4080×3060` | `5.712×4.284 mm / 90°` | 24 sizes; see list below | `4080×3060` | 24 sizes; see list below |

The raw JSON is authoritative for the full lists. The physical device returned
camera IDs `0, 1, 2, 3`; only `0` and `2` were rear-facing. Camera `0` is the
advertised logical camera and reports physical IDs `2, 5, 6, 7`; Camera2 does
not identify those physical IDs with marketing lens names. The request
capabilities were, in order returned: camera `0` — raw
`[0,9,3,7,4,5,1,6,2,19,18,20,11]`; camera `2` — raw
`[0,3,9,2,4,5,1,6,7,18,19,20]`. The named values are emitted by the module;
unknown integers are retained as `UNKNOWN(n)` rather than guessed.

### Physical cameras backing logical camera `0`

Android returned characteristics for all physical IDs `2, 5, 6, 7`. ID `2`
also appears in `CameraManager.cameraIdList` and is independently openable. IDs
`5`, `6`, and `7` do not appear in that list; they are physical-only IDs queried
through `CameraManager.getCameraCharacteristics()` on API 36. These IDs and
characteristics are measured facts. No Samsung marketing labels are assigned.

| Physical ID | Relationship to logical `0` | Focal length / aperture | Sensor physical size | Active / pixel array | Exposure range (ns) | ISO range | OIS | Minimum focus distance | Representative JPEG / YUV sizes | RAW sizes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `2` | Independently openable and a physical member | `2.2000000 mm` / `f/1.9000000` | `5.712 × 4.284 mm` | `0,0..4080,3060` / `4080×3060` | `83,490..176,037,266` | `19..3,200` | `OFF` | `20` diopters | 24 each; `4080×3060`, `3648×2736`, `4000×2252`, `3840×2160`, `3648×2052` | `4080×3060` |
| `5` | Physical-only member | `6.3000002 mm` / `f/1.7000000` | `9.792 × 7.344 mm` | `0,0..4080,3060` / `4080×3060` | `43,219..255,098,784` | `12..3,200` | `OFF, ON` | `10` diopters | 27 each; `4080×3060`, `4000×3000`, `4000×2252`, `2992×2992`, `3840×2160` | `4080×3060` |
| `6` | Physical-only member | `7.9000001 mm` / `f/2.4000001` | `4.48 × 3.36 mm` | `0,0..4000,3000` / `4000×3000` | `53,850..350,026,925` | `50..3,200` | `OFF, ON` | `2.5` diopters | 26 each; `4000×3000`, `3648×2736`, `4000×2252`, `3840×2160`, `3648×2052` | `4000×3000` |
| `7` | Physical-only member | `18.6000004 mm` / `f/3.4000001` | `5.712 × 4.284 mm` | `0,0..4080,3060` / `4080×3060` | `48,309..273,984,151` | `28..3,200` | `OFF, ON` | `1.25` diopters | 27 each; `4080×3060`, `4032×3024`, `4000×3000`, `4000×2252`, `2992×2992` | `4080×3060` |

All four physical IDs reported sensor orientation `90°` and Camera2 timestamp
source `REALTIME`. Their measured maximum frame durations were, respectively,
`176,102,264`, `255,142,810`, `350,113,086`, and `274,127,466 ns`.

### Zoom characteristics and result-key support

| Camera ID | `CONTROL_ZOOM_RATIO_RANGE` | Max digital zoom | Effective zoom result | Active physical ID result | Active physical crop result | Focal length result | Crop-region result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Logical `0` | `0.6..10.0` | `8.0` | available | available | not exposed | available | available |
| Openable rear `2` | `1.0..8.0` | `8.0` | available | not exposed | not exposed | available | available |

The zoom-ratio upper bound and legacy maximum digital zoom are different
Camera2 characteristics and are therefore reported independently rather than
forced into one range.

Representative and complete output-size lists from the same run:

- Camera `0` JPEG and YUV (same list): `4080×3060`, `4032×3024`, `4000×3000`,
  `4000×2252`, `4000×1848`, `4000×1716`, `3840×2160`, `3648×2736`,
  `3648×2052`, `3648×1704`, `2992×2992`, `2736×2736`, `2560×1440`,
  `2400×1080`, `2336×1080`, `1920×1440`, `1920×1080`, `1920×824`,
  `1440×1080`, `1280×720`, `1232×1008`, `1088×1088`, `960×720`,
  `720×480`, `640×480`, `640×360`, `352×288`, `320×240`, `176×144`.
- Camera `0` RAW: `4080×3060`.
- Camera `2` JPEG and YUV (same list): `4080×3060`, `3648×2736`, `4000×2252`,
  `3840×2160`, `3648×2052`, `2736×2736`, `3648×1704`, `2560×1440`,
  `1920×1440`, `2400×1080`, `2336×1080`, `1920×1080`, `1920×824`,
  `1440×1080`, `1232×1008`, `1088×1088`, `1280×720`, `960×720`,
  `720×480`, `640×480`, `640×360`, `352×288`, `320×240`, `176×144`.
- Camera `2` RAW: `4080×3060`.

### Dynamic diagnostic results

| Diagnostic | Measured result |
| --- | --- |
| AE baseline near 0 EV | Requested index `0` / `0 EV`; actual `29,994,234 ns`, ISO `1,717`, `CONVERGED`; `10` frames / `549 ms` |
| Nearest supported negative target near -2 EV | Requested index `-20` / `-2 EV`; actual `29,994,234 ns`, ISO `482`, `CONVERGED`; `18` frames / `792 ms` |
| Nearest supported positive target near +2 EV | Requested index `20` / `+2 EV`; actual `39,965,296 ns`, ISO `6,773`, `CONVERGED`; `17` frames / `868 ms` |
| Manual sensor baseline and explicit request | `MANUAL_SENSOR` request completed; requested `29,994,234 ns` / ISO `1,717`; actual `29,994,234 ns` / ISO `1,708`; AE state `INACTIVE`; provider-adjusted ISO means `verified=false` |
| Temporary sequential manual three-request probe | All 3 completed. Requested exposure times `14,997,117`, `29,994,234`, `59,988,468 ns` at ISO `1,717`; actual times matched and ISO was `1,708` for all three |
| Diagnostic manual `captureBurst` | Both required capabilities were advertised. All `3/3` requests completed in request order with failures `0`; details and timings are below. |
| Temporary AE-on Camera2 burst | `BURST_CAPTURE` completed `3/3`, failures `0`; sensor intervals `33.403125 ms`, `33.402917 ms`; completion intervals `45.902969 ms`, `34.063125 ms`; AE remained `SEARCHING` |

#### AE ISO observation

The `+2 EV` value of ISO `6,773` is measured auto-exposure behavior from the
logical-camera YUV result, even though that logical camera advertises a manual
`SENSOR_INFO_SENSITIVITY_RANGE` ending at ISO `3,200`. Neither value is
corrected or treated as a contradiction in this evidence record. The measured
AE value must not be assumed to be an equivalent manual
`SENSOR_SENSITIVITY` request: processed AE/YUV behavior may include additional
pipeline gain, such as post-RAW sensitivity boost or other HAL-managed
processing. Future Balanced-versus-Pro tests must compare image
brightness/noise rather than assume that AE and manual ISO values are
interchangeable. This is not a Samsung-specific explanation.

The manual `captureBurst` used temporary diagnostic multipliers only; it does
not propose a product count or EV spacing:

| Request index | Requested exposure / ISO | Actual exposure / ISO | Sensor timestamp (ns) | Frame | Completion timestamp, elapsed realtime (ns) | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `0` | `14,997,117 ns` / `1,717` | `14,997,117 ns` / `1,708` | `800225220987111` | `126` | `800225335755385` | completed |
| `1` | `29,994,234 ns` / `1,717` | `29,994,234 ns` / `1,708` | `800225266146460` | `127` | `800225374649864` | completed |
| `2` | `59,988,468 ns` / `1,717` | `59,988,468 ns` / `1,708` | `800225296231372` | `128` | `800225424419083` | completed |

The manual-burst sensor intervals were `45.159349 ms` and `30.084912 ms`;
completion-callback intervals were `38.894479 ms` and `49.769219 ms`.
Request and completion order were both `[0, 1, 2]`, with no capture failures.
Exposure time matched every request exactly in this run; the provider adjusted
ISO from `1,717` to `1,708` on every frame.

The separate AE-on burst returned `(29,994,234 ns, ISO 1,977)`,
`(29,994,234 ns, ISO 1,966)`, and `(29,994,234 ns, ISO 1,873)`. It remains only
evidence that the advertised generic burst path completed; AE was still
`SEARCHING`.

### Dynamic zoom-routing probe

Logical camera `0` advertised `0.6..10.0`. The harness requested the minimum,
requested `0.6` explicitly, and requested `1.0`; `0.5` was not sent because it
was outside the advertised range. Every accepted request returned an effective
zoom ratio and an active physical ID.

| Probe | Requested / actual ratio | Active physical result | Physical IDs observed while settling | Result focal length | Logical crop | Active physical crop | Output | Observation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Minimum supported | `0.60000002` / `0.60000002` | final `2` | `5` for 2 frames, then `2` for 13 | `2.2000000 mm` | `0,0..4080,3060` | not exposed | `640×480` YUV | 15 frames / `767 ms`; settled |
| Explicit `0.6` | `0.60000002` / `0.60000002` | final `2` | `2` for all 13 frames | `2.2000000 mm` | `0,0..4080,3060` | not exposed | `640×480` YUV | 13 frames / `779 ms`; settled |
| Explicit `1.0` | `1.0` / `1.0` | final `5` | `5` for all 14 frames | `6.3000002 mm` | `0,0..4080,3060` | not exposed | `640×480` YUV | 14 frames / `791 ms`; settled |
| Candidate `0.5` | not requested | none | none | none | none | none | none | outside advertised range |

The initial two frames at the minimum show that active physical routing can be
transitional. The final IDs above are the results after a minimum 750 ms
observation, not assumptions about lens labels. This run provides no evidence
that `0.5` and `0.6` are separate lenses, and no such claim is made.

### Level and movement sensor diagnostics

All requested public Android sensor types were available:

| Sensor type | Name / vendor | `minDelay` | Advertised / useful rate cap | Reporting mode |
| --- | --- | --- | --- | --- |
| `TYPE_ROTATION_VECTOR` | `Rotation Vector Non-wakeup` / QTI | `5,000 µs` | `200 / 200 Hz` | continuous |
| `TYPE_GAME_ROTATION_VECTOR` | `Game Rotation Vector Non-wakeup` / QTI | `5,000 µs` | `200 / 200 Hz` | continuous |
| `TYPE_GRAVITY` | `gravity Non-wakeup` / QTI | `5,000 µs` | `200 / 200 Hz` | continuous |
| `TYPE_GYROSCOPE` | `lsm6dsv_0 Gyroscope Non-wakeup` / STMicro | `5,000 µs` | `200 / 200 Hz` | continuous |
| `TYPE_LINEAR_ACCELERATION` | `linear_acceleration` / QTI | `5,000 µs` | `200 / 200 Hz` | continuous |

The corresponding `maxDelay` values were `200,000 µs` for the rotation, game
rotation, gravity, and linear-acceleration sensors, and `1,000,000 µs` for the
gyroscope. The probe requested a `20,000 µs` sampling period and selected
`TYPE_ROTATION_VECTOR`, `TYPE_GYROSCOPE`, and `TYPE_LINEAR_ACCELERATION` for the
temporary measurements.

Level stability was measured during the 3-second handheld-still window. Raw
Android device coordinates were used; there is no UI remapping and no green
threshold:

| Axis | Samples / rate | Minimum | Maximum | Mean | Standard deviation | Peak-to-peak |
| --- | --- | --- | --- | --- | --- | --- |
| Pitch | 142 / `47.447 Hz` | `-76.2356°` | `-73.4642°` | `-75.3543°` | `0.6762°` | `2.7714°` |
| Roll | 142 / `47.447 Hz` | `2.4894°` | `8.7870°` | `4.7752°` | `1.8191°` | `6.2975°` |

These values describe one handheld-still trial, including human hold jitter;
they are not a proposed level threshold.

The movement probe used a 3-second still window, a discarded 1.5-second
transition, and a 3-second deliberate handheld-movement window:

| Metric | Still | Deliberate movement |
| --- | --- | --- |
| Orientation samples / rate | 142 / `47.447 Hz` | 141 / `47.447 Hz` |
| Pitch/roll path | `24.0554°` | `28.5668°` |
| Maximum pitch/roll delta from start | `3.6476°` | `2.5804°` |
| Gyroscope samples / rate | 142 / `47.447 Hz` | 142 / `47.447 Hz` |
| Gyroscope magnitude mean / RMS / max | `0.04005 / 0.04611 / 0.11303 rad/s` | `0.04434 / 0.06474 / 0.17912 rad/s` |
| Integrated gyroscope magnitude | `0.11841 rad` | `0.13095 rad` |
| Linear-acceleration samples / rate | 142 / `47.447 Hz` | 141 / `47.447 Hz` |
| Linear-acceleration RMS / max | `0.19762 / 0.52003 m/s²` | `0.35385 / 1.16725 m/s²` |
| Integrated linear-acceleration magnitude | `0.46853 m/s` | `0.66883 m/s` |

The deliberate window measured `1.404×` the still-window gyroscope RMS and
approximately `1.791×` the linear-acceleration RMS. This is evidence that the
two traces differed, not evidence for a production movement-warning threshold.

The app-private report preserved 354 timestamped rotation samples, 355
gyroscope samples, and 354 linear-acceleration samples, including both
`SensorEvent.timestamp` and callback `elapsedRealtimeNanos`. The rotation trace
spanned sensor timestamps `800104124663162..800111564545796 ns`; the gyroscope
trace spanned `800104133093579..800111594052410 ns`. Camera2 reported timestamp
source `REALTIME`, so future combined experiments can correlate these public
sensor timestamps with Camera2 `SENSOR_TIMESTAMP`. This run did not define a
production level or movement UI.

### Quick Camera regression

| Check | Result |
| --- | --- |
| Physical S25 Ultra preview opens | Passed in the existing Quick Camera route |
| Portrait 3:4 preview/capture path | Passed; one Quick capture completed and reported `3060 × 4080` |
| Landscape 4:3 preview/capture path | Not physically verified in this run; the route still declares `orientation: 'all'` and the existing preview uses `4/3`, but the connected handset remained portrait. Forced ADB rotation produced a letterboxed portrait app because of the existing app-level portrait manifest, so it was not treated as a valid landscape result. |
| Quick capture persistence after restart | Passed; the shoot photo count increased from 2 to 3 and remained 3 after relaunch |
| Done → Gallery | Passed; Done returned to Shoot Gallery and the new photo was visible in the gallery count |

No Quick Camera source behavior was changed for this spike. The landscape item
requires a physically rotated-device retest before release confidence is claimed.

## Android API guarantees

These are platform-contract statements, not S25 Ultra measurements:

- `CameraManager.cameraIdList` lists independently openable camera devices but
  does not necessarily list physical IDs used only to compose a logical camera.
  A camera advertising `REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA`
  exposes its physical ID set through
  `CameraCharacteristics.getPhysicalCameraIds()`. On API 29+, an application
  can pass those physical IDs to `CameraManager.getCameraCharacteristics()`
  even when they are not independently openable.
- `REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR`, `BURST_CAPTURE`, and `RAW`
  advertise capability support. They do not, by themselves, prove that every
  requested control will be accepted in every session or that a useful
  production image pipeline has been validated.
- `CONTROL_AE_COMPENSATION_RANGE` is an integer index range and
  `CONTROL_AE_COMPENSATION_STEP` is the EV value represented by one index. The
  EV endpoints in the harness are calculated as index × step; the actual
  exposure and ISO are read from capture results.
- `SENSOR_INFO_EXPOSURE_TIME_RANGE`, `SENSOR_INFO_SENSITIVITY_RANGE`, and
  `SENSOR_INFO_MAX_FRAME_DURATION` describe advertised sensor bounds. They are
  not a promise that all combinations of time, ISO, output size, frame rate,
  focus, and stabilization will work together.
- `CameraCaptureSession.captureBurst` accepts a temporary list of requests and
  reports capture callbacks. The platform does not provide a universal
  device-independent practical inter-frame timing guarantee; the harness
  measures callback and sensor timestamps.
- `CONTROL_ZOOM_RATIO_RANGE` is the advertised range for public zoom-ratio
  requests on API 30+. `CaptureResult.CONTROL_ZOOM_RATIO` reports the effective
  ratio. `LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID` is optional capture-result
  metadata and identifies the physical camera active for a logical result when
  the key is exposed; it is not a marketing lens label.
- Public continuous sensors expose metadata including `minDelay` and reporting
  mode. `SensorEvent.timestamp` uses nanoseconds on a monotonic time base. A
  Camera2 sensor advertising timestamp source `REALTIME` can be compared with
  `elapsedRealtimeNanos()` and other sensors using that time base.
- Camera2 does not provide a universal mapping from a camera ID or focal length
  to marketing labels such as `0.6x`, `1x`, `3x`, or `5x`. The harness therefore
  returns no such labels.

References: [Camera2 camera characteristics](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics),
[CameraManager physical-characteristics query](https://developer.android.com/reference/android/hardware/camera2/CameraManager#getCameraCharacteristics(java.lang.String)),
[Camera2 request capabilities](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#REQUEST_AVAILABLE_CAPABILITIES),
[AE exposure compensation](https://developer.android.com/reference/android/hardware/camera2/CaptureRequest#CONTROL_AE_EXPOSURE_COMPENSATION),
[manual sensor capability](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR),
[burst capability](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#REQUEST_AVAILABLE_CAPABILITIES_BURST_CAPTURE),
[logical multi-camera](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA),
[zoom-ratio range](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#CONTROL_ZOOM_RATIO_RANGE),
[active physical camera result](https://developer.android.com/reference/android/hardware/camera2/CaptureResult#LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID),
[Android sensors](https://developer.android.com/reference/android/hardware/Sensor),
[SensorEvent timestamps](https://developer.android.com/reference/android/hardware/SensorEvent#timestamp),
and [Expo Modules API](https://docs.expo.dev/modules/get-started/).

## Engineering inference and recommendation

The recommendations below are based on the physical S25 Ultra camera and
sensor runs above. They are spike conclusions, not production capture
specifications.

### Quick

Quick should stay on Expo Camera. It is already a working single-exposure flow
with the required preview aspect ratios and local persistence. This spike does
not supply a product reason to replace it, and the native module is isolated
from its behavior.

### Balanced and AE compensation

Balanced can plausibly use AE compensation on the tested logical camera: the
advertised range was exactly `-2..+2 EV` in `0.1 EV` steps, and all three
probes reached `CONVERGED` while changing actual exposure/ISO. This supports a
future public-API experiment, but does not choose a production count or EV
spacing and is only one scene/run.

### Balanced and manual Camera2

Balanced does not currently need manual Camera2 merely to obtain the tested
AE-compensation points. Manual Camera2 is available and the temporary probe
held exposure time exactly, but the provider adjusted ISO `1,717` to `1,708`, so
manual exactness and output-quality repeatability still need further tests
before choosing it for Balanced.

### Pro and manual burst

Pro can plausibly use public Camera2 manual burst primitives, because both
`MANUAL_SENSOR` and `BURST_CAPTURE` were advertised and a diagnostic
three-request manual `captureBurst` completed in order with zero failures.
Requested exposure times were returned exactly, sensor intervals were about
`30–45 ms`, and ISO was consistently adjusted from `1,717` to `1,708`. This
establishes public-API feasibility on this device, not production bracket or
image-quality readiness. No production burst count or EV spacing is defined
here.

### Still unknown after this spike

- Samsung marketing labels for physical IDs `2, 5, 6, 7`. Camera2 directly
  measured their focal lengths and apertures, but no vendor marketing mapping
  was exposed or inferred.
- Whether logical-camera routing at `0.6` is stable across scenes, focus,
  lighting, thermal state, and repeated zoom transitions. The final run settled
  on ID `2`, but its first two transition frames still reported ID `5`.
- Whether logical-camera request controls behave consistently across lighting,
  focus distance, zoom/crop, stabilization, and device thermal state.
- Whether AE-compensated frames align well enough for later HDR/merge work.
- Whether manual exposure/ISO requests remain exact at the eventual output
  sizes and frame rates.
- Motion ghosting, rolling-shutter alignment, shutter lag, autofocus repeatability,
  white balance consistency, JPEG/RAW quality, and end-to-end merge quality.
- Production level-indicator coordinate remapping, filtering, calibration, and
  green threshold; production movement-warning metric, time window, and
  threshold. This spike deliberately chooses none of them.
- A valid physical landscape Quick Camera result. The existing portrait-only
  app architecture was not changed in this PR.
- iOS behavior and any server/order contract needed by future Balanced or Pro.
