// middleware.ts
// Protects all federation scorecards except FEI, and all non-whitelisted routes.
// Password stored in PRISM_PASSWORD env var (set in Vercel dashboard).

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'prism_auth'
const PUBLIC_COOKIE_VALUE = 'authenticated'

// ── Public routes (no auth required) ─────────────────────────────────────────

function isPublic(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl

  // Always public: static assets, Next.js internals, login page
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/insights') ||   // keep AI endpoint accessible
    pathname.startsWith('/api/auth') ||
    pathname === '/login'
  ) return true

  // Public: directory page
  if (pathname === '/directory') return true

  // Public: root page ONLY when fed=FEI (or no fed param — defaults to FEI)
  if (pathname === '/') {
    const fed = searchParams.get('fed')
    if (!fed || fed === 'FEI') return true
    return false   // any other ?fed=XXX requires auth
  }

  // Everything else is private
  return false
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  if (isPublic(request)) return NextResponse.next()

  // Check auth cookie
  const cookie = request.cookies.get(COOKIE_NAME)
  if (cookie?.value === PUBLIC_COOKIE_VALUE) return NextResponse.next()

  // Not authenticated — redirect to login, preserve intended destination
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run on all routes except static files Next.js handles itself
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
