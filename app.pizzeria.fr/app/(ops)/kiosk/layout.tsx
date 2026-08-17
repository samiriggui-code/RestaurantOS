/** Layout appareil totem — plein écran, sans barre admin. */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-charcoal text-cream">
      {children}
    </div>
  )
}
