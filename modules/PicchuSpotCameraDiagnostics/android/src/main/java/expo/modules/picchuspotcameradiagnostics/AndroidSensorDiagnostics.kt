package expo.modules.picchuspotcameradiagnostics

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sqrt

private const val SENSOR_SAMPLING_PERIOD_US = 20_000
private const val STILL_DURATION_MS = 3_000L
private const val TRANSITION_DURATION_MS = 1_500L
private const val MOVEMENT_DURATION_MS = 3_000L
private const val SENSOR_PROBE_TIMEOUT_PADDING_MS = 2_000L

internal class AndroidSensorDiagnostics(context: Context) {
  private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

  fun inventory(): Map<String, Any?> {
    val sensors = sensorSpecifications().map { specification ->
      val sensor = sensorManager.getDefaultSensor(specification.type)
      mapOf(
        "type" to specification.type,
        "typeName" to specification.name,
        "available" to (sensor != null),
        "details" to sensor?.let(::sensorDetails),
      )
    }
    return mapOf(
      "requestedSamplingPeriodUs" to SENSOR_SAMPLING_PERIOD_US,
      "sensors" to sensors,
      "notes" to listOf(
        "The inventory uses public Android SensorManager and Sensor APIs only.",
        "The useful-rate estimate is capped at 200 Hz because this diagnostic does not request HIGH_SAMPLING_RATE_SENSORS.",
      ),
    )
  }

  fun runProbe(): Map<String, Any?> {
    val rotationVector = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    val gameRotationVector = sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
    val selectedRotation = rotationVector ?: gameRotationVector
    val gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    val linearAcceleration = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)

    if (selectedRotation == null && gyroscope == null) {
      return mapOf(
        "status" to "unsupported",
        "reason" to "Neither a rotation-vector sensor nor a gyroscope is available.",
        "sensorInventory" to inventory(),
      )
    }

    val thread = HandlerThread("PicchuSpotSensorDiagnostics").also { it.start() }
    val handler = Handler(thread.looper)
    val completion = CountDownLatch(1)
    val vectorSamples = mutableMapOf<Int, MutableList<VectorSample>>()
    val orientationSamples = mutableListOf<OrientationSample>()
    val startElapsedRealtimeNs = SystemClock.elapsedRealtimeNanos()
    val stillEndNs = startElapsedRealtimeNs + STILL_DURATION_MS * 1_000_000L
    val movementStartNs = stillEndNs + TRANSITION_DURATION_MS * 1_000_000L
    val endNs = movementStartNs + MOVEMENT_DURATION_MS * 1_000_000L

    val listener = object : SensorEventListener {
      override fun onSensorChanged(event: SensorEvent) {
        val phase = phaseForTimestamp(
          timestampNs = event.timestamp,
          startNs = startElapsedRealtimeNs,
          stillEndNs = stillEndNs,
          movementStartNs = movementStartNs,
          endNs = endNs,
        ) ?: return
        val sample = VectorSample(
          sensorType = event.sensor.type,
          timestampNs = event.timestamp,
          callbackElapsedRealtimeNs = SystemClock.elapsedRealtimeNanos(),
          accuracy = event.accuracy,
          values = event.values.map { it.toDouble() },
          phase = phase,
        )
        vectorSamples.getOrPut(event.sensor.type) { mutableListOf() }.add(sample)

        if (event.sensor == selectedRotation) {
          orientationFromRotationVector(event.values)?.let { orientation ->
            orientationSamples += OrientationSample(
              timestampNs = event.timestamp,
              callbackElapsedRealtimeNs = sample.callbackElapsedRealtimeNs,
              accuracy = event.accuracy,
              azimuthDegrees = orientation[0],
              pitchDegrees = orientation[1],
              rollDegrees = orientation[2],
              phase = phase,
            )
          }
        }
      }

      override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    }

    val sensorsToRegister = listOfNotNull(selectedRotation, gyroscope, linearAcceleration)
      .distinctBy { it.type }
    val registrations = sensorsToRegister.associate { sensor ->
      sensor.type to sensorManager.registerListener(
        listener,
        sensor,
        SENSOR_SAMPLING_PERIOD_US,
        handler,
      )
    }

