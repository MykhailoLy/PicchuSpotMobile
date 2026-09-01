package expo.modules.picchuspotbalancedprototype

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureFailure
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.CaptureResult
import android.hardware.camera2.TotalCaptureResult
import android.media.Image
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Range
import android.util.Rational
import android.util.Size
import android.view.Surface
import android.view.TextureView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.io.FileOutputStream
import java.lang.IllegalStateException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

/**
 * A real Camera2-owned preview and a deliberately development-only comparison
 * harness. It never opens expo-camera, writes Shoot SQLite rows, or targets a
 * public media collection.
 */
class BalancedCapturePreview(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val textureView = TextureView(context)
  private val controller = BalancedPrototypeCamera(context, textureView, ::emitStatus)

  var cameraId: String = "0"
    set(value) {
      if (field != value) {
        field = value
        controller.cameraId = value
      }
    }

  var zoomRatio: Float = 1f
    set(value) {
      val normalized = value.coerceAtLeast(0.1f)
      if (field != normalized) {
        field = normalized
        controller.zoomRatio = normalized
      }
    }

  val onStatusChanged by EventDispatcher<Map<String, Any>>()

  init {
    orientation = HORIZONTAL
    addView(
      textureView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    controller.start()
  }

  override fun onDetachedFromWindow() {
    controller.stop()
    super.onDetachedFromWindow()
  }

  fun destroy() {
    controller.destroy()
  }

  fun status(): Map<String, Any?> = controller.status()

  fun runComparison(): Map<String, Any?> = controller.runComparison()

  private fun emitStatus(status: String, message: String?) {
    val payload = mutableMapOf<String, Any>("status" to status)
    if (message != null) {
      payload["message"] = message
    }
    onStatusChanged(payload)
  }
}

private class BalancedPrototypeCamera(
  private val context: Context,
  private val textureView: TextureView,
  private val reportStatus: (String, String?) -> Unit,
) : TextureView.SurfaceTextureListener {
  private val thread = HandlerThread("PicchuSpotBalancedPrototype").also { it.start() }
  private val handler = Handler(thread.looper)
  private val stateMonitor = Object()
  private val captureMonitor = Object()
  private val previewTracker = PreviewTracker()

  @Volatile
  var cameraId: String = "0"
    set(value) {
      field = value
      restart()
    }

  @Volatile
  var zoomRatio: Float = 1f
    set(value) {
      field = value
      handler.post { refreshPreview() }
    }

  @Volatile
  private var lifecycleStatus = "idle"
  @Volatile
  private var lifecycleMessage: String? = null
  @Volatile
  private var shouldRun = false
  @Volatile
  private var destroyed = false

  private var camera: CameraDevice? = null
  private var session: CameraCaptureSession? = null
  private var imageReader: ImageReader? = null
  private var previewSurface: Surface? = null
  private var characteristics: CameraCharacteristics? = null
  private var selectedJpegSize: Size? = null
  private var selectedPreviewSize: Size? = null
  private var controls = PreviewControls()
  @Volatile
  private var activeCollector: FrameCollector? = null

  init {
    textureView.surfaceTextureListener = this
  }

  fun start() {
    shouldRun = true
    setStatus("opening-camera", "Starting the Camera2-owned development preview…")
    handler.post { openIfPossible() }
  }

  fun stop() {
    shouldRun = false
    handler.post { closeCamera() }
    setStatus("idle", "The development preview is stopped.")
  }

  fun destroy() {
    if (destroyed) return
    destroyed = true
    shouldRun = false
    handler.post {
      closeCamera()
      thread.quitSafely()
    }
  }

  fun status(): Map<String, Any?> = mapOf(
    "status" to lifecycleStatus,
    "reason" to lifecycleMessage,
    "cameraId" to cameraId,
    "selectedJpegSize" to selectedJpegSize?.let(::sizeMap),
    "zoomRatio" to zoomRatio,
  )

  override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
    handler.post { openIfPossible() }
  }

  override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
    handler.post { updatePreviewTransform() }
  }

  override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
    handler.post { closeCamera() }
    return true
  }

  override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit

  fun runComparison(): Map<String, Any?> {
    synchronized(captureMonitor) {
      if (!awaitPreviewReady()) {
        return failedComparison("The Camera2 preview is not ready: ${lifecycleMessage ?: "unknown error"}")
      }
      val activeCamera = camera ?: return failedComparison("The Camera2 device is unavailable.")
      val activeSession = session ?: return failedComparison("The Camera2 session is unavailable.")
      val activeCharacteristics = characteristics
        ?: return failedComparison("Camera characteristics are unavailable.")
      val jpegSize = selectedJpegSize
        ?: return failedComparison("No practical 4:3 Camera2 JPEG size is available.")
      val evidenceFilename = "comparison-${SystemClock.elapsedRealtimeNanos()}.json"

      setStatus("capturing", "Capturing temporary AE and manual Camera2 comparison sets…")
      val motion = PublicMotionRecorder(context)
      motion.start()
      var focusWhiteBalance: Map<String, Any?> = emptyMap()
      var aeExecution = StrategyExecution.unavailable("The AE sequence was not started.")
      var manualExecution = StrategyExecution.unavailable("The manual burst was not started.")
      var failure: String? = null

      try {
        focusWhiteBalance = establishFocusAndWhiteBalance(
          activeCamera,
          activeSession,
          activeCharacteristics,
        )
        val aeStart = SystemClock.elapsedRealtimeNanos()
        aeExecution = captureAeSequence(
          activeCamera,
          activeSession,
          activeCharacteristics,
        )
        val aeEnd = SystemClock.elapsedRealtimeNanos()
        val baseline = aeExecution.frames.firstOrNull { it.plan.label == "0 EV" }
        val manualStart = SystemClock.elapsedRealtimeNanos()
        manualExecution = captureManualBurst(
          activeCamera,
          activeSession,
          activeCharacteristics,
          baseline,
        )
        val manualEnd = SystemClock.elapsedRealtimeNanos()

        val result = comparisonMap(
          activeCharacteristics,
          jpegSize,
          focusWhiteBalance,
          aeExecution,
          manualExecution,
          mapOf(
            "timestampBasis" to "SensorEvent.timestamp and SystemClock.elapsedRealtimeNanos are nanoseconds since boot.",
            "aeSequence" to motion.window(aeStart, aeEnd),
            "manualBurst" to motion.window(manualStart, manualEnd),
          ),
          failure,
          evidenceFilename,
        )
        persistComparisonEvidence(result, evidenceFilename)
        return result
      } catch (error: Throwable) {
        failure = errorMessage(error)
        val result = comparisonMap(
          activeCharacteristics,
          jpegSize,
          focusWhiteBalance,
          aeExecution,
          manualExecution,
          mapOf("failure" to "Movement windows were not completed: $failure"),
          failure,
          evidenceFilename,
        )
        persistComparisonEvidence(result, evidenceFilename)
        return result
      } finally {
        motion.stop()
        handler.post { refreshPreview() }
        setStatus("preview-ready", "Camera2 preview ready. Temporary prototype JPEGs remain in cache until cleared.")
      }
    }
  }

  private fun awaitPreviewReady(timeoutMs: Long = 8_000): Boolean {
    val deadline = SystemClock.elapsedRealtime() + timeoutMs
    synchronized(stateMonitor) {
      while (session == null && lifecycleStatus != "error") {
        val remaining = deadline - SystemClock.elapsedRealtime()
        if (remaining <= 0) return false
        stateMonitor.wait(remaining)
      }
      return session != null
    }
  }

  private fun openIfPossible() {
    if (!shouldRun || destroyed || camera != null || !textureView.isAvailable) return
    if (!hasCameraPermission()) {
      setStatus("error", "Android Camera permission is required for the development preview.")
      return
    }
    val surfaceTexture = textureView.surfaceTexture ?: return
    try {
      val manager = cameraManager()
      val cameraCharacteristics = manager.getCameraCharacteristics(cameraId)
      val jpegSize = chooseLargestFourByThreeJpeg(cameraCharacteristics)
        ?: throw IllegalStateException("Camera $cameraId does not advertise a 4:3 JPEG output.")
      val previewSize = choosePreviewSize(cameraCharacteristics)
        ?: throw IllegalStateException("Camera $cameraId does not advertise a 4:3 preview output.")
      selectedJpegSize = jpegSize
      selectedPreviewSize = previewSize
      characteristics = cameraCharacteristics
      surfaceTexture.setDefaultBufferSize(previewSize.width, previewSize.height)
      updatePreviewTransform()
      imageReader = ImageReader.newInstance(jpegSize.width, jpegSize.height, ImageFormat.JPEG, 4).also { reader ->
        reader.setOnImageAvailableListener({ availableReader -> drainImages(availableReader) }, handler)
      }
      manager.openCamera(cameraId, cameraStateCallback, handler)
    } catch (error: Throwable) {
      setStatus("error", errorMessage(error))
    }
  }

  private val cameraStateCallback = object : CameraDevice.StateCallback() {
    override fun onOpened(openedCamera: CameraDevice) {
      if (!shouldRun || destroyed) {
        openedCamera.close()
        return
      }
      camera = openedCamera
      configureSession(openedCamera)
    }

    override fun onDisconnected(disconnectedCamera: CameraDevice) {
      disconnectedCamera.close()
      camera = null
      setStatus("error", "Camera2 disconnected from camera $cameraId.")
    }

    override fun onError(erroredCamera: CameraDevice, error: Int) {
      erroredCamera.close()
      camera = null
      setStatus("error", "Camera2 failed to open camera $cameraId (error $error).")
    }
  }

  private fun configureSession(openedCamera: CameraDevice) {
    val surfaceTexture = textureView.surfaceTexture ?: run {
      setStatus("error", "The Camera2 preview surface is unavailable.")
      return
    }
    val reader = imageReader ?: run {
      setStatus("error", "The Camera2 JPEG reader is unavailable.")
      return
    }
    previewSurface = Surface(surfaceTexture)
    try {
      openedCamera.createCaptureSession(
        listOfNotNull(previewSurface, reader.surface),
        object : CameraCaptureSession.StateCallback() {
          override fun onConfigured(configuredSession: CameraCaptureSession) {
            if (!shouldRun || destroyed) {
              configuredSession.close()
              return
            }
            session = configuredSession
            refreshPreview()
            synchronized(stateMonitor) {
              stateMonitor.notifyAll()
            }
          }

          override fun onConfigureFailed(failedSession: CameraCaptureSession) {
            failedSession.close()
            setStatus("error", "Camera2 could not configure a preview and JPEG session.")
          }
        },
        handler,
      )
    } catch (error: Throwable) {
      setStatus("error", errorMessage(error))
    }
  }

  private fun refreshPreview() {
    val activeCamera = camera ?: return
    val activeSession = session ?: return
    try {
      activeSession.setRepeatingRequest(
        buildPreviewRequest(activeCamera, controls),
        previewCallback,
        handler,
      )
      setStatus("preview-ready", "Camera2 preview ready on logical camera $cameraId at zoom ${effectiveZoomRatio()}.")
    } catch (error: Throwable) {
      setStatus("error", errorMessage(error))
    }
  }

  private val previewCallback = object : CameraCaptureSession.CaptureCallback() {
    override fun onCaptureCompleted(
      captureSession: CameraCaptureSession,
      request: CaptureRequest,
      result: TotalCaptureResult,
    ) {
      previewTracker.update(
        CaptureSnapshot.from(result),
        result.get(CaptureResult.CONTROL_AE_EXPOSURE_COMPENSATION),
      )
    }
  }

  private fun establishFocusAndWhiteBalance(
    activeCamera: CameraDevice,
    activeSession: CameraCaptureSession,
    activeCharacteristics: CameraCharacteristics,
  ): Map<String, Any?> {
    val preliminary = PreviewControls()
    setPreviewControls(activeCamera, activeSession, preliminary)
    val baseline = previewTracker.awaitStable(
      expectedCompensation = 0,
      requireAfLock = false,
      requireAwbLock = false,
    )

    var current = preliminary
    var afLocked = false
    val minimumFocusDistance = activeCharacteristics.get(
      CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE,
    )
    if (minimumFocusDistance != null && minimumFocusDistance > 0f) {
      val triggerControls = current.copy(afMode = CaptureRequest.CONTROL_AF_MODE_AUTO)
      try {
        activeSession.capture(
          buildPreviewRequest(
            activeCamera,
            triggerControls,
            CaptureRequest.CONTROL_AF_TRIGGER_START,
          ),
          previewCallback,
          handler,
        )
        setPreviewControls(activeCamera, activeSession, triggerControls)
        val locked = previewTracker.awaitStable(
          expectedCompensation = 0,
          requireAfLock = true,
          requireAwbLock = false,
        )
        afLocked = locked.status == "stable"
        if (afLocked) current = triggerControls
      } catch (_: Throwable) {
        afLocked = false
      }
    }

    val supportsAwbLock = activeCharacteristics.get(
      CameraCharacteristics.CONTROL_AWB_LOCK_AVAILABLE,
    ) == true
    var awbLocked = false
    if (supportsAwbLock) {
      val lockControls = current.copy(awbLocked = true)
      try {
        setPreviewControls(activeCamera, activeSession, lockControls)
        val locked = previewTracker.awaitStable(
          expectedCompensation = 0,
          requireAfLock = afLocked,
          requireAwbLock = true,
        )
        awbLocked = locked.status == "stable"
        if (awbLocked) current = lockControls
      } catch (_: Throwable) {
        awbLocked = false
      }
    }
    controls = current
    return mapOf(
      "method" to "Preview AE convergence, then temporary AF lock when supported and successful, then temporary AWB lock when supported and successful. AE remains enabled for the AE comparison.",
      "baseline" to baseline.toMap(),
      "minimumFocusDistanceDiopters" to minimumFocusDistance,
      "afLockAttempted" to (minimumFocusDistance != null && minimumFocusDistance > 0f),
      "afLocked" to afLocked,
      "awbLockSupported" to supportsAwbLock,
      "awbLocked" to awbLocked,
      "controlsUsedForSets" to current.toMap(),
    )
  }

  private fun captureAeSequence(
    activeCamera: CameraDevice,
    activeSession: CameraCaptureSession,
    activeCharacteristics: CameraCharacteristics,
  ): StrategyExecution {
    val range = activeCharacteristics.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE)
      ?: return StrategyExecution.unavailable("Camera2 does not advertise an AE compensation range.")
    val step = activeCharacteristics.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_STEP)
      ?: return StrategyExecution.unavailable("Camera2 does not advertise an AE compensation step.")
    val points = listOf(-2.0, 0.0, 2.0).mapIndexed { index, targetEv ->
      val compensation = nearestCompensation(range, step, targetEv)
      CapturePlan(
        requestIndex = index,
        label = when (targetEv) {
          -2.0 -> "-2 EV"
          0.0 -> "0 EV"
          else -> "+2 EV"
        },
        requested = mapOf(
          "strategy" to "ae-sequence",
          "controlAeMode" to "ON",
          "aeCompensationIndex" to compensation.index,
          "aeRequestedEv" to compensation.actualEv,
          "aeDiagnosticTargetEv" to targetEv,
          "afMode" to afModeName(controls.afMode),
          "awbLock" to controls.awbLocked,
          "zoomRatio" to effectiveZoomRatio(),
          "jpegOrientationDegrees" to jpegOrientation(activeCharacteristics),
        ),
      )
    }
    val started = SystemClock.elapsedRealtimeNanos()
    val records = mutableListOf<CapturedFrame>()
    val convergence = mutableListOf<Map<String, Any?>>()
    points.forEach { plan ->
      val compensationIndex = plan.requested["aeCompensationIndex"] as Int
      val pointControls = controls.copy(aeCompensation = compensationIndex)
      setPreviewControls(activeCamera, activeSession, pointControls)
      val stable = previewTracker.awaitStable(
        expectedCompensation = compensationIndex,
        requireAfLock = controls.afMode == CaptureRequest.CONTROL_AF_MODE_AUTO,
        requireAwbLock = controls.awbLocked,
      )
      convergence += mapOf(
        "label" to plan.label,
        "framesObserved" to stable.framesObserved,
        "elapsedMs" to stable.elapsedMs,
        "status" to stable.status,
      )
      if (stable.status != "stable") {
        records += CapturedFrame.failed(plan, "AE/AF/AWB did not reach the temporary stability criteria before timeout.")
      } else {
        records += captureOne(activeCamera, activeSession, activeCharacteristics, plan, pointControls)
      }
    }
    controls = controls.copy(aeCompensation = 0)
    return StrategyExecution(
      status = if (records.all { it.failure == null }) "completed" else "partial",
      label = "Sequential AE-compensation full-resolution JPEG capture",
      startedAtNs = started,
      finishedAtNs = SystemClock.elapsedRealtimeNanos(),
      plans = points,
      frames = records,
      convergence = convergence,
      failure = records.firstOrNull { it.failure != null }?.failure,
    )
  }

  private fun captureManualBurst(
    activeCamera: CameraDevice,
    activeSession: CameraCaptureSession,
    activeCharacteristics: CameraCharacteristics,
    baseline: CapturedFrame?,
  ): StrategyExecution {
    val capabilities = activeCharacteristics.get(
      CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES,
    )?.toSet() ?: emptySet()
    if (!capabilities.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR)) {
      return StrategyExecution.unavailable("Camera2 does not advertise MANUAL_SENSOR.")
    }
    if (!capabilities.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BURST_CAPTURE)) {
      return StrategyExecution.unavailable("Camera2 does not advertise BURST_CAPTURE.")
    }
    val baselineExposure = baseline?.result?.exposureTimeNs
      ?: return StrategyExecution.unavailable("A successful 0 EV AE JPEG baseline is required before manual comparison.")
    val baselineIso = baseline.result.iso
      ?: return StrategyExecution.unavailable("The AE baseline did not expose an ISO value for manual comparison.")
    val exposureRange = activeCharacteristics.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE)
      ?: return StrategyExecution.unavailable("Camera2 does not advertise a manual exposure-time range.")
    val isoRange = activeCharacteristics.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE)
      ?: return StrategyExecution.unavailable("Camera2 does not advertise a manual ISO range.")

    val multipliers = listOf(0.25, 1.0, 4.0)
    val labels = listOf("-2 EV", "0 EV", "+2 EV")
    val plans = multipliers.mapIndexed { index, multiplier ->
      val desiredExposure = (baselineExposure * multiplier).toLong().coerceAtLeast(1L)
      val exposure = desiredExposure.coerceIn(exposureRange.lower, exposureRange.upper)
      val desiredIso = ((baselineExposure.toDouble() * baselineIso * multiplier) / exposure)
        .toInt()
        .coerceAtLeast(1)
      val iso = desiredIso.coerceIn(isoRange.lower, isoRange.upper)
      CapturePlan(
        requestIndex = index,
        label = labels[index],
        requested = mapOf(
          "strategy" to "manual-capture-burst",
          "controlAeMode" to "OFF",
          "sensorExposureTimeNs" to exposure,
          "sensorSensitivityIso" to iso,
          "aeBaselineExposureTimeNs" to baselineExposure,
          "aeBaselineIso" to baselineIso,
          "diagnosticEvMultiplier" to multiplier,
          "exposureTimeClamped" to (exposure != desiredExposure),
          "sensitivityClamped" to (iso != desiredIso),
          "afMode" to afModeName(controls.afMode),
          "awbLock" to controls.awbLocked,
          "zoomRatio" to effectiveZoomRatio(),
          "jpegOrientationDegrees" to jpegOrientation(activeCharacteristics),
        ),
      )
    }
    val started = SystemClock.elapsedRealtimeNanos()
    val collector = FrameCollector(context.cacheDir, plans)
    activeCollector = collector
    try {
      val requests = plans.map { plan ->
        buildStillRequest(activeCamera, activeCharacteristics, plan, controls, manual = true)
      }
      activeSession.captureBurst(requests, collector.callback, handler)
      val frames = collector.await()
      return StrategyExecution(
        status = if (frames.all { it.failure == null }) "completed" else "partial",
        label = "Manual Camera2 captureBurst() full-resolution JPEG capture",
        startedAtNs = started,
        finishedAtNs = SystemClock.elapsedRealtimeNanos(),
        plans = plans,
        frames = frames,
        convergence = emptyList(),
        failure = frames.firstOrNull { it.failure != null }?.failure,
      )
    } catch (error: Throwable) {
      return StrategyExecution.failed(
        "Manual captureBurst() failed: ${errorMessage(error)}",
        plans,
        started,
      )
    } finally {
      activeCollector = null
    }
  }

  private fun captureOne(
    activeCamera: CameraDevice,
    activeSession: CameraCaptureSession,
    activeCharacteristics: CameraCharacteristics,
    plan: CapturePlan,
    pointControls: PreviewControls,
  ): CapturedFrame {
    val collector = FrameCollector(context.cacheDir, listOf(plan))
    activeCollector = collector
    return try {
      activeSession.capture(
        buildStillRequest(activeCamera, activeCharacteristics, plan, pointControls, manual = false),
        collector.callback,
        handler,
      )
      collector.await().first()
    } catch (error: Throwable) {
      CapturedFrame.failed(plan, "Camera2 JPEG capture failed: ${errorMessage(error)}")
    } finally {
      activeCollector = null
    }
  }

  private fun setPreviewControls(
    activeCamera: CameraDevice,
    activeSession: CameraCaptureSession,
    nextControls: PreviewControls,
  ) {
    controls = nextControls
    activeSession.setRepeatingRequest(
      buildPreviewRequest(activeCamera, nextControls),
      previewCallback,
      handler,
    )
  }

  private fun buildPreviewRequest(
    activeCamera: CameraDevice,
    requestControls: PreviewControls,
    afTrigger: Int = CaptureRequest.CONTROL_AF_TRIGGER_IDLE,
  ): CaptureRequest {
    val surface = previewSurface ?: throw IllegalStateException("Preview surface is unavailable.")
    return activeCamera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
      addTarget(surface)
      applyCommonControls(this, requestControls, manual = false)
      set(CaptureRequest.CONTROL_AF_TRIGGER, afTrigger)
    }.build()
  }

  private fun buildStillRequest(
    activeCamera: CameraDevice,
    activeCharacteristics: CameraCharacteristics,
    plan: CapturePlan,
    requestControls: PreviewControls,
    manual: Boolean,
  ): CaptureRequest {
    val surface = previewSurface ?: throw IllegalStateException("Preview surface is unavailable.")
    val reader = imageReader ?: throw IllegalStateException("JPEG reader is unavailable.")
    return activeCamera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
      addTarget(surface)
      addTarget(reader.surface)
      applyCommonControls(this, requestControls, manual)
      set(CaptureRequest.JPEG_ORIENTATION, jpegOrientation(activeCharacteristics))
      if (manual) {
        set(CaptureRequest.SENSOR_EXPOSURE_TIME, plan.requested["sensorExposureTimeNs"] as Long)
        set(CaptureRequest.SENSOR_SENSITIVITY, plan.requested["sensorSensitivityIso"] as Int)
      } else {
        set(CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION, plan.requested["aeCompensationIndex"] as Int)
      }
      setTag(plan)
    }.build()
  }

  private fun applyCommonControls(
    builder: CaptureRequest.Builder,
    requestControls: PreviewControls,
    manual: Boolean,
  ) {
    builder.set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
    builder.set(
      CaptureRequest.CONTROL_AE_MODE,
      if (manual) CaptureRequest.CONTROL_AE_MODE_OFF else CaptureRequest.CONTROL_AE_MODE_ON,
    )
    if (!manual) {
      builder.set(CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION, requestControls.aeCompensation)
    }
    builder.set(CaptureRequest.CONTROL_AF_MODE, requestControls.afMode)
    builder.set(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_AUTO)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      builder.set(CaptureRequest.CONTROL_AWB_LOCK, requestControls.awbLocked)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.set(CaptureRequest.CONTROL_ZOOM_RATIO, effectiveZoomRatio())
    }
  }

  private fun drainImages(reader: ImageReader) {
    while (true) {
      val image = try {
        reader.acquireNextImage()
      } catch (_: Throwable) {
        null
      } ?: return
      try {
        activeCollector?.onImage(image, prototypeDirectory())
      } finally {
        image.close()
      }
    }
  }

  private fun closeCamera() {
    activeCollector?.abort("Camera2 preview was closed before JPEG capture completed.")
    activeCollector = null
    try {
      session?.close()
    } catch (_: Throwable) {
      // Best-effort debug cleanup.
    }
    try {
      camera?.close()
    } catch (_: Throwable) {
      // Best-effort debug cleanup.
    }
    try {
      imageReader?.close()
    } catch (_: Throwable) {
      // Best-effort debug cleanup.
    }
    try {
      previewSurface?.release()
    } catch (_: Throwable) {
      // Best-effort debug cleanup.
    }
    session = null
    camera = null
    imageReader = null
    previewSurface = null
    characteristics = null
    selectedJpegSize = null
    selectedPreviewSize = null
    synchronized(stateMonitor) {
      stateMonitor.notifyAll()
    }
  }

  private fun restart() {
    handler.post {
      closeCamera()
      openIfPossible()
    }
  }

  private fun updatePreviewTransform() {
    val previewSize = selectedPreviewSize ?: return
    textureView.post {
      if (!textureView.isAvailable || textureView.width <= 0 || textureView.height <= 0) {
        return@post
      }
      val displayRotation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        context.display?.rotation ?: Surface.ROTATION_0
      } else {
        @Suppress("DEPRECATION")
        textureView.display?.rotation ?: Surface.ROTATION_0
      }
      val displayDegrees = rotationDegrees(displayRotation)
      // TextureView already applies the Camera2 sensor orientation. Apply only
      // the current display rotation, then scale the sensor-oriented buffer.
      val rotatedWidth = if (displayDegrees % 180 == 0) previewSize.height.toFloat() else previewSize.width.toFloat()
      val rotatedHeight = if (displayDegrees % 180 == 0) previewSize.width.toFloat() else previewSize.height.toFloat()
      val scale = max(textureView.width / rotatedWidth, textureView.height / rotatedHeight)
      val matrix = Matrix().apply {
        postScale(scale, scale, textureView.width / 2f, textureView.height / 2f)
        postRotate(displayDegrees.toFloat(), textureView.width / 2f, textureView.height / 2f)
      }
      textureView.setTransform(matrix)
    }
  }

  private fun effectiveZoomRatio(): Float {
    val range = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      characteristics?.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
    } else {
      null
    }
    return if (range == null) 1f else zoomRatio.coerceIn(range.lower, range.upper)
  }

  private fun jpegOrientation(activeCharacteristics: CameraCharacteristics): Int {
    val sensor = activeCharacteristics.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 0
    val rotation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      context.display?.rotation ?: Surface.ROTATION_0
    } else {
      @Suppress("DEPRECATION")
      textureView.display?.rotation ?: Surface.ROTATION_0
    }
    return (sensor - rotationDegrees(rotation) + 360) % 360
  }

  private fun comparisonMap(
    activeCharacteristics: CameraCharacteristics,
    jpegSize: Size,
    focusWhiteBalance: Map<String, Any?>,
    aeExecution: StrategyExecution,
    manualExecution: StrategyExecution,
    movementWindows: Map<String, Any?>,
    failure: String?,
    evidenceFilename: String,
  ): Map<String, Any?> {
    val status = when {
      failure != null -> "failed"
      aeExecution.status == "completed" && manualExecution.status == "completed" -> "completed"
      else -> "partial"
    }
    return mapOf(
      "schemaVersion" to 1,
      "kind" to "android-balanced-capture-prototype",
      "status" to status,
      "capturedAtUtc" to nowUtc(),
      "android" to androidInfo(),
      "camera" to mapOf(
        "logicalCameraId" to cameraId,
        "selectedJpegSize" to sizeMap(jpegSize),
        "sensorOrientationDegrees" to activeCharacteristics.get(CameraCharacteristics.SENSOR_ORIENTATION),
        "zoomRatio" to effectiveZoomRatio(),
        "timestampSource" to timestampSourceName(activeCharacteristics.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE)),
      ),
      "focusWhiteBalance" to focusWhiteBalance,
      "aeSequence" to aeExecution.toMap(),
      "manualBurst" to manualExecution.toMap(),
      "movementWindows" to movementWindows,
      "storage" to mapOf(
        "directory" to PROTOTYPE_DIRECTORY,
        "evidenceFilename" to evidenceFilename,
        "filesAreCacheOnly" to true,
        "galleryWrite" to false,
        "shootSqliteWrite" to false,
        "upload" to false,
      ),
      "failure" to failure,
    )
  }

  private fun failedComparison(reason: String): Map<String, Any?> = mapOf(
    "schemaVersion" to 1,
    "kind" to "android-balanced-capture-prototype",
    "status" to "failed",
    "capturedAtUtc" to nowUtc(),
    "failure" to reason,
  )

  private fun setStatus(status: String, message: String?) {
    lifecycleStatus = status
    lifecycleMessage = message
    textureView.post { reportStatus(status, message) }
    synchronized(stateMonitor) {
      stateMonitor.notifyAll()
    }
  }

  private fun cameraManager(): CameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager

  private fun hasCameraPermission(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
    context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

  private fun prototypeDirectory(): File {
    val cacheDirectory = context.cacheDir ?: throw IllegalStateException("App cache directory is unavailable.")
    val directory = File(cacheDirectory, PROTOTYPE_DIRECTORY)
    if (!directory.exists() && !directory.mkdirs()) {
      throw IllegalStateException("Could not create the prototype cache directory.")
    }
    return directory
  }

  private fun persistComparisonEvidence(result: Map<String, Any?>, filename: String) {
    try {
      val target = File(prototypeDirectory(), filename)
      FileOutputStream(target).use { output ->
        output.write(JSONObject(result).toString(2).toByteArray(Charsets.UTF_8))
      }
    } catch (_: Throwable) {
      // The onscreen result remains available if a cache-only evidence write fails.
    }
  }
}

