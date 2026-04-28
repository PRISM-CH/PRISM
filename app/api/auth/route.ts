// app/api/auth/route.ts
// Validates submitted password against PRISM_PASSWORD (general) or
// PRISM_UCI_PASSWORD (UCI-specific). Sets an httpOnly cookie accordingly.
//
// Cookie values:
//   "authenticated"     → general access (all scorecards except UCI)
//   "uci_authenticated" → UCI access + all other scorecards

import { NextResponse } from 'next/server'

const COOKIE_NAME = 'prism_auth'
// Cookie lasts 30 days; adjust as needed
const MAX_AGE = 60 * 60 * 24 * 30

export async function POST(req: Request) {
  const { password } = await req.json()

  const generalPassword = process.env.PRISM_PASSWORD
  const uciPassword     = process.env.PRISM_UCI_PASSWORD

  if (!generalPassword) {
    return NextResponse.json(
      { error: 'PRISM_PASSWORD env var not set' },
      { status: 500 }
    )
  }

  const trimmed = password?.trim() ?? ''

  let cookieValue: string | null = null

  if (uciPassword && trimmed === uciPassword.trim()) {
    // UCI password grants access to the UCI scorecard only
    cookieValue = 'uci_authenticated'
  } else if (trimmed === generalPassword.trim()) {
    // Master password grants access to all routes including UCI
    cookieValue = 'authenticated'
  }

  if (!cookieValue) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  // Set httpOnly cookie — not readable by JS, harder to steal
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })

  return response
}
