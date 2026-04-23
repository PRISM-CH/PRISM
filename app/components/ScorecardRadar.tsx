// ─────────────────────────────────────────────────────────────────────────────
// PRISM · components/ScorecardRadar.tsx
// Radar chart comparing an IF's pillar scores against its GROUP average
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import type { IFGroup } from '@/lib/if-groups'
import { IF_GROUPS } from '@/lib/if-groups'
import { useGroupPillarAverages } from '@/hooks/useGroupAverages'
import type { FederationPillarScore } from '@/hooks/useGroupAverages'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  federationName: string
  federationAbbr: string
  ifGroup: IFGroup
  pillarScores: FederationPillarScore[]
  /** Optional: pass pre-loaded group benchmark to avoid refetch */
  preloadedBenchmark?: Record<string, number>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Shorten pillar names for the radar axis labels */
function shortPillarLabel(name: string): string {
  const map: Record<string, string> = {
    'Governance & Integrity': 'Governance',
    'Commercial & Partnerships': 'Commercial',
    'Participation & Growth': 'Participation',
    'People & Development': 'People',
    'Reach & Engagement': 'Reach',
    Sustainability: 'Sustainability',
  }
  return map[name] ?? name
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const pillar = payload[0]?.payload?.pillar
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{pillar}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScorecardRadar({
  federationName,
  federationAbbr,
  ifGroup,
  pillarScores,
  preloadedBenchmark,
}: Props) {
  const { getBenchmarkForGroup, loading } = useGroupPillarAverages()

  const groupMeta = IF_GROUPS[ifGroup]
  const benchmark = preloadedBenchmark ?? getBenchmarkForGroup(ifGroup)

  const chartData = pillarScores.map((p) => ({
    pillar: p.pillar_name,
    subject: shortPillarLabel(p.pillar_name),
    [federationAbbr]: p.pillar_score,
    [`${groupMeta.shortLabel} avg`]: benchmark[p.pillar_slug] ?? null,
  }))

  if (loading && !preloadedBenchmark) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400 text-sm">Loading group benchmarks…</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Group benchmark badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: `${groupMeta.accentColor}18`, color: groupMeta.color }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: groupMeta.accentColor }}
          />
          Benchmarked vs {groupMeta.label}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickCount={5}
          />

          {/* Group average — dashed line */}
          <Radar
            name={`${groupMeta.shortLabel} avg`}
            dataKey={`${groupMeta.shortLabel} avg`}
            stroke={groupMeta.accentColor}
            fill={groupMeta.accentColor}
            fillOpacity={0.08}
            strokeDasharray="5 3"
            strokeWidth={1.5}
          />

          {/* Federation score — solid line */}
          <Radar
            name={federationAbbr}
            dataKey={federationAbbr}
            stroke="#1a56db"
            fill="#1a56db"
            fillOpacity={0.15}
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#1a56db' }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-gray-600">{value}</span>
            )}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