private data class PreviewControls(
  val aeCompensation: Int = 0,
  val afMode: Int = CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE,
  val awbLocked: Boolean = false,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "aeCompensationIndex" to aeCompensation,
    "afMode" to afModeName(afMode),
    "awbLocked" to awbLocked,
  )
}

private data class CapturePlan(
  val requestIndex: Int,
  val label: String,
  val requested: Map<String, Any?>,
)

private data class CaptureSnapshot(
  val exposureTimeNs: Long?,
  val iso: Int?,
  val aeState: Int?,
  val afState: Int?,
  val awbState: Int?,
  val zoomRatio: Float?,
  val activePhysicalCameraId: String?,
  val focalLengthMm: Float?,
  val jpegOrientationDegrees: Int?,
  val sensorTimestampNs: Long?,
  val completionTimestampNs: Long,
  val frameNumber: Long,
) {
  companion object {
    fun from(result: TotalCaptureResult): CaptureSnapshot = CaptureSnapshot(
      exposureTimeNs = result.get(CaptureResult.SENSOR_EXPOSURE_TIME),
      iso = result.get(CaptureResult.SENSOR_SENSITIVITY),
      aeState = result.get(CaptureResult.CONTROL_AE_STATE),
      afState = result.get(CaptureResult.CONTROL_AF_STATE),
      awbState = result.get(CaptureResult.CONTROL_AWB_STATE),
      zoomRatio = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        result.get(CaptureResult.CONTROL_ZOOM_RATIO)
      } else {
        null
      },
      activePhysicalCameraId = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        result.get(CaptureResult.LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID)
      } else {
        null
      },
      focalLengthMm = result.get(CaptureResult.LENS_FOCAL_LENGTH),
      jpegOrientationDegrees = result.get(CaptureResult.JPEG_ORIENTATION),
      sensorTimestampNs = result.get(CaptureResult.SENSOR_TIMESTAMP),
      completionTimestampNs = SystemClock.elapsedRealtimeNanos(),
      frameNumber = result.frameNumber,
    )
  }
}

