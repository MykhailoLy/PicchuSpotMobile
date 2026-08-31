package expo.modules.picchuspotcameradiagnostics

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Rect
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureFailure
import android.hardware.camera2.CaptureResult
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.TotalCaptureResult
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Range
import android.util.Rational
import android.util.Size
import android.util.SizeF
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume

private const val REPORT_DIRECTORY = "camera-diagnostics"
private const val REPORT_SCHEMA_VERSION = 1
private const val AE_SETTLED_FRAME_COUNT = 2
private const val AE_PHASE_TIMEOUT_MS = 2_500L
private const val SINGLE_CAPTURE_TIMEOUT_MS = 1_500L
private const val BURST_TIMEOUT_MS = 3_000L
private const val DIAGNOSTIC_BURST_COUNT = 3
private const val ZOOM_SETTLED_FRAME_COUNT = 2
private const val ZOOM_MINIMUM_OBSERVATION_FRAMES = 4
private const val ZOOM_MINIMUM_OBSERVATION_MS = 750L
private const val ZOOM_PHASE_TIMEOUT_MS = 3_000L

/** Development build implementation; release registers an inert same-name stub. */
class PicchuSpotCameraDiagnosticsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PicchuSpotCameraDiagnostics")

    AsyncFunction("getCameraDiagnosticsAsync").SuspendBody<Map<String, Any?>> {
      withContext(Dispatchers.Default) {
        buildInventory().serialized
      }
    }

    AsyncFunction("runDiagnosticsAsync").SuspendBody<Map<String, Any?>> {
      withContext(Dispatchers.IO) {
        runDiagnostics()
      }
    }

    AsyncFunction("runSensorDiagnosticsAsync").SuspendBody<Map<String, Any?>> {
      withContext(Dispatchers.IO) {
        runSensorDiagnostics()
      }
    }
  }

  private fun runSensorDiagnostics(): Map<String, Any?> {
    val diagnostics = AndroidSensorDiagnostics(requireContext())
    val report = linkedMapOf<String, Any?>(
      "schemaVersion" to REPORT_SCHEMA_VERSION,
      "kind" to "android-sensor-diagnostic-run",
      "capturedAtUtc" to nowUtc(),
      "android" to androidInfo(),
      "measurements" to diagnostics.runProbe(),
    )
    val cacheFilename = writeReport(report, "sensor-diagnostic")
    report["cacheReport"] = mapOf(
      "written" to (cacheFilename != null),
      "filename" to cacheFilename,
    )
    return report
  }

  @SuppressLint("MissingPermission")
  private suspend fun runDiagnostics(): Map<String, Any?> {
    val inventory = buildInventory()
    val selected = selectCamera(inventory.cameras)
    val cameraGranted = hasCameraPermission()
    val diagnosticResults = linkedMapOf<String, Any?>(
      "aeCompensation" to unsupportedResult(
        "not-run",
        "A rear logical camera was not selected.",
      ),
      "manualSensor" to unsupportedResult(
        "not-run",
        "A rear logical camera was not selected.",
      ),
      "burst" to unsupportedResult(
        "not-run",
        "A rear logical camera was not selected.",
      ),
      "zoomRatios" to unsupportedResult(
        "not-run",
        "A rear logical camera was not selected.",
      ),
      "manualBurst" to unsupportedResult(
        "not-run",
        "A rear logical camera was not selected.",
      ),
    )

    val report = linkedMapOf<String, Any?>(
      "schemaVersion" to REPORT_SCHEMA_VERSION,
      "kind" to "android-camera2-diagnostic-run",
      "capturedAtUtc" to nowUtc(),
      "android" to androidInfo(),
      "permission" to mapOf("cameraGranted" to cameraGranted),
      "cameraInventory" to inventory.serialized,
      "selection" to mapOf(
        "cameraId" to selected?.id,
        "reason" to selectionReason(selected),
        "candidates" to inventory.cameras.map { it.id },
      ),
      "diagnostics" to diagnosticResults,
    )

    if (!cameraGranted) {
      diagnosticResults["aeCompensation"] = unsupportedResult(
        "permission-denied",
        "Camera permission is required for dynamic Camera2 diagnostics.",
      )
      diagnosticResults["manualSensor"] = unsupportedResult(
        "permission-denied",
        "Camera permission is required for dynamic Camera2 diagnostics.",
      )
      diagnosticResults["burst"] = unsupportedResult(
        "permission-denied",
        "Camera permission is required for dynamic Camera2 diagnostics.",
      )
      diagnosticResults["zoomRatios"] = unsupportedResult(
        "permission-denied",
        "Camera permission is required for dynamic Camera2 diagnostics.",
      )
      diagnosticResults["manualBurst"] = unsupportedResult(
        "permission-denied",
        "Camera permission is required for dynamic Camera2 diagnostics.",
      )
    } else if (selected != null) {
      runSelectedCameraDiagnostics(selected, diagnosticResults)
    }

    val cacheFilename = writeReport(report)
    report["cacheReport"] = mapOf(
      "written" to (cacheFilename != null),
      "filename" to cacheFilename,
    )
    return report
  }

  @SuppressLint("MissingPermission")
  private suspend fun runSelectedCameraDiagnostics(
    camera: RearCamera,
    results: MutableMap<String, Any?>,
  ) {
    var session: DiagnosticCameraSession? = null

    try {
      session = openCameraSession(camera.id, camera.characteristics)
      val aeResult = runAeCompensationDiagnostic(camera, session)
      results["aeCompensation"] = aeResult.serialized
      results["manualSensor"] = runManualSensorDiagnostic(
        camera,
        session,
        aeResult,
      )
      results["zoomRatios"] = runZoomRatioDiagnostic(camera, session)
      results["manualBurst"] = runManualBurstDiagnostic(
        camera,
        session,
        aeResult,
      )
      results["burst"] = runBurstDiagnostic(camera, session)
    } catch (error: Throwable) {
      val message = error.message ?: error::class.java.simpleName
      val failed = mapOf(
        "supported" to false,
        "status" to "session-error",
        "error" to message,
      )
      results["aeCompensation"] = failed
      results["manualSensor"] = failed
      results["burst"] = failed
      results["zoomRatios"] = failed
      results["manualBurst"] = failed
    } finally {
      session?.close()
    }
  }

  private suspend fun runAeCompensationDiagnostic(
    camera: RearCamera,
    session: DiagnosticCameraSession,
  ): AeDiagnosticResult {
    val range = camera.characteristics.get(
      CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE,
    )
    val step = camera.characteristics.get(
      CameraCharacteristics.CONTROL_AE_COMPENSATION_STEP,
    )

    if (range == null || step == null || rationalValue(step) <= 0.0) {
      return AeDiagnosticResult(
        serialized = unsupportedResult(
          "unsupported",
          "The camera did not advertise an AE compensation range and step.",
        ),
        baseline = null,
      )
    }
    val aeModes = camera.characteristics.get(
      CameraCharacteristics.CONTROL_AE_AVAILABLE_MODES,
    ) ?: intArrayOf()
    if (!aeModes.contains(CaptureRequest.CONTROL_AE_MODE_ON)) {
      return AeDiagnosticResult(
        serialized = unsupportedResult(
          "unsupported",
          "The camera did not advertise CONTROL_AE_MODE_ON for an AE compensation probe.",
        ),
        baseline = null,
      )
    }

    val phases = listOf(
      nearestCompensation(range, step, 0.0),
      nearestCompensation(range, step, -2.0),
      nearestCompensation(range, step, 2.0),
    )
    val phaseResults = phases.map { target ->
      val result = awaitAePhase(
        session,
        target,
      )
      result
    }

    return AeDiagnosticResult(
      serialized = mapOf(
        "supported" to true,
        "status" to if (phaseResults.all { it["status"] == "converged" }) {
          "converged"
        } else {
          "completed-with-timeouts-or-errors"
        },
        "range" to rangeMap(range),
        "step" to rationalMap(step),
        "phases" to phaseResults,
        "notes" to listOf(
          "The three requested points are diagnostic probes only, not a production bracket definition.",
          "Nearest supported integer compensation indices were selected from the advertised range and step.",
        ),
      ),
      baseline = phaseResults.firstOrNull(),
    )
  }

  private suspend fun runManualSensorDiagnostic(
    camera: RearCamera,
    session: DiagnosticCameraSession,
    aeResult: AeDiagnosticResult,
  ): Map<String, Any?> {
    if (!camera.supportsManualSensor) {
      return unsupportedResult(
        "unsupported",
        "MANUAL_SENSOR was not advertised by this camera.",
      )
    }

    val baseline = aeResult.baseline
    val baselineExposure = baseline?.get("exposureTimeNs") as? Long
    val baselineIso = baseline?.get("iso") as? Int
    val exposureRange = camera.characteristics.get(
      CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE,
    )
    val isoRange = camera.characteristics.get(
      CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE,
    )

    if (baselineExposure == null || baselineIso == null) {
      return mapOf(
        "supported" to true,
        "status" to "baseline-unavailable",
        "advertisedCapability" to "MANUAL_SENSOR",
        "reason" to "The AE baseline did not return both exposure time and ISO.",
      )
    }

    val exposure = clampLong(baselineExposure, exposureRange)
    val iso = clampInt(baselineIso, isoRange)
    val manualAttempt = try {
      val request = buildManualRequest(session, exposure, iso)
      val capture = awaitSingleCapture(session, request)
      mapOf(
        "status" to capture.status,
        "requestedExposureTimeNs" to exposure,
        "requestedIso" to iso,
        "actualExposureTimeNs" to capture.exposureTimeNs,
        "actualIso" to capture.iso,
        "aeState" to capture.aeState,
        "aeStateName" to aeStateName(capture.aeState),
        "frameNumber" to capture.frameNumber,
        "completedAtElapsedRealtimeNs" to capture.completedAtElapsedRealtimeNs,
        "verified" to (
          capture.status == "completed" &&
            capture.exposureTimeNs == exposure &&
            capture.iso == iso
          ),
      )
    } catch (error: Throwable) {
      mapOf(
        "status" to "request-error",
        "requestedExposureTimeNs" to exposure,
        "requestedIso" to iso,
        "error" to (error.message ?: error::class.java.simpleName),
      )
    }

    val probe = listOf(0.5, 1.0, 2.0).map { multiplier ->
      val requestedExposure = clampLong(
        (exposure.toDouble() * multiplier).toLong(),
        exposureRange,
      )
      try {
        val request = buildManualRequest(session, requestedExposure, iso)
        val capture = awaitSingleCapture(session, request)
        mapOf(
          "multiplier" to multiplier,
          "requestedExposureTimeNs" to requestedExposure,
          "requestedIso" to iso,
          "status" to capture.status,
          "actualExposureTimeNs" to capture.exposureTimeNs,
          "actualIso" to capture.iso,
          "frameNumber" to capture.frameNumber,
          "completedAtElapsedRealtimeNs" to capture.completedAtElapsedRealtimeNs,
        )
      } catch (error: Throwable) {
        mapOf(
          "multiplier" to multiplier,
          "requestedExposureTimeNs" to requestedExposure,
          "requestedIso" to iso,
          "status" to "request-error",
          "error" to (error.message ?: error::class.java.simpleName),
        )
      }
    }

    return mapOf(
      "supported" to true,
      "status" to if (manualAttempt["status"] == "completed") {
        "completed"
      } else {
        "completed-with-error"
      },
      "advertisedCapability" to "MANUAL_SENSOR",
      "aeBaseline" to baseline,
      "manualAttempt" to manualAttempt,
      "temporaryThreeRequestProbe" to mapOf(
        "status" to if (probe.all { it["status"] == "completed" }) {
          "completed"
        } else {
          "completed-with-errors"
        },
        "multipliers" to listOf(0.5, 1.0, 2.0),
        "frames" to probe,
        "note" to "This is a temporary feasibility probe, not a production bracket definition.",
      ),
    )
  }

  private suspend fun runZoomRatioDiagnostic(
    camera: RearCamera,
    session: DiagnosticCameraSession,
  ): Map<String, Any?> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      return unsupportedResult(
        "unsupported-api-level",
        "CONTROL_ZOOM_RATIO requires Android API 30 or newer.",
      )
    }
    val range = camera.characteristics.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
      ?: return unsupportedResult(
        "unsupported",
        "The selected logical camera did not expose CONTROL_ZOOM_RATIO_RANGE.",
      )
    val candidates = mutableListOf(
      ZoomCandidate("minimum-supported", range.lower),
    )
    listOf(0.5f, 0.6f, 1.0f).forEach { ratio ->
      if (range.contains(ratio)) {
        candidates += ZoomCandidate("candidate-$ratio", ratio)
      }
    }
    val skipped = listOf(0.5f, 0.6f, 1.0f).filterNot(range::contains).map { ratio ->
      mapOf(
        "requestedZoomRatio" to ratio.toDouble(),
        "status" to "outside-advertised-range",
      )
    }
    val probes = candidates.map { candidate ->
      try {
        awaitZoomPhase(session, candidate)
      } catch (error: Throwable) {
        mapOf(
          "label" to candidate.label,
          "requestedZoomRatio" to candidate.ratio.toDouble(),
          "status" to "request-error",
          "error" to errorMessage(error),
          "outputSize" to sizeMap(session.outputSize),
        )
      }
    }
    return mapOf(
      "supported" to true,
      "status" to if (probes.all { it["status"] == "settled" }) {
        "completed"
      } else {
        "completed-with-timeouts-or-errors"
      },
      "advertisedZoomRatioRange" to rangeMap(range),
      "captureResultKeyAvailability" to zoomResultKeyAvailability(camera.characteristics),
      "probes" to probes,
      "skippedCandidates" to skipped,
      "note" to "Ratios are diagnostic requests only. No ratio is assigned a Samsung lens or marketing label.",
    )
  }

  private suspend fun runManualBurstDiagnostic(
    camera: RearCamera,
    session: DiagnosticCameraSession,
    aeResult: AeDiagnosticResult,
  ): Map<String, Any?> {
    if (!camera.supportsManualSensor || !camera.supportsBurstCapture) {
      return unsupportedResult(
        "unsupported",
        "Both MANUAL_SENSOR and BURST_CAPTURE must be advertised.",
      )
    }
    val baseline = aeResult.baseline
    val baselineExposure = baseline?.get("exposureTimeNs") as? Long
    val baselineIso = baseline?.get("iso") as? Int
    val exposureRange = camera.characteristics.get(
      CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE,
    )
    val isoRange = camera.characteristics.get(
      CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE,
    )
    if (baselineExposure == null || baselineIso == null) {
      return mapOf(
        "supported" to true,
        "status" to "baseline-unavailable",
        "reason" to "The validated AE baseline did not return exposure time and ISO.",
      )
    }
    val iso = clampInt(baselineIso, isoRange)
    val specifications = listOf(0.5, 1.0, 2.0).mapIndexed { index, multiplier ->
      ManualBurstSpecification(
        requestIndex = index,
        multiplier = multiplier,
        exposureTimeNs = clampLong(
          (baselineExposure.toDouble() * multiplier).toLong(),
          exposureRange,
        ),
        iso = iso,
      )
    }
    return try {
      val requests = specifications.map { specification ->
        buildManualRequest(
          session = session,
          exposureTimeNs = specification.exposureTimeNs,
          iso = specification.iso,
          requestTag = specification.requestIndex,
        )
      }
      val metadata = specifications.map { specification ->
        mapOf(
          "requestedExposureTimeNs" to specification.exposureTimeNs,
          "requestedIso" to specification.iso,
          "diagnosticMultiplier" to specification.multiplier,
        )
      }
      val burst = awaitBurst(session, requests, metadata)
      mapOf(
        "supported" to true,
        "status" to burst.status,
        "advertisedCapabilities" to listOf("MANUAL_SENSOR", "BURST_CAPTURE"),
        "aeBaseline" to baseline,
        "requestCount" to specifications.size,
        "requestSubmittedAtElapsedRealtimeNs" to burst.submittedAtElapsedRealtimeNs,
        "sequenceId" to burst.sequenceId,
        "completionCount" to burst.completionCount,
        "failureCount" to burst.failureCount,
        "requestOrder" to specifications.map { it.requestIndex },
        "completionOrder" to burst.frames.mapNotNull { it["requestIndex"] as? Int },
        "frames" to burst.frames,
        "interFrameSensorIntervalsMs" to burst.interFrameSensorIntervalsMs,
        "interFrameCompletionIntervalsMs" to burst.interFrameCompletionIntervalsMs,
        "note" to "This three-request manual captureBurst is diagnostic only and does not define product bracket values.",
      )
    } catch (error: Throwable) {
      mapOf(
        "supported" to true,
        "status" to "request-error",
        "error" to errorMessage(error),
        "requests" to specifications.map { specification ->
          mapOf(
            "requestIndex" to specification.requestIndex,
            "requestedExposureTimeNs" to specification.exposureTimeNs,
            "requestedIso" to specification.iso,
            "diagnosticMultiplier" to specification.multiplier,
          )
        },
      )
    }
  }

  private suspend fun runBurstDiagnostic(
    camera: RearCamera,
    session: DiagnosticCameraSession,
  ): Map<String, Any?> {
    if (!camera.supportsBurstCapture) {
      return unsupportedResult(
        "unsupported",
        "BURST_CAPTURE was not advertised by this camera.",
      )
    }

    val aeRange = camera.characteristics.get(
      CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE,
    )
    val aeStep = camera.characteristics.get(
      CameraCharacteristics.CONTROL_AE_COMPENSATION_STEP,
    )
    val baselineCompensation = if (aeRange != null && aeStep != null) {
      nearestCompensation(aeRange, aeStep, 0.0)
    } else {
      Compensation(0, null, 0.0)
    }

    return try {
      val requests = (0 until DIAGNOSTIC_BURST_COUNT).map { requestIndex ->
        buildAeRequest(session, baselineCompensation.index, requestIndex)
      }
      val burst = awaitBurst(session, requests)
      mapOf(
        "supported" to true,
        "status" to burst.status,
        "advertisedCapability" to "BURST_CAPTURE",
        "requestCount" to DIAGNOSTIC_BURST_COUNT,
        "requestSubmittedAtElapsedRealtimeNs" to burst.submittedAtElapsedRealtimeNs,
        "completionCount" to burst.completionCount,
        "failureCount" to burst.failureCount,
        "frames" to burst.frames,
        "interFrameSensorIntervalsMs" to burst.interFrameSensorIntervalsMs,
        "interFrameCompletionIntervalsMs" to burst.interFrameCompletionIntervalsMs,
        "note" to "This is a temporary small burst feasibility probe, not a production bracket definition.",
      )
    } catch (error: Throwable) {
      mapOf(
        "supported" to true,
        "status" to "request-error",
        "advertisedCapability" to "BURST_CAPTURE",
        "requestCount" to DIAGNOSTIC_BURST_COUNT,
        "error" to (error.message ?: error::class.java.simpleName),
      )
    }
  }

  private suspend fun awaitAePhase(
    session: DiagnosticCameraSession,
    compensation: Compensation,
  ): Map<String, Any?> {
    val request = buildAeRequest(session, compensation.index)
    return suspendCancellableCoroutine { continuation ->
      val startedAt = SystemClock.elapsedRealtime()
      var frameCount = 0
      var stableFrames = 0
      var lastObservation = CaptureObservation.empty()
      lateinit var timeout: Runnable

      fun finish(status: String) {
        if (!continuation.isActive) {
          return
        }
        session.handler.removeCallbacks(timeout)
        try {
          session.session.stopRepeating()
        } catch (_: Throwable) {
          // The session may already be closing after a device error.
        }
        continuation.resume(
          mapOf(
            "status" to status,
            "targetEv" to compensation.targetEv,
            "requestedCompensationIndex" to compensation.index,
            "requestedEv" to compensation.requestedEv,
            "exposureTimeNs" to lastObservation.exposureTimeNs,
            "iso" to lastObservation.iso,
            "aeState" to lastObservation.aeState,
            "aeStateName" to aeStateName(lastObservation.aeState),
            "convergenceFrames" to frameCount,
            "convergenceTimeMs" to (SystemClock.elapsedRealtime() - startedAt),
            "settled" to (status == "converged"),
            "sensorTimestampNs" to lastObservation.sensorTimestampNs,
          ),
        )
      }

      timeout = Runnable { finish("timeout") }
      session.handler.postDelayed(timeout, AE_PHASE_TIMEOUT_MS)

      val callback = object : CameraCaptureSession.CaptureCallback() {
        override fun onCaptureCompleted(
          captureSession: CameraCaptureSession,
          captureRequest: CaptureRequest,
          result: TotalCaptureResult,
        ) {
          frameCount += 1
          lastObservation = CaptureObservation.from(result)
          if (result.get(CaptureResult.CONTROL_AE_STATE) ==
            CaptureResult.CONTROL_AE_STATE_CONVERGED
          ) {
            stableFrames += 1
          } else {
            stableFrames = 0
          }
          if (stableFrames >= AE_SETTLED_FRAME_COUNT) {
            finish("converged")
          }
        }

        override fun onCaptureFailed(
          captureSession: CameraCaptureSession,
          captureRequest: CaptureRequest,
          failure: CaptureFailure,
        ) {
          finish("capture-failed")
        }
      }

      try {
        session.session.setRepeatingRequest(request, callback, session.handler)
      } catch (error: Throwable) {
        finish("request-error:${error.message ?: error::class.java.simpleName}")
      }

      continuation.invokeOnCancellation {
        try {
          session.session.stopRepeating()
        } catch (_: Throwable) {
          // Best-effort cancellation cleanup.
        }
        session.handler.removeCallbacks(timeout)
      }
    }
  }

  private suspend fun awaitZoomPhase(
    session: DiagnosticCameraSession,
    candidate: ZoomCandidate,
  ): Map<String, Any?> {
    val request = buildZoomRequest(session, candidate.ratio)
    return suspendCancellableCoroutine { continuation ->
      val startedAt = SystemClock.elapsedRealtime()
      var frameCount = 0
      var stableFrames = 0
      var lastActivePhysicalId: String? = null
      var lastResult = emptyMap<String, Any?>()
      val observedActivePhysicalIds = linkedMapOf<String, Int>()
      lateinit var timeout: Runnable

      fun finish(status: String) {
        if (!continuation.isActive) {
          return
        }
        session.handler.removeCallbacks(timeout)
        try {
          session.session.stopRepeating()
        } catch (_: Throwable) {
          // The diagnostic session may already be closing.
        }
        continuation.resume(
          linkedMapOf<String, Any?>(
            "label" to candidate.label,
            "requestedZoomRatio" to candidate.ratio.toDouble(),
            "status" to status,
            "observationFrames" to frameCount,
            "observationTimeMs" to (SystemClock.elapsedRealtime() - startedAt),
            "observedActivePhysicalCameraIds" to observedActivePhysicalIds.map { (cameraId, frames) ->
              mapOf("cameraId" to cameraId, "frames" to frames)
            },
            "outputSize" to sizeMap(session.outputSize),
          ) + lastResult,
        )
      }

      timeout = Runnable { finish("timeout") }
      session.handler.postDelayed(timeout, ZOOM_PHASE_TIMEOUT_MS)
      val callback = object : CameraCaptureSession.CaptureCallback() {
        override fun onCaptureCompleted(
          captureSession: CameraCaptureSession,
          captureRequest: CaptureRequest,
          result: TotalCaptureResult,
        ) {
          frameCount += 1
          lastResult = zoomResultMap(result)
          val actualZoom = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            result.get(CaptureResult.CONTROL_ZOOM_RATIO)
          } else {
            null
          }
          val activePhysicalId = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            result.get(CaptureResult.LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID)
          } else {
            null
          }
          activePhysicalId?.let { cameraId ->
            observedActivePhysicalIds[cameraId] =
              (observedActivePhysicalIds[cameraId] ?: 0) + 1
          }
          val ratioSettled = actualZoom == null ||
            kotlin.math.abs(actualZoom - candidate.ratio) <= 0.01f
          if (activePhysicalId == null || activePhysicalId == lastActivePhysicalId) {
            stableFrames += 1
          } else {
            stableFrames = 1
          }
          lastActivePhysicalId = activePhysicalId
          if (
            frameCount >= ZOOM_MINIMUM_OBSERVATION_FRAMES &&
            SystemClock.elapsedRealtime() - startedAt >= ZOOM_MINIMUM_OBSERVATION_MS &&
            ratioSettled &&
            stableFrames >= ZOOM_SETTLED_FRAME_COUNT
          ) {
            finish("settled")
          }
        }

        override fun onCaptureFailed(
          captureSession: CameraCaptureSession,
          captureRequest: CaptureRequest,
          failure: CaptureFailure,
        ) {
          lastResult = mapOf("failureFrameNumber" to failure.frameNumber)
          finish("capture-failed")
        }
      }

      try {
        session.session.setRepeatingRequest(request, callback, session.handler)
      } catch (error: Throwable) {
        lastResult = mapOf("error" to errorMessage(error))
        finish("request-error")
      }

      continuation.invokeOnCancellation {
        try {
          session.session.stopRepeating()
        } catch (_: Throwable) {
          // Best-effort cancellation cleanup.
        }
        session.handler.removeCallbacks(timeout)
      }
    }
  }

  private suspend fun awaitSingleCapture(
    session: DiagnosticCameraSession,
    request: CaptureRequest,
  ): CaptureObservation {
    return suspendCancellableCoroutine { continuation ->
      lateinit var timeout: Runnable

      fun finish(observation: CaptureObservation) {
        if (!continuation.isActive) {
          return
        }
        session.handler.removeCallbacks(timeout)
        continuation.resume(observation)
      }

      timeout = Runnable {
        finish(CaptureObservation.empty().copy(status = "timeout"))
      }
      session.handler.postDelayed(timeout, SINGLE_CAPTURE_TIMEOUT_MS)

      val callback = object : CameraCaptureSession.CaptureCallback() {
        override fun onCaptureCompleted(
          captureSession: CameraCaptureSession,
          captureRequest: CaptureRequest,
          result: TotalCaptureResult,
        ) {
          finish(CaptureObservation.from(result).copy(status = "completed"))
        }

        override fun onCaptureFailed(
          captureSession: CameraCaptureSession,
          captureRequest: CaptureRequest,
          failure: CaptureFailure,
        ) {
          finish(
            CaptureObservation.empty().copy(
              status = "capture-failed",
              frameNumber = failure.frameNumber,
            ),
          )
        }
      }

      try {
        session.session.capture(request, callback, session.handler)
      } catch (error: Throwable) {
        finish(
          CaptureObservation.empty().copy(
            status = "request-error:${error.message ?: error::class.java.simpleName}",
          ),
        )
      }

      continuation.invokeOnCancellation {
        session.handler.removeCallbacks(timeout)
      }
    }
  }

  private suspend fun awaitBurst(
    session: DiagnosticCameraSession,
    requests: List<CaptureRequest>,
    requestMetadata: List<Map<String, Any?>> = emptyList(),
  ): BurstObservation {
    return suspendCancellableCoroutine { continuation ->
      val submittedAt = SystemClock.elapsedRealtimeNanos()
      val started = mutableListOf<StartedFrame>()
      val startedByFrameNumber = mutableMapOf<Long, StartedFrame>()
      val completed = mutableListOf<Map<String, Any?>>()
      var failureCount = 0
      var sequenceId: Int? = null
      lateinit var timeout: Runnable

      fun finish(status: String) {
        if (!continuation.isActive) {
          return
        }
        session.handler.removeCallbacks(timeout)
        val sensorTimes = started.map { it.sensorTimestampNs }
        val completionTimes = completed.mapNotNull {
          it["completedAtElapsedRealtimeNs"] as? Long
        }
        continuation.resume(
          BurstObservation(
            status = status,
            submittedAtElapsedRealtimeNs = submittedAt,
            sequenceId = sequenceId,
            completionCount = completed.count { it["status"] != "capture-failed" },
            failureCount = failureCount,
            frames = completed,
            interFrameSensorIntervalsMs = sensorTimes.zipWithNext { first, second ->
              (second - first) / 1_000_000.0
            },
            interFrameCompletionIntervalsMs = completionTimes.zipWithNext {
                first,
                second,
              -> (second - first) / 1_000_000.0 },
          ),
        )
      }

      timeout = Runnable { finish("timeout") }
      session.handler.postDelayed(timeout, BURST_TIMEOUT_MS)

      val callback = object : CameraCaptureSession.CaptureCallback() {
        override fun onCaptureStarted(
          captureSession: CameraCaptureSession,
          request: CaptureRequest,
          timestamp: Long,
          frameNumber: Long,
        ) {
          val requestIndex = (request.tag as? Int)
            ?: requests.indexOf(request).takeIf { it >= 0 }
          val startedFrame = StartedFrame(
            sensorTimestampNs = timestamp,
            frameNumber = frameNumber,
            callbackElapsedRealtimeNs = SystemClock.elapsedRealtimeNanos(),
            requestIndex = requestIndex,
          )
          started += startedFrame
          startedByFrameNumber[frameNumber] = startedFrame
        }

        override fun onCaptureCompleted(
          captureSession: CameraCaptureSession,
          request: CaptureRequest,
          result: TotalCaptureResult,
        ) {
          val completedAt = SystemClock.elapsedRealtimeNanos()
          val startedFrame = startedByFrameNumber[result.frameNumber]
          val requestIndex = (request.tag as? Int) ?: startedFrame?.requestIndex
          val metadata = requestIndex?.let(requestMetadata::getOrNull).orEmpty()
          completed += linkedMapOf<String, Any?>(
            "status" to "completed",
            "callbackOrder" to completed.size,
            "requestIndex" to requestIndex,
            "frameNumber" to result.frameNumber,
            "captureStartedSensorTimestampNs" to startedFrame?.sensorTimestampNs,
            "captureStartedCallbackElapsedRealtimeNs" to startedFrame?.callbackElapsedRealtimeNs,
            "sensorTimestampNs" to result.get(CaptureResult.SENSOR_TIMESTAMP),
            "completedAtElapsedRealtimeNs" to completedAt,
            "exposureTimeNs" to result.get(CaptureResult.SENSOR_EXPOSURE_TIME),
            "iso" to result.get(CaptureResult.SENSOR_SENSITIVITY),
            "aeState" to result.get(CaptureResult.CONTROL_AE_STATE),
            "aeStateName" to aeStateName(result.get(CaptureResult.CONTROL_AE_STATE)),
          ) + metadata
          if (completed.size >= requests.size) {
            finish(if (failureCount == 0) "completed" else "completed-with-failures")
          }
        }

        override fun onCaptureFailed(
          captureSession: CameraCaptureSession,
          request: CaptureRequest,
          failure: CaptureFailure,
        ) {
          failureCount += 1
          val requestIndex = request.tag as? Int
          val metadata = requestIndex?.let(requestMetadata::getOrNull).orEmpty()
          completed += linkedMapOf<String, Any?>(
            "callbackOrder" to completed.size,
            "requestIndex" to requestIndex,
            "frameNumber" to failure.frameNumber,
            "status" to "capture-failed",
            "failureReason" to failure.reason,
            "wasImageCaptured" to failure.wasImageCaptured(),
            "completedAtElapsedRealtimeNs" to SystemClock.elapsedRealtimeNanos(),
          ) + metadata
          if (completed.size >= requests.size) {
            finish("completed-with-failures")
          }
        }

        override fun onCaptureSequenceAborted(
          captureSession: CameraCaptureSession,
          abortedSequenceId: Int,
        ) {
          sequenceId = abortedSequenceId
          finish("sequence-aborted")
        }

        override fun onCaptureSequenceCompleted(
          captureSession: CameraCaptureSession,
          completedSequenceId: Int,
          frameNumber: Long,
        ) {
          sequenceId = completedSequenceId
          if (completed.size < requests.size) {
            finish("sequence-completed-with-missing-callbacks")
          }
        }
      }

      try {
        sequenceId = session.session.captureBurst(requests, callback, session.handler)
      } catch (error: Throwable) {
        finish("request-error:${error.message ?: error::class.java.simpleName}")
      }

      continuation.invokeOnCancellation {
        session.handler.removeCallbacks(timeout)
      }
    }
  }

  @SuppressLint("MissingPermission")
  private fun openCameraSession(
    cameraId: String,
    characteristics: CameraCharacteristics,
  ): DiagnosticCameraSession {
    val manager = cameraManager()
    val yuvSizes = characteristics.get(
      CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP,
    )?.getOutputSizes(ImageFormat.YUV_420_888).orEmpty()
    val outputSize = chooseDiagnosticSize(yuvSizes)
      ?: throw IllegalStateException("No YUV_420_888 output size is available.")
    val thread = HandlerThread("PicchuSpotCameraDiagnostics-$cameraId").also {
      it.start()
    }
    val handler = Handler(thread.looper)
    val reader = ImageReader.newInstance(
      outputSize.width,
      outputSize.height,
      ImageFormat.YUV_420_888,
      3,
    )
    reader.setOnImageAvailableListener({ availableReader ->
      availableReader.acquireLatestImage()?.close()
    }, handler)

    var device: CameraDevice? = null
    return try {
      val openedDevice = openCamera(manager, cameraId, handler)
      device = openedDevice
      val captureSession = createCaptureSession(openedDevice, reader, handler)
      DiagnosticCameraSession(
        camera = openedDevice,
        session = captureSession,
        reader = reader,
        thread = thread,
        handler = handler,
        characteristics = characteristics,
        outputSize = outputSize,
      )
    } catch (error: Throwable) {
      device?.close()
      reader.close()
      thread.quitSafely()
      throw error
    }
  }

  @SuppressLint("MissingPermission")
  private fun openCamera(
    manager: CameraManager,
    cameraId: String,
    handler: Handler,
  ): CameraDevice {
    val latch = CountDownLatch(1)
    var camera: CameraDevice? = null
    var failure: Throwable? = null
    manager.openCamera(
      cameraId,
      object : CameraDevice.StateCallback() {
        override fun onOpened(openedCamera: CameraDevice) {
          camera = openedCamera
          latch.countDown()
        }

        override fun onDisconnected(disconnectedCamera: CameraDevice) {
          disconnectedCamera.close()
          failure = IllegalStateException("Camera disconnected.")
          latch.countDown()
        }

        override fun onError(errorCamera: CameraDevice, error: Int) {
          errorCamera.close()
          failure = IllegalStateException("Camera open failed with error code $error.")
          latch.countDown()
        }
      },
      handler,
    )
    if (!latch.await(5, TimeUnit.SECONDS)) {
      throw IllegalStateException("Timed out while opening camera $cameraId.")
    }
    failure?.let { throw it }
    return camera ?: throw IllegalStateException("Camera did not open.")
  }

  private fun createCaptureSession(
    device: CameraDevice,
    reader: ImageReader,
    handler: Handler,
  ): CameraCaptureSession {
    val latch = CountDownLatch(1)
    var captureSession: CameraCaptureSession? = null
    var failure: Throwable? = null
    device.createCaptureSession(
      listOf(reader.surface),
      object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(configuredSession: CameraCaptureSession) {
          captureSession = configuredSession
          latch.countDown()
        }

        override fun onConfigureFailed(failedSession: CameraCaptureSession) {
          failure = IllegalStateException("Camera capture session configuration failed.")
          latch.countDown()
        }
      },
      handler,
    )
    if (!latch.await(5, TimeUnit.SECONDS)) {
      throw IllegalStateException("Timed out while configuring the camera session.")
    }
    failure?.let { throw it }
    return captureSession ?: throw IllegalStateException("Camera session was not configured.")
  }

  private fun buildAeRequest(
    session: DiagnosticCameraSession,
    compensationIndex: Int,
    requestTag: Int? = null,
  ): CaptureRequest {
    val builder = session.camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
    builder.addTarget(session.reader.surface)
    requestTag?.let(builder::setTag)
    val aeModes = session.characteristics.get(
      CameraCharacteristics.CONTROL_AE_AVAILABLE_MODES,
    ) ?: intArrayOf()
    if (aeModes.contains(CaptureRequest.CONTROL_AE_MODE_ON)) {
      builder.set(
        CaptureRequest.CONTROL_AE_MODE,
        CaptureRequest.CONTROL_AE_MODE_ON,
      )
      if (session.characteristics.get(
          CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE,
        ) != null
      ) {
        builder.set(
          CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION,
          compensationIndex,
        )
      }
    }
    if (session.characteristics.get(CameraCharacteristics.CONTROL_AE_LOCK_AVAILABLE) == true) {
      builder.set(CaptureRequest.CONTROL_AE_LOCK, false)
    }
    return builder.build()
  }

  private fun buildManualRequest(
    session: DiagnosticCameraSession,
    exposureTimeNs: Long,
    iso: Int,
    requestTag: Int? = null,
  ): CaptureRequest {
    val builder = session.camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
    builder.addTarget(session.reader.surface)
    requestTag?.let(builder::setTag)
    builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_OFF)
    builder.set(CaptureRequest.SENSOR_EXPOSURE_TIME, exposureTimeNs)
    builder.set(CaptureRequest.SENSOR_SENSITIVITY, iso)
    return builder.build()
  }

  private fun buildZoomRequest(
    session: DiagnosticCameraSession,
    zoomRatio: Float,
  ): CaptureRequest {
    val builder = session.camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
    builder.addTarget(session.reader.surface)
    val aeModes = session.characteristics.get(
      CameraCharacteristics.CONTROL_AE_AVAILABLE_MODES,
    ) ?: intArrayOf()
    if (aeModes.contains(CaptureRequest.CONTROL_AE_MODE_ON)) {
      builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.set(CaptureRequest.CONTROL_ZOOM_RATIO, zoomRatio)
    }
    return builder.build()
  }

  private fun buildInventory(): InventoryResult {
    val manager = cameraManager()
    val discoveredIds = try {
      manager.cameraIdList.toList()
    } catch (error: Throwable) {
      return InventoryResult(
        serialized = mapOf(
          "schemaVersion" to REPORT_SCHEMA_VERSION,
          "generatedAtUtc" to nowUtc(),
          "android" to androidInfo(),
          "permission" to mapOf("cameraGranted" to hasCameraPermission()),
          "discoveredCameraIds" to emptyList<String>(),
          "rearCameraCount" to 0,
          "physicalCameraCount" to 0,
          "enumerationErrors" to listOf(
            mapOf("cameraId" to "<cameraIdList>", "error" to errorMessage(error)),
          ),
          "rearCameras" to emptyList<Map<String, Any?>>(),
          "physicalCameraCharacterizationErrors" to emptyList<Map<String, Any?>>(),
          "physicalCameras" to emptyList<Map<String, Any?>>(),
          "motionSensors" to AndroidSensorDiagnostics(requireContext()).inventory(),
          "notes" to inventoryNotes(),
        ),
        cameras = emptyList(),
      )
    }

    val errors = mutableListOf<Map<String, Any?>>()
    val cameras = discoveredIds.mapNotNull { id ->
      try {
        val characteristics = manager.getCameraCharacteristics(id)
        if (characteristics.get(CameraCharacteristics.LENS_FACING) !=
          CameraCharacteristics.LENS_FACING_BACK
        ) {
          null
        } else {
          rearCamera(id, characteristics)
        }
      } catch (error: Throwable) {
        errors += mapOf("cameraId" to id, "error" to errorMessage(error))
        null
      }
    }

    val physicalParents = linkedMapOf<String, MutableSet<String>>()
    cameras.filter { it.isLogical }.forEach { logicalCamera ->
      logicalCamera.physicalIds.forEach { physicalId ->
        physicalParents.getOrPut(physicalId) { linkedSetOf() }.add(logicalCamera.id)
      }
    }
    val physicalErrors = mutableListOf<Map<String, Any?>>()
    val physicalCameras = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      physicalParents.entries.sortedBy { it.key }.mapNotNull { (physicalId, parentIds) ->
        try {
          physicalCamera(
            id = physicalId,
            logicalParentIds = parentIds.toList().sorted(),
            independentlyOpenable = discoveredIds.contains(physicalId),
            characteristics = manager.getCameraCharacteristics(physicalId),
          )
        } catch (error: Throwable) {
          physicalErrors += mapOf(
            "physicalCameraId" to physicalId,
            "logicalParentCameraIds" to parentIds.toList().sorted(),
            "error" to errorMessage(error),
          )
          null
        }
      }
    } else {
      physicalParents.forEach { (physicalId, parentIds) ->
        physicalErrors += mapOf(
          "physicalCameraId" to physicalId,
          "logicalParentCameraIds" to parentIds.toList().sorted(),
          "error" to "Physical-only CameraCharacteristics queries require API 29 or newer.",
        )
      }
      emptyList()
    }

    val serialized = mapOf(
      "schemaVersion" to REPORT_SCHEMA_VERSION,
      "generatedAtUtc" to nowUtc(),
      "android" to androidInfo(),
      "permission" to mapOf("cameraGranted" to hasCameraPermission()),
      "discoveredCameraIds" to discoveredIds,
      "rearCameraCount" to cameras.size,
      "physicalCameraCount" to physicalCameras.size,
      "enumerationErrors" to errors,
      "rearCameras" to cameras.map { it.serialized },
      "physicalCameraCharacterizationErrors" to physicalErrors,
      "physicalCameras" to physicalCameras,
      "motionSensors" to AndroidSensorDiagnostics(requireContext()).inventory(),
      "notes" to inventoryNotes(),
    )
    return InventoryResult(serialized, cameras)
  }

  private fun rearCamera(
    id: String,
    characteristics: CameraCharacteristics,
  ): RearCamera {
    val capabilities = characteristics.get(
      CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES,
    ) ?: intArrayOf()
    val isLogical = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
      capabilities.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA)
    val physicalIds = if (isLogical && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      characteristics.physicalCameraIds.toList()
    } else {
      emptyList()
    }
    val activeArray = characteristics.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
    val pixelArray = characteristics.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE)
    val maxZoom = characteristics.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM)
    val serialized = mapOf(
      "cameraId" to id,
      "lensFacing" to "BACK",
      "topology" to mapOf(
        "kind" to if (isLogical) "logical" else "physical-or-single",
        "isLogicalMultiCamera" to isLogical,
        "physicalCameraIds" to physicalIds,
        "evidence" to if (isLogical) {
          "LOGICAL_MULTI_CAMERA and CameraCharacteristics.getPhysicalCameraIds()"
        } else {
          "No logical multi-camera capability was advertised for this camera ID."
        },
        "lensLabels" to emptyList<String>(),
        "mappingInference" to null,
      ),
      "hardwareLevel" to mapOf(
        "raw" to characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL),
        "name" to hardwareLevelName(
          characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL),
        ),
      ),
      "requestCapabilities" to mapOf(
        "raw" to capabilities.toList(),
        "names" to capabilities.map(::capabilityName),
      ),
      "supports" to mapOf(
        "manualSensor" to capabilities.contains(
          CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR,
        ),
        "burstCapture" to capabilities.contains(
          CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BURST_CAPTURE,
        ),
        "raw" to capabilities.contains(
          CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_RAW,
        ),
        "logicalMultiCamera" to isLogical,
      ),
      "lens" to mapOf(
        "focalLengthsMm" to characteristics.get(
          CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS,
        )?.map { it.toDouble() }.orEmpty(),
        "aperturesFNumber" to characteristics.get(
          CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES,
        )?.map { it.toDouble() }.orEmpty(),
        "minimumFocusDistanceDiopters" to characteristics.get(
          CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE,
        )?.toDouble(),
        "opticalStabilizationModes" to modeMap(
          characteristics.get(CameraCharacteristics.LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION),
          ::oisModeName,
        ),
      ),
      "flash" to mapOf(
        "available" to characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE),
      ),
      "zoom" to zoomMap(characteristics, activeArray, maxZoom),
      "aeCompensation" to aeCompensationMap(characteristics),
      "sensor" to mapOf(
        "exposureTimeRangeNs" to rangeMapOrNull(
          characteristics.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE),
        ),
        "sensitivityRangeIso" to rangeMapOrNull(
          characteristics.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE),
        ),
        "maxFrameDurationNs" to characteristics.get(
          CameraCharacteristics.SENSOR_INFO_MAX_FRAME_DURATION,
        ),
        "physicalSizeMm" to sizeFMap(
          characteristics.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE),
        ),
        "orientationDegrees" to characteristics.get(CameraCharacteristics.SENSOR_ORIENTATION),
        "timestampSource" to timestampSourceMap(characteristics),
        "activeArray" to rectMap(activeArray),
        "pixelArray" to sizeMap(pixelArray),
      ),
      "ae" to mapOf(
        "lockAvailable" to characteristics.get(CameraCharacteristics.CONTROL_AE_LOCK_AVAILABLE),
        "modes" to modeMap(
          characteristics.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_MODES),
          ::aeModeName,
        ),
        "antibanding" to modeMap(
          characteristics.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_ANTIBANDING_MODES),
          ::antibandingModeName,
        ),
        "fpsRanges" to characteristics.get(
          CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES,
        )?.map(::rangeMap).orEmpty(),
      ),
      "outputs" to outputMap(characteristics),
    )
    val pixelArea = pixelArray?.let { it.width.toLong() * it.height.toLong() } ?: 0L
    return RearCamera(
      id = id,
      characteristics = characteristics,
      serialized = serialized,
      isLogical = isLogical,
      supportsManualSensor = capabilities.contains(
        CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR,
      ),
      supportsBurstCapture = capabilities.contains(
        CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BURST_CAPTURE,
      ),
      physicalIds = physicalIds,
      pixelArea = pixelArea,
    )
  }

  private fun physicalCamera(
    id: String,
    logicalParentIds: List<String>,
    independentlyOpenable: Boolean,
    characteristics: CameraCharacteristics,
  ): Map<String, Any?> {
    val activeArray = characteristics.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
    val pixelArray = characteristics.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE)
    return mapOf(
      "physicalCameraId" to id,
      "logicalParentCameraIds" to logicalParentIds,
      "independentlyOpenable" to independentlyOpenable,
      "relationship" to if (independentlyOpenable) {
        "independently-openable-and-physical"
      } else {
        "physical-only-backing-logical-camera"
      },
      "lensLabels" to emptyList<String>(),
      "mappingInference" to null,
      "hardwareLevel" to mapOf(
        "raw" to characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL),
        "name" to hardwareLevelName(
          characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL),
        ),
      ),
      "lens" to mapOf(
        "focalLengthsMm" to characteristics.get(
          CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS,
        )?.map { it.toDouble() }.orEmpty(),
        "aperturesFNumber" to characteristics.get(
          CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES,
        )?.map { it.toDouble() }.orEmpty(),
        "minimumFocusDistanceDiopters" to characteristics.get(
          CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE,
        )?.toDouble(),
        "opticalStabilizationModes" to modeMap(
          characteristics.get(CameraCharacteristics.LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION),
          ::oisModeName,
        ),
      ),
      "sensor" to mapOf(
        "physicalSizeMm" to sizeFMap(
          characteristics.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE),
        ),
        "activeArray" to rectMap(activeArray),
        "pixelArray" to sizeMap(pixelArray),
        "exposureTimeRangeNs" to rangeMapOrNull(
          characteristics.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE),
        ),
        "sensitivityRangeIso" to rangeMapOrNull(
          characteristics.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE),
        ),
        "maxFrameDurationNs" to characteristics.get(
          CameraCharacteristics.SENSOR_INFO_MAX_FRAME_DURATION,
        ),
        "orientationDegrees" to characteristics.get(CameraCharacteristics.SENSOR_ORIENTATION),
        "timestampSource" to timestampSourceMap(characteristics),
      ),
      "zoom" to zoomMap(
        characteristics,
        activeArray,
        characteristics.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM),
      ),
      "outputs" to outputMap(characteristics),
    )
  }

  private fun zoomMap(
    characteristics: CameraCharacteristics,
    activeArray: Rect?,
    maxZoom: Float?,
  ): Map<String, Any?> {
    val maximum = maxZoom?.toDouble()
    val zoomRatioRange = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      characteristics.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
    } else {
      null
    }
    return mapOf(
      "minimumDigitalZoom" to 1.0,
      "maximumDigitalZoom" to maximum,
      "range" to mapOf("lower" to 1.0, "upper" to (maximum ?: 1.0)),
      "cropRegionAtMinimumZoom" to rectMap(activeArray),
      "cropRegionAtMaximumZoom" to if (activeArray != null && maximum != null) {
        cropRectAtZoom(activeArray, maximum)
      } else {
        null
      },
      "zoomRatioRange" to rangeMapOrNull(zoomRatioRange),
      "captureResultKeyAvailability" to zoomResultKeyAvailability(characteristics),
      "evidence" to "SCALER_AVAILABLE_MAX_DIGITAL_ZOOM; maximum crop is derived from SENSOR_INFO_ACTIVE_ARRAY_SIZE.",
    )
  }

  private fun zoomResultKeyAvailability(
    characteristics: CameraCharacteristics,
  ): Map<String, Boolean> {
    val keys = characteristics.availableCaptureResultKeys.orEmpty()
    return mapOf(
      "effectiveZoomRatio" to (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
          keys.contains(CaptureResult.CONTROL_ZOOM_RATIO)
        ),
      "activePhysicalCameraId" to (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
          keys.contains(CaptureResult.LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID)
        ),
      "activePhysicalSensorCropRegion" to (
        Build.VERSION.SDK_INT >= 35 &&
          keys.contains(CaptureResult.LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_SENSOR_CROP_REGION)
        ),
      "focalLength" to keys.contains(CaptureResult.LENS_FOCAL_LENGTH),
      "cropRegion" to keys.contains(CaptureResult.SCALER_CROP_REGION),
    )
  }

  private fun zoomResultMap(result: TotalCaptureResult): Map<String, Any?> = mapOf(
    "actualZoomRatio" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      result.get(CaptureResult.CONTROL_ZOOM_RATIO)?.toDouble()
    } else {
      null
    },
    "activePhysicalCameraId" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      result.get(CaptureResult.LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID)
    } else {
      null
    },
    "focalLengthMm" to result.get(CaptureResult.LENS_FOCAL_LENGTH)?.toDouble(),
    "cropRegion" to rectMap(result.get(CaptureResult.SCALER_CROP_REGION)),
    "activePhysicalSensorCropRegion" to if (Build.VERSION.SDK_INT >= 35) {
      rectMap(result.get(CaptureResult.LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_SENSOR_CROP_REGION))
    } else {
      null
    },
    "sensorTimestampNs" to result.get(CaptureResult.SENSOR_TIMESTAMP),
    "frameNumber" to result.frameNumber,
    "completedAtElapsedRealtimeNs" to SystemClock.elapsedRealtimeNanos(),
  )

  private fun timestampSourceMap(
    characteristics: CameraCharacteristics,
  ): Map<String, Any?> {
    val source = characteristics.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE)
    return mapOf(
      "raw" to source,
      "name" to when (source) {
        CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_UNKNOWN -> "UNKNOWN"
        CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME -> "REALTIME"
        null -> "UNAVAILABLE"
        else -> "UNKNOWN($source)"
      },
    )
  }

  private fun aeCompensationMap(
    characteristics: CameraCharacteristics,
  ): Map<String, Any?> {
    val range = characteristics.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE)
    val step = characteristics.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_STEP)
    val stepEv = step?.let(::rationalValue)
    return mapOf(
      "integerRange" to rangeMapOrNull(range),
      "step" to step?.let(::rationalMap),
      "evRange" to if (range != null && stepEv != null) {
        mapOf(
          "lower" to range.lower * stepEv,
          "upper" to range.upper * stepEv,
        )
      } else {
        null
      },
    )
  }

  private fun outputMap(
    characteristics: CameraCharacteristics,
  ): Map<String, Any?> {
    val streamMap = characteristics.get(
      CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP,
    )
    return mapOf(
      "jpeg" to outputSizes(streamMap?.getOutputSizes(ImageFormat.JPEG)),
      "raw" to outputSizes(streamMap?.getOutputSizes(ImageFormat.RAW_SENSOR)),
      "yuv" to outputSizes(streamMap?.getOutputSizes(ImageFormat.YUV_420_888)),
    )
  }

  private fun selectCamera(cameras: List<RearCamera>): RearCamera? {
    return cameras.maxWithOrNull(
      compareBy<RearCamera>(
        { it.isLogical },
        { hardwareRank(it.characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL)) },
        { it.pixelArea },
        { it.id },
      ),
    )
  }

  private fun selectionReason(camera: RearCamera?): String {
    return if (camera == null) {
      "No rear-facing Camera2 camera could be selected."
    } else {
      "Selected the advertised logical rear camera when available; ties are resolved by hardware level, pixel array area, then camera ID. This is an engineering test selection, not a lens-label mapping."
    }
  }

  private fun cameraManager(): CameraManager {
    val context = requireContext()
    return context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
      ?: throw IllegalStateException("CameraManager is unavailable.")
  }

  private fun requireContext(): Context = appContext.reactContext
    ?: throw IllegalStateException("React context is unavailable.")

  private fun hasCameraPermission(): Boolean {
    val context = appContext.reactContext ?: return false
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
      context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
  }

  private fun writeReport(
    report: Map<String, Any?>,
    filenamePrefix: String = "diagnostic",
  ): String? {
    return try {
      val directory = File(appContext.cacheDirectory, REPORT_DIRECTORY)
      if (!directory.exists() && !directory.mkdirs()) {
        return null
      }
      val filename = "$filenamePrefix-${System.currentTimeMillis()}.json"
      File(directory, filename).writeText(JSONObject(report).toString(2))
      filename
    } catch (_: Throwable) {
      null
    }
  }

  private fun androidInfo(): Map<String, Any?> = mapOf(
    "apiLevel" to Build.VERSION.SDK_INT,
    "manufacturer" to Build.MANUFACTURER,
    "model" to Build.MODEL,
    "release" to Build.VERSION.RELEASE,
  )

  private fun inventoryNotes() = listOf(
    "Camera IDs and logical physical-camera IDs are returned exactly as Camera2 reports them.",
    "No 0.6x, 1x, 3x, or 5x lens labels are assigned.",
    "Any future lens mapping must be separately evidenced; this spike records focal lengths only.",
    "On API 29+, physical IDs backing logical cameras are characterized even when they are not independently openable.",
    "Motion-sensor inventory and temporary still/movement probes use public Android Sensor APIs only.",
    "Dynamic tests use a small app-private YUV reader and discard frames immediately. No image is written.",
  )

  private fun unsupportedResult(status: String, reason: String) = mapOf(
    "supported" to false,
    "status" to status,
    "reason" to reason,
  )

  private fun nowUtc(): String = SimpleDateFormat(
    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
    Locale.US,
  ).apply {
    timeZone = java.util.TimeZone.getTimeZone("UTC")
  }.format(Date())

  private fun errorMessage(error: Throwable): String =
    error.message ?: error::class.java.simpleName

  private fun chooseDiagnosticSize(sizes: Array<out Size>): Size? {
    if (sizes.isEmpty()) {
      return null
    }
    return sizes
      .filter { it.width <= 640 && it.height <= 480 }
      .maxByOrNull { it.width.toLong() * it.height.toLong() }
      ?: sizes.minByOrNull { it.width.toLong() * it.height.toLong() }
  }

  private fun outputSizes(sizes: Array<out Size>?): List<Map<String, Int>> =
    sizes?.mapNotNull(::sizeMap).orEmpty()

  private fun sizeMap(size: Size?): Map<String, Int>? = size?.let {
    mapOf("width" to it.width, "height" to it.height)
  }

  private fun sizeFMap(size: SizeF?): Map<String, Float>? = size?.let {
    mapOf("width" to it.width, "height" to it.height)
  }

  private fun rectMap(rect: Rect?): Map<String, Int>? = rect?.let {
    mapOf("left" to it.left, "top" to it.top, "right" to it.right, "bottom" to it.bottom)
  }

  private fun cropRectAtZoom(activeArray: Rect, zoom: Double): Map<String, Int> {
    val centerX = activeArray.centerX()
    val centerY = activeArray.centerY()
    val halfWidth = (activeArray.width() / (2.0 * zoom)).toInt()
    val halfHeight = (activeArray.height() / (2.0 * zoom)).toInt()
    return mapOf(
      "left" to centerX - halfWidth,
      "top" to centerY - halfHeight,
      "right" to centerX + halfWidth,
      "bottom" to centerY + halfHeight,
    )
  }

  private fun <T : Comparable<T>> rangeMap(range: Range<T>): Map<String, T> = mapOf(
    "lower" to range.lower,
    "upper" to range.upper,
  )

  private fun <T : Comparable<T>> rangeMapOrNull(range: Range<T>?): Map<String, T>? =
    range?.let(::rangeMap)

  private fun rationalMap(rational: Rational): Map<String, Any> = mapOf(
    "numerator" to rational.numerator,
    "denominator" to rational.denominator,
    "ev" to rationalValue(rational),
  )

  private fun rationalValue(rational: Rational): Double =
    rational.numerator.toDouble() / rational.denominator.toDouble()

  private fun modeMap(values: IntArray?, name: (Int) -> String): Map<String, Any> =
    mapOf(
      "raw" to values?.toList().orEmpty(),
      "names" to values?.map(name).orEmpty(),
    )

  private fun nearestCompensation(
    range: Range<Int>,
    step: Rational,
    targetEv: Double,
  ): Compensation {
    val stepEv = rationalValue(step)
    val index = kotlin.math.round(targetEv / stepEv).toInt()
      .coerceIn(range.lower, range.upper)
    return Compensation(index, index * stepEv, targetEv)
  }

  private fun clampLong(value: Long, range: Range<Long>?): Long =
    range?.let { value.coerceIn(it.lower, it.upper) } ?: value

  private fun clampInt(value: Int, range: Range<Int>?): Int =
    range?.let { value.coerceIn(it.lower, it.upper) } ?: value

  private fun hardwareRank(level: Int?): Int = when (level) {
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY -> 0
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED -> 1
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL -> 2
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3 -> 3
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_EXTERNAL -> 4
    else -> -1
  }

  private fun hardwareLevelName(level: Int?): String = when (level) {
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY -> "LEGACY"
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED -> "LIMITED"
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL -> "FULL"
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3 -> "LEVEL_3"
    CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_EXTERNAL -> "EXTERNAL"
    null -> "UNKNOWN"
    else -> "UNKNOWN($level)"
  }

  private fun capabilityName(capability: Int): String = when (capability) {
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BACKWARD_COMPATIBLE -> "BACKWARD_COMPATIBLE"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR -> "MANUAL_SENSOR"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_POST_PROCESSING -> "MANUAL_POST_PROCESSING"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_RAW -> "RAW"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_PRIVATE_REPROCESSING -> "PRIVATE_REPROCESSING"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_READ_SENSOR_SETTINGS -> "READ_SENSOR_SETTINGS"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BURST_CAPTURE -> "BURST_CAPTURE"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_YUV_REPROCESSING -> "YUV_REPROCESSING"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_DEPTH_OUTPUT -> "DEPTH_OUTPUT"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_CONSTRAINED_HIGH_SPEED_VIDEO -> "CONSTRAINED_HIGH_SPEED_VIDEO"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MOTION_TRACKING -> "MOTION_TRACKING"
    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA -> "LOGICAL_MULTI_CAMERA"
    else -> "UNKNOWN($capability)"
  }

  private fun oisModeName(mode: Int): String = when (mode) {
    CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF -> "OFF"
    CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_ON -> "ON"
    else -> "UNKNOWN($mode)"
  }

  private fun aeModeName(mode: Int): String = when (mode) {
    CaptureRequest.CONTROL_AE_MODE_OFF -> "OFF"
    CaptureRequest.CONTROL_AE_MODE_ON -> "ON"
    CaptureRequest.CONTROL_AE_MODE_ON_AUTO_FLASH -> "ON_AUTO_FLASH"
    CaptureRequest.CONTROL_AE_MODE_ON_ALWAYS_FLASH -> "ON_ALWAYS_FLASH"
    CaptureRequest.CONTROL_AE_MODE_ON_AUTO_FLASH_REDEYE -> "ON_AUTO_FLASH_REDEYE"
    CaptureRequest.CONTROL_AE_MODE_ON_EXTERNAL_FLASH -> "ON_EXTERNAL_FLASH"
    else -> "UNKNOWN($mode)"
  }

  private fun antibandingModeName(mode: Int): String = when (mode) {
    CaptureRequest.CONTROL_AE_ANTIBANDING_MODE_OFF -> "OFF"
    CaptureRequest.CONTROL_AE_ANTIBANDING_MODE_50HZ -> "50HZ"
    CaptureRequest.CONTROL_AE_ANTIBANDING_MODE_60HZ -> "60HZ"
    CaptureRequest.CONTROL_AE_ANTIBANDING_MODE_AUTO -> "AUTO"
    else -> "UNKNOWN($mode)"
  }

  private fun aeStateName(state: Int?): String = when (state) {
    null -> "UNKNOWN"
    CaptureResult.CONTROL_AE_STATE_INACTIVE -> "INACTIVE"
    CaptureResult.CONTROL_AE_STATE_SEARCHING -> "SEARCHING"
    CaptureResult.CONTROL_AE_STATE_CONVERGED -> "CONVERGED"
    CaptureResult.CONTROL_AE_STATE_LOCKED -> "LOCKED"
    CaptureResult.CONTROL_AE_STATE_FLASH_REQUIRED -> "FLASH_REQUIRED"
    CaptureResult.CONTROL_AE_STATE_PRECAPTURE -> "PRECAPTURE"
    else -> "UNKNOWN($state)"
  }

  private class DiagnosticCameraSession(
    val camera: CameraDevice,
    val session: CameraCaptureSession,
    val reader: ImageReader,
    val thread: HandlerThread,
    val handler: Handler,
    val characteristics: CameraCharacteristics,
    val outputSize: Size,
  ) {
    fun close() {
      try {
        session.close()
      } catch (_: Throwable) {
        // Best-effort diagnostic cleanup.
      }
      try {
        camera.close()
      } catch (_: Throwable) {
        // Best-effort diagnostic cleanup.
      }
      try {
        reader.close()
      } catch (_: Throwable) {
        // Best-effort diagnostic cleanup.
      }
      thread.quitSafely()
    }
  }

  private data class InventoryResult(
    val serialized: Map<String, Any?>,
    val cameras: List<RearCamera>,
  )

  private data class RearCamera(
    val id: String,
    val characteristics: CameraCharacteristics,
    val serialized: Map<String, Any?>,
    val isLogical: Boolean,
    val supportsManualSensor: Boolean,
    val supportsBurstCapture: Boolean,
    val physicalIds: List<String>,
    val pixelArea: Long,
  )

  private data class Compensation(
    val index: Int,
    val requestedEv: Double?,
    val targetEv: Double,
  )

  private data class AeDiagnosticResult(
    val serialized: Map<String, Any?>,
    val baseline: Map<String, Any?>?,
  )

  private data class ZoomCandidate(
    val label: String,
    val ratio: Float,
  )

  private data class ManualBurstSpecification(
    val requestIndex: Int,
    val multiplier: Double,
    val exposureTimeNs: Long,
    val iso: Int,
  )

  private data class CaptureObservation(
    val status: String = "unknown",
    val exposureTimeNs: Long? = null,
    val iso: Int? = null,
    val aeState: Int? = null,
    val sensorTimestampNs: Long? = null,
    val frameNumber: Long? = null,
    val completedAtElapsedRealtimeNs: Long? = null,
  ) {
    companion object {
      fun empty() = CaptureObservation()

      fun from(result: TotalCaptureResult) = CaptureObservation(
        exposureTimeNs = result.get(CaptureResult.SENSOR_EXPOSURE_TIME),
        iso = result.get(CaptureResult.SENSOR_SENSITIVITY),
        aeState = result.get(CaptureResult.CONTROL_AE_STATE),
        sensorTimestampNs = result.get(CaptureResult.SENSOR_TIMESTAMP),
        frameNumber = result.frameNumber,
        completedAtElapsedRealtimeNs = SystemClock.elapsedRealtimeNanos(),
      )
    }
  }

  private data class StartedFrame(
    val sensorTimestampNs: Long,
    val frameNumber: Long,
    val callbackElapsedRealtimeNs: Long,
    val requestIndex: Int?,
  )

  private data class BurstObservation(
    val status: String,
    val submittedAtElapsedRealtimeNs: Long,
    val sequenceId: Int?,
    val completionCount: Int,
    val failureCount: Int,
    val frames: List<Map<String, Any?>>,
    val interFrameSensorIntervalsMs: List<Double>,
    val interFrameCompletionIntervalsMs: List<Double>,
  )

}
