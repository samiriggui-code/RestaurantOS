package fr.lazpizza.pos.payment

import android.os.Build
import android.util.Log
import fr.lazpizza.pos.MainActivity

/**
 * SUNMI Pay — paiement intégré terminal V2.
 * Production : ajouter `implementation("com.sunmi:paylib:…")` (doc Sunmi Open Platform)
 */
class SunmiPayTerminalProvider(private val activity: MainActivity) : TerminalProvider {
    override val id = "SUNMI_PAY"
    override val label = "SUNMI Pay (intégré)"
    override val connection = "integrated"

    override fun isAvailable(): Boolean {
        val m = Build.MANUFACTURER?.lowercase() ?: return false
        if (!m.contains("sunmi")) return false
        return runCatching { Class.forName("com.sunmi.paylib.SunmiPayKernel") }.isSuccess
    }

    override fun startPayment(session: TerminalSession, onUpdate: (TerminalSession) -> Unit) {
        session.providerId = id
        session.state = "connecting"
        session.message = "Initialisation SUNMI Pay…"
        onUpdate(session)

        try {
            val kernelClass = runCatching { Class.forName("com.sunmi.paylib.SunmiPayKernel") }.getOrNull()
            if (kernelClass == null) {
                session.state = "error"
                session.message = "SDK SUNMI Pay absent — mode manuel ou ajoutez paylib"
                onUpdate(session)
                return
            }
            // TODO prod : SunmiPayKernel.getInstance().initPaySDK(...) puis transact
            session.state = "awaiting_card"
            session.message = "Présentez la carte (SUNMI Pay)"
            onUpdate(session)
            Log.i(TAG, "SUNMI Pay start ${session.amountCents}c ref=${session.reference}")
        } catch (e: Exception) {
            Log.e(TAG, "SUNMI Pay error", e)
            session.state = "error"
            session.message = e.message ?: "Erreur SUNMI Pay"
            onUpdate(session)
        }
    }

    override fun cancelPayment(session: TerminalSession) {
        session.state = "cancelled"
        session.message = "Annulé (SUNMI Pay)"
    }

    override fun pollStatus(session: TerminalSession): TerminalSession = session

    companion object {
        private const val TAG = "SunmiPayProvider"
    }
}
