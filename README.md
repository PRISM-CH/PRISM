# PRISM

**Performance Rating of International Sport Management**

An independent benchmarking and scoring dashboard for International Federations (IFs), built on publicly available governance, strategy, and accountability data.

→ [prism-peach-delta.vercel.app](https://prism-peach-delta.vercel.app)

---

## What it does

PRISM scores IFs across five performance dimensions — governance, athlete services, commercial development, sustainability, and digital presence — using a structured methodology applied to public documents: annual reports, strategy papers, IOC IF governance reviews, and published benchmarks.

Each federation receives a score out of 100 per pillar and an overall grade. Scores reflect documented commitments, institutional capacity, and measurable outputs. The dashboard lets you navigate between federations and compare pillar performance against an ASOIF benchmark average on a radar chart.

**Federations currently assessed:** FEI · WA · WAQ · UIPM

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Charts | Recharts |
| Auth | Supabase Auth |

---

## Database schema

Four tables in Supabase:

```
federations   — one row per IF (name, abbreviation, sport, HQ, founding year, stats)
pillars       — performance dimensions linked to a federation_id
objectives    — scored criteria linked to a pillar_id (score, benchmark, evidence, trend)
assessments   — overall score and grade per federation per year
```

Relationships: `federations → pillars → objectives`, `federations → assessments`

---

## Local development

**Prerequisites:** Node.js 18+, a Supabase project with the schema above.

```bash
git clone https://github.com/PRISM-CH/PRISM.git
cd PRISM
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm run dev
# → http://localhost:3000
```

---

## Deployment

The repo is connected to Vercel via GitHub. Every push to `main` triggers a production deployment automatically.

Set the same two environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings under **Settings → Environment Variables**.

---

## Adding a federation

1. Insert a row into `federations` with the new IF's details and a unique `abbreviation`.
2. Insert rows into `pillars` (linked by `federation_id`) and `objectives` (linked by `pillar_id`).
3. Insert a row into `assessments` with `overall_score`, `grade`, and `assessment_year`.
4. Add the abbreviation to the `FEDERATIONS` array in `ScorecardClient.tsx`:

```ts
const FEDERATIONS = ['FEI', 'WA', 'WAQ', 'UIPM', 'YOUR_NEW_IF'] as const
```

The carousel picks it up automatically.

---

## Methodology

Scores are produced through structured desk research against a fixed rubric per pillar. Each objective is scored 0–100 by the analyst and cross-referenced against at least one primary source (strategy document, annual report, or official IF publication). The benchmark line on the radar chart represents the ASOIF IF Governance Review average.

Assessment cycle: annual. Current data reflects Q1 2025 for 2024/2025 strategy periods.

---

## Project structure

```
app/
  page.tsx              # Entry point — auth gate + layout
  scorecard/
    ScorecardClient.tsx # Main dashboard component + federation carousel
lib/
  supabase.ts           # Supabase client initialisation
vercel.json             # Vercel routing config
```

---

## Status

Early-stage research tool. Data quality and coverage will improve as more federations are assessed and the methodology is refined through peer review.

Contributions, corrections, and federation data submissions welcome via Issues.
