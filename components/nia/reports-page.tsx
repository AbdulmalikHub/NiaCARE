'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { appointments, billing, formatRole, getInitials, metrics, navItems, pageTitle, patients, reports, roleLabels, storeUser, type NiaRole, type NiaUser } from '../../lib/nia/data'
import { StatusBadge } from './status-badge'

export function ReportsPage() { return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">INSIGHTS</p><h1>Reports</h1><p className="muted">A clear view of your facility&apos;s performance.</p></div><button className="filter-button">Aug 2026 ˅</button></div><div className="report-grid">{reports.map((report) => <div className="report-card" key={report.label}><span>{report.label}</span><strong>{report.value}</strong><small>{report.detail}</small><div className={`report-line ${report.tone}`} /></div>)}</div><section className="panel report-panel"><div className="panel-header"><div><p className="eyebrow">REVENUE OVERVIEW</p><h3>Monthly performance</h3></div><StatusBadge tone="success">On track</StatusBadge></div><div className="large-chart">{[28,42,36,58,52,66,61,74,68,81,76,92].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div></section></div> }
