'use client'
// scorecardclient.tsx  –  PRISM  v2
// Adapted to use:
//   • federation_rankings view  (group_rank, global_rank, pillar_ranks JSONB)
//   • recommendations table     (SMART records per pillar)
//   • DATA_SOURCES lookup        (per-pillar, client-side)
//   • generate-recommendations  Edge Function

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Federation, Pillar, Objective, Assessment, ScorecardData } from '@/lib/types'

import ScorecardRadar from './ScorecardRadar'
import PillarInsights from './PillarInsights'

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

// Pillar metadata — slugs must match DB values
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

// impact_type → display metadata
const IMPACT: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  olympic_position: { label: 'Olympic Position', color: '#00C9A7', bg: '#00C9A71A', icon: '🏅' },
  exclusion_risk:   { label: 'Exclusion Risk',   color: '#EF4444', bg: '#EF44441A', icon: '⚠️' },
  ioc_funding:      { label: 'IOC Funding',       color: '#F59E0B', bg: '#F59E0B1A', icon: '💰' },
  sponsorship:      { label: 'Sponsorship',       color: '#A78BFA', bg: '#A78BFA1A', icon: '📈' },
  governance:       { label: 'Governance',        color: '#60A5FA', bg: '#60A5FA1A', icon: '🏛️' },
}

const MAGNITUDE: Record<string, { label: string; color: string; dot: string }> = {
  critical: { label: 'Critical', color: '#EF4444', dot: '#EF4444' },
  high:     { label: 'High',     color: '#F59E0B', dot: '#F59E0B' },
  medium:   { label: 'Medium',   color: '#60A5FA', dot: '#60A5FA' },
  low:      { label: 'Low',      color: '#6B7FA3', dot: '#6B7FA3' },
}

// ─── Types for new DB objects ─────────────────────────────────────────────────

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

