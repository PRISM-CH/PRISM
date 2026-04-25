// ────────────────────────────────────────────────────────────────────────────
// PRISM · hooks/useGroupAverages.ts
// Fetches per-group pillar averages and worst-pillar peer data from Supabase
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
// Use shared singleton — never call createClient() in a hook
import { supabase } from '@/lib/supabase'
// Import IFGroup from canonical location only
import type { IFGroup } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GroupPillarAverage {
  if_group: IFGroup
  pillar_name: string
  pillar_slug: string
  avg_score: number
  federation_count: number
}

/** Keyed by pillar_slug → avg_score, for a specific group */
export type RadarGroupBenchmark = Record<string, number>

export interface WorstPillarPeer {
  federation_id: string
  federation_name: string
  abbreviation: string
  if_group: IFGroup
  worst_pillar_name: string
  worst_pillar_slug: string
  worst_pillar_score: number
  top_peers: string[] | null        // abbreviations
  top_peer_names: string[] | null   // full names
  top_peer_scores: number[] | null
}

// ── Hook: group pillar averages (all groups) ──────────────────────────────────

export function useGroupPillarAverages() {
  const [data, setData] = useState<GroupPillarAverage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      const { data: rows, error: err } = await supabase
        .from('group_pillar_averages')
        .select('*')
        .order('if_group')
        .order('pillar_name')

      if (err) {
        setError(err.message)
      } else {
        setData(rows ?? [])
      }
      setLoading(false)
    }
    fetch()
  }, [])

  /** Returns radar benchmark data for a specific group, keyed by pillar_slug */
  function getBenchmarkForGroup(group: IFGroup): RadarGroupBenchmark {
    return data
      .filter((r) => r.if_group === group)
      .reduce((acc, r) => ({ ...acc, [r.pillar_slug]: r.avg_score }), {} as RadarGroupBenchmark)
  }

  return { data, loading, error, getBenchmarkForGroup }
}

// ── Hook: worst pillar + peers for a single federation ────────────────────────

export function useWorstPillarPeers(federationId: string | undefined) {
  const [data, setData] = useState<WorstPillarPeer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!federationId) return
    setLoading(true)

    async function fetch() {
      // ✅ Use maybeSingle() instead of single().
      // .single() throws if the row doesn't exist; .maybeSingle() returns null safely.
      const { data: rows, error: err } = await supabase
        .from('worst_pillar_with_peers')
        .select('*')
        .eq('federation_id', federationId)
        .maybeSingle()

      if (err) setError(err.message)
      // ✅ null-check before setting state
      else if (rows) setData(rows)
      setLoading(false)
    }
    fetch()
  }, [federationId])

  return { data, loading, error }
}

// ── Hook: federation pillar scores (for the scorecard radar) ──────────────────

export interface FederationPillarScore {
  pillar_name: string
  pillar_slug: string
  display_order: number
  pillar_score: number
}

export function useFederationPillarScores(federationId: string | undefined) {
  const [data, setData] = useState<FederationPillarScore[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!federationId) return
    setLoading(true)

    async function fetch() {
      const { data: rows, error: err } = await supabase
        .from('federation_pillar_scores')
        .select('pillar_name, pillar_slug, display_order, pillar_score')
        .eq('federation_id', federationId)
        .order('display_order')

      if (err) setError(err.message)
      else setData(rows ?? [])
      setLoading(false)
    }
    fetch()
  }, [federationId])

  return { data, loading, error }
}