    handler.postDelayed({ completion.countDown() }, endNsToDelayMs(endNs))
    val completed = completion.await(
      STILL_DURATION_MS + TRANSITION_DURATION_MS + MOVEMENT_DURATION_MS +
        SENSOR_PROBE_TIMEOUT_PADDING_MS,
      TimeUnit.MILLISECONDS,
    )
    val finishedElapsedRealtimeNs = SystemClock.elapsedRealtimeNanos()
    sensorManager.unregisterListener(listener)
    thread.quitSafely()

    val gyroSamples = vectorSamples[Sensor.TYPE_GYROSCOPE].orEmpty()
    val linearSamples = vectorSamples[Sensor.TYPE_LINEAR_ACCELERATION].orEmpty()
    val stillOrientation = orientationSamples.filter { it.phase == ProbePhase.STILL.serialized }
    val movingOrientation = orientationSamples.filter { it.phase == ProbePhase.MOVEMENT.serialized }
    val stillGyro = gyroSamples.filter { it.phase == ProbePhase.STILL.serialized }
    val movingGyro = gyroSamples.filter { it.phase == ProbePhase.MOVEMENT.serialized }
    val stillLinear = linearSamples.filter { it.phase == ProbePhase.STILL.serialized }
    val movingLinear = linearSamples.filter { it.phase == ProbePhase.MOVEMENT.serialized }
    val stillGyroMetrics = vectorMagnitudeMetrics(stillGyro)
    val movementGyroMetrics = vectorMagnitudeMetrics(movingGyro)

