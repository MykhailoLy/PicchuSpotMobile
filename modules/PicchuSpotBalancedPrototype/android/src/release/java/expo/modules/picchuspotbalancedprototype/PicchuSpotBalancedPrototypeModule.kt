package expo.modules.picchuspotbalancedprototype

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Inert release-only registration. The Camera2 preview and capture code exist
 * only in the debug source set and are not present in release bytecode.
 */
class PicchuSpotBalancedPrototypeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PicchuSpotBalancedPrototype")

    View(BalancedCapturePreview::class) {
      Name("PicchuSpotBalancedPrototypeView")
      Events("onStatusChanged")
    }

    AsyncFunction("getStatusAsync").SuspendBody<Map<String, Any?>> {
      unavailable("getStatusAsync")
    }
    AsyncFunction("runComparisonAsync").SuspendBody<Map<String, Any?>> {
      unavailable("runComparisonAsync")
    }
    AsyncFunction("runExperimentAsync").SuspendBody<Map<String, Any?>> {
      unavailable("runExperimentAsync")
    }
    AsyncFunction("inspectCompatibilityAsync").SuspendBody<Map<String, Any?>> {
      unavailable("inspectCompatibilityAsync")
    }
    AsyncFunction("runCompatibilityProbeAsync").SuspendBody<Map<String, Any?>> {
      unavailable("runCompatibilityProbeAsync")
    }
    AsyncFunction("readLatestCompatibilityProbeAsync").SuspendBody<Map<String, Any?>> {
      unavailable("readLatestCompatibilityProbeAsync")
    }
    AsyncFunction("clearCompatibilityProbeFilesAsync").SuspendBody<Map<String, Any?>> {
      mapOf(
        "status" to "unavailable-in-release",
        "removedFileCount" to 0,
        "failure" to "The Balanced compatibility probe is not included in release builds.",
      )
    }
    AsyncFunction("clearPrototypeFilesAsync").SuspendBody<Map<String, Any?>> {
      mapOf(
        "status" to "unavailable-in-release",
        "removedFileCount" to 0,
        "failure" to "The Balanced capture prototype is not included in release builds.",
      )
    }
  }

  private fun unavailable(operation: String): Map<String, Any?> = mapOf(
    "schemaVersion" to 2,
    "kind" to "android-balanced-capture-prototype-release-stub",
    "status" to "unavailable-in-release",
    "operation" to operation,
    "reason" to "The Balanced capture prototype is not included in release builds.",
  )
}
