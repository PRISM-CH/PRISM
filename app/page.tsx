import { getFederationData } from '../lib/supabase'
import ScorecardClient from '../components/ScorecardClient'

export const revalidate = 3600

export default async function Home() {
  const data = await getFederationData('FEI')

  if (!data) {
    return (
      <main style={{ padding: '4rem 2rem', textAlign: 'center', fontFamily: 'sans-serif', color: 'var(--text2)' }}>
        <p>Unable to load scorecard data. Check Supabase connection.</p>
      </main>
    )
  }

  return <ScorecardClient data={data} />
}
