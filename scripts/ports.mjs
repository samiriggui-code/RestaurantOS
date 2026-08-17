/** Ports dev figés — alignés avec server/.env (PORT=3001) et app.pizzeria.fr (--port 3000). */
export const PORTS = {
  WEB: 3000,
  API: 3001,
  LEGACY_VITE: 5173,
  LEGACY_VITE_ALT: 5174,
}

export const DEV_STACK_PORTS = [PORTS.WEB, PORTS.API]
export const ALL_DEV_PORTS = [PORTS.WEB, PORTS.API, PORTS.LEGACY_VITE, PORTS.LEGACY_VITE_ALT]

export function printPortBanner(profile = 'dev') {
  const isMobile = profile === 'mobile'
  console.log('')
  console.log('══════════════════════════════════════════════════')
  console.log('  RestaurantOS — ports figés')
  console.log('══════════════════════════════════════════════════')
  if (isMobile) {
    console.log(`  Landing / livreur (HTTPS)    →  https://localhost:${PORTS.WEB}`)
    console.log(`  Téléphone (même Wi‑Fi)       →  https://<IP-PC>:${PORTS.WEB}/livreur`)
    console.log('  Acceptez le certificat auto-signé sur le téléphone.')
  } else {
    console.log(`  Landing / CRM / KDS / POS  →  http://localhost:${PORTS.WEB}`)
  }
  console.log(`  API Express                →  http://localhost:${PORTS.API}`)
  if (profile === 'all' || profile === 'legacy' || profile === 'client') {
    console.log(`  Legacy Vite (dev:all)      →  http://localhost:${PORTS.LEGACY_VITE}`)
  }
  console.log(
    isMobile
      ? '  Commande : npm run dev:mobile  (HTTPS 3000 + API 3001)'
      : '  Commande : npm run dev  (3000 + 3001 uniquement)',
  )
  console.log('══════════════════════════════════════════════════')
  console.log('')
}
