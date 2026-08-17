package fr.lazpizza.pos

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.RemoteException
import android.util.Log
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterException
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService
import com.sunmi.peripheral.printer.WoyouConsts
import org.json.JSONObject
import java.util.concurrent.ConcurrentLinkedQueue

private data class PendingPrint(val text: String, val bold: Boolean, val receipt: Boolean)

/** Impression SUNMI V2 — compilé uniquement dans le flavor posSunmi. */
class SunmiPrintSdkBackend : SunmiPrintBackend {

    private val tag = "SunmiPrintSdk"
    private val mainHandler = Handler(Looper.getMainLooper())
    private val pendingPrints = ConcurrentLinkedQueue<PendingPrint>()

    override var connectionState: Int = SunmiPrintFacade.CHECKING
        private set

    private var appContext: Context? = null
    private var printerService: SunmiPrinterService? = null

    private val printerCallback = object : InnerPrinterCallback() {
        override fun onConnected(service: SunmiPrinterService) {
            printerService = service
            connectionState = if (hasBuiltInPrinter(service)) SunmiPrintFacade.FOUND else SunmiPrintFacade.NO_PRINTER
            Log.i(tag, "Imprimante connectée (état=$connectionState)")
            flushPendingPrints()
        }

        override fun onDisconnected() {
            printerService = null
            connectionState = SunmiPrintFacade.LOST
        }
    }

    override fun bind(context: Context) {
        appContext = context.applicationContext
        connectionState = SunmiPrintFacade.CHECKING
        try {
            val bound = InnerPrinterManager.getInstance().bindService(context, printerCallback)
            if (!bound) connectionState = SunmiPrintFacade.NO_PRINTER
        } catch (e: Exception) {
            connectionState = SunmiPrintFacade.NO_PRINTER
            Log.e(tag, "bind", e)
        }
    }

    override fun unbind(context: Context) {
        try {
            if (printerService != null) {
                InnerPrinterManager.getInstance().unBindService(context, printerCallback)
            }
        } catch (e: InnerPrinterException) {
            Log.w(tag, "unbind", e)
        } finally {
            printerService = null
            connectionState = SunmiPrintFacade.LOST
            appContext = null
            pendingPrints.clear()
        }
    }

    override fun isReady(): Boolean =
        printerService != null && connectionState == SunmiPrintFacade.FOUND

    override fun printText(text: String, bold: Boolean, receipt: Boolean): Boolean {
        if (!isReady()) {
            pendingPrints.offer(PendingPrint(text, bold, receipt))
            appContext?.let { bind(it) }
            mainHandler.postDelayed({ flushPendingPrints() }, 800)
            return true
        }
        return doPrint(text, bold, receipt)
    }

    private fun flushPendingPrints() {
        if (!isReady()) return
        while (true) {
            val job = pendingPrints.poll() ?: break
            if (!doPrint(job.text, job.bold, job.receipt)) break
        }
    }

    private fun doPrint(text: String, bold: Boolean, receipt: Boolean): Boolean {
        val svc = printerService ?: return false
        return try {
            svc.printerInit(null)
            svc.setAlignment(1, null)
            setBold(svc, bold)
            val fontSize = if (receipt) 22f else if (bold) 28f else 24f
            for (line in text.replace("\r\n", "\n").split('\n')) {
                svc.printTextWithFont(line + "\n", null, fontSize, null)
            }
            svc.lineWrap(3, null)
            try {
                svc.autoOutPaper(null)
            } catch (_: RemoteException) {
                svc.lineWrap(3, null)
            }
            true
        } catch (e: Exception) {
            connectionState = SunmiPrintFacade.LOST
            Log.e(tag, "print", e)
            false
        }
    }

    override fun statusJson(): String {
        val service = printerService
        val root = JSONObject()
        root.put("device", "sunmi")
        root.put("connection", connectionLabel(connectionState))
        root.put("queued", pendingPrints.size)
        if (service == null) {
            return root.put("ok", false).put("error", "service_disconnected").toString()
        }
        root.put("ok", connectionState == SunmiPrintFacade.FOUND)
        try {
            root.put("paper", if (service.printerPaper == 1) "58mm" else "80mm")
            root.put("model", service.printerModal ?: "")
            root.put("version", service.printerVersion ?: "")
            val stateCode = service.updatePrinterState()
            root.put("stateCode", stateCode)
            root.put("state", printerStateLabel(stateCode))
            if (stateCode == 4 || stateCode == 6) root.put("ok", false)
        } catch (_: RemoteException) {
            root.put("ok", false).put("error", "status_unavailable")
        }
        return root.toString()
    }

    private fun hasBuiltInPrinter(service: SunmiPrinterService): Boolean {
        return try {
            InnerPrinterManager.getInstance().hasPrinter(service)
        } catch (_: InnerPrinterException) {
            false
        }
    }

    private fun setBold(service: SunmiPrinterService, bold: Boolean) {
        try {
            service.setPrinterStyle(
                WoyouConsts.ENABLE_BOLD,
                if (bold) WoyouConsts.ENABLE else WoyouConsts.DISABLE,
            )
        } catch (_: RemoteException) {
            // ignore
        }
    }

    private fun connectionLabel(state: Int): String = when (state) {
        SunmiPrintFacade.FOUND -> "found"
        SunmiPrintFacade.LOST -> "lost"
        SunmiPrintFacade.NO_PRINTER -> "none"
        else -> "checking"
    }

    private fun printerStateLabel(code: Int): String = when (code) {
        1 -> "running"
        2 -> "initializing"
        4 -> "out_of_paper"
        6 -> "cover_open"
        505 -> "not_found"
        else -> "unknown"
    }
}
