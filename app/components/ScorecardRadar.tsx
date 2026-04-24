'use client'
// PRISM
// Radar chart comparing an IF's 6 pillar scores vs its GROUP average.
// Uses Recharts

import { useEffect, useState } from 'react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { IF_GROUPS, groupBadge } from '@/lib/if-groups'
import type { IFGroup } from '@/lib/if-groups'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PillarScore {
  pillar_name: string
  pillar_slug: string
  display_order: number
  pillar_score: number
}

interface GroupAvg {
  pillar_slug: string
  pillar_name: string
  avg_score: number
}

interface Props {
  federationId: string
  federationAbbr: string
  ifGroup: IFGroup
}

// ── Short labels for the radar axes ──────────────────────────────────────────

const SHORT_LABEL: Record<string, string> = {
  'Governance & Integrity':    'Governance',
  'Commercial & Partnerships': 'Commercial',
  'Participation & Growth':    'Participation',
  'People & Development':      'People',
  'Reach & Engagement':        'Reach',
  'Sustainability':            'Sustainability',
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2.5 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-800 mb-1.5">{payload[0]?.payload?.fullLabel}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums" style={{ color: p.color }}>
            {p.value != null ? Number(p.value).toFixed(1) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ScorecardRadar({ federationId, federationAbbr, ifGroup }: Props) {
  const supabase = createClient()
  const [pillarScores, setPillarScores] = useState<PillarScore[]>([])
  const [groupAvgs, setGroupAvgs] = useState<GroupAvg[]>([])
  const [loading, setLoading] = useState(true)

  const groupMeta = IF_GROUPS[ifGroup]
  const badge = groupBadge(ifGroup)

  useEffect(() => {
    async function load() {
      const [{ data: scores }, { data: avgs }] = await Promise.all([
        supabase
          .from('federation_pillar_scores')
          .select('pillar_name, pillar_slug, display_order, pillar_score')
          .eq('federation_id', federationId)
          .order('display_order'),
        supabase
          .from('group_pillar_averages')
          .select('pillar_slug, pillar_name, avg_score')
          .eq('if_group', ifGroup),
      ])
      if (scores) setPillarScores(scores)
      if (avgs) setGroupAvgs(avgs)
      setLoading(false)
    }
    load()
  }, [federationId, ifGroup])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400 animate-pulse">Loading radar…</div>
      </div>
    )
  }

  // Build avgMap keyed by slug
  const avgMap: Record<string, number> = {}
  for (const a of groupAvgs) avgMap[a.pillar_slug] = Number(a.avg_score)

  const fedKey = federationAbbr
  const avgKey = `${groupMeta?.shortLabel ?? ifGroup} avg`

  const chartData = pillarScores.map((p) => ({
    subject: SHORT_LABEL[p.pillar_name] ?? p.pillar_name,
    fullLabel: p.pillar_name,
    [fedKey]: Number(p.pillar_score),
    [avgKey]: avgMap[p.pillar_slug] ?? null,
  }))

  return (
    <div className="w-full">
      {/* Benchmark label */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          Benchmarked vs {groupMeta?.label ?? ifGroup}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tickCount={5}
            tick={{ fill: '#d1d5db', fontSize: 9 }}
            axisLine={false}
          />

          {/* Group average — dashed */}
          <Radar
            name={avgKey}
            dataKey={avgKey}
            stroke={groupMeta?.color ?? '#94a3b8'}
            fill={groupMeta?.color ?? '#94a3b8'}
            fillOpacity={0.07}
            strokeDasharray="5 4"
            strokeWidth={1.5}
          />

          {/* This federation — solid */}
          <Radar
            name={fedKey}
            dataKey={fedKey}
            stroke="#1d4ed8"
            fill="#1d4ed8"
            fillOpacity={0.13}
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#1d4ed8', strokeWidth: 0 }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
