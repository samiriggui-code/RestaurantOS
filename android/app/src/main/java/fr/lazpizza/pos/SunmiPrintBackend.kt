package fr.lazpizza.pos

import android.content.Context

/** Contrat impression SUNMI — impl no-op (main) ou SDK (flavor posSunmi). */
interface SunmiPrintBackend {
    val connectionState: Int
    fun bind(context: Context)
    fun unbind(context: Context)
    fun isReady(): Boolean
    fun printText(text: String, bold: Boolean, receipt: Boolean): Boolean
    fun statusJson(): String
}
