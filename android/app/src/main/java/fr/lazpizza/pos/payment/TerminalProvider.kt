package fr.lazpizza.pos.payment

/** États alignés sur lib/payment/payment-terminal.ts (Next.js). */
data class TerminalSession(
    val id: String,
    var state: String,
    var message: String = "",
    var transactionId: String? = null,
    var cardBrand: String? = null,
    var amountCents: Int = 0,
    var providerId: String = "MANUAL",
    var reference: String = "",
)

interface TerminalProvider {
    val id: String
    val label: String
    /** Connexion : integrated | bluetooth | usb */
    val connection: String

    fun isAvailable(): Boolean

    /** Lance le paiement ; met à jour la session (async sur main thread via callbacks). */
    fun startPayment(session: TerminalSession, onUpdate: (TerminalSession) -> Unit)

    fun cancelPayment(session: TerminalSession)

    fun pollStatus(session: TerminalSession): TerminalSession
}
