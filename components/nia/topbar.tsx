'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { appointments, billing, formatRole, getInitials, metrics, navItems, pageTitle, patients, reports, roleLabels, storeUser, type NiaRole, type NiaUser } from '../../lib/nia/data'

export function Topbar({ user, activePage, onMenu }: { user: NiaUser; activePage: string; onMenu: () => void }) { return <header className="topbar"><button className="mobile-menu" onClick={onMenu}>☰</button><div><p className="breadcrumb">NIA DENTAL CENTRE <span>/</span> WORKSPACE</p><h2>{pageTitle(activePage)}</h2></div><div className="topbar-actions"><button className="topbar-icon" aria-label="Search">⌕</button><button className="topbar-icon" aria-label="Notifications">♧<i /></button><div className="topbar-user"><span>{user.initials}</span><b>{user.name}</b><small>{formatRole(user.role)}</small></div></div></header> }

function StatusBadge({ children, tone = 'success' }: { children: React.ReactNode; tone?: string }) { return <span className={`status-badge ${tone}`}>{children}</span> }
