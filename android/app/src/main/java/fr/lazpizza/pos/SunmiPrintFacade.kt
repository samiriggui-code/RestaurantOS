package fr.lazpizza.pos

import android.content.Context
import android.util.Log

/**
 * Point d'entrée unique impression SUNMI.
 * Le flavor posSunmi charge SunmiPrintSdkBackend via réflexion.
 */
object SunmiPrintFacade {

    private const val TAG = "SunmiPrintFacade"
    private const val SDK_BACKEND = "fr.lazpizza.pos.SunmiPrintSdkBackend"

    const val NO_PRINTER = 0
    const val CHECKING = 1
    const val FOUND = 2
    const val LOST = 3

    private val backend: SunmiPrintBackend by lazy { createBackend() }

    val connectionState: Int get() = backend.connectionState

    fun bind(context: Context) = backend.bind(context)

    fun unbind(context: Context) = backend.unbind(context)

    fun isReady(): Boolean = backend.isReady()

    fun printText(text: String, bold: Boolean, receipt: Boolean = false): Boolean =
        backend.printText(text, bold, receipt)

    fun statusJson(): String = backend.statusJson()

    private fun createBackend(): SunmiPrintBackend {
        if (!BuildConfig.HAS_SUNMI_PRINTER) {
            return SunmiPrintNoOpBackend()
        }
        return try {
            Class.forName(SDK_BACKEND)
                .getDeclaredConstructor()
                .newInstance() as SunmiPrintBackend
        } catch (e: Exception) {
            Log.e(TAG, "SDK SUNMI indisponible, fallback no-op", e)
            SunmiPrintNoOpBackend()
        }
    }
}
