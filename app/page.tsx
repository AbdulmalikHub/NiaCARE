'use client'

import { useEffect } from 'react'
import { bootstrapNiaAuth } from '../lib/nia/auth'

export default function Home() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        bootstrapNiaAuth()
      } catch (error) {
        console.error('[v0] NiaCARE runtime failed', error)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <div id="login-screen" />
      <div className="app-shell" id="app-shell" style={{ display: 'none' }}>
        <aside className="sidebar" id="nia-sidebar" />
        <div className="main-col"><header className="topbar" id="nia-topbar" /><main className="content" id="content" /></div>
      </div>
    </>
  )
}