private class PreviewTracker {
  private val monitor = Object()
  private var frameIndex = 0L
  private var snapshot: CaptureSnapshot? = null
  private var actualCompensation: Int? = null

  fun update(next: CaptureSnapshot, compensation: Int? = null) {
    synchronized(monitor) {
      frameIndex += 1
      snapshot = next
      actualCompensation = compensation
      monitor.notifyAll()
    }
  }

  fun awaitStable(
    expectedCompensation: Int,
    requireAfLock: Boolean,
    requireAwbLock: Boolean,
    timeoutMs: Long = 3_500,
  ): StabilityResult {
    val start = SystemClock.elapsedRealtime()
    val deadline = start + timeoutMs
    var seenIndex: Long
    synchronized(monitor) { seenIndex = frameIndex }
    var framesObserved = 0
    var stableFrames = 0
    var physicalCamera: String? = null
    while (SystemClock.elapsedRealtime() < deadline) {
      val next = synchronized(monitor) {
        val remaining = deadline - SystemClock.elapsedRealtime()
        if (frameIndex <= seenIndex && remaining > 0) monitor.wait(remaining)
        if (frameIndex <= seenIndex) null else {
          seenIndex = frameIndex
          PreviewObservation(snapshot, actualCompensation)
        }
      } ?: continue
      framesObserved += 1
      val current = next.snapshot
      val isStable = current != null &&
        (next.compensation == null || next.compensation == expectedCompensation) &&
        isAeStable(current.aeState) &&
        isAfStable(current.afState, requireAfLock) &&
        isAwbStable(current.awbState, requireAwbLock) &&
        (physicalCamera == null || physicalCamera == current.activePhysicalCameraId)
      if (isStable) {
        stableFrames += 1
        physicalCamera = current?.activePhysicalCameraId
        if (stableFrames >= 3) {
          return StabilityResult("stable", framesObserved, SystemClock.elapsedRealtime() - start)
        }
      } else {
        stableFrames = 0
        physicalCamera = current?.activePhysicalCameraId
      }
    }
    return StabilityResult("timeout", framesObserved, SystemClock.elapsedRealtime() - start)
  }

