'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────

type Federation = {
  id: string; name: string; abbreviation: string; hq_country: string
  founding_year: number; ioc_recognized: boolean; sport: string
  n_member_federations: number; n_competitions_per_year: number
  global_fans_millions: number; economic_impact_bn_eur: number
}

type Objective = {
  id: string; pillar_id: string; name: string; description: string
  score: number; benchmark_score: number; trend_note: string
  evidence: string[]; display_order: number
}

type Pillar = {
  id: string; name: string; slug: string; description: string
  icon: string; color: string; display_order: number; objectives: Objective[]
}

type Assessment = {
  overall_score: number; grade: string; assessment_year: number; methodology_version: string
}

type ScorecardData = { federation: Federation; pillars: Pillar[]; assessment: Assessment }

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

function Bar({ score, color, height = 4 }: { score: number; color: string; height?: number }) {
  return (
    <div style={{ background: 'var(--border)', borderRadius: 99, height, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '4rem 1.25rem' }}>
      <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)', textAlign: 'center', marginBottom: '2rem' }}>
        Loading scorecard…
      </div>
      {[80, 120, 200].map((h, i) => (
        <div key={i} style={{ background: 'var(--surface2)', borderRadius: 12, height: h, marginBottom: 12 }} />
      ))}
    </div>
  )
}

// ─── Federation Carousel (NOW DYNAMIC) ────────────────────────────────────────

function FederationCarousel({
  index,
  federations,
  onNavigate,
}: {
  index: number
  federations: string[]
  onNavigate: (next: number) => void
}) {
  const go = useCallback(
    (dir: 'left' | 'right') => {
      const len = federations.length
      if (!len) return

      const next =
        dir === 'right'
          ? (index + 1) % len
          : (index - 1 + len) % len

      onNavigate(next)
    },
    [index, federations, onNavigate]
  )

  if (!federations.length) return null

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'var(--surface)', border: '0.5px solid var(--border)',
      borderRadius: 10, overflow: 'hidden'
    }}>
      <button onClick={() => go('left')} style={{ width: 36 }}>‹</button>

      <div style={{ padding: '6px 20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
          {federations.map((fed, i) => (
            <button
              key={fed}
              onClick={() => onNavigate(i)}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === index ? '#000' : '#ccc'
              }}
            />
          ))}
        </div>

        <div style={{ fontWeight: 700 }}>{federations[index]}</div>
        <div style={{ fontSize: 10 }}>{index + 1} / {federations.length}</div>
      </div>

      <button onClick={() => go('right')} style={{ width: 36 }}>›</button>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function ScorecardClient() {
  const [federations, setFederations] = useState<string[]>([])
  const [fedIdx, setFedIdx] = useState(0)

  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // ── Bootstrap federations ──
  useEffect(() => {
    supabase
      .from('federations')
      .select('abbreviation')
      .order('abbreviation')
      .then(({ data }) => {
        if (data) setFederations(data.map(r => r.abbreviation))
      })
  }, [])

  // ── Load scorecard ──
  useEffect(() => {
    if (!federations.length) return

    const abbr = federations[fedIdx]

    async function load() {
      setLoading(true)
      setError(null)
      setData(null)
      setActiveIdx(0)

      try {
        const { data: fedRows } = await supabase
          .from('federations')
          .select('*')
          .eq('abbreviation', abbr)
          .limit(1)

        const federation = fedRows?.[0]
        if (!federation) throw new Error('No federation')

        const { data: pillarsRaw } = await supabase
          .from('pillars')
          .select('*')
          .eq('federation_id', federation.id)
          .order('display_order')

        const pillarsWithObj: Pillar[] = await Promise.all(
          (pillarsRaw || []).map(async p => {
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
        if (!assessment) throw new Error('No assessment')

        setData({ federation, pillars: pillarsWithObj, assessment })
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [fedIdx, federations])

  // ── Guard ──
  if (federations.length === 0) return <LoadingState />

  const carousel = (
    <FederationCarousel
      index={fedIdx}
      federations={federations}
      onNavigate={setFedIdx}
    />
  )

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem' }}>
      {carousel}
      <LoadingState />
    </div>
  )

  if (error || !data) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem' }}>
      {carousel}
      <div>{error}</div>
    </div>
  )

  const { federation, pillars, assessment } = data
  const abbr = federation.abbreviation
  const overallScore = Math.round(assessment.overall_score)

  const radarData = pillars.map(p => ({
    name: p.name,
    [abbr]: Math.round(p.objectives.reduce((a, o) => a + o.score, 0) / (p.objectives.length || 1)),
    Benchmark: 70,
  }))

  const activePillar = pillars[activeIdx]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

      {/* HEADER */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: 8 }}>{carousel}</div>

        <h1>{federation.name}</h1>

        <p style={{ fontSize: 13 }}>
          {federation.sport} · {federation.founding_year} · {federation.hq_country}
        </p>

        <div style={{ fontSize: 48 }}>
          <AnimatedNumber target={overallScore} /> / 100
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        <div>{federation.n_member_federations}</div>
        <div>{federation.n_competitions_per_year}</div>
        <div>{federation.global_fans_millions}</div>
        <div>{federation.economic_impact_bn_eur}</div>
      </div>

      {/* PILLARS */}
      <div style={{ display: 'grid', gap: 10 }}>
        {pillars.map((p, i) => {
          const avg = Math.round(p.objectives.reduce((a, o) => a + o.score, 0) / (p.objectives.length || 1))

          return (
            <button key={p.id} onClick={() => setActiveIdx(i)}>
              <div>{p.icon} {p.name}</div>
              <div>{avg}</div>
              <Bar score={avg} color={p.color} />
            </button>
          )
        })}
      </div>

      {/* ACTIVE */}
      {activePillar && (
        <div>
          <h2>{activePillar.name}</h2>

          {activePillar.objectives.map(obj => (
            <div key={obj.id}>
              <div>{obj.name}</div>
              <div>{obj.score}</div>
              <Bar score={obj.score} color={scoreColor(obj.score)} />
            </div>
          ))}
        </div>
      )}

      {/* RADAR */}
      <div>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="name" />
            <Radar dataKey={abbr} stroke="#378ADD" fill="#378ADD" />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* FOOTER */}
      <div style={{ fontSize: 11, marginTop: 20 }}>
        PRISM methodology — federation governance & performance scoring system
      </div>
    </div>
  )
}
