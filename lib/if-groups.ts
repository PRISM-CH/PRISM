// lib/if-groups.ts  ─  PRISM group constants + helpers

export type IFGroup = 'olympic_paris' | 'olympic_milano' | 'arisf' | 'aims'

export interface GroupMeta {
  key: IFGroup
  label: string          // full display label
  shortLabel: string     // pill/badge label
  description: string
  color: string          // primary hex
  accent: string         // lighter accent hex
  order: number          // sort priority
}

export const IF_GROUPS: Record<IFGroup, GroupMeta> = {
  olympic_paris: {
    key: 'olympic_paris',
    label: 'Olympic IFs – Paris 2024',
    shortLabel: 'Summer Olympic',
    description: 'Federations on the Paris 2024 Olympic programme',
    color: '#1d4ed8',
    accent: '#93c5fd',
    order: 1,
  },
  olympic_milano: {
    key: 'olympic_milano',
    label: 'Olympic IFs – Milano Cortina 2026',
    shortLabel: 'Winter Olympic',
    description: 'Federations on the Milano Cortina 2026 Olympic programme',
    color: '#047857',
    accent: '#6ee7b7',
    order: 2,
  },
  arisf: {
    key: 'arisf',
    label: 'ARISF Members',
    shortLabel: 'ARISF',
    description: 'Association of IOC Recognised International Sports Federations',
    color: '#6d28d9',
    accent: '#c4b5fd',
    order: 3,
  },
  aims: {
    key: 'aims',
    label: 'AIMS Members',
    shortLabel: 'AIMS',
    description: 'Alliance of Independent Recognised Members of Sport',
    color: '#b45309',
    accent: '#fcd34d',
    order: 4,
  },
}

export const GROUP_ORDER: IFGroup[] = ['olympic_paris', 'recognized_if', 'arisf', 'aims']

/** Sort federations: group order first, then overall_score desc within group */
export function sortByGroup<T extends { if_group: IFGroup | null; overall_score?: number | null }>(
  feds: T[]
): T[] {
  return [...feds].sort((a, b) => {
    const og = IF_GROUPS[a.if_group as IFGroup]?.order ?? 99
    const ob = IF_GROUPS[b.if_group as IFGroup]?.order ?? 99
    if (og !== ob) return og - ob
    return (Number(b.overall_score) || 0) - (Number(a.overall_score) || 0)
  })
}

/** Tailwind colour classes for a group badge */
export function groupBadge(group: IFGroup | null | undefined): {
  bg: string; text: string; border: string; dot: string
} {
  const classes: Record<IFGroup, { bg: string; text: string; border: string; dot: string }> = {
    olympic_paris:  { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
    recognized_if:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    arisf:          { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500'  },
    aims:           { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  }
  return group && classes[group] ? classes[group] : { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', dot: 'bg-gray-400' }
}
