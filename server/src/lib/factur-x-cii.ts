/**
 * Export Factur-X profil MINIMUM (CII XML EN 16931) — prêt PDP sept. 2027.
 * Le PDF/A-3 embarqué sera branché via partenaire PDP ; ici l'XML structuré seul.
 */

type FacturXInput = {
  businessName: string
  siret?: string
  vatNumber?: string
  address?: string
  invoiceNumber: number
  issueDate: Date
  dueDate?: Date | null
  clientName: string
  clientSiret?: string | null
  clientVatNumber?: string | null
  clientAddress?: string | null
  currency?: string
  subtotalCents: number
  taxCents: number
  totalCents: number
  lines: Array<{
    description: string
    quantity: number
    unitPriceCents: number
    taxRate: number
  }>
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cents(n: number): string {
  return (n / 100).toFixed(2)
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function buildFacturXCiiXml(inv: FacturXInput): string {
  const currency = inv.currency ?? 'EUR'
  const invoiceId = String(inv.invoiceNumber).padStart(6, '0')
  const lineXml = inv.lines
    .map((line, idx) => {
      const lineHt = Math.round(line.quantity * line.unitPriceCents)
      const lineTax = Math.round(lineHt * (line.taxRate / 100))
      const lineTtc = lineHt + lineTax
      return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(line.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${cents(line.unitPriceCents)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${line.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${line.taxRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${cents(lineHt)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${invoiceId}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDate(inv.issueDate).replace(/-/g, '')}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lineXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(inv.businessName)}</ram:Name>
        ${inv.address ? `<ram:PostalTradeAddress><ram:LineOne>${esc(inv.address)}</ram:LineOne><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>` : ''}
        ${inv.siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(inv.siret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        ${inv.vatNumber ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(inv.vatNumber)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(inv.clientName)}</ram:Name>
        ${inv.clientAddress ? `<ram:PostalTradeAddress><ram:LineOne>${esc(inv.clientAddress)}</ram:LineOne><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>` : ''}
        ${inv.clientSiret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(inv.clientSiret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        ${inv.clientVatNumber ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(inv.clientVatNumber)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${cents(inv.taxCents)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${cents(inv.subtotalCents)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>10.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${cents(inv.subtotalCents)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${cents(inv.subtotalCents)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${cents(inv.taxCents)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${cents(inv.totalCents)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${cents(inv.totalCents)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}
