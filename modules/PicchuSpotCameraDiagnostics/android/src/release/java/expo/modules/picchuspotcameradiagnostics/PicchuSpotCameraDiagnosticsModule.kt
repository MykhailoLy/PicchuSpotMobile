package expo.modules.picchuspotcameradiagnostics

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Release-only registration stub. The Camera2 and Sensor implementations live
 * exclusively in src/debug and cannot be compiled or executed in this variant.
 */
class PicchuSpotCameraDiagnosticsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PicchuSpotCameraDiagnostics")

    AsyncFunction("getCameraDiagnosticsAsync").SuspendBody<Map<String, Any?>> {
      unavailable("getCameraDiagnosticsAsync")
    }
    AsyncFunction("runDiagnosticsAsync").SuspendBody<Map<String, Any?>> {
      unavailable("runDiagnosticsAsync")
    }
    AsyncFunction("runSensorDiagnosticsAsync").SuspendBody<Map<String, Any?>> {
      unavailable("runSensorDiagnosticsAsync")
    }
  }

  private fun unavailable(operation: String): Map<String, Any?> = mapOf(
    "schemaVersion" to 1,
    "kind" to "picchuspot-camera-diagnostics-release-stub",
    "status" to "diagnostics-unavailable-in-release",
    "operation" to operation,
    "reason" to "Camera2 and Sensor diagnostics are available in debug builds only.",
  )
}
