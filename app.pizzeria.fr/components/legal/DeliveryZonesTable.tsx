import { DELIVERY_TOWNS_CONFIG } from '@/lib/delivery'

export function DeliveryZonesTable() {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[320px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-cream/45">
            <th className="px-3 py-2.5 font-semibold sm:px-4">Commune</th>
            <th className="px-3 py-2.5 font-semibold sm:px-4">CP</th>
            <th className="px-3 py-2.5 font-semibold sm:px-4">Min. pizzas</th>
            <th className="px-3 py-2.5 font-semibold sm:px-4">Frais</th>
          </tr>
        </thead>
        <tbody>
          {DELIVERY_TOWNS_CONFIG.map((z) => (
            <tr key={z.name} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-2.5 font-medium text-cream sm:px-4">{z.name}</td>
              <td className="px-3 py-2.5 text-cream/65 sm:px-4">{z.postalCodes.join(', ')}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-cream/65 sm:px-4">
                {z.minOrder.toFixed(2).replace('.', ',')} €
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-cream/65 sm:px-4">
                {z.fee.toFixed(2).replace('.', ',')} €
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
