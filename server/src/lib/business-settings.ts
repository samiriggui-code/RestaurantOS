/** Structure JSON de Business.settings (Prisma). */

import { decodeStoredText } from './decode-stored-text'
import type { DevicesSettings } from './device-settings'

export type BusinessHours = {
  open: number
  close: number
  /** 7 = tous les jours ; sinon bitmask ou ignoré si absent */
  daysOpen?: number
}

export type MarketplaceIntegrationState = {
  enabled?: boolean
  lastWebhookAt?: string
  lastOrderAt?: string
  lastError?: string
  orderCount?: number
}

export type ExceptionalClosure = {
  /** YYYY-MM-DD */
  date: string
  reason?: string
}

export type BusinessSettingsJson = {
  address?: string
  phone?: string
  /** Raison sociale (RNE) */
  legalName?: string
  siren?: string
  /** SIRET affiché sur le reçu client (58 mm) */
  siret?: string
  /** N° TVA intracommunautaire (optionnel) */
  vatNumber?: string
  nafCode?: string
  nafLabel?: string
  legalForm?: string
  website?: string
  emailDomain?: string
  /** Email alertes stock / incidents (sinon ADMIN_NOTIFICATION_EMAIL ou admins) */
  adminNotificationEmail?: string
  hours?: BusinessHours
  exceptionalClosures?: ExceptionalClosure[]
  /** Capacité par créneau 15 min si aucun TimeSlot en BDD */
  slotCapacity?: number
  /** PIN accès espace livreur (4 chiffres recommandé) — prioritaire sur DRIVER_ACCESS_PIN env */
  driverAccessPin?: string
  /** Règles planning équipe (garde-fous IA) — persistées en settings */
  planning?: {
    maxDaysPerWeek?: number
    maxConsecutiveDays?: number
    minRestDaysPerWeek?: number
    kitchenStart?: string
    serviceStart?: string
    closeTime?: string
    /** Rôles que le MANAGER peut tenir en remplacement (ex. CHEF, CASHIER) */
    managerSubstituteRoles?: string[]
    /** Jours livreur maison requis (0=lun … 6=dim) — plateformes ont leurs livreurs */
    inHouseDriverDays?: number[]
    fullTimeDriverMaxDays?: number
    partTimeDriverMaxDays?: number
    platformDeliveryNote?: string
  }
  /** Jumelage devices, IP WAN, onboarding POS/KDS */
  devices?: DevicesSettings
  /** Marketplaces (webhooks Deliveroo / Uber Eats) */
  integrations?: {
    deliveroo?: MarketplaceIntegrationState
    ubereats?: MarketplaceIntegrationState
  }
  /** Mode formation : tickets TRAINING, exclus des clôtures Z */
  fiscalTrainingMode?: boolean
  /**
   * Première journée de vente réelle avec cette solution (YYYY-MM-DD Europe/Paris).
   * Les clôtures Z ne sont proposées qu’à partir de cette date (mise en service ISCA).
   */
  fiscalActivationDate?: string
}

export type OpenStatus = {
  isOpen: boolean
  label: string
  sublabel: string
  closedReason?: string
}

const DEFAULT_HOURS: BusinessHours = { open: 18, close: 22, daysOpen: 7 }

function decodeOptional(value?: string): string | undefined {
  return decodeStoredText(value)
}

export function parseBusinessSettings(raw: unknown): BusinessSettingsJson {
  if (!raw || typeof raw !== 'object') return {}
  const s = raw as BusinessSettingsJson
  return {
    ...s,
    address: decodeOptional(s.address),
    phone: decodeOptional(s.phone),
    siret: decodeOptional(s.siret),
    vatNumber: decodeOptional(s.vatNumber),
    adminNotificationEmail: decodeOptional(s.adminNotificationEmail),
    exceptionalClosures: s.exceptionalClosures?.map((c: ExceptionalClosure) => ({
      ...c,
      reason: decodeOptional(c.reason),
    })),
  }
}

export function getBusinessHours(settings: BusinessSettingsJson): BusinessHours {
  return settings.hours ?? DEFAULT_HOURS
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isExceptionallyClosed(settings: BusinessSettingsJson, now = new Date()): ExceptionalClosure | null {
  const key = dateKey(now)
  return settings.exceptionalClosures?.find((c) => c.date === key) ?? null
}

export function getOpenStatus(settings: BusinessSettingsJson, now = new Date()): OpenStatus {
  const closure = isExceptionallyClosed(settings, now)
  if (closure) {
    return {
      isOpen: false,
      label: 'Fermé exceptionnellement',
      sublabel: closure.reason ?? 'Réouverture prochainement',
      closedReason: closure.reason ?? 'Fermeture exceptionnelle',
    }
  }

  const hours = getBusinessHours(settings)
  const hour = now.getHours()
  const minute = now.getMinutes()
  const current = hour + minute / 60

  if (current >= hours.open && current < hours.close) {
    return {
      isOpen: true,
      label: 'Ouvert — commandez maintenant',
      sublabel: `Aujourd'hui jusqu'à ${hours.close}h00`,
    }
  }

  if (current < hours.open) {
    return {
      isOpen: false,
      label: 'Fermé',
      sublabel: `Réouverture à ${hours.open}h00`,
    }
  }

  return {
    isOpen: false,
    label: 'Fermé',
    sublabel: `Réouverture demain à ${hours.open}h00`,
  }
}
