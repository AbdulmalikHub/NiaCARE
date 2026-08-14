export type NiaRole = 'owner' | 'admin' | 'dentist' | 'assistant' | 'front_office' | 'claims'

export type NiaUser = { id: string; name: string; role: NiaRole; initials: string }
export type Patient = { id: string; name: string; age: number; phone: string; status: string; lastVisit: string; nextVisit: string }

export const users: NiaUser[] = [
  { id: 'u_owner_neema', name: 'Dr. Neema Kamau', role: 'owner', initials: 'NK' },
  { id: 'u_admin_yusuf', name: 'Yusuf Ali', role: 'admin', initials: 'YA' },
  { id: 'u_dr_amani', name: 'Dr. Amani Njoroge', role: 'dentist', initials: 'AN' },
  { id: 'u_asst_fatma', name: 'Fatma Hassan', role: 'assistant', initials: 'FH' },
  { id: 'u_fo_brenda', name: 'Brenda Wanjiku', role: 'front_office', initials: 'BW' },
  { id: 'u_claims_zainab', name: 'Zainab Noor', role: 'claims', initials: 'ZN' },
]

export const patients: Patient[] = [
  { id: 'PT-1048', name: 'Amara Mwangi', age: 28, phone: '+254 712 348 201', status: 'Active', lastVisit: 'Aug 08, 2026', nextVisit: 'Aug 20, 2026' },
  { id: 'PT-1047', name: 'Brian Otieno', age: 41, phone: '+254 722 109 443', status: 'Treatment', lastVisit: 'Aug 07, 2026', nextVisit: 'Aug 18, 2026' },
  { id: 'PT-1046', name: 'Lilian Njeri', age: 34, phone: '+254 701 888 122', status: 'Active', lastVisit: 'Aug 06, 2026', nextVisit: 'Sep 02, 2026' },
  { id: 'PT-1045', name: 'David Kiptoo', age: 22, phone: '+254 733 664 190', status: 'Follow-up', lastVisit: 'Aug 04, 2026', nextVisit: 'Aug 16, 2026' },
  { id: 'PT-1044', name: 'Sofia Wambui', age: 52, phone: '+254 711 223 789', status: 'Active', lastVisit: 'Aug 02, 2026', nextVisit: 'Sep 11, 2026' },
]

export const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'patients', label: 'Patients', icon: '♧' },
  { id: 'appointments', label: 'Appointments', icon: '◷' },
  { id: 'treatment-plans', label: 'Treatment Plans', icon: '⊞' },
  { id: 'follow-ups', label: 'Follow-ups', icon: '↗' },
  { id: 'reports', label: 'Reports', icon: '▥' },
  { id: 'team', label: 'Team & Roles', icon: '♙' },
  { id: 'facility-settings', label: 'Facility Settings', icon: '⚙' },
]

export const roleLabels: Record<NiaRole, string> = {
  owner: 'Facility Owner', admin: 'Facility Administrator', dentist: 'Dentist', assistant: 'Dental Assistant', front_office: 'Front Office', claims: 'Claims Officer',
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null
  const id = window.sessionStorage.getItem('nia_user_id')
  return users.find((user) => user.id === id) ?? null
}

export function storeUser(userId: string) {
  window.sessionStorage.setItem('nia_user_id', userId)
}

export function clearUser() {
  window.sessionStorage.removeItem('nia_user_id')
}

export function pageTitle(page: string) {
  return navItems.find((item) => item.id === page)?.label ?? 'Dashboard'
}

export function formatRole(role: NiaRole) {
  return roleLabels[role]
}

export const metrics = [
  { label: 'Total patients', value: '1,248', change: '+12.6%', icon: '♧' },
  { label: "Today's appointments", value: '24', change: '+4.2%', icon: '◷' },
  { label: 'Pending follow-ups', value: '18', change: '-8.4%', icon: '↗' },
  { label: 'Monthly revenue', value: 'KES 842K', change: '+18.9%', icon: '◈' },
]

export const appointments = [
  { time: '08:30', patient: 'Amara Mwangi', procedure: 'Root canal consultation', dentist: 'Dr. Amani', status: 'Confirmed' },
  { time: '09:30', patient: 'Brian Otieno', procedure: 'Braces adjustment', dentist: 'Dr. Neema', status: 'Confirmed' },
  { time: '11:00', patient: 'Lilian Njeri', procedure: 'Routine cleaning', dentist: 'Dr. Amani', status: 'Waiting' },
  { time: '14:00', patient: 'David Kiptoo', procedure: 'Follow-up review', dentist: 'Dr. Neema', status: 'Confirmed' },
]

export const reports = [
  { label: 'Patient growth', value: '18.4%', detail: 'This month', tone: 'success' },
  { label: 'Treatment completion', value: '76.2%', detail: 'Across all plans', tone: 'info' },
  { label: 'Collection rate', value: '91.8%', detail: 'Current period', tone: 'gold' },
]

export const billing = [
  { invoice: 'INV-2048', patient: 'Amara Mwangi', amount: 'KES 24,500', status: 'Paid', date: 'Aug 08, 2026' },
  { invoice: 'INV-2047', patient: 'Brian Otieno', amount: 'KES 18,000', status: 'Pending', date: 'Aug 07, 2026' },
  { invoice: 'INV-2046', patient: 'Lilian Njeri', amount: 'KES 8,500', status: 'Paid', date: 'Aug 06, 2026' },
]

export const getInitials = (name: string) => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
