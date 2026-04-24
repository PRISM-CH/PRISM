// ─────────────────────────────────────────────────────────────────────────────
// PRISM · components/GroupFilterBar.tsx
// Horizontal filter + sort bar for the IF directory — shows group pills,
// IF counts, and sort options. Integrates with if-groups.ts constants.
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useState } from 'react'
import { GROUP_ORDER, IF_GROUPS } from '@/lib/if-groups'
import type { IFGroup } from '@/lib/if-groups'

export type SortKey = 'group' | 'score_desc' | 'score_asc' | 'name' | 'size'

interface GroupCount {
  group: IFGroup
  count: number
}

interface Props {
  groupCounts: GroupCount[]
  activeGroups: IFGroup[]
  sortKey: SortKey
  onGroupToggle: (group: IFGroup) => void
  onSortChange: (sort: SortKey) => void
  totalVisible: number
  totalAll: number
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'group', label: 'By Group' },
  { key: 'score_desc', label: 'Top Score ↓' },
  { key: 'score_asc', label: 'Low Score ↑' },
  { key: 'name', label: 'A → Z' },
  { key: 'size', label: 'Size' },
]

export default function GroupFilterBar({
  groupCounts,
  activeGroups,
  sortKey,
  onGroupToggle,
  onSortChange,
  totalVisible,
  totalAll,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3 px-1">
      {/* Group pills */}
      <div className="flex flex-wrap items-center gap-2">
        {GROUP_ORDER.map((group) => {
          const meta = IF_GROUPS[group]
          const countObj = groupCounts.find((g) => g.group === group)
          const count = countObj?.count ?? 0
          const isActive = activeGroups.includes(group) || activeGroups.length === 0

          return (
            <button
              key={group}
              onClick={() => onGroupToggle(group)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                'border transition-all duration-150 select-none',
                isActive
                  ? 'border-transparent shadow-sm'
                  : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600',
              ].join(' ')}
              style={
                isActive
                  ? {
                      backgroundColor: `${meta.accent}1a`,
                      color: meta.color,
                      borderColor: `${meta.accent}40`,
                    }
                  : {}
              }
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isActive ? meta.accent : '#d1d5db' }}
              />
              {meta.shortLabel}
              <span
                className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={
                  isActive
                    ? { backgroundColor: `${meta.accent}30`, color: meta.color }
                    : { backgroundColor: '#f3f4f6', color: '#9ca3af' }
                }
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-gray-200 hidden sm:block" />

      {/* Sort */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 font-medium hidden sm:inline">Sort:</span>
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onSortChange(opt.key)}
              className={[
                'px-2.5 py-1 rounded text-xs font-medium transition-all',
                sortKey === opt.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <span className="ml-auto text-xs text-gray-400">
        {totalVisible === totalAll ? (
          <>{totalAll} federations</>
        ) : (
          <>
            <span className="font-semibold text-gray-600">{totalVisible}</span> of {totalAll}
          </>
        )}
      </span>
    </div>
  )
}

// ── Hook: manages group filter + sort state ───────────────────────────────────

export function useGroupFilter() {
  const [activeGroups, setActiveGroups] = useState<IFGroup[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('group')

  function toggleGroup(group: IFGroup) {
    setActiveGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    )
  }

  function clearFilters() {
    setActiveGroups([])
    setSortKey('group')
  }

  return { activeGroups, sortKey, toggleGroup, setSortKey, clearFilters }
}
