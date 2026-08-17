package fr.lazpizza.pos

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Télécharge une APK depuis le VPS et lance l'installateur Android (remplace l'ancienne version
 * si même certificat — pas de désinstallation manuelle).
 */
object ApkUpdateHelper {

    fun downloadAndInstall(activity: MainActivity, apkUrl: String): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.packageManager.canRequestPackageInstalls()) {
            activity.runOnUiThread {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${activity.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
            }
            return jsonResult(false, "Autorisez « Installer des apps inconnues » pour cette app, puis relancez la mise à jour.")
        }

        return try {
            val file = downloadApk(activity, apkUrl)
            activity.runOnUiThread { launchInstall(activity, file) }
            jsonResult(true, "Écran d'installation Android ouvert — confirmez « Installer ».")
        } catch (e: Exception) {
            jsonResult(false, e.message ?: "Échec téléchargement APK")
        }
    }

    private fun downloadApk(activity: MainActivity, apkUrl: String): File {
        val dir = File(activity.cacheDir, "apk_updates").apply { mkdirs() }
        val outFile = File(dir, "update.apk")
        if (outFile.exists()) outFile.delete()

        val conn = (URL(apkUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 120_000
            instanceFollowRedirects = true
            requestMethod = "GET"
        }

        conn.inputStream.use { input ->
            FileOutputStream(outFile).use { output ->
                val buffer = ByteArray(8192)
                var read: Int
                while (input.read(buffer).also { read = it } != -1) {
                    output.write(buffer, 0, read)
                }
            }
        }

        if (!outFile.exists() || outFile.length() < 1024) {
            throw IllegalStateException("APK téléchargée invalide ou vide")
        }
        return outFile
    }

    private fun launchInstall(activity: MainActivity, apkFile: File) {
        val uri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.fileprovider",
            apkFile,
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
    }

    private fun jsonResult(ok: Boolean, message: String): String {
        return org.json.JSONObject()
            .put("ok", ok)
            .put("message", message)
            .toString()
    }
}
