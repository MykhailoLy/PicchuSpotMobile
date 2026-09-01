# Android Balanced bracket policy experiment

Status: Issue #17 development-only Camera2 experiment. This document records a single-device evaluation; it is not production capture policy.

## Scope and method

The debug-only `PicchuSpotBalancedPrototype` module captured manual Camera2 JPEG bursts on a Galaxy S25 Ultra (SM-S938B, Android camera logical ID `0`, selected physical ID `5`, 1x). It used the device advertised manual-sensor and burst-capture capabilities. The test intentionally did not create a production UI, SQLite capture records, uploads, HDR merges, Pro mode, 0.6x support, or iOS implementation.

Each set first locked AE/AF/AWB, recorded the one-frame AE baseline, then captured the requested manual bracket with `captureBurst`. Each source JPEG was decoded only to calculate metrics; it was neither enhanced nor rewritten. The module recorded the full 16-bin luminance histogram, p01/p05/p50/p95/p99, near-black (luma <= 8), near-white (luma >= 247), and a sampled adjacent-luminance-gradient detail proxy in the device evidence cache.

Definitions:

- A = three frames at -2 / 0 / +2 EV.
- B = five frames at -2 / -1 / 0 / +1 / +2 EV.
- P1 = manual-range planner (uncapped).
- P2 = temporary positive-EV shutter ceiling of about 1/30 s with ISO redistribution.
- P3 = temporary positive-EV shutter ceiling of about 1/15 s with ISO redistribution.
- `S` = sensor completion offsets; `C` = JPEG callback completion offsets; `g` = gyro and accelerometer movement-window ranges. Offsets/ranges are milliseconds.

The ISO/shutter planner preserved the requested exposure product where the advertised ranges allowed it. A `cap` annotation means the positive-EV shutter ceiling was applied. A `clamp` annotation means an exposure range or temporary ceiling affected planning. The actual capture-result values, rather than the plan alone, are reported.

## Device and API facts

Measured device configuration:

| Item | Observed |
| --- | --- |
| Camera | logical `0`, physical `5`, 6.3 mm / f1.7, OIS enabled |
| JPEG output | 4080 x 3060 on every accepted source frame |
| Manual baseline | AE-converged 19.983 ms in every accepted set; ISO 34-74 by scene/run |
| Focus / white balance | `FOCUSED_LOCKED` / `LOCKED` in all 22 accepted sets |
| Outcome | 22/22 accepted manual sets completed; no source-frame, JPEG, sensor-timing, or callback failures |
| Timestamp source | sensor timestamps reported as `REALTIME` |

The device capability capture reported `MANUAL_SENSOR=yes`, `BURST_CAPTURE=yes`, the 4080 x 3060 JPEG size, and advertised manual exposure and ISO ranges. Android Camera2 supports requested manual controls and burst submission when advertised, but it does **not** guarantee every shutter/ISO combination, a fixed inter-frame cadence, use of a particular physical camera, or image-quality/merge quality. On this device the selected physical camera was consistently reported as `5`; that is a measured fact, not a cross-device guarantee.

## Per-set timing, movement, and payload evidence

All rows include the actual AE baseline (shutter/ISO), total duration, actual sensor and callback offsets, movement window, completion outcome, and total JPEG payload. Per-frame actual shutter/ISO, byte count, clipping, percentiles, and detail are in the following section.

