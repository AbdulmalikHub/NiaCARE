'use client'

import { useLayoutEffect } from 'react'
import { bootstrapNiaAuth } from '../lib/nia/auth'

export default function Home() {
  useLayoutEffect(() => {
    bootstrapNiaAuth()
  }, [])

  return (
    <>
      <div id="login-screen" className="login-screen">
        <div className="login-card">
          <div className="login-brand">NiaCARE</div>
          <p className="login-subtitle">Dental facility operations system</p>
          <p className="login-loading">Loading secure sign-in…</p>
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
