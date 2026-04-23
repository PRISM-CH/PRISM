// ─────────────────────────────────────────────────────────────────────────────
// PRISM · lib/if-groups.ts
// IF group definitions, ordering, display labels, and Supabase fetch helpers
// ─────────────────────────────────────────────────────────────────────────────

export type IFGroup = 'olympic_paris' | 'recognized_if' | 'arisf' | 'aims'

export interface GroupMeta {
  key: IFGroup
  label: string
  shortLabel: string
  description: string
  color: string
  accentColor: string
  badgeBg: string
  badgeText: string
  order: number
}

export const IF_GROUPS: Record<IFGroup, GroupMeta> = {
  olympic_paris: {
    key: 'olympic_paris',
    label: 'Olympic IFs – Paris 2024',
    shortLabel: 'Olympic',
    description: 'International Federations whose sport appeared on the Paris 2024 Olympic programme',
    color: '#1a56db',
    accentColor: '#3b82f6',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    order: 1,
  },
  recognized_if: {
    key: 'recognized_if',
    label: 'IOC Recognised IFs',
    shortLabel: 'Recognised',
    description: 'IFs recognised by the IOC but not currently on the Olympic programme',
    color: '#047857',
    accentColor: '#10b981',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    order: 2,
  },
  arisf: {
    key: 'arisf',
    label: 'ARISF Members',
    shortLabel: 'ARISF',
    description: 'Association of IOC Recognised International Sports Federations members',
    color: '#7c3aed',
    accentColor: '#a78bfa',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-700',
    order: 3,
  },
  aims: {
    key: 'aims',
    label: 'AIMS Members',
    shortLabel: 'AIMS',
    description: 'Alliance of Independent Recognised Members of Sport',
    color: '#b45309',
    accentColor: '#f59e0b',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    order: 4,
  },
}

export const GROUP_ORDER: IFGroup[] = ['olympic_paris', 'recognized_if', 'arisf', 'aims']

/** Returns sorted group options for filter dropdowns */
export function getGroupOptions() {
  return GROUP_ORDER.map((key) => ({
    value: key,
    label: IF_GROUPS[key].shortLabel,
    fullLabel: IF_GROUPS[key].label,
  }))
}

/** Badge component props for a given group key */
export function groupBadgeProps(group: IFGroup | null | undefined) {
  if (!group || !IF_GROUPS[group]) return null
  const g = IF_GROUPS[group]
  return { bg: g.badgeBg, text: g.badgeText, label: g.shortLabel }
}

/** Sort federations by group order then by overall score desc */
export function sortFederationsByGroup<T extends { if_group: IFGroup; overall_score?: number }>(
  feds: T[]
): T[] {
  return [...feds].sort((a, b) => {
    const orderDiff =
      (IF_GROUPS[a.if_group]?.order ?? 99) - (IF_GROUPS[b.if_group]?.order ?? 99)
    if (orderDiff !== 0) return orderDiff
    return (b.overall_score ?? 0) - (a.overall_score ?? 0)
  })
}

/** Filter federations by group(s) */
export function filterByGroups<T extends { if_group: IFGroup }>(
  feds: T[],
  activeGroups: IFGroup[]
): T[] {
  if (activeGroups.length === 0) return feds
  return feds.filter((f) => activeGroups.includes(f.if_group))
}
