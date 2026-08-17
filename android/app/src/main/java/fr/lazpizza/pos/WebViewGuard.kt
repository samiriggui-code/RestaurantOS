package fr.lazpizza.pos

import android.content.Context
import android.content.Intent
import android.net.Uri

/** Phase 0 — Next.js POS requiert Chrome/WebView ≥ 64. */
object WebViewGuard {
    const val MIN_CHROME_MAJOR = 64

    private val WEBVIEW_PACKAGES = listOf(
        "com.google.android.webview",
        "com.android.webview",
    )

    fun chromeMajorVersion(context: Context): Int? {
        for (pkg in WEBVIEW_PACKAGES) {
            try {
                val versionName = context.packageManager.getPackageInfo(pkg, 0).versionName ?: continue
                val major = versionName.substringBefore('.').toIntOrNull()
                if (major != null) return major
            } catch (_: Exception) {
                /* package absent */
            }
        }
        return null
    }

    fun isCompatible(context: Context): Boolean {
        val major = chromeMajorVersion(context) ?: return false
        return major >= MIN_CHROME_MAJOR
    }

    fun blockedHtml(context: Context): String {
        val major = chromeMajorVersion(context)
        val versionLabel = major?.toString() ?: "inconnue"
        return """
            <html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="background:#1A1412;color:#e8e4dc;font-family:sans-serif;padding:24px;line-height:1.5">
            <h2 style="color:#f87171">Mise à jour WebView requise</h2>
            <p>Chrome/WebView détecté : <b>$versionLabel</b> — minimum <b>$MIN_CHROME_MAJOR</b> pour la caisse.</p>
            <p>Ouvrez le <b>Play Store</b> et mettez à jour :</p>
            <ul>
              <li><b>Android System WebView</b></li>
              <li><b>Google Chrome</b></li>
            </ul>
            <p>Puis redémarrez le SUNMI et relancez La Z Pizza.</p>
            <p style="color:#888;font-size:12px">APK v${BuildConfig.VERSION_NAME} · ${BuildConfig.APP_URL}</p>
            </body></html>
        """.trimIndent()
    }

    fun openWebViewUpdate(context: Context) {
        val intents = listOf(
            "market://details?id=com.google.android.webview",
            "market://details?id=com.android.chrome",
        )
        for (uri in intents) {
            try {
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
                return
            } catch (_: Exception) {
                /* ignore */
            }
        }
    }
}