  private data class PreviewObservation(
    val snapshot: CaptureSnapshot?,
    val compensation: Int?,
  )
}

private data class StabilityResult(
  val status: String,
  val framesObserved: Int,
  val elapsedMs: Long,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "status" to status,
    "framesObserved" to framesObserved,
    "elapsedMs" to elapsedMs,
  )
}

private class FrameCollector(
  private val cacheDirectory: File?,
  plans: List<CapturePlan>,
) {
  private val monitor = Object()
  private val records = plans.associateWith { MutableFrame(it) }.toMutableMap()
  private val pendingImages = mutableListOf<ImageFile>()
  private var completionCounter = 0

  val callback = object : CameraCaptureSession.CaptureCallback() {
    override fun onCaptureStarted(
      session: CameraCaptureSession,
      request: CaptureRequest,
      timestamp: Long,
      frameNumber: Long,
    ) {
      val plan = request.tag as? CapturePlan ?: return
      synchronized(monitor) {
        records[plan]?.startedSensorTimestampNs = timestamp
      }
    }

    override fun onCaptureCompleted(
      session: CameraCaptureSession,
      request: CaptureRequest,
      result: TotalCaptureResult,
    ) {
      val plan = request.tag as? CapturePlan ?: return
      synchronized(monitor) {
        val record = records[plan] ?: return
        record.result = CaptureSnapshot.from(result)
        completionCounter += 1
        record.completionOrder = completionCounter
        pairAvailableImages()
        monitor.notifyAll()
      }
    }

    override fun onCaptureFailed(
      session: CameraCaptureSession,
      request: CaptureRequest,
      failure: CaptureFailure,
    ) {
      val plan = request.tag as? CapturePlan ?: return
      synchronized(monitor) {
        records[plan]?.failure = "Camera2 capture failure reason ${failure.reason}."
        monitor.notifyAll()
      }
    }

    override fun onCaptureSequenceAborted(session: CameraCaptureSession, sequenceId: Int) {
      abort("Camera2 capture sequence $sequenceId was aborted.")
    }
  }

  fun onImage(image: Image, directory: File) {
    val file = try {
      val filename = "frame-${image.timestamp}-${SystemClock.elapsedRealtimeNanos()}.jpg"
      val target = File(directory, filename)
      FileOutputStream(target).channel.use { channel ->
        val buffer = image.planes.firstOrNull()?.buffer
          ?: throw IllegalStateException("Camera2 JPEG image has no byte buffer.")
        while (buffer.hasRemaining()) channel.write(buffer)
      }
      ImageFile(
        fileUri = android.net.Uri.fromFile(target).toString(),
        filename = filename,
        width = image.width,
        height = image.height,
        byteSize = target.length(),
        sensorTimestampNs = image.timestamp,
      )
    } catch (error: Throwable) {
      ImageFile.failure(image.timestamp, errorMessage(error))
    }
    synchronized(monitor) {
      pendingImages += file
      pairAvailableImages()
      monitor.notifyAll()
    }
  }

  fun await(timeoutMs: Long = 9_000): List<CapturedFrame> {
    val deadline = SystemClock.elapsedRealtime() + timeoutMs
    synchronized(monitor) {
      while (!isComplete()) {
        val remaining = deadline - SystemClock.elapsedRealtime()
        if (remaining <= 0) {
          records.values.filter { it.failure == null && (it.result == null || it.image == null) }.forEach {
            it.failure = "Timed out waiting for Camera2 JPEG result and image delivery."
          }
          break
        }
        monitor.wait(remaining)
      }
      return records.values.sortedBy { it.plan.requestIndex }.map { it.freeze() }
    }
  }

  fun abort(reason: String) {
    synchronized(monitor) {
      records.values.filter { it.failure == null && it.result == null }.forEach { it.failure = reason }
      monitor.notifyAll()
    }
  }

  private fun pairAvailableImages() {
    val awaiting = records.values
      .filter { it.failure == null && it.result != null && it.image == null }
      .sortedBy { it.result?.frameNumber ?: Long.MAX_VALUE }
    awaiting.forEach { record ->
      val timestamp = record.result?.sensorTimestampNs ?: record.startedSensorTimestampNs
      val exactIndex = timestamp?.let { expected ->
        pendingImages.indexOfFirst { image -> image.sensorTimestampNs == expected }
      } ?: -1
      val image = when {
        exactIndex >= 0 -> pendingImages.removeAt(exactIndex)
        pendingImages.isNotEmpty() -> pendingImages.removeAt(0)
        else -> null
      }
      if (image != null) {
        record.image = image
        record.imageAssociation = if (exactIndex >= 0) {
          "sensor-timestamp"
        } else {
          "delivery-order-fallback"
        }
      }
    }
  }

  private fun isComplete(): Boolean = records.values.all { record ->
    record.failure != null || (record.result != null && record.image != null)
  }
}

