package fr.lazpizza.pos

import android.content.Context
import org.json.JSONObject

/** Pas d'imprimante SUNMI — KDS, tablette caisse, livreur. */
class SunmiPrintNoOpBackend : SunmiPrintBackend {

    override var connectionState: Int = SunmiPrintFacade.NO_PRINTER
        private set

    override fun bind(context: Context) {
        connectionState = SunmiPrintFacade.NO_PRINTER
    }

    override fun unbind(context: Context) {
        connectionState = SunmiPrintFacade.NO_PRINTER
    }

    override fun isReady(): Boolean = false

    override fun printText(text: String, bold: Boolean, receipt: Boolean): Boolean = false

    override fun statusJson(): String {
        return JSONObject()
            .put("ok", false)
            .put("device", "none")
            .put("connection", "none")
            .put("error", "no_sunmi_printer")
            .toString()
    }
}
