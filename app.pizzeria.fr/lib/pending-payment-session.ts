const STORAGE_KEY = 'laz-pizza-pending-payment-v1'

/**
 * Survit à un remount de <CheckoutPayment> (fermeture/réouverture du panier, rechargement
 * de page, clic sur le bandeau « Reprendre ») pour le MÊME panier — sans ça, le composant
 * rappelle /payments/prepare et SumUp mint un second paiement pour la même commande alors
 * que le premier a peut-être déjà été capturé (risque de double débit).
 */
type PendingPaymentSession = {
  fingerprint: string
  draftId: string
  checkoutId: string
  savedAt: number
}

/** Le brouillon serveur expire à 2h (voir guest-checkout-draft.ts) — borne plus courte côté
 * client pour éviter de rejouer un paiement initié il y a longtemps sur un panier resté ouvert. */
const TTL_MS = 30 * 60 * 1000

export function savePendingPayment(session: Omit<PendingPaymentSession, 'savedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    const payload: PendingPaymentSession = { ...session, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / mode privé */
  }
}

export function loadPendingPayment(fingerprint: string): { draftId: string; checkoutId: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingPaymentSession
    if (parsed.fingerprint !== fingerprint) return null
    if (Date.now() - parsed.savedAt > TTL_MS) return null
    return { draftId: parsed.draftId, checkoutId: parsed.checkoutId }
  } catch {
    return null
  }
}

export function clearPendingPayment(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
