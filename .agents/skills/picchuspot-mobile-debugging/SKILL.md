---
name: picchuspot-mobile-debugging
description: Diagnose PicchuSpotMobile TypeScript/Kotlin/Gradle/Metro/ADB failures, Camera2 or Expo native-module bugs, orientation, memory, startup and gallery performance. Use when something fails or is slow; do not use to redesign screens, rewrite the stack or change protected services.
---

# PicchuSpot mobile debugging

Read [AGENTS.md](../../../AGENTS.md). Stay inside the authorized bug or investigation. Findings do not authorize production writes, SDK upgrades, dependency changes, store submission or destructive device actions.

## Reproduce before patching

1. Record branch/head, relevant diff, installed versions, host OS, command working directory, build variant and device/API when applicable. Inspect existing scripts and evidence before inventing commands.
2. Classify the failure: wrong shell/path; host/JDK/Gradle startup; compiler; native linking/build; install/signature; Metro connection; runtime lifecycle; camera/session; file/database state; or performance.
3. Save the first causal error, file/line or native stack trace. A final `BUILD FAILED`, a deprecated-API warning, an absent script and a disconnected phone are different findings. Mark a root cause as a hypothesis until supported.
4. Make the smallest correction at the failing boundary, run the narrow check, then the affected regression. If a similar patch fails again, gather the new evidence rather than adding serial null guards blindly.

## Windows and native-build discipline

- From the repository root the generated Gradle wrapper is `android/gradlew.bat`; from inside `android` it is `./gradlew.bat`. Verify location and wrapper existence rather than repeating a broken relative path.
- Read `scripts/start-android-usb.ps1` before changing ports or ADB forwarding. Confirm the target device when multiple devices are connected; never hard-code the owner's serial into source or shared logs.
- Reuse the established development build for custom native modules. Expo Go is not a substitute for testing those modules. A Kotlin/config change needs an appropriate new native build; a JS-only change does not automatically require one.
- Keep CNG-generated root native folders untracked. Fix source/config/plugin inputs, not an untracked generated file as the durable solution. Do not run destructive prebuild/clean/uninstall/data-clear commands merely to try something.
- If a JDK/temp workaround is evidenced, scope it to the process and record it. Do not disable antivirus/firewall or change machine-wide policy as a speculative fix. Ask for a host-side command only when this execution environment cannot run the necessary step.

## Camera and lifecycle investigations

Read the relevant documents under `docs/camera/`, [capture model](../../../docs/capture-model.md), and the current Kotlin module. Quick production behavior and debug Balanced diagnostics are different paths.

Trace request tags, sensor timestamps, JPEG arrival, selected dimensions, requested/actual controls, timeout, cancellation and file ownership separately. Capabilities and nullable metadata vary; do not infer lens names or universal support from the S25. A collector must not claim exact association merely because delivery order looked plausible.

Do not promote candidate EV/count/shutter values to universal production policy. Distinguish requested controls, actual controls and the achieved bracket after clamping. Separate camera-clock intervals from unrelated clock domains, preparation from burst time, and burst completion from durable-save/UI-ready time.

Use algorithmic fixtures for permutations, missing/duplicate/late events and cancellation where feasible. Use real hardware for optical quality, motion and sensor-driven rotation. ADB display overrides are not physical-rotation evidence. Preserve debug/release source-set boundaries and document any independently reproduced Quick regression before touching it.

## Performance investigations

Measure the actual interaction on a named build/device: gallery scroll, shutter-to-ready, cold start or memory across repeated capture/open/close. Identify whether JS, image decode, native work, I/O or rendering is responsible. Change one supported bottleneck and repeat the same measurement. Do not prescribe memoization, FlashList, state libraries or compiler toggles without evidence; do not compare development profiling numbers with release performance as equivalent.

## Handoff

Use `$picchuspot-offline-media` as well when the failure crosses file/SQLite ownership. Then use `$picchuspot-mobile-verification`. Report reproduction, evidence, causal explanation, minimal fix, measured before/after where relevant and unresolved risks. Keep private photos, device identifiers, tokens and addresses out of public diagnostics.

References and reviewed upstream manifests: [agent skills](../../../docs/agent-skills.md).
