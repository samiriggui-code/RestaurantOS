package fr.lazpizza.pos.payment

import android.os.Handler
import android.os.Looper
import fr.lazpizza.pos.MainActivity
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Chaîne de providers : SUNMI Pay → Ingenico USB → Ingenico BT.
 * Si tous échouent, le POS bascule en mode manuel (côté JS).
 */
class TerminalOrchestrator(activity: MainActivity) {

    private val providers: List<TerminalProvider> = listOf(
        SunmiPayTerminalProvider(activity),
        IngenicoUsbTerminalProvider(activity),
        IngenicoBluetoothTerminalProvider(activity),
    )

    private val sessions = ConcurrentHashMap<String, TerminalSession>()
    private val handler = Handler(Looper.getMainLooper())

    fun capabilitiesJson(): String {
        val arr = org.json.JSONArray()
        for (p in providers) {
            arr.put(
                org.json.JSONObject()
                    .put("id", p.id)
                    .put("label", p.label)
                    .put("connection", p.connection)
                    .put("available", p.isAvailable())
            )
        }
        val active = providers.firstOrNull { it.isAvailable() }?.id ?: org.json.JSONObject.NULL
        return org.json.JSONObject()
            .put("providers", arr)
            .put("activeProvider", active)
            .put("fallbackManual", true)
            .toString()
    }

    fun anyNativeAvailable(): Boolean = providers.any { it.isAvailable() }

    fun startPayment(amountCents: Int, reference: String): String {
        val sessionId = UUID.randomUUID().toString()
        val session = TerminalSession(
            id = sessionId,
            state = "connecting",
            amountCents = amountCents,
            reference = reference,
        )
        sessions[sessionId] = session

        val provider = providers.firstOrNull { it.isAvailable() }
        if (provider == null) {
            session.state = "error"
            session.message = "Aucun TPE natif — mode manuel"
            return sessionId
        }

        session.providerId = provider.id
        provider.startPayment(session) { updated ->
            sessions[sessionId] = updated
        }
        return sessionId
    }

    fun cancelPayment(sessionId: String) {
        val session = sessions[sessionId] ?: return
        providers.firstOrNull { it.id == session.providerId }?.cancelPayment(session)
        session.state = "cancelled"
        session.message = "Annulé depuis la caisse"
    }

    fun getPaymentStatus(sessionId: String): String {
        val session = sessions[sessionId]
        if (session == null) {
            return org.json.JSONObject()
                .put("state", "error")
                .put("message", "Session inconnue")
                .toString()
        }
        val provider = providers.firstOrNull { it.id == session.providerId }
        val current = provider?.pollStatus(session) ?: session
        sessions[sessionId] = current
        return org.json.JSONObject()
            .put("state", current.state)
            .put("message", current.message)
            .put("transactionId", current.transactionId ?: org.json.JSONObject.NULL)
            .put("cardBrand", current.cardBrand ?: org.json.JSONObject.NULL)
            .put("provider", current.providerId)
            .toString()
    }

    /** Dev / simulateur sans TPE physique */
    fun simulateApproved(sessionId: String) {
        sessions[sessionId]?.apply {
            state = "approved"
            message = "Paiement accepté (simulation)"
            transactionId = "SIM-${System.currentTimeMillis()}"
        }
    }
}
