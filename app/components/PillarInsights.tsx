'use client'
// components/PillarInsights.tsx  ─  PRISM
// Shows an IF's worst-performing pillar and generates AI recommendations.
// Uses worst_pillar_with_peers view + Claude API via /api/insights.

import { useEffect, useState } from 'react'
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

interface Props {
  federationId: string
  federationName: string
  federationAbbr: string
  ifGroup: IFGroup
}

// ── Group badge inline styles ─────────────────────────────────────────────────

function groupBadgeStyle(ifGroup: IFGroup): { background: string; color: string; border: string } {
  if (ifGroup === 'Olympic')  return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }
  if (ifGroup === 'ARISF')    return { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }
  if (ifGroup === 'AIMS')     return { background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a' }
  return { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PillarInsights({ federationId, federationName, federationAbbr, ifGroup }: Props) {
  const [peer, setPeer] = useState<PeerData | null>(null)
  const [objectives, setObjectives] = useState<PillarObjective[]>([])
  const [insight, setInsight] = useState<string>('')
  const [loadingData, setLoadingData] = useState(true)
  const [loadingAI, setLoadingAI] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groupMeta = IF_GROUPS[ifGroup]
  const badge = groupBadgeStyle(ifGroup)

  // ── Load peer data ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from('worst_pillar_with_peers')
        .select('*')
        .eq('federation_id', federationId)
        .maybeSingle()

      if (err) { setError(err.message); setLoadingData(false); return }
      if (!data) { setLoadingData(false); return }

      setPeer(data as PeerData)

      const { data: pillarRow } = await supabase
        .from('pillars')
        .select('id')
        .eq('federation_id', federationId)
        .eq('name', data.worst_pillar_name)
        .maybeSingle()

      if (pillarRow) {
        const { data: objs } = await supabase
          .from('objectives')
          .select('name, score, description')
          .eq('pillar_id', pillarRow.id)
          .order('score', { ascending: true })
        if (objs) setObjectives(objs as PillarObjective[])
      }

      setLoadingData(false)
    }
    load()
  }, [federationId])

  // ── Generate AI insight ─────────────────────────────────────────────────────
  async function generateInsight() {
    if (!peer) return
    setLoadingAI(true)
    setInsight('')
    setError(null)

    const hasPeers = peer.top_peers && peer.top_peers.length > 0
    const peerSummary = hasPeers
      ? peer.top_peers!.map((abbr, i) => `${abbr} (${peer.top_peer_names![i]}, score ${peer.top_peer_scores![i]})`).join(', ')
      : 'no directly comparable peers found in this group'

    const weakObjectives = objectives
      .slice(0, 3)
      .map((o) => `• ${o.name} (${o.score}/100)`)
      .join('\n')

    const prompt = `You are a strategic advisor for international sports federations. 
Analyse the following performance gap and produce 3–4 specific, actionable recommendations.

FEDERATION: ${federationName} (${federationAbbr})
GROUP: ${groupMeta?.label ?? ifGroup} 
WORST PILLAR: ${peer.worst_pillar_name} – score ${peer.worst_pillar_score}/100
WEAKEST OBJECTIVES WITHIN THIS PILLAR:
${weakObjectives || '(objectives not available)'}

TOP-PERFORMING PEERS ON THIS PILLAR (similar size, same group):
${peerSummary}

Write recommendations in this format:
1. [Specific action title]
[2–3 sentences explaining the action, referencing what peer federations do, and why it would improve ${federationAbbr}'s score on ${peer.worst_pillar_name}.]

Be concrete and IF-specific. Mention peer federation names where relevant. Keep each recommendation under 80 words. Do not use generic management language. End with a one-sentence priority call-out.`

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()
      setInsight(json.text ?? json.error ?? 'No response.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
    setLoadingAI(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

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
              Lowest-scoring pillar and peer-based recommendations
            </div>
          </div>
          <span style={{
            flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '3px 8px',
            borderRadius: 99, ...badge,
          }}>
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

          {/* Score bar */}
          <div style={{ height: 6, background: '#fee2e2', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${peer.worst_pillar_score}%`, height: '100%', background: '#f87171', borderRadius: 99 }} />
          </div>

          {/* Weakest objectives */}
          {objectives.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Lowest objectives
              </div>
              {objectives.slice(0, 3).map((o) => (
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

        {/* ── AI insight section ── */}
        <div style={{ padding: '1rem 1.25rem' }}>
          {insight ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  AI Recommendations
                </div>
                <button
                  onClick={generateInsight}
                  disabled={loadingAI}
                  style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}
                >
                  Regenerate ↺
                </button>
              </div>
              <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {insight}
              </div>
            </div>
          ) : (
            <button
              onClick={generateInsight}
              disabled={loadingAI}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, border: '0.5px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text)',
                fontFamily: 'sans-serif', fontSize: 12, fontWeight: 500,
                cursor: loadingAI ? 'not-allowed' : 'pointer',
                opacity: loadingAI ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
            >
              {loadingAI ? (
                <>
                  <svg style={{ animation: 'spin 1s linear infinite', width: 13, height: 13 }} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 01-5.303 0l-.347-.347z" />
                  </svg>
                  Generate improvement recommendations
                </>
              )}
            </button>
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
