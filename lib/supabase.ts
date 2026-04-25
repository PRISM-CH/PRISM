// ─────────────────────────────────────────────────────────────────────────────
// PRISM · lib/supabase.ts
// Singleton Supabase client. Import `supabase` from here everywhere.
// NEVER call createClient() inside a component or hook.
// Types have been moved to lib/types.ts — import from there.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Re-export types so callers can import client + types from one place if needed
export type { Federation, Pillar, Objective, Assessment, ScorecardData } from './types'
