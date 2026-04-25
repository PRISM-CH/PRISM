'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
// ✅ Use shared singleton — never call createClient() in a component
import { supabase } from '@/lib/supabase'
// ✅ Import all types from canonical location — never redefine locally
import type { Federation, Pillar, Objective, Assessment, ScorecardData } from '@/lib/types'

import ScorecardRadar from './ScorecardRadar'
import PillarInsights from './PillarInsights'

// ── Federation carousel config ────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────────
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

        const federation = fedRows?.[0] as Federation | undefined
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

        const assessment = assessmentRows?.[0] as Assessment | undefined
        if (!assessment) throw new Error(`No assessment found for ${abbr}`)

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
  const overallScore = Math.round(assessment.overall_score)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

      {/* ── HEADER ── */}
      <h1 style={{ fontSize: 28 }}>{federation.name}</h1>

      {/* ── MAIN STATS ── */}
      <div style={{ fontSize: 48 }}>
        <AnimatedNumber target={overallScore} />/100
      </div>

      {/* ── RADAR ── */}
      {/*
        ✅ FIXED: null-guard federation.if_group before passing to ScorecardRadar.
        ScorecardRadar requires ifGroup: IFGroup (non-nullable).
        If if_group is null, we skip rendering the radar entirely.
      */}
      {federation.if_group && (
        <div style={{ marginTop: 24 }}>
          <ScorecardRadar
            federationId={federation.id}
            federationAbbr={federation.abbreviation}
            ifGroup={federation.if_group}
          />
        </div>
      )}

      {/* ── PILLAR INSIGHTS ── */}
      {/*
        ✅ FIXED: PillarInsights is federation-scoped, not pillar-scoped.
        Pass federation props — NOT activePillar.
        Also null-guard if_group before passing as IFGroup.
      */}
      {federation.if_group && (
        <div style={{ marginTop: 24 }}>
          <PillarInsights
            federationId={federation.id}
            federationName={federation.name}
            federationAbbr={federation.abbreviation}
            ifGroup={federation.if_group}
          />
        </div>
      )}

    </div>
  )
}
