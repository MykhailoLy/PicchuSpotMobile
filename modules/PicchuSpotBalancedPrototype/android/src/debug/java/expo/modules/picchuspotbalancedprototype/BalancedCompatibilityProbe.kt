package expo.modules.picchuspotbalancedprototype

import android.content.Context
import android.graphics.ImageFormat
import android.hardware.Sensor
import android.hardware.SensorManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import android.util.Range
import android.util.Rational
import android.util.Size
import java.io.File
import java.io.FileOutputStream
import java.util.Locale
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max

internal const val COMPATIBILITY_PROBE_DIRECTORY = "balanced-compatibility-probe"

internal data class CompatibilityInventory(
  val report: Map<String, Any?>,
  val selectedCameraId: String?,
  val hasRearCamera: Boolean,
  val staticPassed: Boolean,
  val staticReasons: List<String>,
)

internal data class RuntimeCompatibility(
  val status: String,
  val passed: Boolean,
  val reasons: List<String>,
  val report: Map<String, Any?>,
)

/** Development-only, data-shape-driven compatibility inventory and evaluation. */
internal fun collectCompatibilityInventory(
  context: Context,
  preferredCameraId: String?,
): CompatibilityInventory {
  val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
  val cameras = manager.cameraIdList.map { id ->
    runCatching { cameraSnapshot(manager, id) }.getOrElse { error ->
      mapOf("cameraId" to id, "readError" to errorMessage(error))
    }
  }
  val rear = cameras.filter { it["lensFacing"] == "BACK" }
  val selected = selectRearCamera(rear, preferredCameraId)
  val evaluation = evaluateStaticContract(rear, selected)
  val sensors = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  return CompatibilityInventory(
    selectedCameraId = selected?.get("cameraId") as? String,
    hasRearCamera = rear.isNotEmpty(),
    staticPassed = evaluation.first,
    staticReasons = evaluation.second,
    report = mapOf(
      "schemaVersion" to 1,
      "kind" to "android-balanced-compatibility-inventory",
      "capturedAtUtc" to compatibilityNowUtc(),
      "device" to mapOf(
        "manufacturer" to Build.MANUFACTURER,
        "model" to Build.MODEL,
        "androidRelease" to Build.VERSION.RELEASE,
        "apiLevel" to Build.VERSION.SDK_INT,
        "buildFingerprint" to Build.FINGERPRINT,
      ),
      "candidate" to candidateContract(),
      "cameraTopology" to mapOf(
        "rearCameraIds" to rear.mapNotNull { it["cameraId"] as? String },
        "selectedRearCameraId" to selected?.get("cameraId"),
        "selectedBy" to "Actual candidate-contract capability first, then hardware level and JPEG area; topology is diagnostic only; never manufacturer or model",
        "cameras" to cameras,
      ),
      "selectedJpegSize" to selected?.mapValue("selectedFourByThreeJpegSize"),
      "sensors" to mapOf(
        "gyroscopeAvailable" to (sensors.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null),
        "linearAccelerationAvailable" to (
          sensors.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION) != null
          ),
      ),
      "staticEvaluation" to mapOf(
        "status" to if (evaluation.first) "passed" else "failed",
        "requiredContractPassed" to evaluation.first,
        "reasons" to evaluation.second,
        "requiredRules" to staticRules(),
        "diagnosticOnly" to listOf(
          "logical and physical multi-camera topology",
          "RAW capability",
          "AE compensation range and step",
          "AWB and AE lock availability",
          "active physical camera result",
          "Camera2 timestamp source",
          "gyroscope and linear-acceleration availability",
        ),
      ),
    ),
  )
}

