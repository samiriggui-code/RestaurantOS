/**
 * Décode le texte échappé par sanitizeInput (&#39;, &lt;, etc.) avant affichage.
 * Les valeurs sont stockées échappées en BDD — React Email ré-affiche les entités telles quelles.
 */
export function decodeStoredText(value: string | null | undefined): string | undefined {
  if (value == null || value === '') return value ?? undefined

  let text = value
  // Entités numériques
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  // Entités nommées / legacy sanitize
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&#60;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#62;/g, '>')
    .replace(/&amp;/g, '&')

  return text
}
