import { ScorecardClient } from '@/app/components/ScorecardClient'

export const metadata = {
  title: 'PRISM — International Federation Scorecard',
  description: 'Strategic performance assessment for Olympic International Federations',
}

export default function Home() {
  return <ScorecardClient />
}
