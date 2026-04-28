// middleware.ts
// Protects all routes except /directory and system paths.
// Two passwords are supported:
//   PRISM_PASSWORD     → cookie "authenticated"     (master — access to all routes)
//   PRISM_UCI_PASSWORD → cookie "uci_authenticated" (UCI scorecard only)
//
// Public routes: /directory only. Everything else (incl. FEI) requires auth.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'prism_auth'

// ── Route classifiers ─────────────────────────────────────────────────────────

/** Returns true for routes that never need a password. */
function isPublic(request: NextRequest): boolean {
  const { pathname } = request.nextUrl

  // Always public: static assets, Next.js internals, login page, auth endpoint
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/insights') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login'
  ) return true

  // Directory is the only public page
  if (pathname === '/directory') return true

  return false
}

/** Returns true for the UCI scorecard route (?fed=UCI on root). */
function isUciRoute(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl
  return pathname === '/' && searchParams.get('fed') === 'UCI'
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  // Public routes — pass through immediately
  if (isPublic(request)) return NextResponse.next()

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value

  // UCI scorecard: UCI password or master password
  if (isUciRoute(request)) {
    if (cookieValue === 'uci_authenticated' || cookieValue === 'authenticated') {
      return NextResponse.next()
    }
    return redirectToLogin(request)
  }

  // All other protected routes: master password only
  if (cookieValue === 'authenticated') {
    return NextResponse.next()
  }

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
