'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

import ScorecardRadar from './ScorecardRadar'
import PillarInsights from './PillarInsights'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Federation carousel config ───────────────────────────────────────────────
const FEDERATIONS = [
  'BWF','CIPS','CMAS','FAI','FEI','FIA','FIAS','FIB','FIBA','FIDE',
  'FIE','FIFA','FIH','FIK','FIL','FIM','FIP','FIPV','FIS','FISA',
  'FISO','FISU','FITA','FITEQ','FIVB','IBF','IBSF','IBU','ICC','ICF',
  'ICU','IDBF','IFA','IFAF','IFBB','IFF','IFI','IFMA','IFS','IFSC',
  'IGF','IHF','IIHF','IJF','IKF','ILSF','IOF','IPF','IRF','ISA',
  'ISMF','ISSF','ISTAF','ISU','ITF','ITTF','IWF','IWUF','IWWF','JJIF',
  'PADELFIP','RAFT','TRI','TWIF','UCI','UIAA','UIM','UIPM','UWW',
  'WA','WAF','WAKO','WAQ','WB','WBF','WBSC','WCBS','WCF','WDF',
  'WDSF','WFDF','WG','WKF','WL','WMF','WN','WPBF','WR','WS',
  'WSF','WSK','WT',
] as const

type FederationAbbr = typeof FEDERATIONS[number]
const DEFAULT_FED_IDX = 0

// ─── Types (unchanged) ───────────────────────────────────────────────────────
type Federation = { id: string; name: string; abbreviation: string; hq_country: string; founding_year: number; ioc_recognized: boolean; sport: string; n_member_federations: number; n_competitions_per_year: number; global_fans_millions: number; economic_impact_bn_eur: number }
type Objective = { id: string; pillar_id: string; name: string; description: string; score: number; benchmark_score: number; trend_note: string; evidence: string[]; display_order: number }
type Pillar = { id: string; name: string; slug: string; description: string; icon: string; color: string; display_order: number; objectives: Objective[] }
type Assessment = { overall_score: number; grade: string; assessment_year: number; methodology_version: string }
type ScorecardData = { federation: Federation; pillars: Pillar[]; assessment: Assessment }

// ─── Helpers (unchanged) ─────────────────────────────────────────────────────
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ScorecardClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [fedIdx, setFedIdx] = useState(DEFAULT_FED_IDX)
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const fedParam = searchParams.get('fed')
    if (!fedParam) return
    const idx = FEDERATIONS.indexOf(fedParam as FederationAbbr)
    if (idx !== -1) setFedIdx(idx)
  }, [searchParams])

  useEffect(() => {
    const abbr: FederationAbbr = FEDERATIONS[fedIdx]

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
        if (!federation) throw new Error(`No data found for ${abbr}`)

        const { data: pillarsRaw } = await supabase
          .from('pillars')
          .select('*')
          .eq('federation_id', federation.id)
          .order('display_order')

        const pillarsWithObj: Pillar[] = await Promise.all(
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

        setData({ federation, pillars: pillarsWithObj, assessment })
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [fedIdx])

  const navigateFederation = (next: number) => {
    const abbr = FEDERATIONS[next]
    setFedIdx(next)
    router.replace(`/?fed=${abbr}`, { scroll: false })
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading…</div>
  if (error || !data) return <div style={{ padding: '2rem' }}>Error: {error}</div>

  const { federation, pillars, assessment } = data
  const activePillar = pillars[activeIdx]

  const overallScore = Math.round(assessment.overall_score)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

      {/* ── HEADER ── */}
      <h1 style={{ fontSize: 28 }}>{federation.name}</h1>

      {/* ── MAIN STATS ── */}
      <div style={{ fontSize: 48 }}>
        <AnimatedNumber target={overallScore} />/100
      </div>

      {/* ── RADAR (REPLACED) ── */}
      <div style={{ marginTop: 24 }}>
        <ScorecardRadar
          federation={federation}
          pillars={pillars}
          assessment={assessment}
        />
      </div>

      {/* ── PILLAR INSIGHTS (NEW) ── */}
      <div style={{ marginTop: 24 }}>
        <PillarInsights pillar={activePillar} />
      </div>

    </div>
  )
}
