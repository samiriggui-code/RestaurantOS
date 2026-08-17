export type UISoundKind = 'success' | 'error' | 'warning' | 'alert'

function playTone(
  frequencies: number[],
  durationMs: number,
  volume = 0.1,
  gapMs = 0,
) {
  if (typeof window === 'undefined') return
  try {
    const ctx = new AudioContext()
    let t = ctx.currentTime

    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i]!
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const dur = durationMs / 1000
      gain.gain.setValueAtTime(volume, t)
      gain.gain.exponentialRampToValueAtTime(0.01, t + dur)
      osc.start(t)
      osc.stop(t + dur)
      t += dur + gapMs / 1000
    }

    void ctx.close()
  } catch {
    /* autoplay policy ou contexte indisponible */
  }
}

/** Retour court pour succès (double note ascendante). */
export function playSuccessSound() {
  playTone([523, 659], 120, 0.09, 40)
}

/** Bip grave pour erreur. */
export function playErrorSound() {
  playTone([220, 196], 180, 0.12, 30)
}

/** Avertissement avant action sensible. */
export function playWarningSound() {
  playTone([440], 200, 0.08)
}

/** Alerte temps réel (commandes CRM). */
export function playAlertSound() {
  playTone([880], 350, 0.12)
}

export function playUISound(kind: UISoundKind) {
  switch (kind) {
    case 'success':
      playSuccessSound()
      break
    case 'error':
      playErrorSound()
      break
    case 'warning':
      playWarningSound()
      break
    case 'alert':
      playAlertSound()
      break
  }
}
