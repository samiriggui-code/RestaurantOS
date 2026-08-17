import net from 'node:net'

const DEFAULT_PORT = 9100
const TIMEOUT_MS = 8_000

/** ESC/POS minimal : init + texte UTF-8 + coupe partielle */
export function textToEscPos(text: string, bold = false): Buffer {
  const chunks: Buffer[] = [Buffer.from([0x1b, 0x40])] // ESC @
  if (bold) chunks.push(Buffer.from([0x1b, 0x45, 0x01]))
  chunks.push(Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8'))
  if (bold) chunks.push(Buffer.from([0x1b, 0x45, 0x00]))
  chunks.push(Buffer.from('\n\n\n', 'utf8'))
  chunks.push(Buffer.from([0x1d, 0x56, 0x00])) // GS V — coupe
  return Buffer.concat(chunks)
}

export async function sendEscPosToLanPrinter(
  host: string,
  content: string,
  options?: { port?: number; bold?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = host.trim()
  if (!ip) return { ok: false, error: 'ip_vide' }
  const port = options?.port ?? DEFAULT_PORT
  const payload = textToEscPos(content, options?.bold ?? false)

  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (result: { ok: true } | { ok: false; error: string }) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(TIMEOUT_MS)
    socket.once('error', (err) => finish({ ok: false, error: err.message }))
    socket.once('timeout', () => finish({ ok: false, error: 'timeout' }))

    socket.connect(port, ip, () => {
      socket.write(payload, (err) => {
        if (err) {
          finish({ ok: false, error: err.message })
          return
        }
        socket.end(() => finish({ ok: true }))
      })
    })
  })
}
