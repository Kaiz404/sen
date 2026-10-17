package expo.modules.senauth

import android.app.Activity
import android.app.KeyguardManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CREDENTIAL_REQUEST = 4120

// The tag androidx.biometric gives the fragment that hosts a prompt.
private const val BIOMETRIC_FRAGMENT_TAG = "androidx.biometric.BiometricFragment"

// A prompt that has not shown by then is not going to, and the caller must hear that at once, not after its clock.
private const val SHOW_WATCHDOG_MS = 2_000L
private const val DETACH_POLL_MS = 50L
private const val DETACH_POLLS = 20

private fun success() = mapOf("success" to true)

// The codes are the ones expo-local-authentication uses, so JS reads both the same way.
private fun failure(error: String) = mapOf("success" to false, "error" to error)

private fun errorOf(code: Int): String =
  when (code) {
    BiometricPrompt.ERROR_CANCELED,
    BiometricPrompt.ERROR_USER_CANCELED,
    BiometricPrompt.ERROR_NEGATIVE_BUTTON -> "user_cancel"
    BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL -> "passcode_not_set"
    BiometricPrompt.ERROR_HW_UNAVAILABLE,
    BiometricPrompt.ERROR_HW_NOT_PRESENT -> "not_available"
    else -> "unknown"
  }

/**
 * Asks for the phone's screen lock (PIN, pattern or password) and nothing else, which expo-local-authentication
 * cannot do: its prompt always puts biometrics first, and on Android 9 and 10 the combination Sen would need
 * crashes the prompt builder.
 */
class SenAuthModule : Module() {
  // One check at a time. A result for any promise but this one is late and dropped.
  private var pending: Promise? = null
  private var prompt: BiometricPrompt? = null
  private val handler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("SenAuth")

    AsyncFunction("confirmDeviceCredentialAsync") { title: String, promise: Promise ->
      confirm(title, promise)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancelAsync") {
      val current = pending
      prompt?.cancelAuthentication()
      if (current != null) settle(current, failure("user_cancel"))
    }.runOnQueue(Queues.MAIN)

    // Android 9 and 10 answer through the system's confirm-credential screen, which returns here.
    OnActivityResult { _, (requestCode, resultCode, _) ->
      if (requestCode != CREDENTIAL_REQUEST) return@OnActivityResult
      val current = pending ?: return@OnActivityResult
      settle(current, if (resultCode == Activity.RESULT_OK) success() else failure("user_cancel"))
    }
  }

  private fun settle(promise: Promise, result: Map<String, Any>) {
    if (pending !== promise) return
    pending = null
    prompt = null
    promise.resolve(result)
  }

  private fun confirm(title: String, promise: Promise) {
    val activity = appContext.currentActivity as? FragmentActivity
    if (activity == null) {
      promise.resolve(failure("not_available"))
      return
    }
    if (pending != null) {
      promise.resolve(failure("app_cancel"))
      return
    }
    val keyguard = activity.getSystemService(KeyguardManager::class.java)
    if (keyguard == null || !keyguard.isDeviceSecure) {
      promise.resolve(failure("passcode_not_set"))
      return
    }
    pending = promise

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        // DEVICE_CREDENTIAL alone is supported from Android 11. A sensor prompt that handed over to this call may still
        // be detaching, and androidx will not show a replacement until it has. Android 9 and 10 take the activity
        // branch below instead, which has no BiometricFragment to wait for.
        showWhenClear(activity, title, promise, DETACH_POLLS)
      } else {
        val intent = keyguard.createConfirmDeviceCredentialIntent(title, null)
        if (intent == null) {
          settle(promise, failure("passcode_not_set"))
          return
        }
        activity.startActivityForResult(intent, CREDENTIAL_REQUEST)
      }
    } catch (e: Exception) {
      settle(promise, failure("unknown"))
    }
  }

  private fun showWhenClear(activity: FragmentActivity, title: String, promise: Promise, polls: Int) {
    if (pending !== promise) return
    val previous = activity.supportFragmentManager.findFragmentByTag(BIOMETRIC_FRAGMENT_TAG)
    if (previous != null && polls > 0) {
      handler.postDelayed({ showWhenClear(activity, title, promise, polls - 1) }, DETACH_POLL_MS)
      return
    }
    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        settle(promise, success())
      }

      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        settle(promise, failure(errorOf(errorCode)))
      }
    }
    try {
      val local = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback)
      prompt = local
      local.authenticate(
        BiometricPrompt.PromptInfo.Builder()
          .setTitle(title)
          .setAllowedAuthenticators(DEVICE_CREDENTIAL)
          .build()
      )
    } catch (e: Exception) {
      settle(promise, failure("unknown"))
      return
    }
    handler.postDelayed({
      if (pending === promise &&
        activity.supportFragmentManager.findFragmentByTag(BIOMETRIC_FRAGMENT_TAG) == null
      ) {
        settle(promise, failure("unknown"))
      }
    }, SHOW_WATCHDOG_MS)
  }
}
