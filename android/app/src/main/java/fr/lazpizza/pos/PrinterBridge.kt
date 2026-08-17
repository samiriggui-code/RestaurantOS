package fr.lazpizza.pos

import android.media.AudioManager
import android.media.ToneGenerator
import android.util.Log
import android.webkit.JavascriptInterface

/**
 * Pont JS ↔ imprimante thermique SUNMI V2 (58 mm).
 * Exposé à la WebView POS : window.SunmiPrinter
 */
class PrinterBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun printKitchenTicket(content: String) {
        activity.runOnUiThread { printText(content, bold = true, receipt = false) }
    }

    @JavascriptInterface
    fun printReceipt(content: String) {
        activity.runOnUiThread { printText(content, bold = false, receipt = true) }
    }

    @JavascriptInterface
    fun getPrinterStatus(): String {
        return try {
            if (SunmiPrintFacade.isReady()) {
                SunmiPrintFacade.statusJson()
            } else {
                val legacy = legacyHelperStatus()
                legacy ?: SunmiPrintFacade.statusJson()
            }
        } catch (e: Exception) {
            "{\"ok\":false,\"device\":\"sunmi\",\"error\":\"${e.message?.replace("\"", "'")}\"}"
        }
    }

    @JavascriptInterface
    fun playNewOrderSound() {
        activity.runOnUiThread {
            try {
                ToneGenerator(AudioManager.STREAM_ALARM, 100)
                    .startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 800)
            } catch (e: Exception) {
                Log.w(TAG, "playNewOrderSound", e)
            }
        }
    }

    private fun printText(text: String, bold: Boolean, receipt: Boolean) {
        if (SunmiPrintFacade.printText(text, bold, receipt)) return
        if (printViaLegacyHelper(text, bold)) return

        Log.w(TAG, "Aucune imprimante SUNMI — contenu:\n$text")
        activity.showToast("Imprimante SUNMI indisponible")
    }

    /** SDK officiel via SunmiPrintHelper préinstallé sur certains firmwares */
    private fun printViaLegacyHelper(text: String, bold: Boolean): Boolean {
        return try {
            val cls = Class.forName("com.sunmi.printerhelper.utils.SunmiPrintHelper")
            val helper = cls.getMethod("getInstance").invoke(null)
            cls.getMethod("initSunmiPrinterService", android.content.Context::class.java)
                .invoke(helper, activity.applicationContext)
            val payload = if (bold) "\u001B\u0045\u0001$text\u001B\u0045\u0000\n\n\n" else "$text\n\n\n"
            cls.getMethod("printText", String::class.java, String::class.java)
                .invoke(helper, payload, null)
            cls.getMethod("feedPaper").invoke(helper)
            true
        } catch (e: Exception) {
            Log.d(TAG, "SunmiPrintHelper legacy: ${e.message}")
            false
        }
    }

    private fun legacyHelperStatus(): String? {
        return try {
            Class.forName("com.sunmi.printerhelper.utils.SunmiPrintHelper")
                .getMethod("getInstance")
                .invoke(null)
            "{\"ok\":true,\"device\":\"sunmi\",\"connection\":\"legacy_helper\"}"
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        private const val TAG = "PrinterBridge"
    }
}
