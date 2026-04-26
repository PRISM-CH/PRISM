'use client'
// components/PillarInsights.tsx  ─  PRISM  v2
//
// Changes from v1:
//   • Reads from `recommendations` table (SMART records) instead of flat `pillar_insights` text
//   • Calls `generate-recommendations` Edge Function (returns structured JSON per rec)
//   • Displays impact_type + impact_magnitude badges (ImpactBadge)
//   • Shows per-pillar group rank from `worst_pillar_with_peers` (unchanged view)
//   • Backwards-compatible: still shows cached pillar_insights text as fallback when
//     no recs exist yet (graceful degradation during migration)

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { IF_GROUPS } from '@/lib/if-groups'
import type { IFGroup } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PeerData {
  federation_id: string
  federation_name: string
  abbreviation: string
  if_group: IFGroup
  worst_pillar_name: string
  worst_pillar_slug: string
  worst_pillar_score: number
  top_peers: string[] | null
  top_peer_names: string[] | null
  top_peer_scores: number[] | null
}

interface PillarObjective {
  name: string
  score: number
  description: string | null
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

// Legacy fallback shape (pillar_insights table)
interface StoredInsight {
  insight: string
  generated_at: string
  pillar_name: string
}

interface Props {
  federationId: string
  federationName: string
  federationAbbr: string
  ifGroup: IFGroup
}

// ── Impact/Magnitude maps ─────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function ImpactBadge({ type, magnitude }: { type: string; magnitude: string }) {
  const imp = IMPACT[type] ?? IMPACT.governance
  const mag = MAGNITUDE[magnitude] ?? MAGNITUDE.medium
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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

function groupBadgeStyle(ifGroup: IFGroup): { background: string; color: string; border: string } {
  if (ifGroup === 'olympic_paris')  return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }
  if (ifGroup === 'olympic_milano') return { background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }
  if (ifGroup === 'arisf')          return { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }
  if (ifGroup === 'aims')           return { background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a' }
  return { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PillarInsights({ federationId, federationName, federationAbbr, ifGroup }: Props) {
  const [peer, setPeer]                   = useState<PeerData | null>(null)
  const [objectives, setObjectives]       = useState<PillarObjective[]>([])
  const [recs, setRecs]                   = useState<Recommendation[]>([])
  const [legacyInsight, setLegacyInsight] = useState<string>('')         // fallback plain text
  const [insightAge, setInsightAge]       = useState<string | null>(null)
  const [loadingData, setLoadingData]     = useState(true)
  const [loadingRecs, setLoadingRecs]     = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  const groupMeta = IF_GROUPS[ifGroup]
  const badge     = groupBadgeStyle(ifGroup)

  function relativeDate(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86_400_000)
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 30)  return `${days}d ago`
    return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }

  // ── Load peer data + cached recs (+ legacy insight fallback) ──────────────
  useEffect(() => {
    async function load() {
      setLoadingData(true)
      setError(null)

      const [peerRes, insightRes] = await Promise.all([
        supabase
          .from('worst_pillar_with_peers')
          .select('*')
          .eq('federation_id', federationId)
          .maybeSingle(),
        supabase
          .from('pillar_insights')
          .select('insight, generated_at, pillar_name')
          .eq('federation_id', federationId)
          .maybeSingle(),
      ])

      if (peerRes.error) {
        setError(peerRes.error.message)
        setLoadingData(false)
        return
      }
      if (!peerRes.data) {
        setLoadingData(false)
        return
      }

      const peerData = peerRes.data as PeerData
      setPeer(peerData)

      // Load objectives for worst pillar
      const { data: pillarRow } = await supabase
        .from('pillars')
        .select('id')
        .eq('federation_id', federationId)
        .eq('name', peerData.worst_pillar_name)
        .maybeSingle()

      if (pillarRow) {
        const { data: objs } = await supabase
          .from('objectives')
          .select('name, score, description')
          .eq('pillar_id', pillarRow.id)
          .order('score', { ascending: true })
        if (objs) setObjectives(objs as PillarObjective[])
      }

      // Load structured recommendations from new table
      const { data: recsData } = await supabase
        .from('recommendations')
        .select('*')
        .eq('federation_id', federationId)
        .eq('pillar_slug', peerData.worst_pillar_slug)
        .order('display_order')

      if (recsData && recsData.length > 0) {
        setRecs(recsData as Recommendation[])
      } else if (insightRes.data) {
        // Fallback: show legacy flat insight text
        const stored = insightRes.data as StoredInsight
        if (stored.pillar_name === peerData.worst_pillar_name) {
          setLegacyInsight(stored.insight)
          setInsightAge(stored.generated_at)
        }
      }

      setLoadingData(false)
    }
    load()
  }, [federationId])

  // ── Generate / regenerate via Edge Function ───────────────────────────────
  const generateRecs = useCallback(async () => {
    if (!peer) return
    setLoadingRecs(true)
    setError(null)
    setLegacyInsight('')
    setInsightAge(null)

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
            federation_id: federationId,
            pillar_slug: peer.worst_pillar_slug,
            force_regenerate: true,
          }),
        }
      )
      if (!res.ok) throw new Error(`Edge Function error: ${res.status}`)
      const json = await res.json()
      if (json.recommendations) {
        setRecs(json.recommendations as Recommendation[])
        setInsightAge(new Date().toISOString())
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }

    setLoadingRecs(false)
  }, [peer, federationId])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <>
        <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
        <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text3)', padding: '1rem 0', animation: 'pulse 1.5s ease-in-out infinite' }}>
          Loading insight data…
        </div>
      </>
    )
  }

  if (!peer) {
    return (
      <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text3)', padding: '1rem 0' }}>
        No pillar data available.
      </div>
    )
  }

  const hasPeers = peer.top_peers && peer.top_peers.length > 0
  const hasRecs  = recs.length > 0

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>

      <div style={{
        background: 'var(--surface)', border: '0.5px solid var(--border)',
        borderRadius: 12, overflow: 'hidden', marginBottom: '1.5rem',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          padding: '1rem 1.25rem', borderBottom: '0.5px solid var(--border)',
        }}>
          <div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Priority Improvement Area
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Lowest-scoring pillar · SMART recommendations · Peer benchmarks
            </div>
          </div>
          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, ...badge }}>
            {groupMeta?.shortLabel ?? ifGroup}
          </span>
        </div>

        {/* ── Worst pillar highlight ── */}
        <div style={{ padding: '1rem 1.25rem', background: '#fef2f2', borderBottom: '0.5px solid #fee2e2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
              {peer.worst_pillar_name}
            </span>
            <span style={{ fontFamily: 'sans-serif', fontSize: 20, fontWeight: 900, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
              {Number(peer.worst_pillar_score).toFixed(1)}
              <span style={{ fontSize: 11, fontWeight: 500, color: '#f87171' }}>/100</span>
            </span>
          </div>
          <div style={{ height: 6, background: '#fee2e2', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${peer.worst_pillar_score}%`, height: '100%', background: '#f87171', borderRadius: 99 }} />
          </div>

          {/* Weakest objectives */}
          {objectives.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Lowest objectives
              </div>
              {objectives.slice(0, 3).map(o => (
                <div key={o.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'sans-serif', fontSize: 12, color: '#b91c1c', marginBottom: 4 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{o.name}</span>
                  <span style={{ fontWeight: 700, marginLeft: 8, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{o.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Peer benchmarks ── */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Top peers on this pillar (similar size · same group)
          </div>
          {hasPeers ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {peer.top_peers!.map((abbr, i) => (
                <div key={abbr} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--text)', width: 52, flexShrink: 0 }}>{abbr}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${peer.top_peer_scores![i]}%`, height: '100%', background: '#34d399', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text2)', width: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {Number(peer.top_peer_scores![i]).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
              No directly comparable peers in this group.
            </div>
          )}
        </div>

        {/* ── SMART Recommendations ── */}
        <div style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Strategic Recommendations
              </div>
              {insightAge && (
                <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                  generated {relativeDate(insightAge)}
                </div>
              )}
            </div>
            <button
              onClick={generateRecs}
              disabled={loadingRecs}
              style={{
                fontFamily: 'sans-serif', fontSize: 11, color: '#2563eb',
                background: 'none', border: 'none', cursor: loadingRecs ? 'wait' : 'pointer',
                fontWeight: 500, padding: 0, opacity: loadingRecs ? 0.6 : 1,
              }}
            >
              {loadingRecs ? 'Generating…' : hasRecs ? 'Regenerate ↺' : 'Generate →'}
            </button>
          </div>

          {/* Skeleton while generating */}
          {loadingRecs && (
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

          {/* Structured SMART recs */}
          {hasRecs && !loadingRecs && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recs.map((rec, i) => {
                const imp = IMPACT[rec.impact_type] ?? IMPACT.governance
                const mag = MAGNITUDE[rec.impact_magnitude] ?? MAGNITUDE.medium
                return (
                  <div key={rec.id ?? i} style={{
                    background: `${imp.color}08`, border: `1px solid ${imp.color}25`,
                    borderRadius: 10, padding: 16, borderLeft: `3px solid ${mag.dot}`,
                  }}>
                    <div style={{ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 10 }}>
                      <span style={{ color: imp.color, fontFamily: 'monospace', fontSize: 11, marginRight: 6 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {rec.action}
                    </div>
                    <ImpactBadge type={rec.impact_type} magnitude={rec.impact_magnitude} />
                    {rec.rationale && (
                      <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text2)', marginTop: 10, lineHeight: 1.6 }}>
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
                          borderRadius: 6, padding: '6px 10px', fontSize: 10, color: mag.color,
                          display: 'flex', flexDirection: 'column', minWidth: 80,
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
          )}

          {/* Legacy plain-text insight fallback (while no SMART recs exist yet) */}
          {!hasRecs && !loadingRecs && legacyInsight && (
            <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {legacyInsight}
            </div>
          )}

          {/* Empty state */}
          {!hasRecs && !loadingRecs && !legacyInsight && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🎯</div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)' }}>
                No recommendations yet for this pillar.
              </div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)', marginTop: 4, opacity: 0.7 }}>
                Click "Generate →" to create AI-powered SMART recommendations with KPI, deadline, and impact classification.
              </div>
            </div>
          )}

          {error && (
            <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#dc2626', marginTop: 8 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  )
}