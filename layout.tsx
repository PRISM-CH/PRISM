import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PRISM — International Federation Scorecard',
  description: 'Strategic performance assessment for Olympic International Federations',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
