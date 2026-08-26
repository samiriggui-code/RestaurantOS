export type PennylaneBillingAddress = {
  address: string;
  postal_code: string;
  city: string;
  country_alpha2: string;
};

/**
 * Pennylane exige une adresse structurée (rue / CP / ville / pays) sur chaque client, alors que
 * `Invoice.clientAddress` est un champ texte libre. On extrait le code postal français (5 chiffres)
 * comme pivot : tout avant = rue, tout après = ville. Pas de format garanti → on lève une erreur
 * plutôt que d'envoyer une adresse incomplète/fausse à un logiciel comptable.
 */
export function parseFrenchAddressForPennylane(
  raw: string | null | undefined
): PennylaneBillingAddress {
  const text = (raw ?? '').trim();
  const match = text.match(/(\d{5})/);
  if (!text || !match) {
    throw new Error(
      "Adresse client incomplète pour Pennylane (code postal introuvable) — complète l'adresse sur la facture avant de synchroniser."
    );
  }

  const postalCode = match[1];
  const idx = match.index ?? 0;
  const street = text.slice(0, idx).trim().replace(/,+$/, '').trim();
  const city = text
    .slice(idx + postalCode.length)
    .replace(/^[,\n]+/, '')
    .trim();

  if (!street || !city) {
    throw new Error(
      "Adresse client incomplète pour Pennylane (rue ou ville manquante autour du code postal) — complète l'adresse sur la facture avant de synchroniser."
    );
  }

  return { address: street, postal_code: postalCode, city, country_alpha2: 'FR' };
}

/** Découpe un nom complet en prénom/nom pour un client individuel Pennylane (heuristique best-effort). */
export function splitClientName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { firstName: 'Client', lastName: trimmed || 'Comptoir' };
  }
  return {
    firstName: trimmed.slice(0, spaceIdx).trim(),
    lastName: trimmed.slice(spaceIdx + 1).trim(),
  };
}
