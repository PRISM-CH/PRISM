// ─────────────────────────────────────────────────────────────────────────────
// PRISM · lib/types.ts
// Single source of truth for ALL shared types.
// NEVER redefine IFGroup, Federation, Pillar, Objective, or Assessment
// anywhere else in the codebase.
// ─────────────────────────────────────────────────────────────────────────────

// ── IFGroup ──────────────────────────────────────────────────────────────────
// Matches the `if_group` column in the `federations` table.
// The DB allows null — always use `IFGroup | null` for DB-sourced values,
// and null-guard BEFORE passing into any prop typed as `IFGroup`.
export type IFGroup = 'olympic_paris' | 'recognized_if' | 'arisf' | 'aims'

// ── Federation ───────────────────────────────────────────────────────────────
export interface Federation {
  id: string
  name: string
  abbreviation: string
  hq_country: string
  sport: string
  if_group: IFGroup | null
  founding_year: number | null
  ioc_recognized: boolean | null
  n_member_federations: number | null
  n_competitions_per_year: number | null
  global_fans_millions: number | null
  economic_impact_bn_eur: number | null
  access_tier: 'preview' | 'full' | 'restricted' | null
  created_at: string | null
}

// ── Pillar ────────────────────────────────────────────────────────────────────
export interface Pillar {
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

// ── Objective ─────────────────────────────────────────────────────────────────
export interface Objective {
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

// ── Assessment ────────────────────────────────────────────────────────────────
export interface Assessment {
  id: string
  federation_id: string
  assessment_year: number
  overall_score: number
  grade: string
  methodology_version: string
}

// ── ScorecardData ─────────────────────────────────────────────────────────────
export interface ScorecardData {
  federation: Federation
  pillars: Pillar[]
  assessment: Assessment
}
