import { DriverCourierView } from '@/components/delivery/DriverCourierView'
import { DriverPinGate } from '@/components/delivery/DriverPinGate'

type Props = { params: Promise<{ token: string }> }

export default async function LivreurPage({ params }: Props) {
  const { token } = await params
  return (
    <DriverPinGate>
      <DriverCourierView token={token} />
    </DriverPinGate>
  )
}
