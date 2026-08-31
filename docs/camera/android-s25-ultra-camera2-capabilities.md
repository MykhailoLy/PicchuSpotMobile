# Android S25 Ultra Camera2 capability spike

Status: development-only diagnostic spike. This document is the evidence record
for the native Camera2 probe in `PicchuSpotCameraDiagnostics`. It deliberately
does not define production Balanced or Pro bracket counts, EV spacing, lens
labels, storage, upload, or order behavior.

## Scope and constraints

The probe enumerates every rear-facing ID returned by `CameraManager`, records
the advertised `CameraCharacteristics`, and runs temporary Camera2 sessions on
one selected rear camera. The session uses a small `YUV_420_888`
`ImageReader`; each frame is closed immediately and no image is encoded or
written. The only persisted diagnostic artifact is a JSON report in the app's
private cache, identified to JavaScript by filename only.

The module uses public Android Camera2 APIs only. It does not use Samsung or
other vendor-private APIs, change the existing Quick Camera implementation,
write Shoot SQLite rows, write Gallery media, or upload anything.

## How to collect evidence

1. Build and install the Android development build from this branch on the
   physical S25 Ultra.
2. Grant camera permission, open **Account → Camera2 diagnostics**, and tap
   **Refresh inventory**.
3. Record the complete **Rear camera inventory** JSON, including all camera IDs,
   physical-camera IDs, capability values, ranges, and output sizes.
4. Tap **Run diagnostics** once, without changing the camera app or moving the
   phone during the run. Record the complete **Dynamic results** JSON.
5. Repeat the dynamic run once if a phase times out. Keep both runs if their
   values differ; timing and convergence are device/environment observations.
6. Regress Quick Camera separately: preview, portrait 3:4, landscape 4:3, one
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
| Diagnostic report filename | `diagnostic-1788133799372.json`; app-private cache only |
| Captured at (UTC) | `2026-08-30T23:49:55.930Z` |

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
| AE baseline near 0 EV | Requested index `0` / `0 EV`; actual `19,982,648 ns`, ISO `336`, `CONVERGED`; `8` frames / `509 ms` |
| Nearest supported negative target near -2 EV | Requested index `-20` / `-2 EV`; actual `9,991,324 ns`, ISO `137`, `CONVERGED`; `14` frames / `669 ms` |
| Nearest supported positive target near +2 EV | Requested index `20` / `+2 EV`; actual `29,994,234 ns`, ISO `1,765`, `CONVERGED`; `23` frames / `965 ms` |
| Manual sensor baseline and explicit request | `MANUAL_SENSOR` request completed; requested `19,982,648 ns` / ISO `336`; actual `19,982,648 ns` / ISO `334`; AE state `INACTIVE`; provider-adjusted ISO means `verified=false` |
| Temporary manual three-request probe | All 3 completed. Requested exposure times `9,991,324`, `19,982,648`, `39,965,296 ns` at ISO `336`; actual times matched and ISO was `334` for all three |
| Temporary Camera2 burst | `BURST_CAPTURE` completed `3/3`, failures `0`; sensor intervals `43.331795 ms`, `33.319166 ms`; completion intervals `35.230105 ms`, `38.508593 ms`; AE remained `SEARCHING` |

The three-request manual and burst probes are feasibility checks only. Their
factors and count are not proposed production bracket settings.

The burst frames returned exposure/ISO pairs `(29,994,234 ns, 275)`,
`(19,982,648 ns, 363)`, and `(19,982,648 ns, 338)`. This is evidence that the
advertised burst path completed, not evidence of a production exposure bracket:
the diagnostic burst used AE-on requests and the result remained in AE
`SEARCHING`.

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

- `CameraManager.cameraIdList` returns the logical camera IDs exposed to the
  application. A camera advertising `REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA`
  can expose its physical ID set through `CameraCharacteristics.getPhysicalCameraIds()`.
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
- Camera2 does not provide a universal mapping from a camera ID or focal length
  to marketing labels such as `0.6x`, `1x`, `3x`, or `5x`. The harness therefore
  returns no such labels.

References: [Camera2 camera characteristics](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics),
[Camera2 request capabilities](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#REQUEST_AVAILABLE_CAPABILITIES),
[AE exposure compensation](https://developer.android.com/reference/android/hardware/camera2/CaptureRequest#CONTROL_AE_EXPOSURE_COMPENSATION),
[manual sensor capability](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR),
[burst capability](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#REQUEST_AVAILABLE_CAPABILITIES_BURST_CAPTURE),
[logical multi-camera](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics#REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA),
and [Expo Modules API](https://docs.expo.dev/modules/get-started/).

## Engineering inference and recommendation

The recommendations below are based on the one physical S25 Ultra run above.
They are spike conclusions, not production capture specifications.

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
held exposure time exactly, but the provider adjusted ISO `336` to `334`, so
manual exactness and output-quality repeatability still need further tests
before choosing it for Balanced.

### Pro and manual burst

Pro can plausibly use public Camera2 manual burst primitives, because both
`MANUAL_SENSOR` and `BURST_CAPTURE` were advertised and a temporary burst
completed with approximately `33–43 ms` sensor spacing. It is not yet
validated as a manual bracket: the measured burst used AE-on requests, AE was
still searching, and the standalone manual probe showed ISO adjustment. No
production burst count or EV spacing is defined here.

### Still unknown after this spike

- The mapping from physical IDs `2, 5, 6, 7` to Samsung's physical sensors or
  marketing focal lengths.
- Whether logical-camera request controls behave consistently across lighting,
  focus distance, zoom/crop, stabilization, and device thermal state.
- Whether AE-compensated frames align well enough for later HDR/merge work.
- Whether manual exposure/ISO requests remain exact at the eventual output
  sizes and frame rates.
- Motion ghosting, rolling-shutter alignment, shutter lag, autofocus repeatability,
  white balance consistency, JPEG/RAW quality, and end-to-end merge quality.
- iOS behavior and any server/order contract needed by future Balanced or Pro.
