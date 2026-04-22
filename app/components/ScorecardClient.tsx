'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Federation carousel config ───────────────────────────────────────────────

const FEDERATIONS = ['FEI', 'WA', 'WAQ', 'UIPM', 'ISSF','FITA'] as const
type FederationAbbr = typeof FEDERATIONS[number]
const DEFAULT_FED_IDX = 0 // FEI

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
    const step = () => { cur = Math.min(cur + 1.8, target); setVal(Math.round(cur)); if (cur < target) requestAnimationFrame(step) }
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
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
      <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)', textAlign: 'center', marginBottom: '2rem' }}>Loading scorecard…</div>
      {[80, 120, 200].map((h, i) => (
        <div key={i} style={{ background: 'var(--surface2)', borderRadius: 12, height: h, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  )
}

// ─── Federation Carousel ──────────────────────────────────────────────────────

function FederationCarousel({
  index,
  onNavigate,
}: {
  index: number
  onNavigate: (next: number) => void
}) {
  const go = useCallback(
    (dir: 'left' | 'right') => {
      const next =
        dir === 'right'
          ? (index + 1) % FEDERATIONS.length
          : (index - 1 + FEDERATIONS.length) % FEDERATIONS.length
      onNavigate(next)
    },
    [index, onNavigate]
  )

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 0,
      background: 'var(--surface)', border: '0.5px solid var(--border)',
      borderRadius: 10, overflow: 'hidden', userSelect: 'none',
    }}>
      <CarouselArrow dir="left" onClick={() => go('left')} />

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4, padding: '6px 20px', minWidth: 96,
      }}>
        {/* dot indicators */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {FEDERATIONS.map((fed, i) => (
            <button
              key={fed}
              aria-label={fed}
              onClick={() => onNavigate(i)}
              style={{
                width: 6, height: 6, borderRadius: '50%', border: 'none', padding: 0,
                background: i === index ? 'var(--text)' : 'var(--border)',
                transform: i === index ? 'scale(1.35)' : 'scale(1)',
                transition: 'background 0.2s, transform 0.2s',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        {/* label */}
        <div style={{
          fontFamily: 'sans-serif', fontSize: 15, fontWeight: 700,
          letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1,
          minWidth: '4ch', textAlign: 'center',
        }}>
          {FEDERATIONS[index]}
        </div>

        {/* counter */}
        <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: 'var(--text3)', letterSpacing: '0.04em' }}>
          {index + 1} / {FEDERATIONS.length}
        </div>
      </div>

      <CarouselArrow dir="right" onClick={() => go('right')} />
    </div>
  )
}

function CarouselArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'Previous federation' : 'Next federation'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, background: 'var(--surface)', border: 'none',
        borderRight: dir === 'left' ? '0.5px solid var(--border)' : 'none',
        borderLeft: dir === 'right' ? '0.5px solid var(--border)' : 'none',
        color: 'var(--text)', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        {dir === 'left'
          ? <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        }
      </svg>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScorecardClient() {
  const [fedIdx, setFedIdx] = useState(DEFAULT_FED_IDX)
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // Re-fetch whenever the selected federation changes
  useEffect(() => {
    const abbr: FederationAbbr = FEDERATIONS[fedIdx]

    async function load() {
      setLoading(true)
      setError(null)
      setData(null)
      setActiveIdx(0)

      try {
        // ✅ .maybeSingle() — no 406 when multiple rows exist
        const { data: fedRows, error: fedErr } = await supabase
          .from('federations')
          .select('*')
          .eq('abbreviation', abbr)
          .limit(1)
        if (fedErr) throw new Error(fedErr.message)
        const federation = fedRows?.[0]
        if (!federation) throw new Error(`No data found for ${abbr}`)

        const { data: pillarsRaw, error: pilErr } = await supabase
          .from('pillars').select('*').eq('federation_id', federation.id).order('display_order')
        if (pilErr) throw new Error(pilErr.message)

        const pillarsWithObj: Pillar[] = await Promise.all(
          (pillarsRaw || []).map(async (p) => {
            const { data: objectives } = await supabase
              .from('objectives').select('*').eq('pillar_id', p.id).order('display_order')
            return { ...p, objectives: objectives || [] }
          })
        )

        // ✅ also fixed here — order + limit instead of .single()
        const { data: assessmentRows, error: assErr } = await supabase
          .from('assessments').select('*').eq('federation_id', federation.id)
          .order('assessment_year', { ascending: false }).limit(1)
        if (assErr) throw new Error(assErr.message)
        const assessment = assessmentRows?.[0]
        if (!assessment) throw new Error(`No assessment found for ${abbr}`)

        setData({ federation, pillars: pillarsWithObj, assessment })
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [fedIdx])

  // ── Render ─────────────────────────────────────────────────────────────────

  const carousel = (
    <FederationCarousel index={fedIdx} onNavigate={setFedIdx} />
  )

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>{carousel}</div>
      <LoadingState />
    </div>
  )

  if (error || !data) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>{carousel}</div>
      <div style={{ textAlign: 'center', fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)', padding: '2rem 0' }}>
        Unable to load scorecard — {error || 'No data'}
      </div>
    </div>
  )

  const { federation, pillars, assessment } = data
  const activePillar = pillars[activeIdx]
  const overallScore = Math.round(assessment.overall_score)
  const abbr = federation.abbreviation
  const radarData = pillars.map(p => ({
    name: p.name.replace(' & ', ' &\n'),
    [abbr]: Math.round(p.objectives.reduce((a, o) => a + o.score, 0) / (p.objectives.length || 1)),
    Benchmark: 70,
  }))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
          PRISM · {assessment.assessment_year} · {assessment.methodology_version}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            {/* Carousel replaces the static federation title */}
            <div style={{ marginBottom: 8 }}>{carousel}</div>
            <h1 style={{ fontSize: 28, fontWeight: 400, lineHeight: 1.2, color: 'var(--text)' }}>{federation.name}</h1>
            <p style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
              {federation.sport} · Founded {federation.founding_year} · {federation.hq_country}
              {federation.ioc_recognized && ' · IOC-recognised'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'sans-serif', fontSize: 48, fontWeight: 300, lineHeight: 1, color: scoreColor(overallScore) }}>
              <AnimatedNumber target={overallScore} /><span style={{ fontSize: 20, color: 'var(--text3)', fontWeight: 400 }}>/100</span>
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{assessment.grade}</div>
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '0.5px solid var(--border)', marginBottom: '1.5rem' }} />

      {/* ── Stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: '2rem' }}>
        {[
          { label: 'Member federations', val: `${federation.n_member_federations}` },
          { label: 'Competitions / year', val: `${federation.n_competitions_per_year.toLocaleString()}+` },
          { label: 'Global fans', val: `${(federation.global_fans_millions / 1000).toFixed(1)}bn` },
          { label: 'Economic impact', val: `€${federation.economic_impact_bn_eur}bn` },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Pillar tabs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {pillars.map((p, i) => {
          const avg = Math.round(p.objectives.reduce((a, o) => a + o.score, 0) / (p.objectives.length || 1))
          return (
            <button key={p.id} onClick={() => setActiveIdx(i)} style={{
              background: 'var(--surface)', border: i === activeIdx ? `1.5px solid ${p.color}` : '0.5px solid var(--border)',
              borderRadius: 12, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
            }}>
              <div style={{ fontSize: 18, marginBottom: 6, color: p.color }}>{p.icon}</div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 12, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3, marginBottom: 8 }}>{p.name}</div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 22, fontWeight: 400, color: scoreColor(avg) }}>
                {avg}<span style={{ fontSize: 11, color: 'var(--text3)' }}>/100</span>
              </div>
              <Bar score={avg} color={p.color} />
              <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                {p.objectives[0]?.trend_note || ''}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Active pillar detail ── */}
      {activePillar && (
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 style={{ fontFamily: 'sans-serif', fontSize: 17, fontWeight: 500, color: 'var(--text)' }}>
                <span style={{ color: activePillar.color }}>{activePillar.icon}</span> {activePillar.name}
              </h2>
              <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{activePillar.description}</p>
            </div>
          </div>
          {activePillar.objectives.map((obj) => (
            <div key={obj.id} style={{ borderTop: '0.5px solid var(--border)', paddingTop: 14, paddingBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
                <div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{obj.name}</div>
                  <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 8 }}>{obj.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(obj.evidence || []).map((e: string) => (
                      <span key={e} style={{ fontFamily: 'sans-serif', fontSize: 11, background: 'var(--surface2)', color: 'var(--text2)', border: '0.5px solid var(--border)', borderRadius: 4, padding: '2px 8px' }}>{e}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 24, fontWeight: 400, color: scoreColor(obj.score) }}>{obj.score}</div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)' }}>IF avg: {obj.benchmark_score}</div>
                  <Bar score={obj.score} color={scoreColor(obj.score)} height={3} />
                  <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{obj.trend_note}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Radar chart ── */}
      <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Pillar performance vs IF benchmark</div>
        <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text2)', marginBottom: '1rem' }}>
          {abbr} {assessment.assessment_year} · ASOIF benchmark average
        </div>
        <div style={{ display: 'flex', gap: 20, marginBottom: '1rem' }}>
          {[{ label: abbr, color: '#378ADD' }, { label: 'IF benchmark avg', color: '#aaa', dash: true }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text2)' }}>
              <span style={{ display: 'inline-block', width: 20, height: 2, background: l.dash ? 'repeating-linear-gradient(90deg,#aaa 0,#aaa 4px,transparent 4px,transparent 8px)' : l.color }} />
              {l.label}
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'sans-serif', fill: 'var(--text2)' }} />
            <Radar name={abbr} dataKey={abbr} stroke="#378ADD" fill="#378ADD" fillOpacity={0.12} strokeWidth={2} dot={{ r: 4, fill: '#378ADD' }} />
            <Radar name="IF benchmark" dataKey="Benchmark" stroke="#aaa" fill="transparent" strokeWidth={1} strokeDasharray="4 3" dot={{ r: 3, fill: '#aaa' }} />
            <Tooltip formatter={(v: number) => [`${v}/100`]} contentStyle={{ fontFamily: 'sans-serif', fontSize: 12, background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 6 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Footer ── */}
      <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)', lineHeight: 1.7, borderTop: '0.5px solid var(--border)', paddingTop: 16 }}>
        <strong style={{ color: 'var(--text2)' }}>PRISM methodology</strong> scores International Federations across five dimensions using publicly available strategy documents, annual reports, IOC IF governance reviews, and sport federation benchmarks. Scores reflect documented commitments, institutional capacity, and measurable outputs as of Q1 2025.
        <br />
        Sources: {federation.name} strategy documents; {federation.name} Annual Report; IOC Basic Universal Principles of Good Governance; ASOIF IF Governance Review 2023; {federation.abbreviation}.org public data.
      </div>
    </div>
  )
}
