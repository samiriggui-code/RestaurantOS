import Image from 'next/image'
import { cn } from '@/lib/cn'

type FoodImageProps = {
  src: string
  alt: string
  className?: string
  imageClassName?: string
  priority?: boolean
  sizes?: string
  overlay?: 'dark' | 'warm' | 'none'
}

export function FoodImage({
  src,
  alt,
  className,
  imageClassName,
  priority = false,
  sizes = '(max-width: 768px) 100vw, 50vw',
  overlay = 'dark',
}: FoodImageProps) {
  return (
    <div className={cn('relative w-full overflow-hidden bg-charcoal', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn('object-cover transition duration-700 group-hover:scale-105', imageClassName)}
      />
      {overlay === 'dark' && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/20 to-charcoal/30" />
      )}
      {overlay === 'warm' && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-red-950/80 via-transparent to-amber-900/20" />
      )}
    </div>
  )
}
