'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

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
const DEFAULT_FED_IDX = 4 // FEI (your comment was wrong before)

// ─── Types (unchanged) ────────────────────────────────────────────────────────
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

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 80) return '#2d7d46'
  if (s >= 70) return '#1a6fa8'
  if (s >= 60) return '#a06010'
  return '#b83030'
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScorecardClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [fedIdx, setFedIdx] = useState(DEFAULT_FED_IDX)
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // ✅ READ ?fed= FROM URL
  useEffect(() => {
    const fedParam = searchParams.get('fed')
    if (!fedParam) return

    const idx = FEDERATIONS.findIndex(
      f => f.toLowerCase() === fedParam.toLowerCase()
    )

    if (idx !== -1 && idx !== fedIdx) {
      setFedIdx(idx)
    }
  }, [searchParams]) // intentionally NOT depending on fedIdx

  // ✅ UPDATE URL WHEN USER CHANGES FEDERATION
  const navigateFederation = useCallback((nextIdx: number) => {
    setFedIdx(nextIdx)

    const abbr = FEDERATIONS[nextIdx]
    const params = new URLSearchParams(searchParams.toString())
    params.set('fed', abbr)

    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

  // ─── DATA FETCH (unchanged logic) ───────────────────────────────────────────
  useEffect(() => {
    const abbr: FederationAbbr = FEDERATIONS[fedIdx]

    async function load() {
      setLoading(true)
      setError(null)
      setData(null)
      setActiveIdx(0)

      try {
        const { data: fedRows, error: fedErr } = await supabase
          .from('federations')
          .select('*')
          .eq('abbreviation', abbr)
          .limit(1)

        if (fedErr) throw new Error(fedErr.message)
        const federation = fedRows?.[0]
        if (!federation) throw new Error(`No data found for ${abbr}`)

        const { data: pillarsRaw, error: pilErr } = await supabase
          .from('pillars')
          .select('*')
          .eq('federation_id', federation.id)
          .order('display_order')

        if (pilErr) throw new Error(pilErr.message)

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

        const { data: assessmentRows, error: assErr } = await supabase
          .from('assessments')
          .select('*')
          .eq('federation_id', federation.id)
          .order('assessment_year', { ascending: false })
          .limit(1)

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

  // ─── RENDER ────────────────────────────────────────────────────────────────

  const carousel = (
    <FederationCarousel index={fedIdx} onNavigate={navigateFederation} />
  )

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>{carousel}</div>
      <div>Loading…</div>
    </div>
  )

  if (error || !data) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>{carousel}</div>
      <div>Error — {error}</div>
    </div>
  )

  const { federation, pillars, assessment } = data
  const abbr = federation.abbreviation

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <div style={{ marginBottom: 20 }}>{carousel}</div>
      <h1>{federation.name}</h1>
      <div>{abbr} · Score {Math.round(assessment.overall_score)}</div>
    </div>
  )
}
