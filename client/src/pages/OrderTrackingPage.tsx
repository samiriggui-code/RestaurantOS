import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { getSocket } from '../services/socket'
import { useTranslation } from '../i18n/useTranslation'
import { Order } from '../types'
import {
  CheckCircle, ChefHat, Clock, Truck, Bell, ArrowRight, Home,
  MapPin, Receipt, Timer, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'

const steps = (t: any) => [
  { key: 'PENDING', label: t('tracking.pending'), icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  { key: 'PREPARING', label: t('tracking.preparing'), icon: ChefHat, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { key: 'READY', label: t('tracking.ready'), icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  { key: 'DELIVERED', label: t('tracking.delivered'), icon: Truck, color: 'text-surface-400', bg: 'bg-surface-500/20' },
]

export default function OrderTrackingPage() {
  const { t } = useTranslation()
  const { orderNumber } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    try {
      const ctx = new AudioContext()
      const sampleRate = 8000
      const duration = 0.15
      const frames = sampleRate * duration
      const buffer = ctx.createBuffer(1, frames, sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < frames; i++) {
        const t = i / sampleRate
        data[i] = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 20) * 0.3
      }
      const wav = bufferToWav(buffer)
      const blob = new Blob([wav], { type: 'audio/wav' })
      audioRef.current = new Audio(URL.createObjectURL(blob))
    } catch { /* audio not critical */ }
  }, [])

  function bufferToWav(buffer: AudioBuffer) {
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const format = 1
    const bitDepth = 16
    const data = buffer.getChannelData(0)
    const dataLength = data.length * (bitDepth / 8)
    const headerLength = 44
    const totalLength = headerLength + dataLength
    const arrayBuffer = new ArrayBuffer(totalLength)
    const view = new DataView(arrayBuffer)
    writeString(view, 0, 'RIFF')
    view.setUint32(4, totalLength - 8, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, format, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true)
    view.setUint16(32, numChannels * (bitDepth / 8), true)
    view.setUint16(34, bitDepth, true)
    writeString(view, 36, 'data')
    view.setUint32(40, dataLength, true)
    let offset = 44
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
    return arrayBuffer
  }

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  const loadOrder = () => {
    if (!orderNumber) return
    const businessId = new URLSearchParams(window.location.search).get('businessId') || ''
    api.getOrders(`orderNumber=${orderNumber}`)
      .then(async (orders) => {
        const found = orders.find((o: any) => o.orderNumber.toString() === orderNumber)
        if (found) {
          setOrder(found)
        } else {
          try {
            const res = await fetch(`/api/orders/track/${orderNumber}${businessId ? `?businessId=${businessId}` : ''}`)
            const data = await res.json()
            setOrder(data)
          } catch {
            toast.error(t('tracking.order_not_found'))
          }
        }
      })
      .catch(() => toast.error('فشل تحميل الطلب'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadOrder()
    const socket = getSocket()

    const handleStatusUpdate = (updatedOrder: Order) => {
      if (updatedOrder.orderNumber.toString() === orderNumber) {
        setOrder(prev => {
          if (prev && prev.status !== updatedOrder.status) {
            audioRef.current?.play().catch(() => {})
            const statusText: Record<string, string> = {
              PREPARING: 'بدأ تحضير طلبك!',
              READY: 'طلبك جاهز!',
              DELIVERED: 'تم توصيل طلبك!',
            }
            const msg = statusText[updatedOrder.status]
            if (msg) toast.success(msg, { duration: 5000 })
          }
          return updatedOrder
        })
      }
    }

    socket.on('order:statusUpdate', handleStatusUpdate)
    socket.on('order:itemStatusUpdate', (data: any) => {
      if (data.order?.orderNumber.toString() === orderNumber) {
        setOrder(data.order)
      }
    })

    return () => {
      socket.off('order:statusUpdate', handleStatusUpdate)
      socket.off('order:itemStatusUpdate')
    }
  }, [orderNumber])

  useEffect(() => {
    if (!order?.createdAt) return
    const start = new Date(order.createdAt).getTime()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [order?.createdAt])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const currentStepIndex = order
    ? steps(t).findIndex(s => s.key === order.status)
    : -1

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-400">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-surface-50 to-white flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-3xl bg-surface-100 flex items-center justify-center mb-6">
          <Receipt className="w-10 h-10 text-surface-300" />
        </div>
        <h1 className="text-2xl font-bold text-surface-700 mb-1">{t('tracking.order_not_found')}</h1>
        <p className="text-surface-400 mb-8">تأكد من رقم الطلب وحاول مرة أخرى</p>
        <button onClick={() => navigate('/menu')} className="btn-primary">
          {t('menu_customer.view_menu')}
        </button>
      </div>
    )
  }

  const statusEmojis: Record<string, string> = {
    PENDING: '🕐', PREPARING: '👨‍🍳', READY: '✅', DELIVERED: '🎉', CANCELLED: '❌',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/30 to-white">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-surface-100">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/menu')} className="p-2.5 hover:bg-surface-100 rounded-2xl transition-all">
            <ArrowRight className="w-5 h-5 text-surface-600" />
          </button>
          <h1 className="font-bold text-lg text-surface-800">{t('tracking.title')}</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Order Header */}
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-surface-100 text-center animate-fade-in">
          <div className="text-5xl mb-4 animate-bounce-in">{statusEmojis[order.status] || '📋'}</div>
          <h2 className="text-2xl font-bold text-surface-800">طلب <span className="text-primary-600">#{order.orderNumber}</span></h2>
          <p className="text-surface-400 mt-1.5 text-sm">
            {order.status === 'PENDING' && t('tracking.pending_msg')}
            {order.status === 'PREPARING' && t('tracking.preparing_msg')}
            {order.status === 'READY' && t('tracking.ready_msg')}
            {order.status === 'DELIVERED' && t('tracking.delivered_msg')}
            {order.status === 'CANCELLED' && t('tracking.cancelled_msg')}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-surface-50 px-4 py-2.5 rounded-2xl border border-surface-100">
            <Timer className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-medium text-surface-600 font-mono" dir="ltr">{formatTime(elapsed)}</span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-surface-100">
          <div className="relative">
            {steps(t).map((step, idx) => {
              const Icon = step.icon
              const isActive = idx <= currentStepIndex
              const isCurrent = idx === currentStepIndex
              return (
                <div key={step.key} className="flex items-start gap-4 pb-7 last:pb-0 relative">
                  {idx < steps.length - 1 && (
                    <div className={`absolute right-[18px] top-10 w-0.5 h-8 ${
                      idx < currentStepIndex ? 'bg-emerald-500' : 'bg-surface-200'
                    }`} />
                  )}
                  <div className={`p-3 rounded-2xl transition-all ${
                    isActive ? step.bg : 'bg-surface-100'
                  } ${isCurrent ? 'ring-2 ring-primary-500 ring-offset-2 shadow-lg' : ''}`}>
                    <Icon className={`w-5 h-5 ${isActive ? step.color : 'text-surface-300'}`} />
                  </div>
                  <div className="flex-1 pt-2">
                    <p className={`font-bold ${isActive ? 'text-surface-800' : 'text-surface-400'}`}>
                      {step.label}
                    </p>
                    {isCurrent && order.status === 'PREPARING' && (
                      <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                        <Sparkles size={12} />
                        {t('tracking.currently_preparing')}
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center mt-2 shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-surface-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-surface-800">{t('tracking.order_items')}</h3>
            <span className="text-xs text-surface-400">{order.items.length} صنف</span>
          </div>
          <div className="space-y-3">
            {order.items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center font-bold text-sm">
                    {item.quantity}
                  </span>
                  <div>
                    <p className="font-medium text-surface-800 text-sm">{item.menuItem.name || item.menuItem.nameAr}</p>
                    {item.notes && <p className="text-[11px] text-surface-400 mt-0.5">{item.notes}</p>}
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-medium text-surface-700 text-sm">{(item.price * item.quantity).toFixed(2)} د.ج</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${
                    item.status === 'READY' ? 'bg-emerald-50 text-emerald-700' :
                    item.status === 'PREPARING' ? 'bg-blue-50 text-blue-700' :
                    item.status === 'DELIVERED' ? 'bg-surface-100 text-surface-600' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {item.status === 'READY' ? t('tracking.ready') :
                     item.status === 'PREPARING' ? t('tracking.preparing') :
                     item.status === 'DELIVERED' ? t('tracking.delivered') : t('tracking.pending')}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="divider mt-4 mb-4" />
          <div className="flex justify-between font-bold text-lg">
            <span className="text-surface-800">{t('menu_customer.total')}</span>
            <span className="text-gradient">{order.total.toFixed(2)} د.ج</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {order.table && (
            <button
              onClick={async () => {
                const businessId = new URLSearchParams(window.location.search).get('businessId') || ''
                try {
                  await fetch('/api/orders/call-waiter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tableId: order.tableId, businessId }),
                  })
                  toast.success('تم استدعاء النادل!')
                } catch {
                  toast.error('فشل استدعاء النادل')
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200 hover:bg-amber-100 font-bold text-sm transition-all"
            >
              <Bell className="w-5 h-5" />
              {t('tracking.call_waiter')}
            </button>
          )}
          <button
            onClick={() => {
              const params = new URLSearchParams(window.location.search)
              if (order?.tableId) params.set('tableId', order.tableId)
              if (order?.id) params.set('existingOrderId', order.id)
              navigate(`/menu?${params.toString()}`)
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-surface-50 text-surface-600 rounded-2xl border border-surface-200 hover:bg-surface-100 font-bold text-sm transition-all"
          >
            <Home className="w-5 h-5" />
            {t('tracking.order_more')}
          </button>
        </div>
      </div>
    </div>
  )
}
