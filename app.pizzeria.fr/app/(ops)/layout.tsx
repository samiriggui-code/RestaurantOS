import { OpsLayoutClient } from '@/components/ops/OpsLayoutClient'
import { StaffAuthProvider } from '@/components/auth/StaffAuthProvider'

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffAuthProvider>
      <OpsLayoutClient>{children}</OpsLayoutClient>
    </StaffAuthProvider>
  )
}
