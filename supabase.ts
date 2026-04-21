import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Federation = {
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

export type Pillar = {
  id: string
  federation_id: string
  name: string
  slug: string
  description: string
  icon: string
  color: string
  display_order: number
  objectives?: Objective[]
}

export type Objective = {
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

export type Assessment = {
  id: string
  federation_id: string
  assessment_year: number
  overall_score: number
  grade: string
  methodology_version: string
}

export async function getFederationData(abbreviation: string) {
  const { data: federation } = await supabase
    .from('federations')
    .select('*')
    .eq('abbreviation', abbreviation)
    .single()

  if (!federation) return null

  const { data: pillars } = await supabase
    .from('pillars')
    .select('*')
    .eq('federation_id', federation.id)
    .order('display_order')

  const { data: assessment } = await supabase
    .from('assessments')
    .select('*')
    .eq('federation_id', federation.id)
    .eq('assessment_year', 2025)
    .single()

  const pillarsWithObjectives = await Promise.all(
    (pillars || []).map(async (pillar) => {
      const { data: objectives } = await supabase
        .from('objectives')
        .select('*')
        .eq('pillar_id', pillar.id)
        .order('display_order')
      return { ...pillar, objectives: objectives || [] }
    })
  )

  return { federation, pillars: pillarsWithObjectives, assessment }
}
