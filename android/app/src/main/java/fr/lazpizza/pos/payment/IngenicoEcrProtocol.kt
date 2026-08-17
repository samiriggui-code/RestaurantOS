package fr.lazpizza.pos.payment

/**
 * Protocole ECR simplifié Ingenico / Worldline (montant → terminal).
 * Production : remplacer sendFrame par le SDK Worldline ou la lib fournie par la banque.
 */
object IngenicoEcrProtocol {
    /** Trame texte type « montant en centimes + référence » — adapter selon doc acquéreur. */
    fun buildPaymentRequest(amountCents: Int, reference: String): ByteArray {
        val payload = "PAY;${amountCents};${reference.take(24)}\r\n"
        return payload.toByteArray(Charsets.US_ASCII)
    }

    fun parseResponse(raw: ByteArray): EcrResponse? {
        val text = raw.toString(Charsets.US_ASCII).trim()
        if (text.isEmpty()) return null
        return when {
            text.contains("APPROVED", ignoreCase = true) || text.startsWith("OK") ->
                EcrResponse(true, text.substringAfter(";", "APPROVED"), extractTxnId(text))
            text.contains("DECLINED", ignoreCase = true) ->
                EcrResponse(false, "DECLINED", null)
            else -> EcrResponse(false, text, null)
        }
    }

    private fun extractTxnId(text: String): String? {
        val parts = text.split(";")
        return if (parts.size >= 3) parts[2].trim() else null
    }

    data class EcrResponse(val approved: Boolean, val message: String, val transactionId: String?)
}
