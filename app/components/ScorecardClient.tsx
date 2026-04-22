'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────

type Federation = {
  id: string
  name: string
  abbreviation: string
  hq_country: string
  founding_year: number
  ioc_recognized: boolean
  sport: string
  n_member_federations: number
  n_competitions_per_year: number
  global_fans_millions: number
  economic_impact_bn_eur: number
}

type Objective = {
  id: string
  pillar_id: string
  name: string
  description: string
  score: number
  benchmark_score: number
  trend_note: string
  evidence: string[]
  display_order: number
}

type Pillar = {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  color: string
  display_order: number
  objectives: Objective[]
}

type Assessment = {
  overall_score: number
  grade: string
  assessment_year: number
  methodology_version: string
}

type ScorecardData = {
  federation: Federation
  pillars: Pillar[]
  assessment: Assessment
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 80) return '#2d7d46'
  if (s >= 70) return '#1a6fa8'
  if (s >= 60) return '#a06010'
  return '#b83030'
}

function AnimatedNumber({ target }: { target: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let cur = 0
    const step = () => {
      cur = Math.min(cur + 1.8, target)
      setVal(Math.round(cur))
      if (cur < target) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target])
  return <>{val}</>
}

function Bar({
  score,
  color,
  height = 4,
}: {
  score: number
  color: string
  height?: number
}) {
  return (
    <div
      style={{
        background: 'var(--border)',
        borderRadius: 99,
        height,
        overflow: 'hidden',
        marginTop: 6,
      }}
    >
      <div
        style={{
          width: `${score}%`,
          height: '100%',
          background: color,
          borderRadius: 99,
          transition: 'width 0.6s ease',
        }}
      />
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '4rem 1.25rem' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
      <div
        style={{
          fontFamily: 'sans-serif',
          fontSize: 13,
          color: 'var(--text3)',
          textAlign: 'center',
          marginBottom: '2rem',
        }}
      >
        Loading scorecard…
      </div>
      {[80, 120, 200].map((h, i) => (
        <div
          key={i}
          style={{
            background: 'var(--surface2)',
            borderRadius: 12,
            height: h,
            marginBottom: 12,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}

// ─── Federation Carousel ──────────────────────────────────────────────────────

function FederationCarousel({
  federations,
  index,
  onNavigate,
}: {
  federations: Federation[]
  index: number
  onNavigate: (next: number) => void
}) {
  const go = useCallback(
    (dir: 'left' | 'right') => {
      const next =
        dir === 'right'
          ? (index + 1) % federations.length
          : (index - 1 + federations.length) % federations.length
      onNavigate(next)
    },
    [index, federations.length, onNavigate]
  )

  const active = federations[index]

  if (!active) return null

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <CarouselArrow dir="left" onClick={() => go('left')} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '6px 20px',
          minWidth: 96,
        }}
      >
        <div style={{ display: 'flex', gap: 5 }}>
          {federations.map((f, i) => (
            <button
              key={f.id}
              onClick={() => onNavigate(i)}
              aria-label={f.abbreviation}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                border: 'none',
                background: i === index ? 'var(--text)' : 'var(--border)',
                transform: i === index ? 'scale(1.35)' : 'scale(1)',
                transition: 'all 0.2s',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontFamily: 'sans-serif',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          {active.abbreviation}
        </div>

        <div
          style={{
            fontFamily: 'sans-serif',
            fontSize: 10,
            color: 'var(--text3)',
          }}
        >
          {index + 1} / {federations.length}
        </div>
      </div>

      <CarouselArrow dir="right" onClick={() => go('right')} />
    </div>
  )
}

function CarouselArrow({
  dir,
  onClick,
}: {
  dir: 'left' | 'right'
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'Previous federation' : 'Next federation'}
      style={{
        width: 36,
        height: 36,
        background: 'var(--surface)',
        border: 'none',
        borderRight: dir === 'left' ? '0.5px solid var(--border)' : 'none',
        borderLeft: dir === 'right' ? '0.5px solid var(--border)' : 'none',
        cursor: 'pointer',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        {dir === 'left' ? (
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScorecardClient() {
  const [federations, setFederations] = useState<Federation[]>([])
  const [fedIdx, setFedIdx] = useState(0)
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // Load federation list once
  useEffect(() => {
    async function loadFederations() {
      const { data, error } = await supabase
        .from('federations')
        .select('*')
        .order('abbreviation')

      if (!error && data) {
        setFederations(data)
      }
    }
    loadFederations()
  }, [])

  // Load scorecard when federation changes
  useEffect(() => {
    const federation = federations[fedIdx]
    if (!federation) return

    async function loadScorecard() {
      setLoading(true)
      setError(null)
      setData(null)
      setActiveIdx(0)

      try {
        const { data: pillarsRaw } = await supabase
          .from('pillars')
          .select('*')
          .eq('federation_id', federation.id)
          .order('display_order')

        const pillars: Pillar[] = await Promise.all(
          (pillarsRaw || []).map(async (p) => {
            const { data: objectives } = await supabase
              .from('objectives')
              .select('*')
              .eq('pillar_id', p.id)
              .order('display_order')
            return { ...p, objectives: objectives || [] }
          })
        )

        const { data: assessmentRows } = await supabase
          .from('assessments')
          .select('*')
          .eq('federation_id', federation.id)
          .order('assessment_year', { ascending: false })
          .limit(1)

        const assessment = assessmentRows?.[0]
        if (!assessment) throw new Error('No assessment found')

        setData({ federation, pillars, assessment })
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    loadScorecard()
  }, [fedIdx, federations])

  if (!federations.length) return <LoadingState />

  const carousel = (
    <FederationCarousel
      federations={federations}
      index={fedIdx}
      onNavigate={setFedIdx}
    />
  )

  if (loading || !data)
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>{carousel}</div>
        <LoadingState />
      </div>
    )

  if (error)
    return (
      <div style={{ padding: '2rem' }}>
        {carousel}
        <p style={{ marginTop: 16 }}>Error: {error}</p>
      </div>
    )

  // ─── Render uses EXACT SAME JSX as your original ───
  // (No behavioural changes below this point)

  /* 👉 Everything below here you already know works,
        so I've intentionally not re‑explained it */

  // — snip —
  // Keep your existing render body here unchanged
}
