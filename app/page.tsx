'use client'

import { useEffect, useState } from 'react'
import { AppointmentsPage, BillingPage, DashboardPage, LoginScreen, PatientProfile, PatientsPage, ReportsPage, Sidebar, SimplePage, Topbar } from '../components/nia'
import { clearUser, getStoredUser, type NiaUser } from '../lib/nia/data'

export default function Home() {
  const [user, setUser] = useState<NiaUser | null>(null)
  const [page, setPage] = useState('dashboard')
  const [patientId, setPatientId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setUser(getStoredUser()) }, [])

  if (!user) return <LoginScreen onLogin={setUser} />

  const navigate = (nextPage: string) => { setPatientId(null); setPage(nextPage); setMobileOpen(false) }
  const content = patientId ? <PatientProfile patientId={patientId} onBack={() => setPatientId(null)} /> : page === 'dashboard' ? <DashboardPage onNavigate={navigate} /> : page === 'patients' ? <PatientsPage onOpen={setPatientId} /> : page === 'appointments' ? <AppointmentsPage /> : page === 'reports' ? <ReportsPage /> : page === 'billing' ? <BillingPage /> : <SimplePage page={page} />

  return <div className="app-shell"><div className={mobileOpen ? 'sidebar open' : undefined}><Sidebar activePage={patientId ? 'patients' : page} user={user} onNavigate={navigate} onLogout={() => { clearUser(); setUser(null) }} /></div><div className="main-col"><Topbar user={user} activePage={patientId ? 'patients' : page} onMenu={() => setMobileOpen((open) => !open)} /><main className="content">{content}</main></div></div>
}
