'use client'

import { useEffect, useState } from 'react'
import { bootstrapNiaAuth } from '../lib/nia/auth'

const roles = [
  ['u_owner_neema', 'Facility Owner'],
  ['u_admin_yusuf', 'Facility Administrator'],
  ['u_dr_amani', 'Dentist'],
  ['u_asst_fatma', 'Dental Assistant'],
  ['u_fo_brenda', 'Front Office'],
  ['u_claims_zainab', 'Claims Officer'],
] as const

export default function Home() {
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[number][0]>('owner')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        bootstrapNiaAuth()
      } catch (error) {
        console.error('[v0] NiaCARE sign-in bootstrap failed', error)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <div id="login-screen" className="login-screen">
        <div className="login-card">
          <div className="login-brand">NiaCARE</div>
          <p className="login-subtitle">Dental facility operations system</p>
          <p className="login-loading">Choose a role to continue</p>
          <div className="role-grid">
            {roles.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`role-card${selectedRole === id ? ' selected' : ''}`}
                onClick={() => {
                  setSelectedRole(id)
                  sessionStorage.setItem('nia_health_care_session_v1', JSON.stringify({ user_id: id, ts: Date.now() }))
                  window.location.reload()
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="app-shell" id="app-shell" style={{ display: 'none' }}>
        <aside className="sidebar" id="nia-sidebar" />
        <div className="main-col">
          <header className="topbar" id="nia-topbar" />
          <main className="content" id="content" />
        </div>
      </div>
    </>
  )
}
