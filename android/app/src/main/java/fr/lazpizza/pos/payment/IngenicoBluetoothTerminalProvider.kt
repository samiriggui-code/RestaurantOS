package fr.lazpizza.pos.payment

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
import fr.lazpizza.pos.MainActivity
import java.io.IOException
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Ingenico / Worldline via Bluetooth SPP (câble virtuel série).
 * Appairer le TPE dans les réglages Android ; optionnel : TERMINAL_BT_ADDRESS dans BuildConfig.
 */
class IngenicoBluetoothTerminalProvider(private val activity: MainActivity) : TerminalProvider {
    override val id = "INGENICO_BT"
    override val label = "Ingenico Bluetooth"
    override val connection = "bluetooth"

    private val executor = Executors.newSingleThreadExecutor()
    private var socket: BluetoothSocket? = null
    private var activeSession: TerminalSession? = null

    @SuppressLint("MissingPermission")
    override fun isAvailable(): Boolean {
        val adapter = bluetoothAdapter() ?: return false
        if (!adapter.isEnabled) return false
        return findPairedTerminal() != null
    }

    @SuppressLint("MissingPermission")
    override fun startPayment(session: TerminalSession, onUpdate: (TerminalSession) -> Unit) {
        session.providerId = id
        session.state = "connecting"
        session.message = "Connexion Bluetooth Ingenico…"
        onUpdate(session)
        activeSession = session

        executor.execute {
            try {
                val device = findPairedTerminal()
                    ?: throw IOException("Aucun TPE Ingenico appairé (Bluetooth)")
                val spp = device.createRfcommSocketToServiceRecord(SPP_UUID)
                socket?.close()
                socket = spp
                spp.connect()

                val frame = IngenicoEcrProtocol.buildPaymentRequest(session.amountCents, session.reference)
                spp.outputStream.write(frame)
                spp.outputStream.flush()

                session.state = "awaiting_card"
                session.message = "Présentez la carte sur le TPE Ingenico"
                activity.runOnUiThread { onUpdate(session) }

                val buffer = ByteArray(512)
                val read = spp.inputStream.read(buffer)
                if (read > 0) {
                    val resp = IngenicoEcrProtocol.parseResponse(buffer.copyOf(read))
                    applyEcrResponse(session, resp)
                    activity.runOnUiThread { onUpdate(session) }
                }
            } catch (e: Exception) {
                Log.e(TAG, "BT payment failed", e)
                session.state = "error"
                session.message = e.message ?: "Erreur Bluetooth Ingenico"
                activity.runOnUiThread { onUpdate(session) }
            }
        }
    }

    override fun cancelPayment(session: TerminalSession) {
        try {
            socket?.close()
        } catch (_: Exception) {
        }
        session.state = "cancelled"
        session.message = "Annulé (Bluetooth)"
    }

    override fun pollStatus(session: TerminalSession): TerminalSession {
        return activeSession ?: session
    }

    private fun applyEcrResponse(session: TerminalSession, resp: IngenicoEcrProtocol.EcrResponse?) {
        if (resp == null) {
            session.state = "processing"
            session.message = "En attente du TPE…"
            return
        }
        if (resp.approved) {
            session.state = "approved"
            session.message = resp.message
            session.transactionId = resp.transactionId ?: "ECR-${System.currentTimeMillis()}"
        } else {
            session.state = if (resp.message.contains("DECLINED", true)) "declined" else "error"
            session.message = resp.message
        }
    }

    @SuppressLint("MissingPermission")
    private fun findPairedTerminal(): BluetoothDevice? {
        val adapter = bluetoothAdapter() ?: return null
        val configured = runCatching {
            val field = fr.lazpizza.pos.BuildConfig::class.java.getField("TERMINAL_BT_ADDRESS")
            field.get(null) as? String
        }.getOrNull()?.takeIf { it.isNotBlank() }

        if (configured != null) {
            adapter.getRemoteDevice(configured)?.let { return it }
        }

        return adapter.bondedDevices?.firstOrNull { device ->
            val name = device.name?.lowercase() ?: ""
            name.contains("ingenico") || name.contains("move") || name.contains("desk") ||
                name.contains("worldline") || name.contains("lane")
        }
    }

    private fun bluetoothAdapter(): BluetoothAdapter? {
        val mgr = activity.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return mgr?.adapter ?: BluetoothAdapter.getDefaultAdapter()
    }

    companion object {
        private const val TAG = "IngenicoBT"
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }
}
