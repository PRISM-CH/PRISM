// middleware.ts
// Protects all routes except /directory and system paths.
// Three passwords supported:
//   PRISM_PASSWORD     → cookie "authenticated"     (master — all routes)
//   PRISM_UCI_PASSWORD → cookie "uci_authenticated" (UCI scorecard only)
//   PRISM_WS_PASSWORD  → cookie "ws_authenticated"  (World Sailing scorecard only)
//
// Public routes: /directory only.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'prism_auth'

function isPublic(request: NextRequest): boolean {
  const { pathname } = request.nextUrl
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/insights') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login'
  ) return true
  if (pathname === '/directory') return true
  return false
}

function getFedParam(request: NextRequest): string | null {
  const { pathname, searchParams } = request.nextUrl
  if (pathname !== '/') return null
  return searchParams.get('fed')
}

export function middleware(request: NextRequest) {
  if (isPublic(request)) return NextResponse.next()

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value
  const fed = getFedParam(request)

  // Master password always passes
  if (cookieValue === 'authenticated') return NextResponse.next()

  // UCI: UCI password or master
  if (fed === 'UCI') {
    if (cookieValue === 'uci_authenticated') return NextResponse.next()
    return redirectToLogin(request)
  }

  // WS: WS password or master
  if (fed === 'WS') {
    if (cookieValue === 'ws_authenticated') return NextResponse.next()
    return redirectToLogin(request)
  }

  // All other protected routes: master only
  return redirectToLogin(request)
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set(
    'from',
    request.nextUrl.pathname + request.nextUrl.search
  )
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
