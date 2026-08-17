import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const OPS_PREFIXES = ['/pos', '/kitchen', '/admin', '/login', '/monitor']

function hostName(request: NextRequest): string {
  return request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? ''
}

function isDevHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1'
}

function isPublicHost(host: string): boolean {
  const configured = process.env.NEXT_PUBLIC_PUBLIC_HOST
  return (
    host === 'pizzeria.fr' ||
    host === 'pizzeria.test' ||
    (!!configured && host === configured)
  )
}

function isOpsHost(host: string): boolean {
  const configured = process.env.NEXT_PUBLIC_OPS_HOST
  return (
    host === 'app.pizzeria.fr' ||
    host === 'app.pizzeria.test' ||
    (!!configured && host === configured)
  )
}

function opsUrl(request: NextRequest, pathname: string): URL {
  const configured = process.env.NEXT_PUBLIC_OPS_HOST
  if (configured) {
    const proto =
      request.headers.get('x-forwarded-proto') ??
      (configured.includes('localhost') ? 'http' : 'https')
    return new URL(`${pathname}${request.nextUrl.search}`, `${proto}://${configured}`)
  }
  const port = request.nextUrl.port
  const proto = request.nextUrl.protocol
  const host = 'app.pizzeria.fr'
  const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : ''
  return new URL(`${pathname}${request.nextUrl.search}`, `${proto}//${host}${portSuffix}`)
}

function publicUrl(request: NextRequest, pathname: string): URL {
  const configured = process.env.NEXT_PUBLIC_PUBLIC_HOST
  if (configured) {
    const proto =
      request.headers.get('x-forwarded-proto') ??
      (configured.includes('localhost') ? 'http' : 'https')
    return new URL(`${pathname}${request.nextUrl.search}`, `${proto}://${configured}`)
  }
  const port = request.nextUrl.port
  const proto = request.nextUrl.protocol
  const host = 'pizzeria.fr'
  const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : ''
  return new URL(`${pathname}${request.nextUrl.search}`, `${proto}//${host}${portSuffix}`)
}

export function middleware(request: NextRequest) {
  const host = hostName(request)
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Dev local sans vhosts Laragon : tout accessible sur localhost:3000
  if (isDevHost(host)) {
    return NextResponse.next()
  }

  if (isPublicHost(host) && OPS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(opsUrl(request, pathname))
  }

  if (
    isOpsHost(host) &&
    (pathname === '/' ||
      pathname.startsWith('/menu') ||
      pathname.startsWith('/panier') ||
      pathname.startsWith('/commander') ||
      pathname.startsWith('/suivi') ||
      pathname.startsWith('/livreur'))
  ) {
    return NextResponse.redirect(publicUrl(request, pathname === '/' ? '/' : pathname))
  }

  if (isOpsHost(host) && pathname === '/') {
    return NextResponse.redirect(opsUrl(request, '/admin'))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
