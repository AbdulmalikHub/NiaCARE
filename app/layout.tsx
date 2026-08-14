import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NiaCARE | Dental System',
  description: 'NiaCARE dental facility operations system',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-[#F6F2FB]">
      <body>{children}</body>
    </html>
  )
}