internal fun evaluateRuntimeCompatibility(experiment: Map<String, Any?>): RuntimeCompatibility {
  val reasons = mutableListOf<String>()
  val manual = experiment.mapValue("manualExperiment")
  val candidate = manual.mapValue("candidate")
  val planner = manual.mapValue("planner")
  val capture = manual.mapValue("capture")
  val camera = experiment.mapValue("camera")
  val size = camera.mapValue("selectedJpegSize")
  val frames = capture.maps("frames")
  val expectedEv = listOf(-2.0, 0.0, 2.0)
  val candidatePass = candidate["id"] == "candidate-a-three-frame" &&
    numbers(candidate["evOffsets"]) == expectedEv
  val plannerPass = planner["id"] == "positive-ev-cap-1-30" &&
    planner.number("positiveEvShutterCeilingNs") == 33_333_333.0
  val capturePass = experiment["status"] == "completed" && capture["status"] == "completed"
  if (!candidatePass) reasons += "The runtime run did not use the selected three-frame candidate."
  if (!plannerPass) reasons += "The runtime run did not use the temporary 1/30-second positive-EV planner."
  if (!capturePass) reasons += "The manual Camera2 burst did not complete."
  if (frames.size != 3) reasons += "Expected three JPEG frames; received " + frames.size + "."

  val frameResults = frames.mapIndexed { index, frame ->
    val requested = frame.mapValue("requested")
    val actual = frame.mapValue("actual")
    val requestedExposure = requested.number("sensorExposureTimeNs")
    val requestedIso = requested.number("sensorSensitivityIso")
    val actualExposure = actual.number("exposureTimeNs")
    val actualIso = actual.number("iso")
    val shutterDifference = relativeDifference(requestedExposure, actualExposure)
    val isoDifference = relativeDifference(requestedIso, actualIso)
    val jpegDelivered = frame.number("byteSize")?.let { it > 0 } == true
    val dimensionsPass = frame.number("width") == size.number("width") &&
      frame.number("height") == size.number("height")
    val correlationPass = frame["imageAssociation"] == "sensor-timestamp"
    val passed = frame["failure"] == null &&
      requested.number("requestedEv") == expectedEv.getOrNull(index) &&
      jpegDelivered &&
      dimensionsPass &&
      correlationPass &&
      shutterDifference != null &&
      shutterDifference <= 0.05 &&
      isoDifference != null &&
      isoDifference <= 0.05
    if (!passed) reasons += "Frame " + index + " failed a requested/actual, JPEG, or correlation check."
    mapOf(
      "requestIndex" to frame["requestIndex"],
      "requestedEv" to requested["requestedEv"],
      "requestedExposureTimeNs" to requestedExposure,
      "actualExposureTimeNs" to actualExposure,
      "requestedIso" to requestedIso,
      "actualIso" to actualIso,
      "requestedActualTolerance" to 0.05,
      "shutterRelativeDifference" to shutterDifference,
      "isoRelativeDifference" to isoDifference,
      "jpegDelivered" to jpegDelivered,
      "jpegDimensions" to mapOf(
        "width" to frame["width"],
        "height" to frame["height"],
        "byteSize" to frame["byteSize"],
        "expected" to size,
        "matchesSelectedJpegSize" to dimensionsPass,
      ),
      "jpegResultCorrelation" to mapOf(
        "method" to frame["imageAssociation"],
        "passed" to correlationPass,
        "sensorTimestampNs" to actual["sensorTimestampNs"],
      ),
      "physicalCameraId" to actual["activePhysicalCameraId"],
      "completionOrder" to frame["completionOrder"],
      "failure" to frame["failure"],
      "passed" to passed,
    )
  }
  val burstTiming = capture.number("totalDurationMs")
  if (burstTiming == null || burstTiming <= 0.0) reasons += "Manual burst timing was unavailable."
  val passed = candidatePass && plannerPass && capturePass && frames.size == 3 &&
    frameResults.all { it["passed"] == true } && burstTiming != null && burstTiming > 0.0
  if (passed) reasons += "The candidate burst passed with three timestamp-correlated JPEGs and controls within the development-only 5% tolerance."
  return RuntimeCompatibility(
    status = if (passed) "passed" else "failed",
    passed = passed,
    reasons = reasons,
    report = mapOf(
      "status" to if (passed) "passed" else "failed",
      "candidate" to candidate,
      "planner" to planner,
      "captureStatus" to capture["status"],
      "totalBurstTimingMs" to burstTiming,
      "requestOrder" to capture["requestOrder"],
      "completionOrder" to capture["completionOrder"],
      "interFrameSensorIntervalsMs" to capture["interFrameSensorIntervalsMs"],
      "interFrameCompletionIntervalsMs" to capture["interFrameCompletionIntervalsMs"],
      "frameValidation" to frameResults,
      "failures" to frames.mapNotNull { it["failure"] as? String },
      "reasons" to reasons,
    ),
  )
}

internal fun runtimeNotRun(reason: String): RuntimeCompatibility = RuntimeCompatibility(
  status = "not-run",
  passed = false,
  reasons = listOf(reason),
  report = mapOf(
    "status" to "not-run",
    "reasons" to listOf(reason),
    "frameValidation" to emptyList<Map<String, Any?>>(),
    "failures" to emptyList<String>(),
  ),
)

