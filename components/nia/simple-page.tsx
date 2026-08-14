'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { appointments, billing, formatRole, getInitials, metrics, navItems, pageTitle, patients, reports, roleLabels, storeUser, type NiaRole, type NiaUser } from '../../lib/nia/data'
import { StatusBadge } from './status-badge'

export function SimplePage({ page }: { page: string }) { const labels: Record<string, string> = { 'treatment-plans': 'Treatment Plans', 'follow-ups': 'Follow-ups', team: 'Team & Roles', 'facility-settings': 'Facility Settings' }; return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">NiaCARE WORKSPACE</p><h1>{labels[page] ?? 'Workspace'}</h1><p className="muted">Keep your facility operations organized and moving forward.</p></div><button className="primary-button">+ Create new</button></div><section className="panel empty-panel"><div className="empty-icon">✦</div><h3>{labels[page] ?? 'Workspace'} is ready</h3><p>Your role-based workspace will appear here as records are added.</p><button className="text-button">Explore workspace →</button></section></div> }
