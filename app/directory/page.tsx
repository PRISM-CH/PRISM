'use client'
// PRISM IF Directory — inline styles throughout (no Tailwind dependency)

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { GROUP_ORDER, IF_GROUPS, sortByGroup } from '@/lib/if-groups'
import type { IFGroup } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FederationRow {
  id: string
  name: string
  abbreviation: string
  if_group: IFGroup | null
  n_member_federations: number | null
  global_fans_millions: number | null
  overall_score: number | null
  grade: string | null
  access_tier: string | null
}

type SortKey = 'group' | 'score' | 'name' | 'size'

// ── Group inline styles (replaces Tailwind groupBadge) ────────────────────────

interface GroupStyle {
  background: string
  color: string
  border: string
  dot: string
  label: string
}

function groupStyle(g: IFGroup | null | undefined): GroupStyle {
  switch (g) {
    case 'olympic_paris':    return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', dot: '#3b82f6', label: 'Olympic' }
    case 'arisf':     return { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', dot: '#22c55e', label: 'ARISF' }
    case 'aims':      return { background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', dot: '#eab308', label: 'AIMS' }
    default:          return { background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)', dot: '#9ca3af', label: g ?? '–' }
  }
}

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (!score) return 'var(--text3)'
  if (score >= 80) return '#16a34a'
  if (score >= 65) return '#1d4ed8'
  if (score >= 50) return '#b45309'
  return '#dc2626'
}

function scoreBarColor(score: number | null): string {
  if (!score) return 'var(--surface2)'
  if (score >= 80) return '#22c55e'
  if (score >= 65) return '#3b82f6'
  if (score >= 50) return '#f59e0b'
  return '#f87171'
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  const [feds, setFeds] = useState<FederationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeGroups, setActiveGroups] = useState<IFGroup[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('group')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('federations')
        .select(`id, name, abbreviation, if_group, n_member_federations, global_fans_millions, access_tier, assessments ( overall_score, grade )`)
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

  const filtered = useMemo(() => {
    let list = [...feds]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(f => f.name.toLowerCase().includes(q) || f.abbreviation.toLowerCase().includes(q))
    }
    if (activeGroups.length > 0) {
      list = list.filter(f => f.if_group && activeGroups.includes(f.if_group))
    }
    switch (sortKey) {
      case 'score': list.sort((a, b) => (Number(b.overall_score) || 0) - (Number(a.overall_score) || 0)); break
      case 'name':  list.sort((a, b) => a.name.localeCompare(b.name)); break
      case 'size':  list.sort((a, b) => (b.n_member_federations || 0) - (a.n_member_federations || 0)); break
      default:      list = sortByGroup(list)
    }
    return list
  }, [feds, search, activeGroups, sortKey])

  const grouped = useMemo(() => {
    if (sortKey !== 'group') return null
    const map: Record<string, FederationRow[]> = {}
    for (const g of GROUP_ORDER) map[g] = []
    for (const f of filtered) {
      if (f.if_group && map[f.if_group]) map[f.if_group].push(f)
    }
    return map
  }, [filtered, sortKey])

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of feds) {
      if (f.if_group) counts[f.if_group] = (counts[f.if_group] || 0) + 1
    }
    return counts
  }, [feds])

  const toggleGroup = (g: IFGroup) =>
    setActiveGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])

  if (loading) {
    return (
      <>
        <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)', animation: 'pulse 1.5s ease-in-out infinite' }}>
            Loading federations…
          </div>
        </div>
      </>
    )
  }

  const SORT_LABELS: Record<SortKey, string> = { group: 'By Group', score: 'Score ↓', name: 'A–Z', size: 'Size' }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          IF Directory
        </h1>
        <p style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
          {feds.length} international federations across 4 recognition tiers
        </p>
      </div>

      {/* ── Controls row ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: '1.25rem', alignItems: 'center' }}>

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <svg
            width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search federations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
              fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text)',
              background: 'var(--surface)', border: searchFocused ? '1px solid #3b82f6' : '0.5px solid var(--border)',
              borderRadius: 8, outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
          />
        </div>

        {/* Sort pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface2)', borderRadius: 8, padding: 3 }}>
          {(['group', 'score', 'name', 'size'] as SortKey[]).map(s => (
            <button
              key={s}
              onClick={() => setSortKey(s)}
              style={{
                padding: '5px 11px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontFamily: 'sans-serif', fontSize: 12, fontWeight: 500,
                background: sortKey === s ? 'var(--surface)' : 'transparent',
                color: sortKey === s ? 'var(--text)' : 'var(--text3)',
                boxShadow: sortKey === s ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Group filter pills ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '1.25rem' }}>
        {GROUP_ORDER.map(g => {
          const meta = IF_GROUPS[g]
          const st = groupStyle(g as IFGroup)
          const active = activeGroups.length === 0 || activeGroups.includes(g as IFGroup)
          return (
            <button
              key={g}
              onClick={() => toggleGroup(g as IFGroup)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 99,
                fontFamily: 'sans-serif', fontSize: 11, fontWeight: 600,
                background: active ? st.background : 'var(--surface)',
                color: active ? st.color : 'var(--text3)',
                border: active ? st.border : '0.5px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? st.dot : 'var(--border)', flexShrink: 0 }} />
              {meta.shortLabel}
              <span style={{
                padding: '1px 6px', borderRadius: 99,
                fontSize: 10, fontWeight: 700,
                background: active ? 'rgba(0,0,0,0.07)' : 'var(--surface2)',
                color: active ? st.color : 'var(--text3)',
              }}>
                {groupCounts[g] || 0}
              </span>
            </button>
          )
        })}
        {activeGroups.length > 0 && (
          <button
            onClick={() => setActiveGroups([])}
            style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px' }}
          >
            Clear ×
          </button>
        )}
      </div>

      {/* ── Results count ── */}
      <p style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)', marginBottom: '1rem' }}>
        {filtered.length === feds.length ? `${feds.length} federations` : `${filtered.length} of ${feds.length} federations`}
      </p>

      {/* ── Grouped sections ── */}
      {grouped ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {GROUP_ORDER.map(g => {
            const items = grouped[g]
            if (!items || items.length === 0) return null
            const meta = IF_GROUPS[g]
            const st = groupStyle(g as IFGroup)
            return (
              <section key={g}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 99,
                    fontFamily: 'sans-serif', fontSize: 11, fontWeight: 700,
                    background: st.background, color: st.color, border: st.border,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot }} />
                    {meta.label}
                  </span>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)' }}>{items.length} federations</span>
                  <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text3)' }}>· {meta.description}</span>
                </div>

                {/* Cards grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {items.map(fed => <FederationCard key={fed.id} fed={fed} />)}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {filtered.map(fed => <FederationCard key={fed.id} fed={fed} />)}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 0', fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)' }}>
          No federations match your search.
        </div>
      )}
    </div>
  )
}

// ── Federation Card ───────────────────────────────────────────────────────────

function FederationCard({ fed }: { fed: FederationRow }) {
  const [hovered, setHovered] = useState(false)
  const st = groupStyle(fed.if_group)
  const score = fed.overall_score
  const barWidth = `${Math.max(0, Math.min(100, Number(score) || 0))}%`

  return (
    <Link
      href={`/directory/${fed.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', textDecoration: 'none',
        background: 'var(--surface)', borderRadius: 12, padding: '14px',
        border: hovered ? '1px solid #93c5fd' : '0.5px solid var(--border)',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
      }}
    >
      {/* Preview badge */}
      {fed.access_tier === 'preview' && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          fontFamily: 'sans-serif', fontSize: 9, fontWeight: 700,
          color: 'var(--text3)', background: 'var(--surface2)',
          padding: '2px 6px', borderRadius: 4,
        }}>
          PREVIEW
        </span>
      )}

      {/* Abbr + name */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontFamily: 'sans-serif', fontSize: 18, fontWeight: 900,
          color: hovered ? '#1d4ed8' : 'var(--text)',
          letterSpacing: '-0.02em', lineHeight: 1, transition: 'color 0.15s',
        }}>
          {fed.abbreviation}
        </div>
        <div style={{
          fontFamily: 'sans-serif', fontSize: 11, color: 'var(--text2)', marginTop: 3,
          lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {fed.name}
        </div>
      </div>

      {/* Score */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: 'sans-serif', fontSize: 20, fontWeight: 700, color: scoreColor(score), fontVariantNumeric: 'tabular-nums' }}>
            {score != null ? Number(score).toFixed(1) : '–'}
          </span>
          {fed.grade && (
            <span style={{ fontFamily: 'sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>
              {fed.grade}
            </span>
          )}
        </div>
        <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: barWidth, height: '100%', background: scoreBarColor(score), borderRadius: 99, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6 }}>
        <span style={{
          fontFamily: 'sans-serif', fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 99,
          background: st.background, color: st.color, border: st.border,
        }}>
          {IF_GROUPS[fed.if_group!]?.shortLabel ?? fed.if_group ?? '–'}
        </span>
        {fed.n_member_federations && (
          <span style={{ fontFamily: 'sans-serif', fontSize: 10, color: 'var(--text3)' }}>
            {fed.n_member_federations} NFs
          </span>
        )}
      </div>
    </Link>
  )
}