private data class MutableFrame(
  val plan: CapturePlan,
  var startedSensorTimestampNs: Long? = null,
  var result: CaptureSnapshot? = null,
  var image: ImageFile? = null,
  var imageAssociation: String? = null,
  var completionOrder: Int? = null,
  var failure: String? = null,
) {
  fun freeze(): CapturedFrame = CapturedFrame(plan, result, image, imageAssociation, completionOrder, failure)
}

private data class ImageFile(
  val fileUri: String?,
  val filename: String?,
  val width: Int?,
  val height: Int?,
  val byteSize: Long?,
  val sensorTimestampNs: Long,
  val failure: String? = null,
) {
  companion object {
    fun failure(timestamp: Long, reason: String) = ImageFile(null, null, null, null, null, timestamp, reason)
  }
}

private data class CapturedFrame(
  val plan: CapturePlan,
  val result: CaptureSnapshot?,
  val image: ImageFile?,
  val imageAssociation: String?,
  val completionOrder: Int?,
  val failure: String?,
) {
  companion object {
    fun failed(plan: CapturePlan, reason: String) = CapturedFrame(plan, null, null, null, null, reason)
  }

  fun toMap(): Map<String, Any?> {
    val imageFailure = image?.failure
    val actualFailure = failure ?: imageFailure
    val sensorTimestamp = result?.sensorTimestampNs
    val completionTimestamp = result?.completionTimestampNs
    return mapOf(
      "requestIndex" to plan.requestIndex,
      "label" to plan.label,
      "fileUri" to image?.fileUri,
      "filename" to image?.filename,
      "width" to image?.width,
      "height" to image?.height,
      "byteSize" to image?.byteSize,
      "imageAssociation" to imageAssociation,
      "jpegOrientationDegrees" to result?.jpegOrientationDegrees,
      "requested" to plan.requested,
      "actual" to mapOf(
        "activePhysicalCameraId" to result?.activePhysicalCameraId,
        "focalLengthMm" to result?.focalLengthMm,
        "exposureTimeNs" to result?.exposureTimeNs,
        "iso" to result?.iso,
        "aeState" to aeStateName(result?.aeState),
        "afState" to afStateName(result?.afState),
        "awbState" to awbStateName(result?.awbState),
        "zoomRatio" to result?.zoomRatio,
        "sensorTimestampNs" to sensorTimestamp,
        "completionTimestampNs" to completionTimestamp,
        "frameNumber" to result?.frameNumber,
      ),
      "shutterToCompleteMs" to if (sensorTimestamp != null && completionTimestamp != null) {
        (completionTimestamp - sensorTimestamp) / 1_000_000.0
      } else {
        null
      },
      "completionOrder" to completionOrder,
      "failure" to actualFailure,
    )
  }
}