| Scene / handling | Candidate / planner | AE baseline | Total | S offsets | C offsets | g / accel | JPEG payload | Result |
| --- | --- | --- | ---: | --- | --- | --- | ---: | --- |
| HDR / stabilized | A P1 | 20.0 ms / 58 | 816.1 ms | 45.2, 180.1 | 22.6, 148.0 | .0006 / .0010 | 19.08 MB | complete |
| HDR / stabilized | A P2 | 20.0 / 68 | 624.2 | 45.2, 86.9 | 32.5, 22.9 | .0020 / .0029 | 20.36 MB | complete |
| HDR / stabilized | A P3 | 20.0 / 72 | 599.9 | 45.2, 153.6 | 40.1, 89.1 | .0006 / .0012 | 19.70 MB | complete |
| HDR / stabilized | B P2 | 20.0 / 72 | 630.8 | 45.0, 50.2, 86.9, 100.3 | 46.4, 34.1, 27.1, 81.7 | .0005 / .0009 | 34.05 MB | complete |
| HDR / stabilized | B P3 | 20.0 / 74 | 591.4 | 45.0, 50.2, 100.2, 173.6 | 53.4, 20.8, 24.5, 187.7 | .0006 / .0011 | 33.54 MB | complete |
| HDR / handheld | A P2 | 20.0 / 34 | 843.5 | 45.2, 86.9 | 28.2, 19.1 | .0200 / .0404 | 19.30 MB | complete |
| HDR / handheld | B P2 | 20.0 / 36 | 610.6 | 45.0, 70.3, 86.9, 100.3 | 37.0, 44.8, 53.8, 18.7 | .0034 / .0053 | 31.84 MB | complete |
| Even / stabilized | A P1 | 20.0 / 39 | 599.3 | 45.2, 180.1 | 33.6, 156.0 | .0011 / .0018 | 18.31 MB | complete |
| Even / stabilized | B P1 | 20.0 / 44 | 599.7 | 45.0, 70.3, 100.2, 200.1 | 21.8, 33.9, 38.0, 319.7 | .0010 / .0018 | 30.47 MB | complete |
| Even / stabilized | B P2 | 20.0 / 41 | 610.8 | 45.0, 50.2, 86.9, 100.3 | 31.7, 51.0, 20.5, 66.5 | .0013 / .0021 | 32.32 MB | complete |
| Even / handheld | A P2 | 20.0 / 42 | 593.5 | 45.2, 86.9 | 37.9, 21.4 | .0129 / .0251 | 20.03 MB | complete |
| Even / handheld | B P2 | 20.0 / 49 | 597.6 | 45.0, 50.2, 86.9, 100.3 | 19.7, 30.4, 24.9, 123.2 | .0009 / .0017 | 31.49 MB | complete |
| Dim / stabilized | A P1 | 20.0 / 52 | 624.0 | 45.2, 180.1 | 28.5, 205.2 | .0009 / .0016 | 18.27 MB | complete |
| Dim / stabilized (repeat) | A P2 | 20.0 / 55 | 596.3 | 45.2, 86.9 | 21.8, 24.1 | .0007 / .0010 | 19.29 MB | complete |
| Dim / stabilized (repeat) | A P3 | 20.0 / 53 | 591.7 | 45.2, 153.6 | 16.7, 141.8 | .0006 / .0010 | 18.41 MB | complete |
| Dim / stabilized | A P2 | 20.0 / 55 | 599.1 | 45.2, 86.9 | 28.3, 23.4 | .0005 / .0011 | 19.49 MB | complete |
| Dim / stabilized | A P3 | 20.0 / 56 | 567.3 | 45.2, 153.6 | 18.1, 181.1 | .0007 / .0011 | 18.57 MB | complete |
| Dim / stabilized | B P1 | 20.0 / 57 | 571.9 | 45.0, 50.2, 100.2, 200.1 | 19.9, 26.3, 40.9, 310.8 | .0006 / .0009 | 30.98 MB | complete |
| Dim / stabilized | B P2 | 20.0 / 58 | 583.5 | 45.0, 50.2, 86.9, 100.3 | 22.4, 28.3, 19.7, 134.5 | .0005 / .0009 | 31.95 MB | complete |
| Dim / stabilized | B P3 | 20.0 / 60 | 574.5 | 45.0, 50.2, 100.2, 173.6 | 27.8, 20.9, 47.8, 276.0 | .0005 / .0011 | 31.70 MB | complete |
| Dim / handheld | A P2 | 20.0 / 53 | 586.6 | 45.2, 86.9 | 19.0, 32.6 | .0190 / .0373 | 19.13 MB | complete |
| Dim / handheld | B P2 | 20.0 / 54 | 599.4 | 45.0, 50.2, 86.9, 100.3 | 24.8, 25.3, 16.9, 127.6 | .0034 / .0044 | 30.89 MB | complete |

## Actual source-frame evidence

Format in this table is `EV: shutter ms / ISO; bytes; near-black% / near-white%; p01,p05,p50,p95,p99; detail`. The exposure intent requested by every frame matches its shown EV. `cap` and `clamp` identify planner intervention. All frames are 4080 x 3060 JPEGs and all completed. The development cache contains the full 16-bin histogram for every row; selected percentiles are reproduced where required to characterize the endpoint.

