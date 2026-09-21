/** Layout appareil totem — remplit le shell ops (h-dvh), sans double fixed. */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
}