internal fun classifyCompatibility(
  inventory: CompatibilityInventory,
  runtime: RuntimeCompatibility,
): Map<String, Any?> {
  val status = when {
    inventory.staticPassed && runtime.passed -> "FULL_BALANCED"
    !inventory.hasRearCamera -> "UNSUPPORTED"
    else -> "LIMITED"
  }
  return mapOf(
    "status" to status,
    "reasons" to (
      inventory.staticReasons + runtime.reasons + when (status) {
        "FULL_BALANCED" -> listOf("Required static capability contract and runtime candidate burst passed.")
        "LIMITED" -> listOf("A rear camera exists, but the candidate Balanced contract is not guaranteed.")
        else -> listOf("No rear Camera2 camera is available for a safe candidate probe.")
      }
      ).distinct(),
  )
}

internal fun compatibilityProbeDirectory(context: Context): File {
  val root = context.cacheDir ?: throw IllegalStateException("App cache directory is unavailable.")
  return File(root, COMPATIBILITY_PROBE_DIRECTORY).also { directory ->
    if (!directory.exists() && !directory.mkdirs()) {
      throw IllegalStateException("Could not create the compatibility-probe cache directory.")
    }
  }
}

internal fun persistCompatibilityReport(context: Context, report: Map<String, Any?>, filename: String) {
  try {
    FileOutputStream(File(compatibilityProbeDirectory(context), filename)).use {
      it.write(JSONObject(report).toString(2).toByteArray(Charsets.UTF_8))
    }
  } catch (_: Throwable) {
    // The onscreen result remains available if the cache-only write fails.
  }
}

internal fun readLatestCompatibilityReport(cacheDirectory: File?): Map<String, Any?> {
  val files = cacheDirectory?.let { File(it, COMPATIBILITY_PROBE_DIRECTORY) }?.listFiles()
    ?.filter { it.isFile && it.name.startsWith("compatibility-") && it.extension.lowercase(Locale.US) == "json" }
    ?.sortedByDescending(File::lastModified)
    .orEmpty()
  if (files.isEmpty()) {
    return mapOf("status" to "missing", "filename" to null, "json" to null, "failure" to null)
  }
  for (file in files) {
    try {
      val json = file.readText()
      val report = JSONObject(json)
      if (
        report.optInt("schemaVersion", -1) == 1 &&
        report.optString("kind") == "android-balanced-compatibility-probe"
      ) {
        return mapOf("status" to "available", "filename" to file.name, "json" to json, "failure" to null)
      }
    } catch (_: Throwable) {
      // Continue to an older compatibility-named report before reporting a failure below.
    }
  }
  return mapOf(
    "status" to "failed",
    "filename" to files.first().name,
    "json" to null,
    "failure" to "No schema-valid Android Balanced compatibility report was found.",
  )
}

internal fun clearCompatibilityProbeDirectory(cacheDirectory: File?): Map<String, Any?> {
  if (cacheDirectory == null) return mapOf("status" to "failed", "removedFileCount" to 0, "failure" to "The app cache directory is unavailable.")
  val directory = File(cacheDirectory, COMPATIBILITY_PROBE_DIRECTORY)
  if (!directory.exists()) return mapOf("status" to "cleared", "removedFileCount" to 0, "failure" to null)
  var removed = 0
  directory.listFiles().orEmpty().forEach { file -> if (file.isFile && file.delete()) removed += 1 }
  val failure = if (directory.listFiles().orEmpty().isEmpty()) {
    directory.delete()
    null
  } else {
    "Some compatibility-probe cache files could not be removed."
  }
  return mapOf("status" to if (failure == null) "cleared" else "failed", "removedFileCount" to removed, "failure" to failure)
}

