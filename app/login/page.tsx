// Simple password gate — submits to /api/auth, which sets the cookie.

'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/'

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      // Hard navigation — forces a fresh server request so middleware
      // evaluates the newly-set cookie before rendering the destination.
      window.location.href = from
    } else {
      setError('Incorrect password.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg, #f9fafb)', padding: '1.5rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'var(--surface, #fff)', borderRadius: 14,
        border: '0.5px solid var(--border, #e5e7eb)',
        padding: '2rem 2rem 1.75rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {/* Logo / wordmark */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 800, letterSpacing: '0.18em', color: 'var(--text, #111)', marginBottom: 4 }}>
            PRISM
          </div>
          <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text3, #9ca3af)' }}>
            IF Performance Intelligence
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontFamily: 'sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--text2, #6b7280)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Access password
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Enter password"
              style={{
                width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                fontFamily: 'sans-serif', fontSize: 14, color: 'var(--text, #111)',
                background: 'var(--surface, #fff)',
                border: focused ? '1px solid #3b82f6' : '0.5px solid var(--border, #e5e7eb)',
                borderRadius: 8, outline: 'none', transition: 'border-color 0.15s',
              }}
            />
          </div>

          {error && (
            <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#dc2626', marginBottom: '0.75rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
              background: loading || !password ? 'var(--surface2, #f3f4f6)' : '#1d4ed8',
              color: loading || !password ? 'var(--text3, #9ca3af)' : '#fff',
              fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {loading ? 'Verifying…' : 'Continue →'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '0.5px solid var(--border, #e5e7eb)' }}>
          <p style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3, #9ca3af)', lineHeight: 1.6 }}>
            Public:{' '}
            <a href="/directory" style={{ color: '#2563eb', textDecoration: 'none' }}>IF Directory</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
