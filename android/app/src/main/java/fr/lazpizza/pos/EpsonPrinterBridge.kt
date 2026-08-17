package fr.lazpizza.pos

import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.charset.Charset
import java.util.concurrent.Executors

/**
 * Pont JS ↔ imprimante Epson réseau (RAW TCP port 9100).
 * Exposé à la WebView : window.EpsonPrinter
 */
class EpsonPrinterBridge {

    private val executor = Executors.newSingleThreadExecutor()

    @JavascriptInterface
    fun isAvailable(): String = "{\"ok\":true}"

    @JavascriptInterface
    fun printToLan(ip: String, content: String, bold: String): String {
        return try {
            val result: Boolean = executor.submit<Boolean> {
                printRaw(ip.trim(), content, bold == "1")
            }.get()
            JSONObject().apply {
                put("ok", result)
                if (!result) put("error", "socket_failed")
            }.toString()
        } catch (e: Exception) {
            Log.w(TAG, "printToLan", e)
            JSONObject().apply {
                put("ok", false)
                put("error", e.message ?: "unknown")
            }.toString()
        }
    }

    private fun printRaw(ip: String, text: String, bold: Boolean): Boolean {
        if (ip.isEmpty()) return false
        val payload = buildEscPos(text, bold)
        return try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(ip, PORT), TIMEOUT_MS)
                socket.soTimeout = TIMEOUT_MS
                val out: OutputStream = socket.getOutputStream()
                out.write(payload)
                out.flush()
                true
            }
        } catch (e: Exception) {
            Log.w(TAG, "printRaw $ip", e)
            false
        }
    }

    private fun buildEscPos(text: String, bold: Boolean): ByteArray {
        val charset = Charset.forName("UTF-8")
        val chunks = mutableListOf<ByteArray>()
        chunks.add(byteArrayOf(0x1b, 0x40))
        if (bold) chunks.add(byteArrayOf(0x1b, 0x45, 0x01))
        chunks.add(text.replace("\r\n", "\n").toByteArray(charset))
        if (bold) chunks.add(byteArrayOf(0x1b, 0x45, 0x00))
        chunks.add("\n\n\n".toByteArray(charset))
        chunks.add(byteArrayOf(0x1d, 0x56, 0x00))
        var total = 0
        chunks.forEach { total += it.size }
        val out = ByteArray(total)
        var offset = 0
        for (chunk in chunks) {
            System.arraycopy(chunk, 0, out, offset, chunk.size)
            offset += chunk.size
        }
        return out
    }

    companion object {
        private const val TAG = "EpsonPrinterBridge"
        private const val PORT = 9100
        private const val TIMEOUT_MS = 8000
    }
}