private fun cameraSnapshot(manager: CameraManager, id: String): Map<String, Any?> {
  val c = manager.getCameraCharacteristics(id)
  val capabilities = c.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)?.toSet() ?: emptySet()
  val jpegSizes = c.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
    ?.getOutputSizes(ImageFormat.JPEG)?.sortedByDescending { it.width.toLong() * it.height }.orEmpty()
  val zoomRange = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) c.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE) else null
  return mapOf(
    "cameraId" to id,
    "lensFacing" to lensFacingName(c.get(CameraCharacteristics.LENS_FACING)),
    "topology" to if (capabilities.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA)) "logical-multi-camera" else "independently-openable-camera",
    "physicalCameraIds" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) c.physicalCameraIds.sorted() else emptyList<String>(),
    "hardwareLevel" to hardwareLevelName(c.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL)),
    "capabilities" to mapOf(
      "manualSensor" to capabilities.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR),
      "burstCapture" to capabilities.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BURST_CAPTURE),
      "raw" to capabilities.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_RAW),
      "logicalMultiCamera" to capabilities.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA),
    ),
    "availableJpegSizes" to jpegSizes.map(::sizeMap),
    "selectedFourByThreeJpegSize" to jpegSizes.filter(::isFourByThree).maxByOrNull { it.width.toLong() * it.height }?.let(::sizeMap),
    "exposureTimeRangeNs" to c.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE)?.let(::longRangeMap),
    "sensitivityRangeIso" to c.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE)?.let(::intRangeMap),
    "zoomRatioRange" to zoomRange?.let(::floatRangeMap),
    "maxDigitalZoom" to c.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM),
    "aeCompensation" to mapOf(
      "range" to c.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE)?.let(::intRangeMap),
      "step" to c.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_STEP)?.let(::rationalMap),
    ),
    "afModes" to c.get(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES)?.map(::afModeName).orEmpty(),
    "minimumFocusDistanceDiopters" to c.get(CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE),
    "awbLockAvailable" to c.get(CameraCharacteristics.CONTROL_AWB_LOCK_AVAILABLE),
    "aeLockAvailable" to c.get(CameraCharacteristics.CONTROL_AE_LOCK_AVAILABLE),
    "timestampSource" to timestampSourceName(c.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE)),
  )
}

private fun selectRearCamera(rear: List<Map<String, Any?>>, preferred: String?): Map<String, Any?>? {
  rear.firstOrNull { camera -> camera["cameraId"] == preferred && satisfiesStaticCandidateContract(camera) }
    ?.let { return it }
  return rear.sortedWith(
    compareByDescending<Map<String, Any?>>(::satisfiesStaticCandidateContract)
      .thenByDescending(::staticCandidateContractScore)
      .thenByDescending { hardwareRank(it["hardwareLevel"] as? String) }
      .thenByDescending { it.mapValue("selectedFourByThreeJpegSize").number("width") ?: 0.0 }
      .thenBy { it["cameraId"] as? String ?: "" },
  ).firstOrNull()
}

private fun evaluateStaticContract(
  rear: List<Map<String, Any?>>,
  selected: Map<String, Any?>?,
): Pair<Boolean, List<String>> {
  if (selected == null) return false to listOf("No rear Camera2 camera was discovered.")
  val required = staticCandidateContractRequirements(selected)
  val reasons = required.filterNot { it.second }.map { "Missing required static capability: " + it.first + "." }.toMutableList()
  if (reasons.isEmpty()) reasons += "All required static capabilities for the current candidate were advertised."
  return (reasons.size == 1 && reasons.first().startsWith("All required")) to reasons
}

private fun staticRules(): List<String> = listOf(
  "rear Camera2 camera",
  "non-LEGACY hardware level",
  "MANUAL_SENSOR",
  "BURST_CAPTURE",
  "advertised 4:3 JPEG output",
  "usable manual exposure-time and ISO ranges",
  "1x zoom support",
  "AF baseline support",
)

private fun staticCandidateContractRequirements(camera: Map<String, Any?>): List<Pair<String, Boolean>> {
  val capabilities = camera.mapValue("capabilities")
  val exposure = camera.mapValue("exposureTimeRangeNs")
  val sensitivity = camera.mapValue("sensitivityRangeIso")
  val zoom = camera.mapValue("zoomRatioRange")
  val afModes = camera["afModes"] as? List<*> ?: emptyList<Any>()
  val minFocus = camera.number("minimumFocusDistanceDiopters")
  return listOf(
    "rear Camera2 camera" to (camera["lensFacing"] == "BACK"),
    "non-LEGACY hardware level" to (camera["hardwareLevel"] != null && camera["hardwareLevel"] != "LEGACY"),
    "MANUAL_SENSOR" to (capabilities["manualSensor"] == true),
    "BURST_CAPTURE" to (capabilities["burstCapture"] == true),
    "4:3 JPEG output" to camera.mapValue("selectedFourByThreeJpegSize").isNotEmpty(),
    "manual exposure-time range" to rangeValid(exposure),
    "manual ISO range" to rangeValid(sensitivity),
    "1x zoom support" to (
      (zoom.number("lower")?.let { lower -> zoom.number("upper")?.let { it >= 1.0 && lower <= 1.0 } } == true) ||
        (camera.number("maxDigitalZoom")?.let { it >= 1.0 } == true)
      ),
    "AF baseline support" to (minFocus?.let { it <= 0.0 } == true || afModes.contains("AUTO")),
  )
}

