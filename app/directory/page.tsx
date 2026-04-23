'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { GROUP_ORDER, IF_GROUPS, filterByGroups, sortFederationsByGroup } from '@/lib/if-groups'
import type { IFGroup } from '@/lib/if-groups'
import { useGroupFilter } from '@/app/components/GroupFilterBar'
import { GroupFilterBar } from '@/app/components/GroupFilterBar'
import type { SortKey } from '@/app/components/GroupFilterBar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────

type FederationRow = {
  id: string
  name: string
  abbreviation: string
  sport: string
  hq_country: string
  founding_year: number
  ioc_recognized: boolean
  if_group: IFGroup
  n_member_federations: number
  overall_score?: number
  grade?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number | undefined) {
  if (!s) return 'var(--text3)'
  if (s >= 80) return '#2d7d46'
  if (s >= 70) return '#1a6fa8'
  if (s >= 60) return '#a06010'
  return '#b83030'
}

function ScoreBar({ score }: { score: number | undefined }) {
  if (!score) return null
  return (
    <div style={{ background: 'var(--border)', borderRadius: 99, height: 3, overflow: 'hidden', marginTop: 4 }}>
      <div
        style={{
          width: `${score}%`,
          height: '100%',
          background: scoreColor(score),
          borderRadius: 99,
          transition: 'width 0.5s ease',
        }}
      />
    </div>
  )
}

function GroupBadge({ group }: { group: IFGroup }) {
  const meta = IF_GROUPS[group]
  if (!meta) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        fontFamily: 'sans-serif',
        backgroundColor: `${meta.accentColor}18`,
        color: meta.color,
        border: `0.5px solid ${meta.accentColor}40`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: meta.accentColor,
          display: 'inline-block',
        }}
      />
      {meta.shortLabel}
    </span>
  )
}

function FederationCard({
  fed,
  onClick,
}: {
  fed: FederationRow
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const score = fed.overall_score
  const groupMeta = IF_GROUPS[fed.if_group]

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        background: 'var(--surface)',
        border: hovered
          ? `0.5px solid ${groupMeta?.accentColor ?? 'var(--border)'}80`
          : '0.5px solid var(--border)',
        borderRadius: 12,
        padding: '16px 16px 14px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
        transform: hovered ? 'translateY(-1px)' : 'none',
        width: '100%',
      }}
    >
      {/* Top row: abbr + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div
            style={{
              fontFamily: 'sans-serif',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--text)',
              lineHeight: 1,
            }}
          >
            {fed.abbreviation}
          </div>
          <GroupBadge group={fed.if_group} />
        </div>
        {score !== undefined && (
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'sans-serif',
                fontSize: 22,
                fontWeight: 300,
                color: scoreColor(score),
                lineHeight: 1,
              }}
            >
              {Math.round(score)}
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: 'var(--text3)' }}>
              {fed.grade ?? '/100'}
            </div>
          </div>
        )}
      </div>

      {/* Federation name */}
      <div
        style={{
          fontFamily: 'sans-serif',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text)',
          lineHeight: 1.4,
          marginBottom: 4,
          flex: 1,
        }}
      >
        {fed.name}
      </div>

      {/* Sport + country */}
      <div
        style={{
          fontFamily: 'sans-serif',
          fontSize: 11,
          color: 'var(--text3)',
          marginBottom: score !== undefined ? 8 : 0,
          lineHeight: 1.4,
        }}
      >
        {fed.sport} · {fed.hq_country}
      </div>

      {/* Score bar */}
      {score !== undefined && <ScoreBar score={score} />}
    </button>
  )
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface2)',
        borderRadius: 12,
        height: 130,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  )
}

// ─── Sort logic ───────────────────────────────────────────────────────────────

function sortFederations(feds: FederationRow[], key: SortKey): FederationRow[] {
  const copy = [...feds]
  switch (key) {
    case 'group':
      return sortFederationsByGroup(copy)
    case 'score_desc':
      return copy.sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))
    case 'score_asc':
      return copy.sort((a, b) => (a.overall_score ?? 0) - (b.overall_score ?? 0))
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    case 'size':
      return copy.sort((a, b) => (b.n_member_federations ?? 0) - (a.n_member_federations ?? 0))
    default:
      return copy
  }
}

// ─── Group section header ─────────────────────────────────────────────────────

