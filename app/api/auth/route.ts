// Validates the submitted password against PRISM_PASSWORD env var.
// On success, sets an httpOnly cookie that middleware will accept.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'prism_auth'
const COOKIE_VALUE = 'authenticated'
// Cookie lasts 30 days; adjust as needed
const MAX_AGE = 60 * 60 * 24 * 30

export async function POST(req: Request) {
  const { password } = await req.json()

  const correct = process.env.PRISM_PASSWORD
  if (!correct) {
    return NextResponse.json({ error: 'PRISM_PASSWORD env var not set' }, { status: 500 })
  }

  if (password !== correct) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  // Set httpOnly cookie — not readable by JS, harder to steal
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })

  return response
}
