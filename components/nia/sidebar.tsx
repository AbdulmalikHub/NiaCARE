'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { appointments, billing, formatRole, getInitials, metrics, navItems, pageTitle, patients, reports, roleLabels, storeUser, type NiaRole, type NiaUser } from '../../lib/nia/data'

export function Sidebar({ activePage, user, onNavigate, onLogout }: { activePage: string; user: NiaUser; onNavigate: (page: string) => void; onLogout: () => void }) {
  return <aside className="sidebar"><div className="sidebar-brand"><Image src="/nia/nia-logo.png" alt="NiaCARE logo" width={40} height={40} /><div><strong>NiaCARE</strong><span>FACILITY CONSOLE</span></div></div><div className="facility-switcher"><span className="facility-mark">NC</span><span><b>Nia Dental Centre</b><small>Westlands, Nairobi</small></span><span>⌄</span></div><nav className="sidebar-nav"><p className="nav-label">WORKSPACE</p>{navItems.map((item) => <button key={item.id} className={activePage === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}<p className="nav-label secondary-label">FINANCE</p><button className={activePage === 'billing' ? 'active' : ''} onClick={() => onNavigate('billing')}><span className="nav-icon">◈</span>Billing</button></nav><div className="sidebar-bottom"><div className="user-row"><span className="user-avatar">{user.initials}</span><span><b>{user.name}</b><small>{formatRole(user.role)}</small></span><button className="icon-button" onClick={onLogout} aria-label="Log out">↪</button></div></div></aside>
}
