'use client'
// PRISM IF Directory
// Fetches all federations + assessments, groups them,
// renders a filterable / sortable directory with group section headers.

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
// Use shared singleton — never call createClient() in a component
import { supabase } from '@/lib/supabase'
import { GROUP_ORDER, IF_GROUPS, groupBadge, sortByGroup } from '@/lib/if-groups'
// Import IFGroup from canonical location only
import type { IFGroup } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────
// Local view type — only the fields this page needs from the DB join
interface FederationRow {
  id: string
  name: string
  abbreviation: string
  if_group: IFGroup | null         // nullable from DB — guard before use
  n_member_federations: number | null
  global_fans_millions: number | null
  overall_score: number | null
  grade: string | null
  access_tier: string | null
}

type SortKey = 'group' | 'score' | 'name' | 'size'

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number | null) {
  if (!score) return 'text-gray-400'
  if (score >= 80) return 'text-emerald-600'
  if (score >= 65) return 'text-blue-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-500'
}

function scoreBarWidth(score: number | null) {
  return `${Math.max(0, Math.min(100, Number(score) || 0))}%`
}

function scoreBarColor(score: number | null) {
  if (!score) return 'bg-gray-200'
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 65) return 'bg-blue-500'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  // ✅ No createClient() here — use shared singleton imported above
  const [feds, setFeds] = useState<FederationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeGroups, setActiveGroups] = useState<IFGroup[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('group')

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('federations')
        .select(`
          id, name, abbreviation, if_group,
          n_member_federations, global_fans_millions, access_tier,
          assessments ( overall_score, grade )
        `)
      if (data) {
        const flat: FederationRow[] = data.map((f: any) => ({
          ...f,
          overall_score: f.assessments?.[0]?.overall_score ?? null,
          grade: f.assessments?.[0]?.grade ?? null,
        }))
        setFeds(flat)
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Filter + Sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...feds]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.abbreviation.toLowerCase().includes(q)
      )
    }

    if (activeGroups.length > 0) {
      // ✅ Null-guard: federations with null if_group are excluded when filtering
      list = list.filter((f) => f.if_group && activeGroups.includes(f.if_group))
    }

    switch (sortKey) {
      case 'score':
        list.sort((a, b) => (Number(b.overall_score) || 0) - (Number(a.overall_score) || 0))
        break
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'size':
        list.sort((a, b) => (b.n_member_federations || 0) - (a.n_member_federations || 0))
        break
      default: // 'group'
        list = sortByGroup(list)
    }

    return list
  }, [feds, search, activeGroups, sortKey])

  // ── Group sections for 'group' sort ───────────────────────────────────────
  const grouped = useMemo(() => {
    if (sortKey !== 'group') return null
    const map: Record<string, FederationRow[]> = {}
    for (const g of GROUP_ORDER) map[g] = []
    for (const f of filtered) {
      // ✅ Null-guard: skip federations with null if_group in grouped view
      if (f.if_group && map[f.if_group]) map[f.if_group].push(f)
    }
    return map
  }, [filtered, sortKey])

  // ── Counts per group ───────────────────────────────────────────────────────
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of feds) {
      if (f.if_group) counts[f.if_group] = (counts[f.if_group] || 0) + 1
    }
    return counts
  }, [feds])

  const toggleGroup = (g: IFGroup) =>
    setActiveGroups((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    )

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-gray-400 animate-pulse">Loading federations…</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">IF Directory</h1>
        <p className="text-sm text-gray-500 mt-1">
          {feds.length} international federations across 4 recognition tiers
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search federations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['group', 'score', 'name', 'size'] as SortKey[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortKey(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sortKey === s
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'group' ? 'By Group' : s === 'score' ? 'Score ↓' : s === 'name' ? 'A–Z' : 'Size'}
            </button>
          ))}
        </div>
      </div>

      {/* Group filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {GROUP_ORDER.map((g) => {
          const meta = IF_GROUPS[g]
          const badge = groupBadge(g)
          const active = activeGroups.length === 0 || activeGroups.includes(g)
          return (
            <button
              key={g}
              onClick={() => toggleGroup(g)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? `${badge.bg} ${badge.text} ${badge.border}`
                  : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? badge.dot : 'bg-gray-300'}`} />
              {meta.shortLabel}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                active ? `${badge.bg} ${badge.text}` : 'bg-gray-100 text-gray-400'
              }`}>
                {groupCounts[g] || 0}
              </span>
            </button>
          )
        })}
        {activeGroups.length > 0 && (
          <button
            onClick={() => setActiveGroups([])}
            className="text-xs text-gray-400 hover:text-gray-600 px-2"
          >
            Clear ×
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400 mb-4">
        {filtered.length === feds.length
          ? `${feds.length} federations`
          : `${filtered.length} of ${feds.length} federations`}
      </p>

      {/* Grouped sections */}
      {grouped ? (
        <div className="space-y-10">
          {GROUP_ORDER.map((g) => {
            const items = grouped[g]
            if (items.length === 0) return null
            const meta = IF_GROUPS[g]
            const badge = groupBadge(g)
            return (
              <section key={g}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    {meta.label}
                  </span>
                  <span className="text-xs text-gray-400">{items.length} federations</span>
                  <span className="text-xs text-gray-300 hidden sm:inline">·</span>
                  <span className="text-xs text-gray-400 hidden sm:inline">{meta.description}</span>
                </div>

                {/* Federation cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map((fed) => (
                    <FederationCard key={fed.id} fed={fed} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        /* Flat list for non-group sorts */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((fed) => (
            <FederationCard key={fed.id} fed={fed} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No federations match your search.</p>
        </div>
      )}
    </div>
  )
}

// ── Federation Card ───────────────────────────────────────────────────────────

function FederationCard({ fed }: { fed: FederationRow }) {
  const badge = groupBadge(fed.if_group)
  const isPreview = fed.access_tier === 'preview'

  return (
    <Link
      href={`/directory/${fed.id}`}
      className="group relative flex flex-col bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all duration-150"
    >
      {/* Preview lock badge */}
      {isPreview && (
        <span className="absolute top-3 right-3 text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          PREVIEW
        </span>
      )}

      {/* Abbreviation + name */}
      <div className="mb-3">
        <div className="text-lg font-black text-gray-900 tracking-tight group-hover:text-blue-700 transition-colors">
          {fed.abbreviation}
        </div>
        <div className="text-xs text-gray-500 leading-snug mt-0.5 line-clamp-2">{fed.name}</div>
      </div>

      {/* Score bar */}
      <div className="mb-2">
        <div className="flex items-baseline justify-between mb-1">
          <span className={`text-xl font-bold tabular-nums ${scoreColor(fed.overall_score)}`}>
            {fed.overall_score != null ? Number(fed.overall_score).toFixed(1) : '–'}
          </span>
          {fed.grade && (
            <span className="text-xs font-semibold text-gray-500">{fed.grade}</span>
          )}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreBarColor(fed.overall_score)}`}
            style={{ width: scoreBarWidth(fed.overall_score) }}
          />
        </div>
      </div>

      {/* Footer: group badge + member count */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
          {/* ✅ Null-guard: show raw value if no meta found */}
          {IF_GROUPS[fed.if_group!]?.shortLabel ?? fed.if_group ?? '–'}
        </span>
        {fed.n_member_federations && (
          <span className="text-[10px] text-gray-400">
            {fed.n_member_federations} NFs
          </span>
        )}
      </div>
    </Link>
  )
}