function ImpactBadge({ type, magnitude }: { type: string; magnitude: string }) {
  const imp = IMPACT[type] ?? IMPACT.governance
  const mag = MAGNITUDE[magnitude] ?? MAGNITUDE.medium
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        background: imp.bg, color: imp.color, border: `1px solid ${imp.color}40`,
        borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {imp.icon} {imp.label}
      </span>
      <span style={{
        background: `${mag.dot}15`, color: mag.color,
        borderRadius: 20, padding: '3px 8px', fontSize: 10, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 3,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: mag.dot, display: 'inline-block' }} />
        {mag.label}
      </span>
    </div>
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScorecardClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [fedIdx, setFedIdx] = useState(DEFAULT_FED_IDX)
  const [data, setData] = useState<ScorecardData | null>(null)
  const [ranking, setRanking] = useState<FederationRanking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [activePillarSlug, setActivePillarSlug] = useState<string>(PILLARS[0].slug)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [recsLoading, setRecsLoading] = useState(false)

  // Sync URL param → state
  useEffect(() => {
    const fedParam = searchParams.get('fed')
    if (!fedParam) return
    const idx = FEDERATIONS.indexOf(fedParam as FederationAbbr)
    if (idx !== -1 && idx !== fedIdx) setFedIdx(idx)
  }, [searchParams])

  // Re-fetch whenever selected federation changes
  useEffect(() => {
    const abbr: FederationAbbr = FEDERATIONS[fedIdx]

    async function load() {
      setLoading(true)
      setError(null)
      setData(null)
      setRanking(null)
      setRecs([])
      setActiveIdx(0)
      setActivePillarSlug(PILLARS[0].slug)

      try {
        // Fetch federation row
        const { data: fedRows, error: fedErr } = await supabase
          .from('federations').select('*').eq('abbreviation', abbr).limit(1)
        if (fedErr) throw new Error(fedErr.message)
        const federation = fedRows?.[0] as Federation | undefined
        if (!federation) throw new Error(`No data found for ${abbr}`)

        // Fetch all in parallel: pillars+objectives, assessment, rankings
        const [pillarsRaw, assessmentRows, rankingRows] = await Promise.all([
          supabase.from('pillars').select('*').eq('federation_id', federation.id).order('display_order'),
          supabase.from('assessments').select('*').eq('federation_id', federation.id)
            .order('assessment_year', { ascending: false }).limit(1),
          supabase.from('federation_rankings').select(
            'federation_id,group_rank,group_size,global_rank,total_ifs,pillar_ranks'
          ).eq('federation_id', federation.id).limit(1),
        ])

        if (pillarsRaw.error) throw new Error(pillarsRaw.error.message)
        if (assessmentRows.error) throw new Error(assessmentRows.error.message)

        // Enrich pillars with objectives
        const pillarsWithObj: Pillar[] = await Promise.all(
          (pillarsRaw.data || []).map(async (p) => {
            const { data: objectives } = await supabase
              .from('objectives').select('*').eq('pillar_id', p.id).order('display_order')
            return { ...p, objectives: objectives || [] }
          })
        )

        const assessment = assessmentRows.data?.[0] as Assessment | undefined
        if (!assessment) throw new Error(`No assessment found for ${abbr}`)

        setData({ federation, pillars: pillarsWithObj, assessment })
        if (rankingRows.data?.[0]) setRanking(rankingRows.data[0] as FederationRanking)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    load()
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

  // Generate / regenerate SMART recommendations via Edge Function
  const generateRecs = useCallback(async () => {
    if (!data?.federation?.id || !activePillarSlug) return
    setRecsLoading(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-recommendations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            federation_id: data.federation.id,
            pillar_slug: activePillarSlug,
            force_regenerate: true,
          }),
        }
      )
      const json = await res.json()
      if (json.recommendations) setRecs(json.recommendations as Recommendation[])
    } catch (e) {
      console.error('generate-recommendations error', e)
    }
    setRecsLoading(false)
  }, [data?.federation?.id, activePillarSlug])

  const carousel = <FederationCarousel index={fedIdx} onNavigate={navigateFederation} />

  // ── Loading / error states ────────────────────────────────────────────────

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
  const activePillarMeta = PILLARS.find(p => p.slug === activePillarSlug)
  const activePillarData = pillars.find(p => p.slug === activePillarSlug)
  const activePillarRank = ranking?.pillar_ranks?.find(pr => pr.pillar_slug === activePillarSlug)
  const overallScore = Math.round(assessment.overall_score)
  const abbr = federation.abbreviation
  const groupColor = '#00C9A7' // fallback; ideally map from if_group

  // ── Render ────────────────────────────────────────────────────────────────

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

          {/* Score + rank badges */}
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

      {/* ── Pillar grid (click to switch active pillar) ── */}
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

      {/* ── Active pillar detail + Recommendations side-by-side ── */}
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
                  {/* evidence tags (from existing field) */}
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

        {/* Recommendations panel */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Strategic Recommendations</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Specific · Measurable · Time-bound</div>
            </div>
            <button onClick={generateRecs} disabled={recsLoading} style={{
              background: recsLoading ? 'var(--surface2)' : 'rgba(0,201,167,0.12)',
              border: '1px solid rgba(0,201,167,0.4)', borderRadius: 8,
              color: '#00C9A7', cursor: recsLoading ? 'wait' : 'pointer',
              padding: '6px 14px', fontSize: 11, fontWeight: 600,
            }}>
              {recsLoading ? 'Generating…' : recs.length > 0 ? '↻ Regenerate' : 'Generate →'}
            </button>
          </div>

          {recs.length === 0 && !recsLoading && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🎯</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>No recommendations yet for this pillar.</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, opacity: 0.7 }}>
                Click "Generate →" for AI-powered SMART recommendations with impact classification.
              </div>
            </div>
          )}

          {recsLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ background: 'var(--surface2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 16, animation: 'pulse 1.5s infinite' }}>
                  <div style={{ height: 12, background: 'var(--border)', borderRadius: 4, width: '60%', marginBottom: 8 }} />
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, width: '90%', marginBottom: 4 }} />
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, width: '75%' }} />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recs.map((rec, i) => {
              const imp = IMPACT[rec.impact_type] ?? IMPACT.governance
              const mag = MAGNITUDE[rec.impact_magnitude] ?? MAGNITUDE.medium
              return (
                <div key={rec.id ?? i} style={{
                  background: `${imp.color}08`, border: `1px solid ${imp.color}25`,
                  borderRadius: 10, padding: 16, borderLeft: `3px solid ${mag.dot}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 10 }}>
                    <span style={{ color: imp.color, fontFamily: 'monospace', fontSize: 11, marginRight: 6 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {rec.action}
                  </div>
                  <ImpactBadge type={rec.impact_type} magnitude={rec.impact_magnitude} />
                  {rec.rationale && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 10, lineHeight: 1.5 }}>
                      {rec.rationale}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    {rec.kpi && (
                      <div style={{
                        background: 'var(--surface2)', border: '0.5px solid var(--border)',
                        borderRadius: 6, padding: '6px 10px', fontSize: 10, color: 'var(--text3)', flex: 1,
                      }}>
                        <span style={{ display: 'block', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2, color: 'var(--text3)' }}>KPI</span>
                        {rec.kpi}
                      </div>
                    )}
                    {rec.deadline && (
                      <div style={{
                        background: 'var(--surface2)', border: `1px solid ${mag.dot}40`,
                        borderRadius: 6, padding: '6px 10px', fontSize: 10,
                        color: mag.color, display: 'flex', flexDirection: 'column', minWidth: 80,
                      }}>
                        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2, opacity: 0.6 }}>Deadline</span>
                        {rec.deadline}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
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

      {/* ── Pillar Insights (legacy cached AI, shown only when no recs table data) ── */}
      {federation.if_group && (
        <PillarInsights
          federationId={federation.id}
          federationName={federation.name}
          federationAbbr={federation.abbreviation}
          ifGroup={federation.if_group}
        />
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