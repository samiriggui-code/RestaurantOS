/** Ouvre un moniteur CRM dans une fenêtre dédiée (pas un nouvel onglet). */
export function openMonitorWindow(path: '/monitor/kitchen' | '/monitor/pos', label?: string) {
  if (typeof window === 'undefined') return null
  const features = [
    'popup=yes',
    'width=1360',
    'height=900',
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
    'scrollbars=yes',
    'resizable=yes',
  ].join(',')
  const name = label ?? path.replace(/\//g, '-')
  return window.open(path, name, features)
}
