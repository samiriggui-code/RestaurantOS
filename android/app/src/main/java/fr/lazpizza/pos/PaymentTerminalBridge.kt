package fr.lazpizza.pos

import android.webkit.JavascriptInterface
import fr.lazpizza.pos.payment.TerminalOrchestrator

/**
 * Pont JS ↔ TPE (SUNMI Pay, Ingenico BT/USB).
 * Exposé : window.PaymentTerminal
 */
class PaymentTerminalBridge(activity: MainActivity) {

    private val orchestrator = TerminalOrchestrator(activity)

    @JavascriptInterface
    fun isAvailable(): Boolean = orchestrator.anyNativeAvailable()

    @JavascriptInterface
    fun getCapabilities(): String = orchestrator.capabilitiesJson()

    @JavascriptInterface
    fun startPayment(amountCents: Int, reference: String): String {
        return orchestrator.startPayment(amountCents, reference)
    }

    @JavascriptInterface
    fun cancelPayment(sessionId: String) {
        orchestrator.cancelPayment(sessionId)
    }

    @JavascriptInterface
    fun getPaymentStatus(sessionId: String): String {
        return orchestrator.getPaymentStatus(sessionId)
    }

    @JavascriptInterface
    fun simulateApproved(sessionId: String) {
        orchestrator.simulateApproved(sessionId)
    }
}