| Scene / handling | Candidate / planner | Actual source frames |
| --- | --- | --- |
| HDR / stabilized | A P1 | -2: 5.0/58; 6,460,692; 7.48/.27; 4,6,31,196,223; 3.701. 0: 20.0/58; 6,898,717; .39/4.45; 13,22,86,243,255; 4.316. +2: 79.9/58; 5,717,724; 0/11.77; 42,64,144,255,255; 3.790. |
| HDR / stabilized | A P2 | -2: 5.0/68; 6,611,598; 7.60/.29; detail 3.794. 0: 20.0/68; 7,104,879; .37/4.96; detail 4.289. +2: 33.3/162; 6,640,606; 0/11.66; detail 4.062; cap, clamp. |
| HDR / stabilized | A P3 | -2: 5.0/72; 6,763,420; 7.15/.30; detail 3.816. 0: 20.0/72; 7,044,569; .36/5.38; detail 4.295. +2: 66.7/86; 5,896,092; 0/12.00; detail 3.622; cap, clamp. |
| HDR / stabilized | B P2 | -2: 5.0/72; 6,666,357; 7.60/.30; detail 3.742. -1: 10.0/72; 7,121,129; 1.64/1.76; detail 4.111. 0: 20.0/72; 7,053,605; .39/5.16; detail 4.227. +1: 33.3/86; 6,615,883; .03/8.80; detail 4.007; cap, clamp. +2: 33.3/172; 6,635,274; 0/11.78; detail 3.999; cap, clamp. |
| HDR / stabilized | B P3 | -2: 5.0/74; 6,845,300; 7.24/.31; detail 3.811. -1: 10.0/74; 7,229,902; 1.28/1.85; detail 4.181. 0: 20.0/74; 7,118,198; .35/5.31; detail 4.285. +1: 40.0/74; 6,421,199; .03/9.06; detail 4.008. +2: 66.7/89; 5,921,603; 0/11.96; detail 3.611; cap, clamp. |
| HDR / handheld | A P2 | -2: 5.0/34; 6,421,672; 6.68/.22; detail 3.770. 0: 20.0/34; 6,830,717; .93/4.65; detail 4.122. +2: 33.3/82; 6,050,503; 0/12.60; detail 3.406; cap, clamp. |
| HDR / handheld | B P2 | -2: 5.0/36; 6,248,966; 4.07/.25; detail 3.789. -1: 10.0/36; 6,664,237; .95/.95; detail 4.199. 0: 20.0/36; 6,590,137; .04/4.95; detail 4.310. +1: 33.3/43; 6,253,455; .01/8.11; detail 4.126; cap, clamp. +2: 33.3/86; 6,082,697; 0/11.10; detail 3.688; cap, clamp. |
| Even / stabilized | A P1 | -2: 5.0/39; 6,189,669; 4.56/.23; detail 3.709. 0: 20.0/39; 6,584,769; .05/4.64; detail 4.271. +2: 79.9/39; 5,532,563; 0/11.06; detail 3.656. |
| Even / stabilized | B P1 | -2: 5.0/44; 6,386,316; 3.78/.26; detail 3.797. -1: 10.0/44; 6,809,746; .65/1.04; detail 4.230. 0: 20.0/44; 6,646,871; .04/5.13; detail 4.313. +1: 40.0/44; 6,146,701; .01/8.33; detail 4.112. +2: 79.9/44; 5,480,661; 0/11.34; detail 3.610. |
| Even / stabilized | B P2 | -2: 5.0/41; 6,321,002; 4.37/.24; detail 3.753. -1: 10.0/41; 6,751,181; .92/.85; detail 4.171. 0: 20.0/41; 6,660,670; .05/4.76; detail 4.301. +1: 33.3/49; 6,338,899; .02/7.92; detail 4.160; cap, clamp. +2: 33.3/98; 6,245,521; 0/11.03; detail 3.754; cap, clamp. |
| Even / handheld | A P2 | -2: 5.0/42; 6,696,325; 3.14/.15; detail 3.846. 0: 20.0/42; 7,099,538; .03/4.11; detail 4.042. +2: 33.3/100; 6,234,145; 0/12.49; detail 3.190; cap, clamp. |
| Even / handheld | B P2 | -2: 5.0/49; 6,319,969; 4.31/.26; detail 3.646. -1: 10.0/49; 6,758,658; 1.11/1.29; detail 4.026. 0: 20.0/49; 6,592,191; .44/5.14; detail 4.091. +1: 33.3/59; 6,260,555; .04/8.73; detail 3.928; cap, clamp. +2: 33.3/116; 6,558,089; 0/11.56; detail 3.883; cap, clamp. |
| Dim / stabilized | A P1 | -2: 5.0/52; 6,347,138; 3.31/.26; detail 3.614. 0: 20.0/52; 6,543,291; .02/5.32; detail 4.055. +2: 79.9/52; 5,378,370; 0/11.60; detail 3.430. |
| Dim / stabilized (repeat) | A P2 | -2: 5.0/55; 6,391,218; 3.10/.27; detail 3.559. 0: 20.0/55; 6,547,151; .01/5.59; detail 3.982. +2: 33.3/131; 6,353,483; 0/11.85; detail 3.741; cap, clamp. |
| Dim / stabilized (repeat) | A P3 | -2: 5.0/53; 6,354,311; 3.21/.27; detail 3.593. 0: 20.0/53; 6,591,721; .02/5.26; detail 4.070. +2: 66.7/64; 5,469,114; 0/11.64; detail 3.431; cap, clamp. |
| Dim / stabilized | A P2 | -2: 5.0/55; 6,441,484; 3.20/.27; detail 3.615. 0: 20.0/55; 6,627,502; .01/5.41; detail 4.075. +2: 33.3/131; 6,423,658; 0/11.65; detail 3.816; cap, clamp. |
| Dim / stabilized | A P3 | -2: 5.0/56; 6,461,394; 3.12/.27; detail 3.613. 0: 20.0/56; 6,589,011; .02/5.42; detail 4.060. +2: 66.7/67; 5,522,370; 0/11.69; detail 3.429; cap, clamp. |
| Dim / stabilized | B P1 | -2: 5.0/57; 6,482,446; 3.12/.27; detail 3.613. -1: 10.0/57; 6,888,577; .45/1.62; detail 4.002. 0: 20.0/57; 6,631,446; .02/5.47; detail 4.065. +1: 40.0/57; 6,058,207; 0/8.91; detail 3.817. +2: 79.9/57; 5,417,053; 0/11.73; detail 3.419. |
| Dim / stabilized | B P2 | -2: 5.0/58; 6,395,296; 3.67/.27; detail 3.453. -1: 10.0/58; 6,812,310; .57/1.62; detail 3.818. 0: 20.0/58; 6,580,190; .02/5.46; detail 3.893. +1: 33.3/70; 6,194,276; 0/8.86; detail 3.684; cap, clamp. +2: 33.3/138; 6,280,722; 0/11.69; detail 3.693; cap, clamp. |
| Dim / stabilized | B P3 | -2: 5.0/60; 6,506,032; 3.00/.28; detail 3.661. -1: 10.0/60; 6,872,498; .40/1.85; detail 4.039. 0: 20.0/60; 6,679,686; .02/5.67; detail 4.094. +1: 40.0/60; 6,070,355; 0/9.03; detail 3.826. +2: 66.7/72; 5,572,282; 0/11.79; detail 3.419; cap, clamp. |
| Dim / handheld | A P2 | -2: 5.0/53; 6,347,496; 2.74/.19; detail 3.594. 0: 20.0/53; 6,573,631; .01/4.83; detail 3.846. +2: 33.3/126; 6,210,961; 0/12.63; detail 3.353; cap, clamp. |
| Dim / handheld | B P2 | -2: 5.0/54; 6,222,955; 4.56/.26; detail 3.349. -1: 10.0/54; 6,640,980; .95/1.08; detail 3.687. 0: 20.0/54; 6,520,456; .10/4.81; detail 3.777. +1: 33.3/65; 6,149,079; .01/8.45; detail 3.602; cap, clamp. +2: 33.3/128; 6,356,299; 0/11.48; detail 3.588; cap, clamp. |