private data class StrategyExecution(
  val status: String,
  val label: String,
  val startedAtNs: Long?,
  val finishedAtNs: Long?,
  val plans: List<CapturePlan>,
  val frames: List<CapturedFrame>,
  val convergence: List<Map<String, Any?>>,
  val failure: String?,
) {
  companion object {
    fun unavailable(reason: String) = StrategyExecution(
      status = "unavailable",
      label = "Unavailable",
      startedAtNs = null,
      finishedAtNs = null,
      plans = emptyList(),
      frames = emptyList(),
      convergence = emptyList(),
      failure = reason,
    )

    fun failed(reason: String, plans: List<CapturePlan>, startedAtNs: Long) = StrategyExecution(
      status = "failed",
      label = "Manual Camera2 captureBurst() full-resolution JPEG capture",
      startedAtNs = startedAtNs,
      finishedAtNs = SystemClock.elapsedRealtimeNanos(),
      plans = plans,
      frames = plans.map { CapturedFrame.failed(it, reason) },
      convergence = emptyList(),
      failure = reason,
    )
  }

  fun toMap(): Map<String, Any?> {
    val orderedFrames = frames.sortedBy { it.plan.requestIndex }
    val completedFrames = frames.filter { it.completionOrder != null }.sortedBy { it.completionOrder }
    val completionTimes = completedFrames.mapNotNull { it.result?.completionTimestampNs }
    val sensorTimes = frames
      .mapNotNull { it.result?.sensorTimestampNs }
      .sorted()
    return mapOf(
      "status" to status,
      "label" to label,
      "requestedSequence" to plans.map { it.label },
      "startedAtElapsedRealtimeNs" to startedAtNs,
      "finishedAtElapsedRealtimeNs" to finishedAtNs,
      "totalDurationMs" to if (startedAtNs != null && finishedAtNs != null) {
        (finishedAtNs - startedAtNs) / 1_000_000.0
      } else {
        null
      },
      "convergence" to convergence,
      "frames" to orderedFrames.map(CapturedFrame::toMap),
      "requestOrder" to plans.map { it.requestIndex },
      "completionOrder" to completedFrames.map { it.plan.requestIndex },
      "interFrameSensorIntervalsMs" to intervalsMs(sensorTimes),
      "interFrameCompletionIntervalsMs" to intervalsMs(completionTimes),
      "failure" to failure,
    )
  }
}