private fun satisfiesStaticCandidateContract(camera: Map<String, Any?>): Boolean =
  staticCandidateContractRequirements(camera).all { it.second }

private fun staticCandidateContractScore(camera: Map<String, Any?>): Int =
  staticCandidateContractRequirements(camera).count { it.second }

private fun candidateContract(): Map<String, Any?> = mapOf(
  "strategy" to "manual Camera2 captureBurst",
  "frameCount" to 3,
  "evOffsets" to listOf(-2.0, 0.0, 2.0),
  "positiveEvShutterCeilingNs" to 33_333_333L,
  "positiveEvShutterCeilingDescription" to "Temporary approximately 1/30-second ceiling with ISO redistribution when needed.",
  "temporaryExperimentOnly" to true,
)

private fun Map<String, Any?>.mapValue(key: String): Map<String, Any?> = this[key] as? Map<String, Any?> ?: emptyMap()
private fun Map<String, Any?>.maps(key: String): List<Map<String, Any?>> = (this[key] as? List<*>).orEmpty().mapNotNull { it as? Map<String, Any?> }
private fun Map<String, Any?>.number(key: String): Double? = (this[key] as? Number)?.toDouble()
private fun numbers(value: Any?): List<Number> = (value as? List<*>).orEmpty().mapNotNull { it as? Number }
private fun relativeDifference(requested: Double?, actual: Double?): Double? = if (requested == null || actual == null || requested <= 0.0) null else abs(actual - requested) / max(requested, 1.0)
private fun isFourByThree(size: Size): Boolean = abs(size.width * 3 - size.height * 4) <= 4
private fun sizeMap(size: Size): Map<String, Int> = mapOf("width" to size.width, "height" to size.height)
private fun longRangeMap(range: Range<Long>): Map<String, Long> = mapOf("lower" to range.lower, "upper" to range.upper)
private fun intRangeMap(range: Range<Int>): Map<String, Int> = mapOf("lower" to range.lower, "upper" to range.upper)
private fun floatRangeMap(range: Range<Float>): Map<String, Float> = mapOf("lower" to range.lower, "upper" to range.upper)
private fun rationalMap(value: Rational): Map<String, Any?> = mapOf("numerator" to value.numerator, "denominator" to value.denominator, "value" to value.toFloat())
private fun rangeValid(range: Map<String, Any?>): Boolean = range.number("lower")?.let { lower -> range.number("upper")?.let { upper -> lower > 0.0 && upper >= lower } } == true
private fun lensFacingName(value: Int?): String = when (value) {
  CameraCharacteristics.LENS_FACING_BACK -> "BACK"
  CameraCharacteristics.LENS_FACING_FRONT -> "FRONT"
  CameraCharacteristics.LENS_FACING_EXTERNAL -> "EXTERNAL"
  else -> "UNKNOWN"
}
private fun hardwareLevelName(value: Int?): String = when (value) {
  CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY -> "LEGACY"
  CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED -> "LIMITED"
  CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL -> "FULL"
  CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3 -> "LEVEL_3"
  CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_EXTERNAL -> "EXTERNAL"
  else -> "UNKNOWN"
}
private fun hardwareRank(value: String?): Int = when (value) { "LEVEL_3" -> 4; "FULL" -> 3; "LIMITED" -> 2; "EXTERNAL" -> 1; else -> 0 }
private fun timestampSourceName(value: Int?): String = when (value) {
  CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME -> "REALTIME"
  CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_UNKNOWN -> "UNKNOWN"
  else -> "UNKNOWN"
}
private fun afModeName(value: Int): String = when (value) {
  CameraCharacteristics.CONTROL_AF_MODE_OFF -> "OFF"
  CameraCharacteristics.CONTROL_AF_MODE_AUTO -> "AUTO"
  CameraCharacteristics.CONTROL_AF_MODE_MACRO -> "MACRO"
  CameraCharacteristics.CONTROL_AF_MODE_CONTINUOUS_VIDEO -> "CONTINUOUS_VIDEO"
  CameraCharacteristics.CONTROL_AF_MODE_CONTINUOUS_PICTURE -> "CONTINUOUS_PICTURE"
  CameraCharacteristics.CONTROL_AF_MODE_EDOF -> "EDOF"
  else -> "UNKNOWN($value)"
}
private fun compatibilityNowUtc(): String = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date())
private fun errorMessage(error: Throwable): String = error.message ?: error::class.java.simpleName