The two short stabilized dim A P2/P3 rows marked repeat were deliberate repeat data after recovery from an application-background/Camera-close interruption. The interruption did not yield an accepted capture set or retained prototype evidence.

## Exposure-planner observations

Measured requested-to-planned exposure-product agreement was within approximately 0.01 EV on the cap-affected frames. Examples: HDR A P2 +2 planned 1.9995 EV at 33.333 ms / ISO 163; HDR A P3 +2 planned 1.9946 EV at 66.667 ms / ISO 86; dim B P2 +1/+2 planned 1.0095/1.9992 EV at 33.333 ms / ISO 70/139; and dim B P3 +2 planned 2.0013 EV at 66.667 ms / ISO 72. Uncapped +2 frames used 79.931 ms at baseline ISO.

The source metrics do not demonstrate merged-image quality or noise performance, but they show that the capped endpoint still provided the intended bright exposure: across the representative HDR/even/dim runs, capped +2 frames stayed at 11.03-12.63% near-white versus 11.06-11.77% for comparable uncapped +2 frames. The capped bright endpoints also remained near-black 0% in every accepted set. This supports, but does not prove, that ISO redistribution preserved useful tonal coverage on this device.

## Candidate decision table

| Decision | Measured evidence | Engineering inference | Recommendation |
| --- | --- | --- | --- |
| Capture mechanism | 22/22 manual `captureBurst` sets completed with actual shutter/ISO, sensor, and JPEG completion evidence. | Camera2 manual bursts are viable as a basis for the next **development** prototype on this S25 Ultra. Cross-device behavior remains unproven. | Use manual Camera2 `captureBurst` for the next prototype. |
| Frame count | A P2 handheld bursts were 492.9-521.1 ms and about 19-20 MB; B P2 were 642.6-654.9 ms and about 31-32 MB. Both include the same -2/+2 endpoints. | The two B intermediates add coverage, but this experiment did not show a downstream merge benefit sufficient to pay the approximately 130 ms and roughly 12 MB extra cost. | Candidate A: 3 frames. |
| EV spacing | A -2/0/+2 endpoints completed across HDR, even, and dim scenes. | Two-stop endpoint separation is the strongest next candidate; it preserves the tested tonal spread with fewer frames. | -2 / 0 / +2 EV. |
| Positive-EV shutter | P1 +2 was 79.931 ms; P2 was 33.333 ms with ISO redistribution and comparable endpoint clipping metrics; P3 was 66.667 ms and has less handheld-duration benefit. | A temporary ceiling is justified for the next handheld experiment, but it is not a final product policy. | Experiment with about 1/30 s for positive EV and redistribute ISO. |
| Tonal coverage under cap | Cap-affected product error was within approximately 0.01 EV; capped +2 near-white was 11.03-12.63%, with 0% near-black. | The planner preserved enough sampled source exposure coverage to continue testing; it does not validate noise, dynamic range, or a merge result. | Retain cap + ISO redistribution in the next prototype only. |