private class PublicMotionRecorder(context: Context) : SensorEventListener {
  private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private val records = mutableListOf<MotionSample>()
  private val callbackHandler = Handler(android.os.Looper.getMainLooper())
  private var started = false

  fun start() {
    if (started) return
    started = true
    listOf(Sensor.TYPE_GYROSCOPE, Sensor.TYPE_LINEAR_ACCELERATION).forEach { type ->
      sensorManager.getDefaultSensor(type)?.let { sensor ->
        sensorManager.registerListener(this, sensor, 20_000, callbackHandler)
      }
    }
  }

  fun stop() {
    if (!started) return
    sensorManager.unregisterListener(this)
    started = false
  }

  override fun onSensorChanged(event: SensorEvent) {
    synchronized(records) {
      records += MotionSample(
        sensorType = event.sensor.type,
        sensorName = event.sensor.name,
        timestampNs = event.timestamp,
        callbackTimestampNs = SystemClock.elapsedRealtimeNanos(),
        values = event.values.map { it.toDouble() },
      )
    }
  }

  override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) = Unit

  fun window(startNs: Long, endNs: Long): Map<String, Any?> {
    val samples = synchronized(records) {
      records.filter { it.timestampNs in startNs..endNs }
    }
    return mapOf(
      "captureWindowElapsedRealtimeNs" to mapOf("start" to startNs, "end" to endNs),
      "gyroscope" to motionSummary(samples.filter { it.sensorType == Sensor.TYPE_GYROSCOPE }),
      "linearAcceleration" to motionSummary(samples.filter { it.sensorType == Sensor.TYPE_LINEAR_ACCELERATION }),
      "note" to "Public diagnostic sensor data only; no product movement threshold or warning is defined.",
    )
  }

  private fun motionSummary(samples: List<MotionSample>): Map<String, Any?> {
    val magnitudes = samples.map { sample -> sqrt(sample.values.sumOf { it * it }) }
    val sampleRate = if (samples.size >= 2) {
      val seconds = (samples.last().timestampNs - samples.first().timestampNs) / 1_000_000_000.0
      if (seconds > 0) (samples.size - 1) / seconds else null
    } else {
      null
    }
    return mapOf(
      "sampleCount" to samples.size,
      "sampleRateHz" to sampleRate,
      "magnitudeRms" to if (magnitudes.isEmpty()) null else sqrt(magnitudes.sumOf { it * it } / magnitudes.size),
      "magnitudePeak" to magnitudes.maxOrNull(),
      "timestampedSamples" to samples.map(MotionSample::toMap),
    )
  }
}

private data class MotionSample(
  val sensorType: Int,
  val sensorName: String,
  val timestampNs: Long,
  val callbackTimestampNs: Long,
  val values: List<Double>,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "sensorType" to sensorType,
    "sensorName" to sensorName,
    "sensorTimestampNs" to timestampNs,
    "callbackElapsedRealtimeNs" to callbackTimestampNs,
    "values" to values,
  )
}

