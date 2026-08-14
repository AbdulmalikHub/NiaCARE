export function createNiaApp() {
  const root = document.getElementById('login-screen')
  if (root && !root.innerHTML) {
    root.innerHTML = '<div class="login-card"><div class="login-brand">NiaCARE</div><p class="login-subtitle">Dental facility operations system</p></div>'
  }
  return root
}
