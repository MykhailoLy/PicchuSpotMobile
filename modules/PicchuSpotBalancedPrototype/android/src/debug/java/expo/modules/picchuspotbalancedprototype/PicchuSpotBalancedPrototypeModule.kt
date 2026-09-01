package expo.modules.picchuspotbalancedprototype

import java.io.File
import java.lang.ref.WeakReference
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Debug-only registration for the first Camera2 Balanced comparison prototype.
 * The release source set provides the same JavaScript surface without Camera2.
 */
class PicchuSpotBalancedPrototypeModule : Module() {
  private var activePreview = WeakReference<BalancedCapturePreview>(null)

  override fun definition() = ModuleDefinition {
    Name("PicchuSpotBalancedPrototype")

    View(BalancedCapturePreview::class) {
      Name("PicchuSpotBalancedPrototypeView")
      Events("onStatusChanged")

      Prop("cameraId", "0") { view: BalancedCapturePreview, cameraId: String ->
        activePreview = WeakReference(view)
        view.cameraId = cameraId
      }
      Prop("zoomRatio", 1f) { view: BalancedCapturePreview, zoomRatio: Float ->
        activePreview = WeakReference(view)
        view.zoomRatio = zoomRatio
      }
      OnViewDidUpdateProps { view: BalancedCapturePreview ->
        activePreview = WeakReference(view)
      }
      OnViewDestroys { view: BalancedCapturePreview ->
        if (activePreview.get() === view) {
          activePreview = WeakReference(null)
        }
        view.destroy()
      }
    }

    AsyncFunction("getStatusAsync").SuspendBody<Map<String, Any?>> {
      activePreview.get()?.status() ?: mapOf(
        "status" to "idle",
        "reason" to "Mount the development-only Camera2 preview before running the prototype.",
      )
    }

    AsyncFunction("runComparisonAsync").SuspendBody<Map<String, Any?>> {
      activePreview.get()?.runComparison() ?: failedResult(
        "The development-only Camera2 preview is not mounted.",
      )
    }

    AsyncFunction("runExperimentAsync").SuspendBody { candidateId: String, plannerId: String ->
      activePreview.get()?.runExperiment(candidateId, plannerId) ?: failedResult(
        "The development-only Camera2 preview is not mounted.",
      )
    }

    AsyncFunction("clearPrototypeFilesAsync").SuspendBody<Map<String, Any?>> {
      clearPrototypeDirectory(appContext.cacheDirectory)
    }
  }

  private fun failedResult(reason: String): Map<String, Any?> = mapOf(
    "schemaVersion" to 2,
    "kind" to "android-balanced-bracket-policy-experiment",
    "status" to "failed",
    "failure" to reason,
  )
}

internal const val PROTOTYPE_DIRECTORY = "balanced-capture-prototype"

internal fun clearPrototypeDirectory(cacheDirectory: File?): Map<String, Any?> {
  if (cacheDirectory == null) {
    return mapOf(
      "status" to "failed",
      "removedFileCount" to 0,
      "failure" to "The app cache directory is unavailable.",
    )
  }
  val directory = File(cacheDirectory, PROTOTYPE_DIRECTORY)
  if (!directory.exists()) {
    return mapOf(
      "status" to "cleared",
      "removedFileCount" to 0,
      "failure" to null,
    )
  }
  var removedFileCount = 0
  val children = directory.listFiles().orEmpty()
  children.forEach { file ->
    if (file.isFile && file.delete()) {
      removedFileCount += 1
    }
  }
  val remaining = directory.listFiles().orEmpty()
  val failure = if (remaining.isEmpty()) {
    directory.delete()
    null
  } else {
    "Some prototype cache files could not be removed."
  }
  return mapOf(
    "status" to if (failure == null) "cleared" else "failed",
    "removedFileCount" to removedFileCount,
    "failure" to failure,
  )
}
