import type { PrismaClient } from '@prisma/client'
import { BRAND } from '../emails/brand'
import { BRAND_LOGO_ON_PRIMARY_URI, resolveBrandLogoUrl } from '../emails/brand-logo'
import type { BusinessEmailContext } from '../emails/brand'
import { parseBusinessSettings } from './business-settings'
import { displayName } from './locale'
import { decodeStoredText } from './decode-stored-text'

/** Contexte marque + mentions légales pour emails et documents PDF. */
export async function businessDocumentContext(
  prisma: PrismaClient,
  businessId: string,
): Promise<BusinessEmailContext> {
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  const settings = parseBusinessSettings(business?.settings)
  const siteUrl = process.env.PUBLIC_SITE_URL ?? BRAND.siteUrl

  return {
    businessName: decodeStoredText(displayName(business) || undefined),
    legalName: settings.legalName,
    logoUrl: business?.logo?.trim()
      ? resolveBrandLogoUrl(business.logo, siteUrl)
      : BRAND_LOGO_ON_PRIMARY_URI,
    address: settings.address,
    phone: settings.phone,
    siret: settings.siret,
    siren: settings.siren,
    vatNumber: settings.vatNumber,
    nafCode: settings.nafCode,
    nafLabel: settings.nafLabel,
    legalForm: settings.legalForm,
    website: settings.website ?? siteUrl,
  }
}
