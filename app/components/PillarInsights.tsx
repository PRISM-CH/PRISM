'use client'
// components/PillarInsights.tsx  ─  PRISM
// Shows an IF's worst-performing pillar and generates AI recommendations
// based on what similar-sized, same-group IFs do better on that pillar.
// Uses worst_pillar_with_peers view (already in Supabase) + Claude API.

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { IF_GROUPS, groupBadge } from '@/lib/if-groups'
import type { IFGroup } from '@/lib/if-groups'

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function PillarInsights({ federationId, federationName, federationAbbr, ifGroup }: Props) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [peer, setPeer] = useState<PeerData | null>(null)
  const [objectives, setObjectives] = useState<PillarObjective[]>([])
  const [insight, setInsight] = useState<string>('')
  const [loadingData, setLoadingData] = useState(true)
  const [loadingAI, setLoadingAI] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groupMeta = IF_GROUPS[ifGroup]
  const badge = groupBadge(ifGroup)

  // ── Load peer data ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from('worst_pillar_with_peers')
        .select('*')
        .eq('federation_id', federationId)
        .single()

      if (err) { setError(err.message); setLoadingData(false); return }
      if (data) {
        setPeer(data as PeerData)

        // Also fetch the objectives for the worst pillar of THIS federation
        const { data: pillars } = await supabase
          .from('pillars')
          .select('id')
          .eq('federation_id', federationId)
          .eq('name', data.worst_pillar_name)
          .single()

        if (pillars) {
          const { data: objs } = await supabase
            .from('objectives')
            .select('name, score, description')
            .eq('pillar_id', pillars.id)
            .order('score', { ascending: true })
          if (objs) setObjectives(objs as PillarObjective[])
        }
      }
      setLoadingData(false)
    }
    load()
  }, [federationId])

  // ── Generate AI insight ───────────────────────────────────────────────────
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
WORST PILLAR: ${peer.worst_pillar_name} — score ${peer.worst_pillar_score}/100
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
      const json = await res.json()
      setInsight(json.text ?? json.error ?? 'No response.')
    } catch (e: any) {
      setError(e.message)
    }
    setLoadingAI(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingData) {
    return <div className="text-sm text-gray-400 animate-pulse py-4">Loading insight data…</div>
  }

  if (!peer) {
    return <div className="text-sm text-gray-400 py-4">No pillar data available.</div>
  }

  const hasPeers = peer.top_peers && peer.top_peers.length > 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Priority Improvement Area</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Lowest-scoring pillar and peer-based recommendations
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
          {groupMeta?.shortLabel}
        </span>
      </div>

      {/* Worst pillar highlight */}
      <div className="px-5 py-4 bg-red-50 border-b border-red-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-red-700">{peer.worst_pillar_name}</span>
          <span className="text-xl font-black tabular-nums text-red-600">
            {Number(peer.worst_pillar_score).toFixed(1)}
            <span className="text-xs font-medium text-red-400">/100</span>
          </span>
        </div>
        <div className="h-1.5 bg-red-100 rounded-full">
          <div
            className="h-full bg-red-400 rounded-full"
            style={{ width: `${peer.worst_pillar_score}%` }}
          />
        </div>

        {/* Weakest objectives */}
        {objectives.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Lowest objectives</p>
            {objectives.slice(0, 3).map((o) => (
              <div key={o.name} className="flex items-center justify-between text-xs text-red-700">
                <span className="truncate max-w-[240px]">{o.name}</span>
                <span className="font-bold ml-2 tabular-nums">{o.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Peer benchmarks */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Top peers on this pillar (similar size · same group)
        </p>
        {hasPeers ? (
          <div className="space-y-1.5">
            {peer.top_peers!.map((abbr, i) => (
              <div key={abbr} className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700 w-16 shrink-0">{abbr}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${peer.top_peer_scores![i]}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-gray-500 w-8 text-right">
                  {Number(peer.top_peer_scores![i]).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No directly comparable peers in this group.</p>
        )}
      </div>

      {/* AI insight section */}
      <div className="px-5 py-4">
        {insight ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                AI Recommendations
              </p>
              <button
                onClick={generateInsight}
                disabled={loadingAI}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Regenerate ↺
              </button>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {insight}
            </div>
          </div>
        ) : (
          <button
            onClick={generateInsight}
            disabled={loadingAI}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loadingAI ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating recommendations…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 01-5.303 0l-.347-.347z" />
                </svg>
                Generate Improvement Recommendations
              </>
            )}
          </button>
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  )
}
