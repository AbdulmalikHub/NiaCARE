'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { appointments, billing, formatRole, getInitials, metrics, navItems, pageTitle, patients, reports, roleLabels, storeUser, type NiaRole, type NiaUser } from '../../lib/nia/data'

export function LoginScreen({ onLogin }: { onLogin: (user: NiaUser) => void }) {
  const [selectedRole, setSelectedRole] = useState<NiaRole>('owner')
  const selected = ['owner', 'admin', 'dentist', 'assistant', 'front_office', 'claims'] as NiaRole[]
  const users = selected.map((role) => ({ role, label: roleLabels[role] }))
  return <main className="login-screen"><section className="login-card">
    <div className="login-logo"><Image src="/nia/nia-logo.png" alt="NiaCARE logo" width={54} height={54} /><div><strong>NiaCARE</strong><span>Dental operations, connected.</span></div></div>
    <div className="login-copy"><p className="eyebrow">SECURE FACILITY ACCESS</p><h1>Welcome back.</h1><p>Choose your role to enter the NiaCARE workspace.</p></div>
    <div className="role-list">{users.map(({ role, label }) => <button key={role} className={`role-option ${selectedRole === role ? 'selected' : ''}`} onClick={() => setSelectedRole(role)}><span className="role-avatar">{roleLabels[role].slice(0, 2)}</span><span>{label}</span><span className="role-check">{selectedRole === role ? '✓' : '→'}</span></button>)}</div>
    <button className="primary-button login-button" onClick={() => { const user = (selected as NiaRole[]).map((r) => ({ id: `u_${r === 'owner' ? 'owner_neema' : r === 'admin' ? 'admin_yusuf' : r === 'dentist' ? 'dr_amani' : r === 'assistant' ? 'asst_fatma' : r === 'front_office' ? 'fo_brenda' : 'claims_zainab'}`, name: roleLabels[r], role: r, initials: roleLabels[r].slice(0,2) } as NiaUser)).find((u) => u.role === selectedRole)!; storeUser(user.id); onLogin(user) }}>Continue as {roleLabels[selectedRole]}</button>
    <p className="login-footnote">NiaCARE facility operations system · v2.4</p>
  </section></main>
}
