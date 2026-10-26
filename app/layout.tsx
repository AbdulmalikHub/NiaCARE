import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NiaCARE | Dental System',
  description: 'NiaCARE dental facility operations system for treatment, appointments, follow-up, finance, and practice operations.',
  themeColor: '#FFFFFF',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-white">
      <body>{children}</body>
    </html>
  )
}