function GroupHeader({ group }: { group: IFGroup }) {
  const meta = IF_GROUPS[group]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 28,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: `0.5px solid ${meta.accentColor}30`,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: meta.accentColor,
          flexShrink: 0,
        }}
      />
      <div>
        <div
          style={{
            fontFamily: 'sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: meta.color,
            lineHeight: 1,
          }}
        >
          {meta.label}
        </div>
        <div
          style={{
            fontFamily: 'sans-serif',
            fontSize: 11,
            color: 'var(--text3)',
            marginTop: 2,
          }}
        >
          {meta.description}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  const [federations, setFederations] = useState<FederationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const { activeGroups, sortKey, toggleGroup, setSortKey } = useGroupFilter()

  // ── Fetch all federations with their latest assessment score ──────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        // Fetch all federations
        const { data: feds, error: fedErr } = await supabase
          .from('federations')
          .select('id, name, abbreviation, sport, hq_country, founding_year, ioc_recognized, if_group, n_member_federations')
          .order('name')

        if (fedErr) throw new Error(fedErr.message)
        if (!feds?.length) throw new Error('No federations found')

        // Fetch latest assessment score per federation
        const { data: assessments, error: assErr } = await supabase
          .from('assessments')
          .select('federation_id, overall_score, grade, assessment_year')
          .order('assessment_year', { ascending: false })

        if (assErr) throw new Error(assErr.message)

        // Map latest score onto each federation
        const scoreMap = new Map<string, { overall_score: number; grade: string }>()
        for (const a of assessments ?? []) {
          if (!scoreMap.has(a.federation_id)) {
            scoreMap.set(a.federation_id, { overall_score: a.overall_score, grade: a.grade })
          }
        }

        const enriched: FederationRow[] = feds.map((f) => ({
          ...f,
          if_group: f.if_group as IFGroup,
          overall_score: scoreMap.get(f.id)?.overall_score,
          grade: scoreMap.get(f.id)?.grade,
        }))

        setFederations(enriched)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // ── Derived data ──────────────────────────────────────────────────────────

  const groupCounts = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        count: federations.filter((f) => f.if_group === group).length,
      })),
    [federations]
  )

  const filtered = useMemo(() => {
    let result = filterByGroups(federations, activeGroups)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.abbreviation.toLowerCase().includes(q) ||
          f.sport.toLowerCase().includes(q) ||
          f.hq_country.toLowerCase().includes(q)
      )
    }
    return sortFederations(result, sortKey)
  }, [federations, activeGroups, search, sortKey])

  // ── Grouped rendering (only when sort=group) ──────────────────────────────

  const showGroupHeaders = sortKey === 'group' && activeGroups.length === 0 && !search.trim()

  const groupedFeds = useMemo(() => {
    if (!showGroupHeaders) return null
    return GROUP_ORDER.map((group) => ({
      group,
      feds: filtered.filter((f) => f.if_group === group),
    })).filter((g) => g.feds.length > 0)
  }, [filtered, showGroupHeaders])

  // ── Navigate to scorecard (reuse existing page) ───────────────────────────

  function goToScorecard(abbr: string) {
    // The existing scorecard is on /  — we pass the federation via URL param
    // Adjust this path if you wire up routing differently
    window.location.href = `/?fed=${abbr}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .fed-grid { animation: fadeIn 0.3s ease; }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{
          fontFamily: 'sans-serif', fontSize: 11, fontWeight: 500,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--text3)', marginBottom: 8,
        }}>
          PRISM · IF Directory
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{
              fontSize: 26, fontWeight: 400, lineHeight: 1.2,
              color: 'var(--text)', margin: 0,
            }}>
              International Federations
            </h1>
            <p style={{
              fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text2)', marginTop: 4,
            }}>
              {loading ? 'Loading…' : `${federations.length} federations across ${GROUP_ORDER.length} groups`}
            </p>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)',
            border: `0.5px solid ${searchFocused ? 'var(--text2)' : 'var(--border)'}`,
            borderRadius: 8, padding: '7px 12px',
            transition: 'border-color 0.15s',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="6" cy="6" r="4.5" stroke="var(--text3)" strokeWidth="1.25" />
              <path d="M9.5 9.5L12.5 12.5" stroke="var(--text3)" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search federations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text)',
                background: 'transparent', border: 'none', outline: 'none',
                width: 180, minWidth: 0,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', padding: 0, lineHeight: 1, fontSize: 14,
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '0.5px solid var(--border)', marginBottom: '1rem' }} />

      {/* ── Filter bar ── */}
      <GroupFilterBar
        groupCounts={groupCounts}
        activeGroups={activeGroups}
        sortKey={sortKey}
        onGroupToggle={toggleGroup}
        onSortChange={setSortKey}
        totalVisible={filtered.length}
        totalAll={federations.length}
      />

      <hr style={{ border: 'none', borderTop: '0.5px solid var(--border)', margin: '1rem 0 1.5rem' }} />

      {/* ── Error ── */}
      {error && (
        <div style={{
          fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)',
          textAlign: 'center', padding: '3rem 0',
        }}>
          Unable to load directory — {error}
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}>
          {Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{
          fontFamily: 'sans-serif', fontSize: 13, color: 'var(--text3)',
          textAlign: 'center', padding: '3rem 0',
        }}>
          No federations match your filters.{' '}
          <button
            onClick={() => { setSearch(''); setSortKey('group') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', textDecoration: 'underline', fontFamily: 'sans-serif', fontSize: 13 }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Grouped view (sort=group, no active filter, no search) ── */}
      {!loading && !error && showGroupHeaders && groupedFeds && (
        <div>
          {groupedFeds.map(({ group, feds }) => (
            <div key={group}>
              <GroupHeader group={group} />
              <div
                className="fed-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 10,
                }}
              >
                {feds.map((fed) => (
                  <FederationCard
                    key={fed.id}
                    fed={fed}
                    onClick={() => goToScorecard(fed.abbreviation)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Flat view (filtered / sorted / searched) ── */}
      {!loading && !error && !showGroupHeaders && filtered.length > 0 && (
        <div
          className="fed-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}
        >
          {filtered.map((fed) => (
            <FederationCard
              key={fed.id}
              fed={fed}
              onClick={() => goToScorecard(fed.abbreviation)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
