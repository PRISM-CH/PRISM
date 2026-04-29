'use client'
// scorecardclient.tsx  –  PRISM  v2

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Federation, Pillar, Objective, Assessment, ScorecardData } from '@/lib/types'

import ScorecardRadar from './ScorecardRadar'

// ─── Constants ────────────────────────────────────────────────────────────────

const FEDERATIONS = [
  'BWF', 'CIPS', 'CMAS', 'FAI', 'FEI', 'FIA', 'FIAS', 'FIB', 'FIBA', 'FIDE',
  'FIE', 'FIFA', 'FIH', 'FIK', 'FIL', 'FIM', 'FIP', 'FIPV', 'FIS', 'FISA',
  'FISO', 'FISU', 'FITA', 'FITEQ', 'FIVB', 'IBF', 'IBSF', 'IBU', 'ICC', 'ICF',
  'ICU', 'IDBF', 'IFA', 'IFAF', 'IFBB', 'IFF', 'IFI', 'IFMA', 'IFS', 'IFSC',
  'IGF', 'IHF', 'IIHF', 'IJF', 'IKF', 'ILSF', 'IOF', 'IPF', 'IRF', 'ISA',
  'ISMF', 'ISSF', 'ISTAF', 'ISU', 'ITF', 'ITTF', 'IWF', 'IWUF', 'IWWF', 'JJIF',
  'PADELFIP', 'RAFT', 'TRI', 'TWIF', 'UCI', 'UIAA', 'UIM', 'UIPM', 'UWW',
  'WA', 'WAF', 'WAKO', 'WAQ', 'WB', 'WBF', 'WBSC', 'WCBS', 'WCF', 'WDF',
  'WDSF', 'WFDF', 'WG', 'WKF', 'WL', 'WMF', 'WN', 'WPBF', 'WR', 'WS',
  'WSF', 'WSK', 'WT',
] as const
type FederationAbbr = typeof FEDERATIONS[number]
const DEFAULT_FED_IDX = 0

const PILLARS = [
  { slug: 'reach',          label: 'Reach & Engagement',       icon: '📡', color: '#00C9A7' },
  { slug: 'participation',  label: 'Participation & Growth',    icon: '🌍', color: '#60A5FA' },
  { slug: 'people',         label: 'People & Development',      icon: '👥', color: '#A78BFA' },
  { slug: 'partnerships',   label: 'Commercial & Partnerships', icon: '🤝', color: '#F59E0B' },
  { slug: 'sustainability', label: 'Sustainability',            icon: '♻️', color: '#34D399' },
  { slug: 'governance',     label: 'Governance & Integrity',    icon: '⚖️', color: '#F87171' },
] as const

const DATA_SOURCES: Record<string, string[]> = {
  reach:          ['IF Official Website', 'Social Media Analytics (public)', 'YouTube channel stats', 'World Games broadcast data'],
  participation:  ['IF Member Federation Register', 'World Athletics / IF annual reports', 'Event entry lists (public)', 'IOC Programme Documentation'],
  people:         ['WADA Compliance Status (public)', 'IF Statutes & By-Laws', 'Athlete Commission pages', 'Anti-doping public database'],
  partnerships:   ['IF Press Releases', 'Sponsorship announcements (public)', 'Annual Reports', 'Event commercial documentation'],
  sustainability: ['IF Sustainability Reports', 'IOC Sustainability Tracker', 'UN SDG alignment statements', 'Event environmental disclosures'],
  governance:     ['IOC Recognition Status Register', 'IF Ethics Commission Reports', 'CAS Jurisprudence (public)', 'IF Statutes (published)'],
}

// ─── Impact metadata ──────────────────────────────────────────────────────────
// impact_type describes *what* is at stake; impact_magnitude describes *how severely*

const IMPACT_TYPE: Record<string, { label: string; color: string; bg: string; icon: string; description: string }> = {
  olympic_position: { label: 'Olympic Position', color: '#00C9A7', bg: '#00C9A71A', icon: '🏅', description: 'Affects standing in the Olympic programme' },
  programme_risk:   { label: 'Programme Risk', color: '#EF4444', bg: '#EF44441A', icon: '⚠️', description: 'Risk to Olympic programme' },
  ioc_funding:      { label: 'IOC Funding',       color: '#F59E0B', bg: '#F59E0B1A', icon: '💰', description: 'Affects IOC solidarity or financial support' },
  sponsorship:      { label: 'Sponsorship',       color: '#A78BFA', bg: '#A78BFA1A', icon: '📈', description: 'Affects commercial revenue potential' },
  governance:       { label: 'Governance',        color: '#60A5FA', bg: '#60A5FA1A', icon: '🏛️', description: 'Affects governance standing or compliance' },
}

