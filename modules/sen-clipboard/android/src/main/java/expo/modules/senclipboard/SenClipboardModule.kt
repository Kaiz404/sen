package expo.modules.senclipboard

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The constant arrived in Android 13. Android's guide uses the same key as a string below that.
private const val IS_SENSITIVE_BEFORE_13 = "android.content.extra.IS_SENSITIVE"

class SenClipboardModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SenClipboard")

    AsyncFunction("setSensitiveStringAsync") { text: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clip = ClipData.newPlainText(null, text)
      val key =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) ClipDescription.EXTRA_IS_SENSITIVE
        else IS_SENSITIVE_BEFORE_13
      clip.description.extras = PersistableBundle().apply { putBoolean(key, true) }
      clipboard.setPrimaryClip(clip)
    }
  }
}
