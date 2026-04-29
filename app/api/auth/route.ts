// app/api/auth/route.ts
// Validates submitted password against PRISM_PASSWORD (general),
// PRISM_UCI_PASSWORD (UCI-specific), or PRISM_WS_PASSWORD (WS-specific).
// Sets an httpOnly cookie accordingly.
//
// Cookie values:
//   "authenticated"     → master access (all scorecards)
//   "uci_authenticated" → UCI scorecard only
//   "ws_authenticated"  → World Sailing scorecard only

import { NextResponse } from 'next/server'

const COOKIE_NAME = 'prism_auth'
const MAX_AGE = 60 * 60 * 24 * 30

export async function POST(req: Request) {
  const { password } = await req.json()

  const generalPassword = process.env.PRISM_PASSWORD
  const uciPassword     = process.env.PRISM_UCI_PASSWORD
  const wsPassword      = process.env.PRISM_WS_PASSWORD

  if (!generalPassword) {
    return NextResponse.json(
      { error: 'PRISM_PASSWORD env var not set' },
      { status: 500 }
    )
  }

  const trimmed = password?.trim() ?? ''

  let cookieValue: string | null = null

  if (uciPassword && trimmed === uciPassword.trim()) {
    cookieValue = 'uci_authenticated'
  } else if (wsPassword && trimmed === wsPassword.trim()) {
    cookieValue = 'ws_authenticated'
  } else if (trimmed === generalPassword.trim()) {
    cookieValue = 'authenticated'
  }

  if (!cookieValue) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

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
