'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { appointments, billing, formatRole, getInitials, metrics, navItems, pageTitle, patients, reports, roleLabels, storeUser, type NiaRole, type NiaUser } from '../../lib/nia/data'
import { StatusBadge } from './status-badge'

export function AppointmentsPage() { return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">SCHEDULE</p><h1>Appointments</h1><p className="muted">Coordinate today&apos;s chair time across the facility.</p></div><button className="primary-button">+ New appointment</button></div><section className="panel calendar-panel"><div className="calendar-header"><button className="icon-button">‹</button><div><b>August 2026</b><span>Week 33</span></div><button className="icon-button">›</button><button className="filter-button today-button">Today</button></div><div className="week-grid">{['MON 10','TUE 11','WED 12','THU 13','FRI 14','SAT 15'].map((day, index) => <div className={index === 4 ? 'day-column current' : 'day-column'} key={day}><b>{day}</b><span className="day-number">{10 + index}</span>{index === 4 && <><div className="calendar-event event-purple"><b>08:30</b><span>Amara Mwangi</span></div><div className="calendar-event event-gold"><b>11:00</b><span>Lilian Njeri</span></div><div className="calendar-event event-blue"><b>14:00</b><span>David Kiptoo</span></div></>}</div>)}</div></section></div> }