const IMPACT_MAGNITUDE: Record<string, { label: string; color: string; dot: string; description: string }> = {
  critical: { label: 'Critical impact', color: '#EF4444', dot: '#EF4444', description: 'Immediate action required' },
  high:     { label: 'High impact',     color: '#F59E0B', dot: '#F59E0B', description: 'Address within current cycle' },
  medium:   { label: 'Medium impact',   color: '#60A5FA', dot: '#60A5FA', description: 'Plan for next cycle' },
  low:      { label: 'Low impact',      color: '#6B7FA3', dot: '#6B7FA3', description: 'Monitor and review' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PillarRank {
  pillar_slug: string
  pillar_group_rank: number
  pillar_group_size: number
  pillar_global_rank: number
  pillar_score: number
}

interface FederationRanking {
  federation_id: string
  group_rank: number
  group_size: number
  global_rank: number
  total_ifs: number
  pillar_ranks: PillarRank[]
}

interface Recommendation {
  id: string
  action: string
  rationale: string | null
  kpi: string | null
  deadline: string | null
  impact_type: string
  impact_magnitude: string
  display_order: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 80) return '#00C9A7'
  if (s >= 70) return '#60A5FA'
  if (s >= 60) return '#F59E0B'
  return '#EF4444'
}

function gradeColor(grade = '') {
  if (grade.startsWith('A')) return '#00C9A7'
  if (grade.startsWith('B')) return '#60A5FA'
  if (grade.startsWith('C')) return '#F59E0B'
  return '#EF4444'
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

function ScoreBar({ score, color, height = 4 }: { score: number; color: string; height?: number }) {
  return (
    <div style={{ background: '#1A2744', borderRadius: 3, height, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, score)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function RankBadge({ rank, total, color = '#00C9A7', size = 'md' }: { rank: number; total: number; color?: string; size?: 'sm' | 'md' }) {
  const small = size === 'sm'
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      background: `${color}15`, border: `1px solid ${color}40`,
      borderRadius: 8, padding: small ? '4px 8px' : '8px 14px',
      minWidth: small ? 56 : 72,
    }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: small ? 14 : 20, color, lineHeight: 1 }}>
        #{rank}
      </span>
      <span style={{ fontSize: small ? 9 : 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace' }}>
        of {total}
      </span>
    </div>
  )
}

function GradeBadge({ grade }: { grade: string }) {
  const color = gradeColor(grade)
  return (
    <span style={{
      background: `${color}20`, color, border: `1px solid ${color}50`,
      borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 700,
      fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1,
    }}>{grade}</span>
  )
}

// Impact area badge — what is at stake
function ImpactAreaBadge({ type }: { type: string }) {
  const imp = IMPACT_TYPE[type] ?? IMPACT_TYPE.governance
  return (
    <span style={{
      background: imp.bg, color: imp.color, border: `1px solid ${imp.color}40`,
      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {imp.icon} {imp.label}
    </span>
  )
}

// Impact magnitude badge — how severely
function ImpactMagnitudeBadge({ magnitude }: { magnitude: string }) {
  const mag = IMPACT_MAGNITUDE[magnitude] ?? IMPACT_MAGNITUDE.medium
  return (
    <span style={{
      background: `${mag.dot}15`, color: mag.color,
      borderRadius: 20, padding: '3px 8px', fontSize: 10, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: mag.dot, display: 'inline-block', flexShrink: 0 }} />
      {mag.label}
    </span>
  )
}

function LoadingState() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '4rem 1.25rem' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
      <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)', textAlign: 'center', marginBottom: '2rem' }}>
        Loading scorecard…
      </div>
      {[80, 120, 200].map((h, i) => (
        <div key={i} style={{
          background: 'var(--surface2)', borderRadius: 12, height: h,
          marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
}

// ─── Federation Carousel ──────────────────────────────────────────────────────

function FederationCarousel({ index, onNavigate }: { index: number; onNavigate: (next: number) => void }) {
  const go = useCallback((dir: 'left' | 'right') => {
    const next = dir === 'right'
      ? (index + 1) % FEDERATIONS.length
      : (index - 1 + FEDERATIONS.length) % FEDERATIONS.length
    onNavigate(next)
  }, [index, onNavigate])

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 0,
      background: 'var(--surface)', border: '0.5px solid var(--border)',
      borderRadius: 10, overflow: 'hidden', userSelect: 'none',
    }}>
      <CarouselArrow dir="left" onClick={() => go('left')} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 20px', minWidth: 96 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {FEDERATIONS.map((fed, i) => (
            <button key={fed} aria-label={fed} onClick={() => onNavigate(i)} style={{
              width: 6, height: 6, borderRadius: '50%', border: 'none', padding: 0,
              background: i === index ? 'var(--text)' : 'var(--border)',
              transform: i === index ? 'scale(1.35)' : 'scale(1)',
              transition: 'background 0.2s, transform 0.2s', cursor: 'pointer',
            }} />
          ))}
        </div>
        <div style={{
          fontFamily: 'sans-serif', fontSize: 15, fontWeight: 700,
          letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1,
          minWidth: '4ch', textAlign: 'center',
        }}>
          {FEDERATIONS[index]}
        </div>
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
    <button onClick={onClick} aria-label={dir === 'left' ? 'Previous federation' : 'Next federation'} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 36, height: 36, background: 'var(--surface)', border: 'none',
      borderRight: dir === 'left' ? '0.5px solid var(--border)' : 'none',
      borderLeft: dir === 'right' ? '0.5px solid var(--border)' : 'none',
      color: 'var(--text)', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s',
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

// ─── Impact legend strip ───────────────────────────────────────────────────────
// Shown once above the recommendations panel so users understand the two axes

function ImpactLegend() {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start',
      padding: '10px 14px', background: 'var(--surface2)',
      borderRadius: 8, marginBottom: 14,
      fontSize: 10, color: 'var(--text3)', lineHeight: 1.5,
    }}>
      <div>
        <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
          Impact area — what is at stake
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.entries(IMPACT_TYPE).map(([key, val]) => (
            <span key={key} style={{
              background: val.bg, color: val.color, border: `1px solid ${val.color}40`,
              borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              {val.icon} {val.label}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
          Impact severity — how urgently to act
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.entries(IMPACT_MAGNITUDE).map(([key, val]) => (
            <span key={key} style={{
              background: `${val.dot}15`, color: val.color,
              borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: val.dot, display: 'inline-block' }} />
              {val.description}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScorecardClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // ── Fix 1: lazy-initialise from URL so the correct federation loads on the
  //    very first render — no useState(DEFAULT_FED_IDX) that always starts at BWF.
  const [fedIdx, setFedIdx] = useState<number>(() => {
    const fedParam = searchParams.get('fed')
    if (fedParam) {
      const idx = FEDERATIONS.indexOf(fedParam as FederationAbbr)
      if (idx !== -1) return idx
    }
    return DEFAULT_FED_IDX
  })

  const [data, setData] = useState<ScorecardData | null>(null)
  const [ranking, setRanking] = useState<FederationRanking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [activePillarSlug, setActivePillarSlug] = useState<string>(PILLARS[0].slug)
  const [recs, setRecs] = useState<Recommendation[]>([])

  // Sync URL param → state (handles browser back/forward navigation)
  useEffect(() => {
    const fedParam = searchParams.get('fed')
    if (!fedParam) return
    const idx = FEDERATIONS.indexOf(fedParam as FederationAbbr)
    if (idx !== -1 && idx !== fedIdx) setFedIdx(idx)
  }, [searchParams])

  // Re-fetch whenever selected federation changes
  useEffect(() => {
    const abbr: FederationAbbr = FEDERATIONS[fedIdx]

    // ── Fix 2: AbortController so a stale fetch (e.g. the initial BWF request
    //    if the URL pointed to UCI) cannot overwrite the data we actually want.
    const controller = new AbortController()
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setData(null)
      setRanking(null)
      setRecs([])
      setActiveIdx(0)
      setActivePillarSlug(PILLARS[0].slug)

      try {
        const { data: fedRows, error: fedErr } = await supabase
          .from('federations').select('*').eq('abbreviation', abbr).limit(1)
        if (cancelled) return
        if (fedErr) throw new Error(fedErr.message)
        const federation = fedRows?.[0] as Federation | undefined
        if (!federation) throw new Error(`No data found for ${abbr}`)

        const [pillarsRaw, assessmentRows, rankingRows] = await Promise.all([
          supabase.from('pillars').select('*').eq('federation_id', federation.id).order('display_order'),
          supabase.from('assessments').select('*').eq('federation_id', federation.id)
            .order('assessment_year', { ascending: false }).limit(1),
          supabase.from('federation_rankings').select(
            'federation_id,group_rank,group_size,global_rank,total_ifs,pillar_ranks'
          ).eq('federation_id', federation.id).limit(1),
        ])

        if (cancelled) return
        if (pillarsRaw.error) throw new Error(pillarsRaw.error.message)
        if (assessmentRows.error) throw new Error(assessmentRows.error.message)

        const pillarsWithObj: Pillar[] = await Promise.all(
          (pillarsRaw.data || []).map(async (p) => {
            const { data: objectives } = await supabase
              .from('objectives').select('*').eq('pillar_id', p.id).order('display_order')
            return { ...p, objectives: objectives || [] }
          })
        )

        if (cancelled) return
        const assessment = assessmentRows.data?.[0] as Assessment | undefined
        if (!assessment) throw new Error(`No assessment found for ${abbr}`)

        setData({ federation, pillars: pillarsWithObj, assessment })
        if (rankingRows.data?.[0]) setRanking(rankingRows.data[0] as FederationRanking)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    // Cleanup: mark any in-flight requests for this federation as stale
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [fedIdx])

  // Load recommendations whenever pillar tab changes
  useEffect(() => {
    if (!data?.federation?.id || !activePillarSlug) return
    setRecs([])
    supabase
      .from('recommendations')
      .select('*')
      .eq('federation_id', data.federation.id)
      .eq('pillar_slug', activePillarSlug)
      .order('display_order')
      .then(({ data: rows }) => {
        if (rows) setRecs(rows as Recommendation[])
      })
  }, [data?.federation?.id, activePillarSlug])

  const navigateFederation = (next: number) => {
    const abbr = FEDERATIONS[next]
    setFedIdx(next)
    router.replace(`/?fed=${abbr}`, { scroll: false })
  }

  const carousel = <FederationCarousel index={fedIdx} onNavigate={navigateFederation} />

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
  const activePillarMeta = PILLARS.find(p => p.slug === activePillarSlug)
  const activePillarData = pillars.find(p => p.slug === activePillarSlug)
  const activePillarRank = ranking?.pillar_ranks?.find(pr => pr.pillar_slug === activePillarSlug)
  const overallScore = Math.round(assessment.overall_score)
  const abbr = federation.abbreviation
  const groupColor = '#00C9A7'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem 4rem', fontFamily: 'sans-serif' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
          PRISM · {assessment.assessment_year} · {assessment.methodology_version}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 8 }}>{carousel}</div>
            <h1 style={{ fontSize: 28, fontWeight: 400, lineHeight: 1.2, color: 'var(--text)' }}>
              {federation.name}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
              {federation.sport} · Founded {federation.founding_year} · {federation.hq_country}
              {federation.ioc_recognized && ' · IOC-recognised'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 48, fontWeight: 300, lineHeight: 1, color: scoreColor(overallScore) }}>
                <AnimatedNumber target={overallScore} />
                <span style={{ fontSize: 20, color: 'var(--text3)', fontWeight: 400 }}>/100</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                <GradeBadge grade={assessment.grade} />
              </div>
            </div>
            {ranking && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Group Rank
                  </div>
                  <RankBadge rank={ranking.group_rank} total={ranking.group_size} color={groupColor} size="sm" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Global Rank
                  </div>
                  <RankBadge rank={ranking.global_rank} total={ranking.total_ifs} color="var(--text3)" size="sm" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '0.5px solid var(--border)', marginBottom: '1.5rem' }} />

      {/* ── Stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: '2rem' }}>
        {[
          { label: 'Member federations', val: federation.n_member_federations != null ? `${federation.n_member_federations}` : '—' },
          { label: 'Competitions / year', val: federation.n_competitions_per_year != null ? `${federation.n_competitions_per_year.toLocaleString()}+` : '—' },
          { label: 'Global fans', val: federation.global_fans_millions != null ? `${(federation.global_fans_millions / 1000).toFixed(1)}bn` : '—' },
          { label: 'Economic impact', val: federation.economic_impact_bn_eur != null ? `€${federation.economic_impact_bn_eur}bn` : '—' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Pillar grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {PILLARS.map((pMeta, i) => {
          const pData = pillars.find(p => p.slug === pMeta.slug)
          const pRank = ranking?.pillar_ranks?.find(pr => pr.pillar_slug === pMeta.slug)
          const pScore = pRank?.pillar_score ?? Math.round(
            (pData?.objectives ?? []).reduce((a, o) => a + o.score, 0) / ((pData?.objectives?.length) || 1)
          )
          const isActive = activePillarSlug === pMeta.slug
          const objs = [...(pData?.objectives ?? [])].sort((a, b) => b.score - a.score)
          const topObj = objs[0]
          const botObj = objs[objs.length - 1]

          return (
            <button key={pMeta.slug} onClick={() => { setActivePillarSlug(pMeta.slug); setActiveIdx(i) }} style={{
              background: isActive ? `${pMeta.color}12` : 'var(--surface)',
              border: `1px solid ${isActive ? pMeta.color : 'var(--border)'}`,
              borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = pMeta.color }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 16 }}>{pMeta.icon}</span>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? pMeta.color : 'var(--text)', marginTop: 4, lineHeight: 1.2 }}>
                    {pMeta.label}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 20, color: pMeta.color }}>{pScore}</div>
                  {pRank && (
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                      #{pRank.pillar_group_rank}<span style={{ opacity: 0.5 }}>/{pRank.pillar_group_size}</span>
                    </div>
                  )}
                </div>
              </div>
              <ScoreBar score={pScore} color={pMeta.color} height={4} />
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {topObj && (
                  <div style={{ fontSize: 10, color: '#00C9A7', display: 'flex', justifyContent: 'space-between' }}>
                    <span>▲ {topObj.name.length > 22 ? topObj.name.slice(0, 22) + '…' : topObj.name}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{topObj.score}</span>
                  </div>
                )}
                {botObj && botObj !== topObj && (
                  <div style={{ fontSize: 10, color: '#F87171', display: 'flex', justifyContent: 'space-between' }}>
                    <span>▼ {botObj.name.length > 22 ? botObj.name.slice(0, 22) + '…' : botObj.name}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{botObj.score}</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Active pillar detail + Impact-ranked recommendations side-by-side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, marginBottom: '1.5rem' }}>

        {/* Objectives panel */}
        {activePillarData && activePillarMeta && (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>{activePillarMeta.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{activePillarMeta.label}</div>
                {activePillarRank && (
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                    Group rank:{' '}
                    <span style={{ color: activePillarMeta.color, fontWeight: 700 }}>
                      #{activePillarRank.pillar_group_rank}/{activePillarRank.pillar_group_size}
                    </span>
                    <span style={{ marginLeft: 6 }}>
                      Global: #{activePillarRank.pillar_global_rank}/{ranking?.total_ifs ?? '—'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...(activePillarData.objectives ?? [])].sort((a, b) => b.score - a.score).map(obj => (
                <div key={obj.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', flex: 1, paddingRight: 8 }}>{obj.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: scoreColor(obj.score) }}>
                      {obj.score}
                    </span>
                  </div>
                  <ScoreBar score={obj.score} color={scoreColor(obj.score)} height={3} />
                  {obj.trend_note && (
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{obj.trend_note}</div>
                  )}
                  {(obj.evidence ?? []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {(obj.evidence as string[]).map((e: string) => (
                        <span key={e} style={{
                          fontSize: 10, background: 'var(--surface2)', color: 'var(--text3)',
                          border: '0.5px solid var(--border)', borderRadius: 4, padding: '1px 6px',
                        }}>{e}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Data Sources */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Data Sources
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {(DATA_SOURCES[activePillarSlug] ?? []).map(src => (
                  <span key={src} style={{
                    background: 'var(--surface2)', border: '0.5px solid var(--border)',
                    borderRadius: 4, padding: '3px 8px', fontSize: 9, color: 'var(--text3)',
                  }}>{src}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Impact-ranked recommendations panel ── */}
        {activePillarMeta && (
          <div style={{ background: 'var(--surface)', border: `0.5px solid ${activePillarMeta.color}40`, borderRadius: 12, padding: 20 }}>

            {/* Panel header */}
            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `0.5px solid ${activePillarMeta.color}25` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15 }}>{activePillarMeta.icon}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {activePillarMeta.label} — Impact-ranked actions
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>
                Each action is assessed by <strong style={{ color: 'var(--text2)', fontWeight: 600 }}>what it impacts</strong> (Olympic position, funding, governance…) and <strong style={{ color: 'var(--text2)', fontWeight: 600 }}>how severely</strong> (critical → low).
              </div>
            </div>

            {/* Impact legend — shown once per panel */}
            <ImpactLegend />

            {recs.length === 0 && (
              <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>No impact-ranked actions yet for this pillar.</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recs.map((rec, i) => {
                const imp = IMPACT_TYPE[rec.impact_type] ?? IMPACT_TYPE.governance
                const mag = IMPACT_MAGNITUDE[rec.impact_magnitude] ?? IMPACT_MAGNITUDE.medium
                return (
                  <div key={rec.id ?? i} style={{
                    background: `${imp.color}08`,
                    border: `1px solid ${imp.color}25`,
                    borderRadius: 10,
                    padding: 16,
                    // Left border color encodes severity so it's immediately scannable
                    borderLeft: `3px solid ${mag.dot}`,
                  }}>
                    {/* Impact badges first — what's at stake and how urgently */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      <ImpactAreaBadge type={rec.impact_type} />
                      <ImpactMagnitudeBadge magnitude={rec.impact_magnitude} />
                    </div>

                    {/* Action headline */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 8 }}>
                      <span style={{ color: imp.color, fontFamily: 'monospace', fontSize: 11, marginRight: 6 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {rec.action}
                    </div>

                    {/* Rationale — why this action has the stated impact */}
                    {rec.rationale && (
                      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 10 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', display: 'block', marginBottom: 3 }}>
                          Why this matters
                        </span>
                        {rec.rationale}
                      </div>
                    )}

                    {/* KPI + deadline */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {rec.kpi && (
                        <div style={{
                          background: 'var(--surface2)', border: '0.5px solid var(--border)',
                          borderRadius: 6, padding: '6px 10px', fontSize: 10, color: 'var(--text3)', flex: 1,
                        }}>
                          <span style={{ display: 'block', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2, color: 'var(--text3)' }}>
                            How impact is measured (KPI)
                          </span>
                          {rec.kpi}
                        </div>
                      )}
                      {rec.deadline && (
                        <div style={{
                          background: 'var(--surface2)', border: `1px solid ${mag.dot}40`,
                          borderRadius: 6, padding: '6px 10px', fontSize: 10,
                          color: mag.color, display: 'flex', flexDirection: 'column', minWidth: 80,
                        }}>
                          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2, opacity: 0.6 }}>
                            Deadline
                          </span>
                          {rec.deadline}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Radar chart ── */}
      {federation.if_group && (
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
            Pillar performance vs IF benchmark
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1rem' }}>
            {abbr} {assessment.assessment_year} · Benchmarked vs Olympic IFs – Paris 2024
          </div>
          <ScorecardRadar
            federationId={federation.id}
            federationAbbr={federation.abbreviation}
            ifGroup={federation.if_group}
          />
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7, borderTop: '0.5px solid var(--border)', paddingTop: 16, marginTop: '1.5rem' }}>
        <strong style={{ color: 'var(--text2)' }}>PRISM methodology</strong> scores International Federations across six dimensions using publicly available strategy documents, annual reports, IOC IF governance reviews, and sport federation benchmarks. Scores reflect documented commitments, institutional capacity, and measurable outputs as of Q1 2025.
        <br />
        Sources: {federation.name} strategy documents; {federation.name} Annual Report; IOC Basic Universal Principles of Good Governance; ASOIF IF Governance Review 2023; {federation.abbreviation}.org public data.
      </div>
    </div>
  )
}
