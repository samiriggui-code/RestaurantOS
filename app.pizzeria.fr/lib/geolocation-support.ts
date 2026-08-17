export type GeolocationBlockReason = 'insecure' | 'unsupported' | null

export type GeolocationSupport = {
  available: boolean
  secureContext: boolean
  reason: GeolocationBlockReason
  message: string | null
  devHttpsUrl: string | null
}

const INSECURE_MESSAGE =
  'Le GPS est bloqué en HTTP sur le réseau local. Utilisez HTTPS (voir lien ci-dessous) ou testez sur localhost.'

export function getGeolocationSupport(): GeolocationSupport {
  if (typeof window === 'undefined') {
    return {
      available: false,
      secureContext: false,
      reason: null,
      message: null,
      devHttpsUrl: null,
    }
  }

  const secureContext = window.isSecureContext
  const hasApi = typeof navigator !== 'undefined' && !!navigator.geolocation

  if (!hasApi) {
    return {
      available: false,
      secureContext,
      reason: 'unsupported',
      message: 'GPS non disponible sur cet appareil.',
      devHttpsUrl: null,
    }
  }

  if (!secureContext) {
    return {
      available: false,
      secureContext: false,
      reason: 'insecure',
      message: INSECURE_MESSAGE,
      devHttpsUrl: buildDevHttpsUrl('/livreur'),
    }
  }

  return {
    available: true,
    secureContext: true,
    reason: null,
    message: null,
    devHttpsUrl: null,
  }
}

export function buildDevHttpsUrl(path = '/livreur'): string | null {
  if (typeof window === 'undefined') return null
  const { hostname, port } = window.location
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'
  if (isLocalHost || window.isSecureContext) return null
  const p = port ? `:${port}` : ''
  const basePath = path.startsWith('/') ? path : `/${path}`
  return `https://${hostname}${p}${basePath}`
}

export function formatGeolocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Autorisez la géolocalisation dans les réglages du navigateur.'
    case err.POSITION_UNAVAILABLE:
      return 'Position GPS indisponible — vérifiez que le GPS est activé.'
    case err.TIMEOUT:
      return 'Délai GPS dépassé — réessayez en extérieur.'
    default:
      return err.message || 'Géolocalisation refusée.'
  }
}
