package expo.modules.picchuspotbalancedprototype

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/** Release-only inert native-view stub; it neither opens nor references Camera2. */
class BalancedCapturePreview(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  fun destroy() = Unit
}
