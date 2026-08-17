package fr.lazpizza.pos

import android.os.Build
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Infos appareil + orientation pour POS/KDS (phase 0 WebView go/no-go).
 * Exposé : window.LaZPizzaDevice
 */
class DeviceBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun getDeviceInfo(): String {
        return JSONObject()
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("appVersionCode", BuildConfig.VERSION_CODE)
            .put("appKind", BuildConfig.APP_KIND)
            .put("androidSdk", Build.VERSION.SDK_INT)
            .put("androidRelease", Build.VERSION.RELEASE)
            .put("model", Build.MODEL)
            .put("manufacturer", Build.MANUFACTURER)
            .put("screenOrientation", BuildConfig.SCREEN_ORIENTATION)
            .toString()
    }

    /** Télécharge l'APK depuis le VPS et ouvre l'installateur (remplace sans désinstaller). */
    @JavascriptInterface
    fun downloadAndInstallApk(apkUrl: String): String {
        return ApkUpdateHelper.downloadAndInstall(activity, apkUrl)
    }

    @JavascriptInterface
    fun lockLandscape() {
        activity.runOnUiThread { activity.lockLandscape() }
    }

    @JavascriptInterface
    fun lockPortrait() {
        activity.runOnUiThread { activity.lockPortrait() }
    }

    @JavascriptInterface
    fun getScreenOrientation(): String = activity.currentOrientationLabel()

    @JavascriptInterface
    fun getDefaultOrientation(): String = BuildConfig.SCREEN_ORIENTATION
}
