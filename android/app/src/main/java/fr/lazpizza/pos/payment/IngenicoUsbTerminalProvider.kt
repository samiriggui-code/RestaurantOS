package fr.lazpizza.pos.payment

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.util.Log
import fr.lazpizza.pos.MainActivity
import java.util.concurrent.Executors

/**
 * Ingenico via USB OTG (série / câble).
 * Détecte un périphérique USB Ingenico ; envoi trame ECR.
 * Production : permissions USB intent + driver selon modèle (FTDI, CDC…).
 */
class IngenicoUsbTerminalProvider(private val activity: MainActivity) : TerminalProvider {
    override val id = "INGENICO_USB"
    override val label = "Ingenico USB"
    override val connection = "usb"

    private val executor = Executors.newSingleThreadExecutor()

    override fun isAvailable(): Boolean {
        return findIngenicoDevice() != null
    }

    override fun startPayment(session: TerminalSession, onUpdate: (TerminalSession) -> Unit) {
        session.providerId = id
        session.state = "connecting"
        session.message = "Connexion USB Ingenico…"
        onUpdate(session)

        executor.execute {
            try {
                val device = findIngenicoDevice()
                    ?: throw IllegalStateException("TPE Ingenico USB non détecté")
                val usbManager = activity.getSystemService(android.content.Context.USB_SERVICE) as UsbManager
                if (!usbManager.hasPermission(device)) {
                    session.state = "error"
                    session.message = "Autorisez l'accès USB au TPE Ingenico"
                    activity.runOnUiThread { onUpdate(session) }
                    return@execute
                }

                // TODO prod : ouvrir UsbDeviceConnection + bulkTransfer selon doc Ingenico
                val frame = IngenicoEcrProtocol.buildPaymentRequest(session.amountCents, session.reference)
                Log.i(TAG, "USB ECR frame ${frame.size} bytes → ${device.deviceName}")

                session.state = "awaiting_card"
                session.message = "Présentez la carte (USB Ingenico)"
                activity.runOnUiThread { onUpdate(session) }

                // Stub : en prod, lire la réponse USB réelle
                Thread.sleep(800)
                session.state = "error"
                session.message =
                    "Driver USB Ingenico à finaliser — utilisez le mode manuel ou SDK banque"
                activity.runOnUiThread { onUpdate(session) }
            } catch (e: Exception) {
                Log.e(TAG, "USB payment failed", e)
                session.state = "error"
                session.message = e.message ?: "Erreur USB Ingenico"
                activity.runOnUiThread { onUpdate(session) }
            }
        }
    }

    override fun cancelPayment(session: TerminalSession) {
        session.state = "cancelled"
        session.message = "Annulé (USB)"
    }

    override fun pollStatus(session: TerminalSession): TerminalSession = session

    private fun findIngenicoDevice(): UsbDevice? {
        val usbManager = activity.getSystemService(android.content.Context.USB_SERVICE) as UsbManager
        return usbManager.deviceList.values.firstOrNull { dev ->
            val name = dev.productName?.lowercase() ?: ""
            val mfg = dev.manufacturerName?.lowercase() ?: ""
            name.contains("ingenico") || mfg.contains("ingenico") ||
                name.contains("worldline") || mfg.contains("worldline")
        }
    }

    companion object {
        private const val TAG = "IngenicoUSB"
    }
}
