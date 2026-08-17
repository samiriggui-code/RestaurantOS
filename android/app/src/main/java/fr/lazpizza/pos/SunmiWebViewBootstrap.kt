package fr.lazpizza.pos

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.norman.webviewup.lib.UpgradeCallback
import com.norman.webviewup.lib.WebViewUpgrade
import com.norman.webviewup.lib.source.UpgradeFileSource
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream

/**
 * Télécharge et active un WebView Chromium récent pour l'APK SUNMI uniquement
 * (Android 7.1 livré avec Chrome 62 — Next.js requiert ≥ 64).
 *
 * Ne modifie pas le WebView système ; s'applique seulement à cette application.
 */
object SunmiWebViewBootstrap {
    private const val TAG = "SunmiWebViewBootstrap"
    private const val WEBVIEW_ZIP_URL =
        "https://raw.githubusercontent.com/JonaNorman/ShareFile/main/com.google.android.webview_122.0.6261.64_armeabi-v7a.zip"

    private val mainHandler = Handler(Looper.getMainLooper())

    fun needsBootstrap(context: Context): Boolean {
        if (!BuildConfig.HAS_SUNMI_PRINTER) return false
        return !WebViewGuard.isCompatible(context)
    }

    fun ensureUpgraded(
        context: Context,
        onProgress: (Int) -> Unit,
        onReady: () -> Unit,
        onError: (String) -> Unit,
    ) {
        if (!needsBootstrap(context)) {
            onReady()
            return
        }

        val appContext = context.applicationContext
        val apkFile = webViewApkFile(appContext)

        Thread {
            try {
                if (!apkFile.exists()) {
                    mainHandler.post { onProgress(1) }
                    downloadAndExtract(appContext, apkFile) { pct ->
                        mainHandler.post { onProgress(pct.coerceIn(1, 90)) }
                    }
                }
                mainHandler.post {
                    runUpgrade(appContext, apkFile, onProgress, onReady, onError)
                }
            } catch (e: Exception) {
                Log.e(TAG, "WebView bootstrap failed", e)
                mainHandler.post { onError(e.message ?: "Échec mise à jour WebView") }
            }
        }.start()
    }

    private fun webViewApkFile(context: Context): File {
        return File(context.filesDir, "webview/com.google.android.webview.apk").apply {
            parentFile?.mkdirs()
        }
    }

    private fun runUpgrade(
        context: Context,
        apkFile: File,
        onProgress: (Int) -> Unit,
        onReady: () -> Unit,
        onError: (String) -> Unit,
    ) {
        if (!apkFile.exists()) {
            onError("Fichier WebView introuvable après téléchargement")
            return
        }

        val source = UpgradeFileSource(context, apkFile)
        WebViewUpgrade.addUpgradeCallback(object : UpgradeCallback {
            override fun onUpgradeProcess(percent: Float) {
                onProgress((90 + percent * 10).toInt().coerceIn(90, 100))
            }

            override fun onUpgradeComplete() {
                Log.i(TAG, "WebView upgrade complete — kernel ${WebViewUpgrade.getUpgradeWebViewVersion()}")
                onProgress(100)
                onReady()
            }

            override fun onUpgradeError(throwable: Throwable) {
                Log.e(TAG, "WebView upgrade error", throwable)
                onError(throwable.message ?: "Échec installation WebView")
            }
        })

        Log.i(TAG, "Installing bundled WebView from ${apkFile.absolutePath}")
        onProgress(91)
        WebViewUpgrade.upgrade(source)
    }

    private fun downloadAndExtract(context: Context, apkFile: File, onDownloadProgress: (Int) -> Unit) {
        val zipFile = File(context.cacheDir, "webview_upgrade.zip")
        downloadFile(WEBVIEW_ZIP_URL, zipFile, onDownloadProgress)
        extractWebViewApk(zipFile, apkFile)
        zipFile.delete()
    }

    private fun downloadFile(url: String, dest: File, onProgress: (Int) -> Unit) {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 120_000
            instanceFollowRedirects = true
        }
        try {
            connection.connect()
            if (connection.responseCode !in 200..299) {
                throw IllegalStateException("HTTP ${connection.responseCode}")
            }
            val total = connection.contentLengthLong.takeIf { it > 0 } ?: -1L
            connection.inputStream.use { input ->
                FileOutputStream(dest).use { output ->
                    val buffer = ByteArray(8192)
                    var downloaded = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read <= 0) break
                        output.write(buffer, 0, read)
                        downloaded += read
                        if (total > 0) {
                            onProgress((downloaded * 85 / total).toInt())
                        }
                    }
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun extractWebViewApk(zipFile: File, apkFile: File) {
        ZipInputStream(zipFile.inputStream()).use { zip ->
            var entry: ZipEntry? = zip.nextEntry
            while (entry != null) {
                if (!entry.isDirectory && entry.name.endsWith(".apk", ignoreCase = true)) {
                    FileOutputStream(apkFile).use { out ->
                        zip.copyTo(out)
                    }
                    return
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }
        throw IllegalStateException("Aucun APK WebView dans l'archive")
    }
}