    return mapOf(
      "status" to if (completed) "completed" else "timeout",
      "sensorInventory" to inventory(),
      "selectedRotationSensor" to selectedRotation?.let(::sensorDetails),
      "selectedGyroscope" to gyroscope?.let(::sensorDetails),
      "selectedLinearAcceleration" to linearAcceleration?.let(::sensorDetails),
      "registrations" to registrations.mapKeys { sensorTypeName(it.key) },
      "timing" to mapOf(
        "sensorTimestampBasis" to "SensorEvent.timestamp nanoseconds since boot",
        "elapsedRealtimeNsAtStart" to startElapsedRealtimeNs,
        "elapsedRealtimeNsAtFinish" to finishedElapsedRealtimeNs,
        "stillDurationMs" to STILL_DURATION_MS,
        "transitionDurationMs" to TRANSITION_DURATION_MS,
        "movementDurationMs" to MOVEMENT_DURATION_MS,
        "requestedSamplingPeriodUs" to SENSOR_SAMPLING_PERIOD_US,
      ),
      "levelStability" to mapOf(
        "status" to if (stillOrientation.isNotEmpty()) "measured" else "unavailable",
        "coordinateSystem" to "Raw Android device coordinates; no product/UI remapping or green threshold is applied.",
        "sampleCount" to stillOrientation.size,
        "sampleRateHz" to sampleRateHz(stillOrientation.map { it.timestampNs }),
        "pitchDegrees" to angleStatistics(stillOrientation.map { it.pitchDegrees }),
        "rollDegrees" to angleStatistics(stillOrientation.map { it.rollDegrees }),
        "rawSamples" to stillOrientation.map(::orientationSampleMap),
      ),
      "movement" to mapOf(
        "still" to movementWindowMap(
          durationMs = STILL_DURATION_MS,
          orientation = stillOrientation,
          gyro = stillGyro,
          linearAcceleration = stillLinear,
        ),
        "deliberateMovement" to movementWindowMap(
          durationMs = MOVEMENT_DURATION_MS,
          orientation = movingOrientation,
          gyro = movingGyro,
          linearAcceleration = movingLinear,
        ),
        "gyroRmsRatioMovementToStill" to ratioOrNull(
          movementGyroMetrics["rms"] as? Double,
          stillGyroMetrics["rms"] as? Double,
        ),
        "note" to "These are diagnostic metrics only; no production movement threshold or warning decision is defined.",
      ),
      "preservedTimestampedSamples" to mapOf(
        "rotation" to orientationSamples.map(::orientationSampleMap),
        "gyroscope" to gyroSamples.map(::vectorSampleMap),
        "linearAcceleration" to linearSamples.map(::vectorSampleMap),
      ),
    )
  }

  private fun sensorSpecifications() = listOf(
    SensorSpecification(Sensor.TYPE_ROTATION_VECTOR, "TYPE_ROTATION_VECTOR"),
    SensorSpecification(Sensor.TYPE_GAME_ROTATION_VECTOR, "TYPE_GAME_ROTATION_VECTOR"),
    SensorSpecification(Sensor.TYPE_GRAVITY, "TYPE_GRAVITY"),
    SensorSpecification(Sensor.TYPE_GYROSCOPE, "TYPE_GYROSCOPE"),
    SensorSpecification(Sensor.TYPE_LINEAR_ACCELERATION, "TYPE_LINEAR_ACCELERATION"),
  )

  private fun sensorDetails(sensor: Sensor): Map<String, Any?> {
    val advertisedRateHz = if (sensor.minDelay > 0) {
      1_000_000.0 / sensor.minDelay.toDouble()
    } else {
      null
    }
    return mapOf(
      "type" to sensor.type,
      "typeName" to sensorTypeName(sensor.type),
      "name" to sensor.name,
      "vendor" to sensor.vendor,
      "version" to sensor.version,
      "minDelayUs" to sensor.minDelay,
      "maxDelayUs" to sensor.maxDelay,
      "advertisedMaximumSamplingRateHz" to advertisedRateHz,
      "maximumUsefulRateWithoutHighSamplingPermissionHz" to advertisedRateHz?.let {
        min(it, 200.0)
      },
      "reportingMode" to mapOf(
        "raw" to sensor.reportingMode,
        "name" to reportingModeName(sensor.reportingMode),
      ),
      "resolution" to sensor.resolution.toDouble(),
      "maximumRange" to sensor.maximumRange.toDouble(),
      "powerMa" to sensor.power.toDouble(),
      "fifoReservedEventCount" to sensor.fifoReservedEventCount,
      "fifoMaxEventCount" to sensor.fifoMaxEventCount,
      "isWakeUpSensor" to sensor.isWakeUpSensor,
    )
  }

  private fun movementWindowMap(
    durationMs: Long,
    orientation: List<OrientationSample>,
    gyro: List<VectorSample>,
    linearAcceleration: List<VectorSample>,
  ): Map<String, Any?> = mapOf(
    "configuredDurationMs" to durationMs,
    "orientation" to mapOf(
      "sampleCount" to orientation.size,
      "sampleRateHz" to sampleRateHz(orientation.map { it.timestampNs }),
      "metrics" to orientationMovementMetrics(orientation),
    ),
    "gyroscope" to mapOf(
      "sampleCount" to gyro.size,
      "sampleRateHz" to sampleRateHz(gyro.map { it.timestampNs }),
      "magnitudeRadPerSecond" to vectorMagnitudeMetrics(gyro),
    ),
    "linearAcceleration" to mapOf(
      "sampleCount" to linearAcceleration.size,
      "sampleRateHz" to sampleRateHz(linearAcceleration.map { it.timestampNs }),
      "magnitudeMetersPerSecondSquared" to vectorMagnitudeMetrics(linearAcceleration),
    ),
  )

  private fun orientationFromRotationVector(values: FloatArray): List<Double>? {
    return try {
      val rotationMatrix = FloatArray(9)
      val orientation = FloatArray(3)
      SensorManager.getRotationMatrixFromVector(rotationMatrix, values)
      SensorManager.getOrientation(rotationMatrix, orientation)
      orientation.map { Math.toDegrees(it.toDouble()) }
    } catch (_: Throwable) {
      null
    }
  }

  private fun angleStatistics(values: List<Double>): Map<String, Any?> {
    if (values.isEmpty()) {
      return scalarStatistics(emptyList())
    }
    return scalarStatistics(unwrapDegrees(values)) + mapOf(
      "method" to "Angles unwrapped around the first sample before statistics.",
    )
  }

  private fun orientationMovementMetrics(samples: List<OrientationSample>): Map<String, Any?> {
    if (samples.isEmpty()) {
      return mapOf(
        "pitchDegrees" to scalarStatistics(emptyList()),
        "rollDegrees" to scalarStatistics(emptyList()),
        "orientationPathDegrees" to null,
        "maximumDeltaFromStartDegrees" to null,
      )
    }
    val pitch = unwrapDegrees(samples.map { it.pitchDegrees })
    val roll = unwrapDegrees(samples.map { it.rollDegrees })
    var path = 0.0
    var maximumDelta = 0.0
    for (index in 1 until samples.size) {
      path += hypot(pitch[index] - pitch[index - 1], roll[index] - roll[index - 1])
      maximumDelta = maxOf(
        maximumDelta,
        hypot(pitch[index] - pitch.first(), roll[index] - roll.first()),
      )
    }
    return mapOf(
      "pitchDegrees" to scalarStatistics(pitch),
      "rollDegrees" to scalarStatistics(roll),
      "orientationPathDegrees" to path,
      "maximumDeltaFromStartDegrees" to maximumDelta,
    )
  }

  private fun vectorMagnitudeMetrics(samples: List<VectorSample>): Map<String, Any?> {
    val magnitudes = samples.map { sample ->
      val x = sample.values.getOrElse(0) { 0.0 }
      val y = sample.values.getOrElse(1) { 0.0 }
      val z = sample.values.getOrElse(2) { 0.0 }
      sqrt(x * x + y * y + z * z)
    }
    val statistics = scalarStatistics(magnitudes).toMutableMap()
    statistics["integratedMagnitude"] = integratedMagnitude(samples, magnitudes)
    return statistics
  }

  private fun integratedMagnitude(
    samples: List<VectorSample>,
    magnitudes: List<Double>,
  ): Double? {
    if (samples.size < 2) {
      return null
    }
    var total = 0.0
    for (index in 1 until samples.size) {
      val deltaSeconds = (samples[index].timestampNs - samples[index - 1].timestampNs) /
        1_000_000_000.0
      total += (magnitudes[index - 1] + magnitudes[index]) * 0.5 * deltaSeconds
    }
    return total
  }

  private fun scalarStatistics(values: List<Double>): Map<String, Any?> {
    if (values.isEmpty()) {
      return mapOf(
        "count" to 0,
        "minimum" to null,
        "maximum" to null,
        "mean" to null,
        "standardDeviation" to null,
        "peakToPeak" to null,
        "rms" to null,
      )
    }
    val mean = values.average()
    val variance = values.sumOf { value ->
      val delta = value - mean
      delta * delta
    } / values.size.toDouble()
    val minimum = values.minOrNull()
    val maximum = values.maxOrNull()
    return mapOf(
      "count" to values.size,
      "minimum" to minimum,
      "maximum" to maximum,
      "mean" to mean,
      "standardDeviation" to sqrt(variance),
      "peakToPeak" to if (minimum != null && maximum != null) maximum - minimum else null,
      "rms" to sqrt(values.sumOf { it * it } / values.size.toDouble()),
    )
  }

  private fun unwrapDegrees(values: List<Double>): List<Double> {
    if (values.isEmpty()) {
      return emptyList()
    }
    val unwrapped = mutableListOf(values.first())
    var previousRaw = values.first()
    var previousUnwrapped = values.first()
    values.drop(1).forEach { raw ->
      var delta = raw - previousRaw
      while (delta > 180.0) delta -= 360.0
      while (delta < -180.0) delta += 360.0
      previousUnwrapped += delta
      unwrapped += previousUnwrapped
      previousRaw = raw
    }
    return unwrapped
  }

  private fun sampleRateHz(timestamps: List<Long>): Double? {
    if (timestamps.size < 2) {
      return null
    }
    val durationSeconds = (timestamps.last() - timestamps.first()) / 1_000_000_000.0
    return if (durationSeconds > 0.0) {
      (timestamps.size - 1).toDouble() / durationSeconds
    } else {
      null
    }
  }

  private fun ratioOrNull(numerator: Double?, denominator: Double?): Double? {
    return if (numerator != null && denominator != null && denominator > 0.0) {
      numerator / denominator
    } else {
      null
    }
  }

  private fun orientationSampleMap(sample: OrientationSample): Map<String, Any?> = mapOf(
    "sensorTimestampNs" to sample.timestampNs,
    "callbackElapsedRealtimeNs" to sample.callbackElapsedRealtimeNs,
    "accuracy" to sample.accuracy,
    "azimuthDegrees" to sample.azimuthDegrees,
    "pitchDegrees" to sample.pitchDegrees,
    "rollDegrees" to sample.rollDegrees,
    "phase" to sample.phase,
  )

  private fun vectorSampleMap(sample: VectorSample): Map<String, Any?> = mapOf(
    "sensorType" to sample.sensorType,
    "sensorTypeName" to sensorTypeName(sample.sensorType),
    "sensorTimestampNs" to sample.timestampNs,
    "callbackElapsedRealtimeNs" to sample.callbackElapsedRealtimeNs,
    "accuracy" to sample.accuracy,
    "values" to sample.values,
    "phase" to sample.phase,
  )

  private fun phaseForTimestamp(
    timestampNs: Long,
    startNs: Long,
    stillEndNs: Long,
    movementStartNs: Long,
    endNs: Long,
  ): String? = when {
    timestampNs < startNs || timestampNs > endNs -> null
    timestampNs < stillEndNs -> ProbePhase.STILL.serialized
    timestampNs < movementStartNs -> ProbePhase.TRANSITION.serialized
    else -> ProbePhase.MOVEMENT.serialized
  }

  private fun endNsToDelayMs(endNs: Long): Long {
    val remainingNs = endNs - SystemClock.elapsedRealtimeNanos()
    return (remainingNs / 1_000_000L).coerceAtLeast(1L)
  }

  private fun sensorTypeName(type: Int): String = when (type) {
    Sensor.TYPE_ROTATION_VECTOR -> "TYPE_ROTATION_VECTOR"
    Sensor.TYPE_GAME_ROTATION_VECTOR -> "TYPE_GAME_ROTATION_VECTOR"
    Sensor.TYPE_GRAVITY -> "TYPE_GRAVITY"
    Sensor.TYPE_GYROSCOPE -> "TYPE_GYROSCOPE"
    Sensor.TYPE_LINEAR_ACCELERATION -> "TYPE_LINEAR_ACCELERATION"
    else -> "TYPE_UNKNOWN($type)"
  }

  private fun reportingModeName(mode: Int): String = when (mode) {
    Sensor.REPORTING_MODE_CONTINUOUS -> "CONTINUOUS"
    Sensor.REPORTING_MODE_ON_CHANGE -> "ON_CHANGE"
    Sensor.REPORTING_MODE_ONE_SHOT -> "ONE_SHOT"
    Sensor.REPORTING_MODE_SPECIAL_TRIGGER -> "SPECIAL_TRIGGER"
    else -> "UNKNOWN($mode)"
  }

  private data class SensorSpecification(val type: Int, val name: String)

  private data class VectorSample(
    val sensorType: Int,
    val timestampNs: Long,
    val callbackElapsedRealtimeNs: Long,
    val accuracy: Int,
    val values: List<Double>,
    val phase: String,
  )

  private data class OrientationSample(
    val timestampNs: Long,
    val callbackElapsedRealtimeNs: Long,
    val accuracy: Int,
    val azimuthDegrees: Double,
    val pitchDegrees: Double,
    val rollDegrees: Double,
    val phase: String,
  )

  private enum class ProbePhase(val serialized: String) {
    STILL("still"),
    TRANSITION("transition"),
    MOVEMENT("deliberate-movement"),
  }
}