private fun chooseLargestFourByThreeJpeg(characteristics: CameraCharacteristics): Size? =
  characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
    ?.getOutputSizes(ImageFormat.JPEG)
    ?.filter(::isFourByThree)
    ?.maxByOrNull { it.width.toLong() * it.height.toLong() }

private fun choosePreviewSize(characteristics: CameraCharacteristics): Size? =
  characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
    ?.getOutputSizes(SurfaceTexture::class.java)
    ?.filter(::isFourByThree)
    ?.filter { it.width <= 1_920 && it.height <= 1_440 }
    ?.maxByOrNull { it.width.toLong() * it.height.toLong() }
    ?: characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
      ?.getOutputSizes(SurfaceTexture::class.java)
      ?.filter(::isFourByThree)
      ?.minByOrNull { it.width.toLong() * it.height.toLong() }

private fun isFourByThree(size: Size): Boolean = abs(size.width * 3 - size.height * 4) <= 4

private fun nearestCompensation(range: Range<Int>, step: Rational, targetEv: Double): Compensation {
  val stepEv = step.numerator.toDouble() / step.denominator
  val index = kotlin.math.round(targetEv / stepEv).toInt().coerceIn(range.lower, range.upper)
  return Compensation(index, index * stepEv)
}

private data class Compensation(val index: Int, val actualEv: Double)

private fun isAeStable(state: Int?): Boolean = state == CaptureResult.CONTROL_AE_STATE_CONVERGED ||
  state == CaptureResult.CONTROL_AE_STATE_LOCKED ||
  state == CaptureResult.CONTROL_AE_STATE_FLASH_REQUIRED

private fun isAfStable(state: Int?, requireLock: Boolean): Boolean = if (requireLock) {
  state == CaptureResult.CONTROL_AF_STATE_FOCUSED_LOCKED ||
    state == CaptureResult.CONTROL_AF_STATE_NOT_FOCUSED_LOCKED
} else {
  state == CaptureResult.CONTROL_AF_STATE_FOCUSED_LOCKED ||
    state == CaptureResult.CONTROL_AF_STATE_NOT_FOCUSED_LOCKED ||
    state == CaptureResult.CONTROL_AF_STATE_PASSIVE_FOCUSED ||
    state == CaptureResult.CONTROL_AF_STATE_PASSIVE_UNFOCUSED
}

private fun isAwbStable(state: Int?, requireLock: Boolean): Boolean = if (requireLock) {
  state == CaptureResult.CONTROL_AWB_STATE_LOCKED
} else {
  state == CaptureResult.CONTROL_AWB_STATE_CONVERGED || state == CaptureResult.CONTROL_AWB_STATE_LOCKED
}

private fun intervalsMs(timestamps: List<Long>): List<Double> = timestamps.zipWithNext { first, second ->
  (second - first) / 1_000_000.0
}

private fun sizeMap(size: Size): Map<String, Int> = mapOf("width" to size.width, "height" to size.height)

private fun rotationDegrees(rotation: Int): Int = when (rotation) {
  Surface.ROTATION_0 -> 0
  Surface.ROTATION_90 -> 90
  Surface.ROTATION_180 -> 180
  Surface.ROTATION_270 -> 270
  else -> 0
}

private fun aeStateName(state: Int?): String = when (state) {
  CaptureResult.CONTROL_AE_STATE_INACTIVE -> "INACTIVE"
  CaptureResult.CONTROL_AE_STATE_SEARCHING -> "SEARCHING"
  CaptureResult.CONTROL_AE_STATE_CONVERGED -> "CONVERGED"
  CaptureResult.CONTROL_AE_STATE_LOCKED -> "LOCKED"
  CaptureResult.CONTROL_AE_STATE_FLASH_REQUIRED -> "FLASH_REQUIRED"
  CaptureResult.CONTROL_AE_STATE_PRECAPTURE -> "PRECAPTURE"
  null -> "UNKNOWN"
  else -> "UNKNOWN($state)"
}

private fun afStateName(state: Int?): String = when (state) {
  CaptureResult.CONTROL_AF_STATE_INACTIVE -> "INACTIVE"
  CaptureResult.CONTROL_AF_STATE_PASSIVE_SCAN -> "PASSIVE_SCAN"
  CaptureResult.CONTROL_AF_STATE_PASSIVE_FOCUSED -> "PASSIVE_FOCUSED"
  CaptureResult.CONTROL_AF_STATE_ACTIVE_SCAN -> "ACTIVE_SCAN"
  CaptureResult.CONTROL_AF_STATE_FOCUSED_LOCKED -> "FOCUSED_LOCKED"
  CaptureResult.CONTROL_AF_STATE_NOT_FOCUSED_LOCKED -> "NOT_FOCUSED_LOCKED"
  CaptureResult.CONTROL_AF_STATE_PASSIVE_UNFOCUSED -> "PASSIVE_UNFOCUSED"
  null -> "UNKNOWN"
  else -> "UNKNOWN($state)"
}

private fun awbStateName(state: Int?): String = when (state) {
  CaptureResult.CONTROL_AWB_STATE_INACTIVE -> "INACTIVE"
  CaptureResult.CONTROL_AWB_STATE_SEARCHING -> "SEARCHING"
  CaptureResult.CONTROL_AWB_STATE_CONVERGED -> "CONVERGED"
  CaptureResult.CONTROL_AWB_STATE_LOCKED -> "LOCKED"
  null -> "UNKNOWN"
  else -> "UNKNOWN($state)"
}

private fun afModeName(mode: Int): String = when (mode) {
  CaptureRequest.CONTROL_AF_MODE_OFF -> "OFF"
  CaptureRequest.CONTROL_AF_MODE_AUTO -> "AUTO"
  CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE -> "CONTINUOUS_PICTURE"
  CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO -> "CONTINUOUS_VIDEO"
  CaptureRequest.CONTROL_AF_MODE_MACRO -> "MACRO"
  else -> "UNKNOWN($mode)"
}

private fun timestampSourceName(source: Int?): String = when (source) {
  CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME -> "REALTIME"
  CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_UNKNOWN -> "UNKNOWN"
  null -> "UNKNOWN"
  else -> "UNKNOWN($source)"
}

private fun nowUtc(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
  timeZone = TimeZone.getTimeZone("UTC")
}.format(Date())

private fun androidInfo(): Map<String, Any?> = mapOf(
  "apiLevel" to Build.VERSION.SDK_INT,
  "manufacturer" to Build.MANUFACTURER,
  "model" to Build.MODEL,
  "release" to Build.VERSION.RELEASE,
)

private fun errorMessage(error: Throwable): String = error.message ?: error::class.java.simpleName
