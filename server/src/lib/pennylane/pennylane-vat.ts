/** Codes de taux de TVA française attendus par l'API Pennylane (customer_invoices.invoice_lines[].vat_rate). */
const FR_VAT_RATE_CODES: Record<string, string> = {
  '0': 'FR_0',
  '2.1': 'FR_21',
  '5.5': 'FR_55',
  '10': 'FR_100',
  '20': 'FR_200',
};

/**
 * Convertit un taux de TVA en pourcentage (ex. 10, 5.5) vers le code Pennylane (ex. "FR_100").
 * Lève une erreur plutôt que d'envoyer un taux non mappé à un logiciel comptable.
 */
export function frVatRateCode(taxRatePercent: number): string {
  const key = Number.isInteger(taxRatePercent) ? String(taxRatePercent) : String(taxRatePercent);
  const code = FR_VAT_RATE_CODES[key];
  if (!code) {
    throw new Error(
      `Taux de TVA non reconnu pour Pennylane : ${taxRatePercent}% (attendu 0, 2.1, 5.5, 10 ou 20)`
    );
  }
  return code;
}
