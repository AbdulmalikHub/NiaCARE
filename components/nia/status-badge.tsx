'use client'

export function StatusBadge({ children, tone = 'success' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status-badge ${tone}`}>{children}</span>
}