## Quick Camera regression

After the Balanced runs, a normal handheld Quick Camera capture was completed through the existing user flow and appeared in the shoot gallery. No Quick Camera source files were changed.

## Risks and deferred work

- These results are one physical Android device and three indoor scene types; no cross-device, thermal-duration, or repeated-session study exists.
- The simple metrics are source-frame proxies. They do not measure noise, merge alignment, ghosting, HDR output quality, or user-perceived sharpness.
- Movement windows were captured for evidence only. There is deliberately no acceptance threshold or movement enforcement.
- The debug prototype has no production Balanced UI, CaptureSet/ExposureAsset SQLite persistence, owned-file cleanup contract, upload path, HDR merge, 0.6x lens support, or iOS implementation.
- App backgrounding closed the Camera2 session during setup once; subsequent fresh foreground runs completed. Lifecycle/recovery behavior needs explicit treatment before any user-facing capture flow.

## Exact next production implementation step

Create a separately approved Android development prototype that keeps the debug/release source-set boundary, captures a manual Camera2 `-2/0/+2` burst with the temporary approximately 1/30 s positive-EV ceiling and ISO redistribution, and writes recoverable shoot-owned draft source files plus interruption state. Do not add production UI, production SQLite schema, upload/sync, HDR merge, or movement enforcement until that prototype validates lifecycle and image-quality outcomes.
