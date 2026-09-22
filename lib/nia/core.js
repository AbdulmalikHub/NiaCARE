// Shared NiaCARE runtime and DOM helpers.

const NIA_LOGO_DATA_URI = '/nia.png';

/* ============================================================
   NiaCARE | Data Layer
   Implements the entity model from the SmilePath schema:
   Facility -> Users -> Patients -> Treatment Plans -> Procedures
   -> Appointments -> Follow-Ups, plus Root Canal & Braces tracks.
   Persisted to localStorage so state survives across the linked
   pages of this multi-page system.
   ============================================================ */

const NIA_DB_KEY = 'nia_health_care_db_v1';
const NIA_SESSION_KEY = 'nia_health_care_session_v1';

const NIA_ROLES = [
  { id: 'dentist', label: 'Dentist', icon: 'tooth' },
  { id: 'assistant', label: 'Dental Assistant', icon: 'clipboard' },
  { id: 'front_office', label: 'Front Office', icon: 'desk' },
  { id: 'claims', label: 'Claims Officer', icon: 'shield' },
  { id: 'admin', label: 'Facility Administrator', icon: 'admin' },
  { id: 'owner', label: 'Facility Owner', icon: 'crown' },
];

/* Platform-level role — not tied to any single facility, never shown on the
   public facility-staff role picker. Reached only via the hidden Developer
   Access entry point on the login screen. */
const NIA_PLATFORM_ROLE = { id: 'super_admin', label: 'Super Admin / Developer', icon: 'globe' };

const NIA_SUBSCRIPTION_FEE_USD = 200;
const NIA_GRACE_PERIOD_DAYS = 3;
const NIA_BILLING_CYCLE_DAYS = 30;

const NIA_MPESA_CONFIG = {
  paybill_number: '4127 590',
  account_reference_prefix: 'NIA-',
  business_short_code: '174379',
  till_name: 'NiaCARE Ltd',
  support_phone: '+254 712 445 980',
  support_email: 'billing@niahealthcare.co.ke',
  daraja_env: 'sandbox',
  daraja_integration_status: 'Not yet connected — currently simulated. Built to drop in Safaricom Daraja STK Push + C2B credentials when ready for production.',
};

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

function fmtKES(n) {
  if (n === undefined || n === null) return 'KES 0';
  return 'KES ' + Number(n).toLocaleString('en-KE', { maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysBetween(d1, d2) {
  const a = new Date(d1), b = new Date(d2);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

/* ---------------- Subscription helpers ---------------- */
function niaBuildSubscription(startDate, cyclesPaid, statusOverride) {
  // Builds a subscription where the most recent due date is `cyclesPaid` cycles
  // after startDate, with full payment history for each prior cycle.
  const payments = [];
  let dueDate = startDate;
  for (let i = 0; i < cyclesPaid; i++) {
    const paidOn = dueDate;
    payments.push({
      payment_id: uid('pay'), amount_usd: NIA_SUBSCRIPTION_FEE_USD, method: i === 0 ? 'Bank Transfer' : 'M-Pesa',
      mpesa_receipt: i === 0 ? null : 'S' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      paid_at: paidOn, confirmed_by: 'system_seed', cycle_start: dueDate, cycle_end: addDaysISO(dueDate, NIA_BILLING_CYCLE_DAYS),
    });
    dueDate = addDaysISO(dueDate, NIA_BILLING_CYCLE_DAYS);
  }
  return {
    monthly_fee_usd: NIA_SUBSCRIPTION_FEE_USD,
    billing_cycle_start: startDate,
    next_due_date: dueDate,
    status: statusOverride || 'active', // active | grace | locked
    grace_started_at: null,
    mpesa_number_on_file: '+254 712 445 980',
    payments,
  };
}

function addDaysISO(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------------- Seed data builder ---------------- */
function buildSeedData() {
  const facilities = [
    {
      facility_id: 'fac_001',
      facility_name: 'NiaCARE | Nyali Dental Centre',
      facility_code: 'NIA-MSA-01',
      facility_email: 'frontdesk@niahealthcare.co.ke',
      facility_phone: '+254 712 445 980',
      county: 'Mombasa',
      active_status: true,
      onboarded_at: '2024-02-10',
      created_at: '2024-02-10',
      subscription: niaBuildSubscription('2026-08-18', 1, 'active'), // due 2026-09-17 — current billing cycle
    },
    {
      facility_id: 'fac_002',
      parent_facility_id: 'fac_001',
      facility_name: 'NiaCARE | Kileleshwa Smile Studio',
      facility_code: 'NIA-NRB-02',
      facility_email: 'info@kileleshwasmile.co.ke',
      facility_phone: '+254 721 334 510',
      county: 'Nairobi',
      active_status: true,
      onboarded_at: '2024-08-05',
      created_at: '2024-08-05',
      subscription: niaBuildSubscription('2026-03-22', 3, 'active'), // comfortably paid up, due 2026-06-20
    },
    {
      facility_id: 'fac_003',
      facility_name: 'NiaCARE | Eldoret Family Dental',
      facility_code: 'NIA-ELD-03',
      facility_email: 'admin@eldoretfamilydental.co.ke',
      facility_phone: '+254 733 902 218',
      county: 'Uasin Gishu',
      active_status: false,
      onboarded_at: '2024-11-12',
      created_at: '2024-11-12',
      subscription: niaBuildSubscription('2026-01-08', 2, 'locked'), // discontinued — stopped paying, now locked
    },
  ];
  // Force fac_003's subscription into a locked state with an overdue date in the past
  facilities[2].subscription.next_due_date = '2026-05-08';
  facilities[2].subscription.status = 'locked';
  facilities[2].subscription.grace_started_at = '2026-05-08';

  const facility = facilities[0]; // legacy convenience reference, re-pointed per-session in niaRequireAuth

  const users = [
    { user_id: 'u_dr_amani', facility_id: 'fac_001', full_name: 'Dr. Amani Said', email: 'amani.said@niahealthcare.co.ke', role: 'dentist', active_status: true, created_at: '2024-02-10' },
    { user_id: 'u_dr_chebet', facility_id: 'fac_001', full_name: 'Dr. Lindiwe Chebet', email: 'lindiwe.chebet@niahealthcare.co.ke', role: 'dentist', active_status: true, created_at: '2024-03-01' },
    { user_id: 'u_asst_fatma', facility_id: 'fac_001', full_name: 'Fatma Juma', email: 'fatma.juma@niahealthcare.co.ke', role: 'assistant', active_status: true, created_at: '2024-02-12' },
    { user_id: 'u_fo_brenda', facility_id: 'fac_001', full_name: 'Brenda Atieno', email: 'brenda.atieno@niahealthcare.co.ke', role: 'front_office', active_status: true, created_at: '2024-02-12' },
    { user_id: 'u_fo_kevin', facility_id: 'fac_001', full_name: 'Kevin Mwangangi', email: 'kevin.mwangangi@niahealthcare.co.ke', role: 'front_office', active_status: true, created_at: '2024-04-18' },
    { user_id: 'u_claims_zainab', facility_id: 'fac_001', full_name: 'Zainab Hassan', email: 'zainab.hassan@niahealthcare.co.ke', role: 'claims', active_status: true, created_at: '2024-03-22' },
    { user_id: 'u_admin_yusuf', facility_id: 'fac_001', full_name: 'Yusuf Bakari', email: 'yusuf.bakari@niahealthcare.co.ke', role: 'admin', active_status: true, created_at: '2024-02-10' },
    { user_id: 'irene', facility_id: 'fac_001', full_name: 'Irene Ogongo', email: 'irene.ogongo@niahealthcare.co.ke', role: 'owner', active_status: true, created_at: '2024-02-10' },

    /* Kileleshwa Smile Studio (fac_002) — minimal staff, paid up */
    { user_id: 'u_dr_kamau', facility_id: 'fac_002', full_name: 'Dr. Peter Kamau', email: 'peter.kamau@kileleshwasmile.co.ke', role: 'dentist', active_status: true, created_at: '2024-08-05' },
    { user_id: 'u_owner_wanjiku', facility_id: 'fac_002', full_name: 'Wanjiku Njoroge', email: 'wanjiku@kileleshwasmile.co.ke', role: 'owner', active_status: true, created_at: '2024-08-05' },
    { user_id: 'u_admin_otieno', facility_id: 'fac_002', full_name: 'Otieno Were', email: 'otieno@kileleshwasmile.co.ke', role: 'admin', active_status: true, created_at: '2024-08-06' },

    /* Eldoret Family Dental (fac_003) — discontinued/locked facility */
    { user_id: 'u_dr_ruto', facility_id: 'fac_003', full_name: 'Dr. Sammy Ruto', email: 'sammy.ruto@eldoretfamilydental.co.ke', role: 'dentist', active_status: true, created_at: '2024-11-12' },
    { user_id: 'u_owner_chebet', facility_id: 'fac_003', full_name: 'Joyce Chebet', email: 'joyce@eldoretfamilydental.co.ke', role: 'owner', active_status: true, created_at: '2024-11-12' },

    /* Platform-level developer/super admin — not bound to any single facility */
    { user_id: 'u_super_root', facility_id: null, full_name: 'NIA Platform Admin', email: 'platform@niahealthcare.co.ke', role: 'super_admin', active_status: true, created_at: '2024-01-01' },
  ];

  const patients = [
    { patient_id: 'p_001', facility_id: 'fac_001', patient_number: 'NIA-P-1001', first_name: 'Halima', last_name: 'Mwinyi', phone_number: '+254 722 110 234', email: 'halima.mwinyi@gmail.com', date_of_birth: '1990-04-12', gender: 'Female', payment_type: 'Cash', created_at: '2025-09-02' },
    { patient_id: 'p_002', facility_id: 'fac_001', patient_number: 'NIA-P-1002', first_name: 'Brian', last_name: 'Otieno', phone_number: '+254 733 882 110', email: 'brian.otieno@yahoo.com', date_of_birth: '1985-11-03', gender: 'Male', payment_type: 'Insurance — AAR', created_at: '2025-09-10' },
    { patient_id: 'p_003', facility_id: 'fac_001', patient_number: 'NIA-P-1003', first_name: 'Aisha', last_name: 'Said', phone_number: '+254 700 556 781', email: 'aisha.said@gmail.com', date_of_birth: '2010-06-21', gender: 'Female', payment_type: 'Cash', created_at: '2025-10-01' },
    { patient_id: 'p_004', facility_id: 'fac_001', patient_number: 'NIA-P-1004', first_name: 'Kevin', last_name: 'Mutiso', phone_number: '+254 711 290 442', email: 'kevin.mutiso@gmail.com', date_of_birth: '1978-01-29', gender: 'Male', payment_type: 'Insurance — Jubilee', created_at: '2025-10-08' },
    { patient_id: 'p_005', facility_id: 'fac_001', patient_number: 'NIA-P-1005', first_name: 'Faith', last_name: 'Wanjiru', phone_number: '+254 720 671 209', email: 'faith.wanjiru@outlook.com', date_of_birth: '1995-08-17', gender: 'Female', payment_type: 'Cash', created_at: '2025-10-15' },
    { patient_id: 'p_006', facility_id: 'fac_001', patient_number: 'NIA-P-1006', first_name: 'Omar', last_name: 'Abdalla', phone_number: '+254 705 334 887', email: 'omar.abdalla@gmail.com', date_of_birth: '2001-02-14', gender: 'Male', payment_type: 'Cash', created_at: '2025-11-01' },
    { patient_id: 'p_007', facility_id: 'fac_001', patient_number: 'NIA-P-1007', first_name: 'Grace', last_name: 'Kerubo', phone_number: '+254 718 442 990', email: 'grace.kerubo@gmail.com', date_of_birth: '1988-12-05', gender: 'Female', payment_type: 'Insurance — NHIF SHA', created_at: '2025-11-12' },
    { patient_id: 'p_008', facility_id: 'fac_001', patient_number: 'NIA-P-1008', first_name: 'Daniel', last_name: 'Kazungu', phone_number: '+254 729 887 651', email: 'daniel.kazungu@gmail.com', date_of_birth: '1999-07-23', gender: 'Male', payment_type: 'Cash', created_at: '2025-11-20' },
    { patient_id: 'p_009', facility_id: 'fac_001', patient_number: 'NIA-P-1009', first_name: 'Mwanaisha', last_name: 'Rashid', phone_number: '+254 733 119 462', email: 'mwanaisha.rashid@gmail.com', date_of_birth: '1992-03-30', gender: 'Female', payment_type: 'Cash', created_at: '2025-12-02' },
    { patient_id: 'p_010', facility_id: 'fac_001', patient_number: 'NIA-P-1010', first_name: 'Collins', last_name: 'Mwakio', phone_number: '+254 700 882 213', email: 'collins.mwakio@gmail.com', date_of_birth: '1983-09-09', gender: 'Male', payment_type: 'Insurance — AAR', created_at: '2025-12-10' },
    { patient_id: 'p_011', facility_id: 'fac_001', patient_number: 'NIA-P-1011', first_name: 'Sharon', last_name: 'Chepkemoi', phone_number: '+254 712 556 330', email: 'sharon.chepkemoi@gmail.com', date_of_birth: '2013-05-18', gender: 'Female', payment_type: 'Cash', created_at: '2026-01-05' },
    { patient_id: 'p_012', facility_id: 'fac_001', patient_number: 'NIA-P-1012', first_name: 'Hassan', last_name: 'Mohamed', phone_number: '+254 722 998 104', email: 'hassan.mohamed@gmail.com', date_of_birth: '1975-10-11', gender: 'Male', payment_type: 'Cash', created_at: '2026-01-22' },
    { patient_id: 'p_013', facility_id: 'fac_001', patient_number: 'NIA-P-1013', first_name: 'Lucy', last_name: 'Achieng', phone_number: '+254 740 221 567', email: 'lucy.achieng@gmail.com', date_of_birth: '1996-02-09', gender: 'Female', payment_type: 'Cash', created_at: '2026-02-14' },
    { patient_id: 'p_014', facility_id: 'fac_001', patient_number: 'NIA-P-1014', first_name: 'Peter', last_name: 'Karisa', phone_number: '+254 708 663 415', email: 'peter.karisa@gmail.com', date_of_birth: '1991-06-26', gender: 'Male', payment_type: 'Insurance — Jubilee', created_at: '2026-03-01' },
    { patient_id: 'p_015', facility_id: 'fac_001', patient_number: 'NIA-P-1015', first_name: 'Zawadi', last_name: 'Mwakio', phone_number: '+254 715 884 220', email: 'zawadi.mwakio@gmail.com', date_of_birth: '2015-04-02', gender: 'Female', payment_type: 'Cash', created_at: '2026-04-09' },
  ];

  const plans = [
    { treatment_plan_id: 'tp_001', facility_id: 'fac_001', patient_id: 'p_001', dentist_id: 'u_dr_amani', plan_number: 'NIA-TP-2025-014', treatment_plan_date: '2025-09-03', total_estimated_value: 68000, status: 'Completed', treatment_plan_shared: true, sharing_method: 'WhatsApp', shared_date: '2025-09-03', notes: 'Full mouth scaling + crown #26.', created_at: '2025-09-02' },
    { treatment_plan_id: 'tp_002', facility_id: 'fac_001', patient_id: 'p_002', dentist_id: 'u_dr_chebet', plan_number: 'NIA-TP-2025-027', treatment_plan_date: '2025-09-12', total_estimated_value: 145000, status: 'In Progress', treatment_plan_shared: true, sharing_method: 'Email', shared_date: '2025-09-12', notes: 'Root canal molar 36 + post-care crown.', created_at: '2025-09-10' },
    { treatment_plan_id: 'tp_003', facility_id: 'fac_001', patient_id: 'p_003', dentist_id: 'u_dr_amani', plan_number: 'NIA-TP-2025-031', treatment_plan_date: '2025-10-02', total_estimated_value: 220000, status: 'In Progress', treatment_plan_shared: true, sharing_method: 'Printed', shared_date: '2025-10-02', notes: 'Orthodontic braces, 18-month plan.', created_at: '2025-10-01' },
    { treatment_plan_id: 'tp_004', facility_id: 'fac_001', patient_id: 'p_004', dentist_id: 'u_dr_chebet', plan_number: 'NIA-TP-2025-039', treatment_plan_date: '2025-10-09', total_estimated_value: 35000, status: 'Accepted', treatment_plan_shared: true, sharing_method: 'WhatsApp', shared_date: '2025-10-09', notes: 'Extraction tooth 38 + scaling.', created_at: '2025-10-08' },
    { treatment_plan_id: 'tp_005', facility_id: 'fac_001', patient_id: 'p_005', dentist_id: 'u_dr_amani', plan_number: 'NIA-TP-2025-044', treatment_plan_date: '2025-10-16', total_estimated_value: 18000, status: 'Shared', treatment_plan_shared: true, sharing_method: 'Email', shared_date: '2025-10-16', notes: 'Composite filling tooth 14.', created_at: '2025-10-15' },
    { treatment_plan_id: 'tp_006', facility_id: 'fac_001', patient_id: 'p_006', dentist_id: 'u_dr_chebet', plan_number: 'NIA-TP-2025-052', treatment_plan_date: '2025-11-02', total_estimated_value: 52000, status: 'Rejected', treatment_plan_shared: true, sharing_method: 'WhatsApp', shared_date: '2025-11-02', notes: 'Patient opted for treatment elsewhere.', created_at: '2025-11-01' },
    { treatment_plan_id: 'tp_007', facility_id: 'fac_001', patient_id: 'p_007', dentist_id: 'u_dr_amani', plan_number: 'NIA-TP-2025-061', treatment_plan_date: '2025-11-13', total_estimated_value: 96000, status: 'Dropped Off', treatment_plan_shared: true, sharing_method: 'Printed', shared_date: '2025-11-13', notes: 'No contact since acceptance — recovery needed.', created_at: '2025-11-12' },
    { treatment_plan_id: 'tp_008', facility_id: 'fac_001', patient_id: 'p_008', dentist_id: 'u_dr_chebet', plan_number: 'NIA-TP-2025-068', treatment_plan_date: '2025-11-21', total_estimated_value: 28000, status: 'Completed', treatment_plan_shared: true, sharing_method: 'WhatsApp', shared_date: '2025-11-21', notes: 'Two extractions, completed in one session.', created_at: '2025-11-20' },
    { treatment_plan_id: 'tp_009', facility_id: 'fac_001', patient_id: 'p_009', dentist_id: 'u_dr_amani', plan_number: 'NIA-TP-2025-074', treatment_plan_date: '2025-12-03', total_estimated_value: 175000, status: 'In Progress', treatment_plan_shared: true, sharing_method: 'Email', shared_date: '2025-12-03', notes: 'Root canal molar 46, multi-session.', created_at: '2025-12-02' },
    { treatment_plan_id: 'tp_010', facility_id: 'fac_001', patient_id: 'p_010', dentist_id: 'u_dr_chebet', plan_number: 'NIA-TP-2025-081', treatment_plan_date: '2025-12-11', total_estimated_value: 41000, status: 'Accepted', treatment_plan_shared: true, sharing_method: 'WhatsApp', shared_date: '2025-12-11', notes: 'Crown tooth 26 after old filling failure.', created_at: '2025-12-10' },
    { treatment_plan_id: 'tp_011', facility_id: 'fac_001', patient_id: 'p_011', dentist_id: 'u_dr_amani', plan_number: 'NIA-TP-2026-006', treatment_plan_date: '2026-01-06', total_estimated_value: 240000, status: 'In Progress', treatment_plan_shared: true, sharing_method: 'Printed', shared_date: '2026-01-06', notes: 'Orthodontic braces — child, 24-month plan.', created_at: '2026-01-05' },
    { treatment_plan_id: 'tp_012', facility_id: 'fac_001', patient_id: 'p_012', dentist_id: 'u_dr_chebet', plan_number: 'NIA-TP-2026-013', treatment_plan_date: '2026-01-23', total_estimated_value: 22000, status: 'Draft', treatment_plan_shared: false, sharing_method: null, shared_date: null, notes: 'Awaiting dentist final sign-off.', created_at: '2026-01-22' },
    { treatment_plan_id: 'tp_013', facility_id: 'fac_001', patient_id: 'p_013', dentist_id: 'u_dr_amani', plan_number: 'NIA-TP-2026-021', treatment_plan_date: '2026-02-15', total_estimated_value: 64000, status: 'Shared', treatment_plan_shared: true, sharing_method: 'WhatsApp', shared_date: '2026-02-15', notes: 'Scaling, polishing, and 2 fillings.', created_at: '2026-02-14' },
    { treatment_plan_id: 'tp_014', facility_id: 'fac_001', patient_id: 'p_014', dentist_id: 'u_dr_chebet', plan_number: 'NIA-TP-2026-028', treatment_plan_date: '2026-03-02', total_estimated_value: 89000, status: 'Dropped Off', treatment_plan_shared: true, sharing_method: 'Email', shared_date: '2026-03-02', notes: 'Accepted but never booked appointment.', created_at: '2026-03-01' },
    { treatment_plan_id: 'tp_015', facility_id: 'fac_001', patient_id: 'p_015', dentist_id: 'u_dr_amani', plan_number: 'NIA-TP-2026-035', treatment_plan_date: '2026-04-10', total_estimated_value: 195000, status: 'In Progress', treatment_plan_shared: true, sharing_method: 'Printed', shared_date: '2026-04-10', notes: 'Orthodontic braces, early monitoring stage.', created_at: '2026-04-09' },
  ];

  const procedures = [
    { procedure_id: 'pr_001', treatment_plan_id: 'tp_001', procedure_name: 'Scaling and Polishing', tooth_number: null, estimated_cost: 8000, priority: 'Medium', status: 'Completed', next_session_date: null, notes: '', created_at: '2025-09-03' },
    { procedure_id: 'pr_002', treatment_plan_id: 'tp_001', procedure_name: 'Crown Tooth 26', tooth_number: '26', estimated_cost: 60000, priority: 'High', status: 'Completed', next_session_date: null, notes: '', created_at: '2025-09-03' },
    { procedure_id: 'pr_003', treatment_plan_id: 'tp_002', procedure_name: 'Root Canal Tooth 36', tooth_number: '36', estimated_cost: 85000, priority: 'High', status: 'In Progress', next_session_date: '2026-06-22', notes: 'Session 2 of 3.', created_at: '2025-09-12' },
    { procedure_id: 'pr_004', treatment_plan_id: 'tp_002', procedure_name: 'Crown Tooth 36 (post root canal)', tooth_number: '36', estimated_cost: 60000, priority: 'Medium', status: 'Planned', next_session_date: null, notes: '', created_at: '2025-09-12' },
    { procedure_id: 'pr_005', treatment_plan_id: 'tp_003', procedure_name: 'Orthodontic Braces — Full Arch', tooth_number: null, estimated_cost: 220000, priority: 'High', status: 'In Progress', next_session_date: '2026-06-25', notes: 'Monthly adjustment cycle.', created_at: '2025-10-02' },
    { procedure_id: 'pr_006', treatment_plan_id: 'tp_004', procedure_name: 'Extraction Tooth 38', tooth_number: '38', estimated_cost: 12000, priority: 'High', status: 'Scheduled', next_session_date: '2026-06-19', notes: '', created_at: '2025-10-09' },
    { procedure_id: 'pr_007', treatment_plan_id: 'tp_004', procedure_name: 'Scaling and Polishing', tooth_number: null, estimated_cost: 8000, priority: 'Low', status: 'Planned', next_session_date: null, notes: '', created_at: '2025-10-09' },
    { procedure_id: 'pr_008', treatment_plan_id: 'tp_005', procedure_name: 'Composite Filling Tooth 14', tooth_number: '14', estimated_cost: 18000, priority: 'Medium', status: 'Planned', next_session_date: null, notes: 'Awaiting patient decision.', created_at: '2025-10-16' },
    { procedure_id: 'pr_009', treatment_plan_id: 'tp_007', procedure_name: 'Crown Tooth 11', tooth_number: '11', estimated_cost: 65000, priority: 'High', status: 'Planned', next_session_date: null, notes: 'Accepted — no booking yet.', created_at: '2025-11-13' },
    { procedure_id: 'pr_010', treatment_plan_id: 'tp_007', procedure_name: 'Scaling and Polishing', tooth_number: null, estimated_cost: 8000, priority: 'Low', status: 'Planned', next_session_date: null, notes: '', created_at: '2025-11-13' },
    { procedure_id: 'pr_011', treatment_plan_id: 'tp_008', procedure_name: 'Extraction Tooth 18', tooth_number: '18', estimated_cost: 14000, priority: 'High', status: 'Completed', next_session_date: null, notes: '', created_at: '2025-11-21' },
    { procedure_id: 'pr_012', treatment_plan_id: 'tp_008', procedure_name: 'Extraction Tooth 48', tooth_number: '48', estimated_cost: 14000, priority: 'High', status: 'Completed', next_session_date: null, notes: '', created_at: '2025-11-21' },
    { procedure_id: 'pr_013', treatment_plan_id: 'tp_009', procedure_name: 'Root Canal Tooth 46', tooth_number: '46', estimated_cost: 90000, priority: 'High', status: 'In Progress', next_session_date: '2026-06-20', notes: 'Session 1 of 3 completed.', created_at: '2025-12-03' },
    { procedure_id: 'pr_014', treatment_plan_id: 'tp_009', procedure_name: 'Crown Tooth 46 (post root canal)', tooth_number: '46', estimated_cost: 60000, priority: 'Medium', status: 'Planned', next_session_date: null, notes: '', created_at: '2025-12-03' },
    { procedure_id: 'pr_015', treatment_plan_id: 'tp_010', procedure_name: 'Crown Tooth 26', tooth_number: '26', estimated_cost: 41000, priority: 'High', status: 'Scheduled', next_session_date: '2026-06-23', notes: '', created_at: '2025-12-11' },
    { procedure_id: 'pr_016', treatment_plan_id: 'tp_011', procedure_name: 'Orthodontic Braces — Full Arch', tooth_number: null, estimated_cost: 240000, priority: 'High', status: 'In Progress', next_session_date: '2026-06-21', notes: 'Stage 2 of 6, review monthly.', created_at: '2026-01-06' },
    { procedure_id: 'pr_017', treatment_plan_id: 'tp_012', procedure_name: 'Filling Tooth 25', tooth_number: '25', estimated_cost: 22000, priority: 'Medium', status: 'Planned', next_session_date: null, notes: 'Plan not yet shared.', created_at: '2026-01-23' },
    { procedure_id: 'pr_018', treatment_plan_id: 'tp_013', procedure_name: 'Scaling and Polishing', tooth_number: null, estimated_cost: 8000, priority: 'Low', status: 'Planned', next_session_date: null, notes: '', created_at: '2026-02-15' },
    { procedure_id: 'pr_019', treatment_plan_id: 'tp_013', procedure_name: 'Filling Tooth 16', tooth_number: '16', estimated_cost: 18000, priority: 'Medium', status: 'Planned', next_session_date: null, notes: '', created_at: '2026-02-15' },
    { procedure_id: 'pr_020', treatment_plan_id: 'tp_013', procedure_name: 'Filling Tooth 24', tooth_number: '24', estimated_cost: 18000, priority: 'Medium', status: 'Planned', next_session_date: null, notes: '', created_at: '2026-02-15' },
    { procedure_id: 'pr_021', treatment_plan_id: 'tp_014', procedure_name: 'Crown Tooth 21', tooth_number: '21', estimated_cost: 65000, priority: 'High', status: 'Planned', next_session_date: null, notes: 'Accepted, never booked — 60+ days inactive.', created_at: '2026-03-02' },
    { procedure_id: 'pr_022', treatment_plan_id: 'tp_015', procedure_name: 'Orthodontic Braces — Full Arch', tooth_number: null, estimated_cost: 195000, priority: 'High', status: 'In Progress', next_session_date: '2026-06-24', notes: 'Stage 1 of 7.', created_at: '2026-04-10' },
  ];

  const appointments = [
    { appointment_id: 'ap_001', facility_id: 'fac_001', patient_id: 'p_002', treatment_plan_id: 'tp_002', procedure_id: 'pr_003', provider_id: 'u_dr_chebet', appointment_date: '2026-06-20', appointment_time: '09:00', status: 'Scheduled', notes: 'Root canal session 2.', created_at: '2026-06-10' },
    { appointment_id: 'ap_002', facility_id: 'fac_001', patient_id: 'p_009', treatment_plan_id: 'tp_009', procedure_id: 'pr_013', provider_id: 'u_dr_amani', appointment_date: '2026-06-20', appointment_time: '11:00', status: 'Scheduled', notes: 'Root canal session 2 of 3.', created_at: '2026-06-09' },
    { appointment_id: 'ap_003', facility_id: 'fac_001', patient_id: 'p_004', treatment_plan_id: 'tp_004', procedure_id: 'pr_006', provider_id: 'u_dr_chebet', appointment_date: '2026-06-19', appointment_time: '14:30', status: 'Scheduled', notes: 'Extraction tooth 38.', created_at: '2026-06-12' },
    { appointment_id: 'ap_004', facility_id: 'fac_001', patient_id: 'p_011', treatment_plan_id: 'tp_011', procedure_id: 'pr_016', provider_id: 'u_dr_amani', appointment_date: '2026-06-21', appointment_time: '10:00', status: 'Scheduled', notes: 'Braces adjustment, stage 2.', created_at: '2026-06-05' },
    { appointment_id: 'ap_005', facility_id: 'fac_001', patient_id: 'p_010', treatment_plan_id: 'tp_010', procedure_id: 'pr_015', provider_id: 'u_dr_chebet', appointment_date: '2026-06-23', appointment_time: '09:30', status: 'Scheduled', notes: 'Crown fitting tooth 26.', created_at: '2026-06-11' },
    { appointment_id: 'ap_006', facility_id: 'fac_001', patient_id: 'p_003', treatment_plan_id: 'tp_003', procedure_id: 'pr_005', provider_id: 'u_dr_amani', appointment_date: '2026-06-25', appointment_time: '15:00', status: 'Scheduled', notes: 'Monthly braces adjustment.', created_at: '2026-06-13' },
    { appointment_id: 'ap_007', facility_id: 'fac_001', patient_id: 'p_015', treatment_plan_id: 'tp_015', procedure_id: 'pr_022', provider_id: 'u_dr_amani', appointment_date: '2026-06-24', appointment_time: '11:30', status: 'Scheduled', notes: 'Braces stage 1 review.', created_at: '2026-06-14' },
    { appointment_id: 'ap_008', facility_id: 'fac_001', patient_id: 'p_001', treatment_plan_id: 'tp_001', procedure_id: 'pr_002', provider_id: 'u_dr_amani', appointment_date: '2025-09-20', appointment_time: '10:00', status: 'Completed', notes: 'Crown fitted successfully.', created_at: '2025-09-15' },
    { appointment_id: 'ap_009', facility_id: 'fac_001', patient_id: 'p_008', treatment_plan_id: 'tp_008', procedure_id: 'pr_011', provider_id: 'u_dr_chebet', appointment_date: '2025-11-25', appointment_time: '13:00', status: 'Completed', notes: 'Both extractions done same session.', created_at: '2025-11-22' },
    { appointment_id: 'ap_010', facility_id: 'fac_001', patient_id: 'p_006', treatment_plan_id: 'tp_006', procedure_id: null, provider_id: 'u_dr_chebet', appointment_date: '2025-11-05', appointment_time: '09:00', status: 'No Show', notes: 'Patient did not attend consult.', created_at: '2025-11-02' },
    { appointment_id: 'ap_011', facility_id: 'fac_001', patient_id: 'p_005', treatment_plan_id: 'tp_005', procedure_id: 'pr_008', provider_id: 'u_dr_amani', appointment_date: '2026-06-15', appointment_time: '10:30', status: 'No Show', notes: 'Did not arrive — follow-up triggered.', created_at: '2026-06-08' },
    { appointment_id: 'ap_012', facility_id: 'fac_001', patient_id: 'p_012', treatment_plan_id: 'tp_012', procedure_id: 'pr_017', provider_id: 'u_dr_chebet', appointment_date: '2026-06-18', appointment_time: '08:30', status: 'Cancelled', notes: 'Rescheduling requested by patient.', created_at: '2026-06-12' },
    { appointment_id: 'ap_013', facility_id: 'fac_001', patient_id: 'p_007', treatment_plan_id: 'tp_007', procedure_id: 'pr_009', provider_id: 'u_dr_amani', appointment_date: '2025-11-20', appointment_time: '14:00', status: 'No Show', notes: 'No further contact since.', created_at: '2025-11-14' },
    { appointment_id: 'ap_014', facility_id: 'fac_001', patient_id: 'p_013', treatment_plan_id: 'tp_013', procedure_id: 'pr_018', provider_id: 'u_dr_amani', appointment_date: '2026-06-22', appointment_time: '16:00', status: 'Scheduled', notes: 'Scaling and polishing.', created_at: '2026-06-15' },
    { appointment_id: 'ap_015', facility_id: 'fac_001', patient_id: 'p_002', treatment_plan_id: 'tp_002', procedure_id: 'pr_003', provider_id: 'u_dr_chebet', appointment_date: '2026-05-18', appointment_time: '09:00', status: 'Completed', notes: 'Root canal session 1 of 3.', created_at: '2026-05-10' },
  ];

  const followUps = [
    { follow_up_id: 'fu_001', facility_id: 'fac_001', patient_id: 'p_007', treatment_plan_id: 'tp_007', conducted_by: 'u_fo_brenda', follow_up_date: '2026-06-10', outcome: 'Not Reached', next_follow_up_date: '2026-06-17', notes: 'Phone unreachable, tried twice.', created_at: '2026-06-10' },
    { follow_up_id: 'fu_002', facility_id: 'fac_001', patient_id: 'p_014', treatment_plan_id: 'tp_014', conducted_by: 'u_fo_kevin', follow_up_date: '2026-06-12', outcome: 'Interested', next_follow_up_date: '2026-06-19', notes: 'Wants to book for next week, awaiting confirmation.', created_at: '2026-06-12' },
    { follow_up_id: 'fu_003', facility_id: 'fac_001', patient_id: 'p_005', treatment_plan_id: 'tp_005', conducted_by: 'u_fo_brenda', follow_up_date: '2026-06-16', outcome: 'Will Return', next_follow_up_date: '2026-06-20', notes: 'Rescheduling after missed appointment.', created_at: '2026-06-16' },
    { follow_up_id: 'fu_004', facility_id: 'fac_001', patient_id: 'p_006', treatment_plan_id: 'tp_006', conducted_by: 'u_fo_kevin', follow_up_date: '2025-11-10', outcome: 'Declined', next_follow_up_date: null, notes: 'Chose another provider closer to home.', created_at: '2025-11-10' },
    { follow_up_id: 'fu_005', facility_id: 'fac_001', patient_id: 'p_012', treatment_plan_id: 'tp_012', conducted_by: 'u_fo_brenda', follow_up_date: '2026-06-14', outcome: 'Reached', next_follow_up_date: '2026-06-21', notes: 'Plan still pending dentist review.', created_at: '2026-06-14' },
    { follow_up_id: 'fu_006', facility_id: 'fac_001', patient_id: 'p_007', treatment_plan_id: 'tp_007', conducted_by: 'u_fo_kevin', follow_up_date: '2026-06-03', outcome: 'Wrong Number', next_follow_up_date: '2026-06-10', notes: 'Number on file appears outdated, requested update via WhatsApp.', created_at: '2026-06-03' },
  ];

  const rootCanalCases = [
    { root_canal_case_id: 'rc_001', patient_id: 'p_002', procedure_id: 'pr_003', tooth_number: '36', planned_sessions: 3, current_session: 1, next_session_date: '2026-06-20', status: 'Active', created_at: '2025-09-12' },
    { root_canal_case_id: 'rc_002', patient_id: 'p_009', procedure_id: 'pr_013', tooth_number: '46', planned_sessions: 3, current_session: 1, next_session_date: '2026-06-20', status: 'Active', created_at: '2025-12-03' },
  ];

  const rootCanalSessions = [
    { root_canal_session_id: 'rcs_001', root_canal_case_id: 'rc_001', provider_id: 'u_dr_chebet', session_number: 1, session_date: '2026-05-18', procedure_done: 'Access opening + pulp extirpation', next_session_date: '2026-06-20', notes: 'Patient tolerated well, mild sensitivity expected.', created_at: '2026-05-18' },
    { root_canal_session_id: 'rcs_002', root_canal_case_id: 'rc_002', provider_id: 'u_dr_amani', session_number: 1, session_date: '2026-05-30', procedure_done: 'Access opening + canal cleaning', next_session_date: '2026-06-20', notes: 'Three canals identified.', created_at: '2026-05-30' },
  ];

  const bracesCases = [
    { braces_case_id: 'bc_001', patient_id: 'p_003', procedure_id: 'pr_005', treatment_start_date: '2025-10-02', expected_duration_months: 18, current_stage: 'Alignment — Stage 3 of 9', next_review_date: '2026-06-25', status: 'Active', created_at: '2025-10-02' },
    { braces_case_id: 'bc_002', patient_id: 'p_011', procedure_id: 'pr_016', treatment_start_date: '2026-01-06', expected_duration_months: 24, current_stage: 'Spacing — Stage 2 of 12', next_review_date: '2026-06-21', status: 'Active', created_at: '2026-01-06' },
    { braces_case_id: 'bc_003', patient_id: 'p_015', procedure_id: 'pr_022', treatment_start_date: '2026-04-10', expected_duration_months: 20, current_stage: 'Initial Bonding — Stage 1 of 10', next_review_date: '2026-06-24', status: 'Active', created_at: '2026-04-10' },
  ];

  const bracesVisits = [
    { braces_visit_id: 'bv_001', braces_case_id: 'bc_001', provider_id: 'u_dr_amani', visit_date: '2026-05-25', adjustment_performed: 'Archwire tension adjustment', next_review_date: '2026-06-25', notes: 'Good progress, minor discomfort reported.', created_at: '2026-05-25' },
    { braces_visit_id: 'bv_002', braces_case_id: 'bc_002', provider_id: 'u_dr_amani', visit_date: '2026-05-21', adjustment_performed: 'Spacer placement', next_review_date: '2026-06-21', notes: '', created_at: '2026-05-21' },
    { braces_visit_id: 'bv_003', braces_case_id: 'bc_003', provider_id: 'u_dr_amani', visit_date: '2026-04-10', adjustment_performed: 'Initial bracket bonding', next_review_date: '2026-06-24', notes: 'First visit, well tolerated.', created_at: '2026-04-10' },
  ];

  return { facility, facilities, users, patients, plans, procedures, appointments, followUps, rootCanalCases, rootCanalSessions, bracesCases, bracesVisits };
}

const NIA_SCHEMA_VERSION = 2; // bump whenever the stored shape changes incompatibly

function niaIsValidSchema(db) {
  // Guards against stale localStorage from an earlier version of the app (e.g. the
  // pre-multi-facility build) that has a different shape and would otherwise crash
  // every db.facilities.find(...) call downstream with "Cannot read properties of
  // undefined (reading 'find')".
  if (!db || typeof db !== 'object') return false;
  if (db.__schema_version !== NIA_SCHEMA_VERSION) return false;
  if (!Array.isArray(db.facilities) || db.facilities.length === 0) return false;
  if (!Array.isArray(db.users)) return false;
  const everyFacilityHasSubscription = db.facilities.every(f => f && f.subscription && typeof f.subscription === 'object');
  return everyFacilityHasSubscription;
}

function niaLoadDB() {
  let raw = localStorage.getItem(NIA_DB_KEY);
  if (!raw) {
    const seed = buildSeedData();
    seed.__schema_version = NIA_SCHEMA_VERSION;
    localStorage.setItem(NIA_DB_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!niaIsValidSchema(parsed)) {
      const seed = buildSeedData();
      seed.__schema_version = NIA_SCHEMA_VERSION;
      localStorage.setItem(NIA_DB_KEY, JSON.stringify(seed));
      return seed;
    }
    let migrated = false;
    if (parsed.facilities.some(facility => facility.facility_id === 'fac_002' && !facility.parent_facility_id)) {
      const rootFacility = parsed.facilities.find(facility => facility.facility_id === 'fac_001');
      const seededBranch = parsed.facilities.find(facility => facility.facility_id === 'fac_002');
      if (rootFacility && seededBranch) {
        seededBranch.parent_facility_id = rootFacility.facility_id;
        migrated = true;
      }
    }
    const fac001Owner = parsed.users.find(user => user.facility_id === 'fac_001' && user.role === 'owner');
    if (fac001Owner && (fac001Owner.full_name !== 'Irene Ogongo' || fac001Owner.email !== 'irene.ogongo@niahealthcare.co.ke')) {
      fac001Owner.user_id = 'irene';
      fac001Owner.full_name = 'Irene Ogongo';
      fac001Owner.email = 'irene.ogongo@niahealthcare.co.ke';
      migrated = true;
    }
    if (migrated) niaSaveDB(parsed);
    return parsed;
  }
  catch (e) {
    const seed = buildSeedData();
    seed.__schema_version = NIA_SCHEMA_VERSION;
    localStorage.setItem(NIA_DB_KEY, JSON.stringify(seed));
    return seed;
  }
}

function niaSaveDB(db) {
  db.__schema_version = NIA_SCHEMA_VERSION;
  localStorage.setItem(NIA_DB_KEY, JSON.stringify(db));
}

function niaResetDB() {
  localStorage.removeItem(NIA_DB_KEY);
  return niaLoadDB();
}

/* ---------------- Session ---------------- */
function niaGetSession() {
  try { return JSON.parse(sessionStorage.getItem(NIA_SESSION_KEY)); }
  catch (e) { return null; }
}
function niaSetSession(userId) {
  sessionStorage.setItem(NIA_SESSION_KEY, JSON.stringify({ user_id: userId, ts: Date.now() }));
}
function niaLogout() {
  sessionStorage.removeItem(NIA_SESSION_KEY);
  showLoginView();
}
/* ---------------- Facility scoping ----------------
   db.X arrays are the single shared source of truth across all
   facilities (so writes via db.X.push(...) and niaSaveDB(db) stay
   simple). Facility-scoped pages must read through these getters
   instead of db.X directly, so a new facility's owner never sees
   another facility's patients, plans, or staff. */
function niaScopedPatients(db) { return db.patients.filter(p => p.facility_id === db.facility.facility_id); }
function niaScopedUsers(db) { return db.users.filter(u => u.facility_id === db.facility.facility_id); }
function niaScopedPlans(db) { return db.plans.filter(p => p.facility_id === db.facility.facility_id); }
function niaScopedAppointments(db) { return db.appointments.filter(a => a.facility_id === db.facility.facility_id); }
function niaScopedFollowUps(db) { return db.followUps.filter(f => f.facility_id === db.facility.facility_id); }
function niaScopedProcedures(db) {
  const planIds = new Set(niaScopedPlans(db).map(p => p.treatment_plan_id));
  return db.procedures.filter(pr => planIds.has(pr.treatment_plan_id));
}
function niaScopedRootCanalCases(db) {
  const patientIds = new Set(niaScopedPatients(db).map(p => p.patient_id));
  return db.rootCanalCases.filter(c => patientIds.has(c.patient_id));
}
function niaScopedBracesCases(db) {
  const patientIds = new Set(niaScopedPatients(db).map(p => p.patient_id));
  return db.bracesCases.filter(c => patientIds.has(c.patient_id));
}
function niaScopedRootCanalSessions(db) {
  const caseIds = new Set(niaScopedRootCanalCases(db).map(c => c.root_canal_case_id));
  return db.rootCanalSessions.filter(s => caseIds.has(s.root_canal_case_id));
}
function niaScopedBracesVisits(db) {
  const caseIds = new Set(niaScopedBracesCases(db).map(c => c.braces_case_id));
  return db.bracesVisits.filter(v => caseIds.has(v.braces_case_id));
}

function niaRequireAuth() {
  const sess = niaGetSession();
  if (!sess) { showLoginView(); return null; }
  const db = niaLoadDB();
  const user = db.users.find(u => u.user_id === sess.user_id);
  if (!user) { niaLogout(); return null; }
  if (user.role !== 'super_admin') {
    const facilities = Array.isArray(db.facilities) ? db.facilities : [];
    db.facility = facilities.find(f => f.facility_id === user.facility_id) || facilities[0];
    if (!db.facility || db.facility.deleted_at || db.facility.deletion_status === 'deleted_by_owner') { niaLogout(); return null; }
    niaUpdateBillingStatus(db.facility);
  } else {
    (db.facilities || []).forEach(niaUpdateBillingStatus);
  }
  return { db, user };
}

/* ---------------- Billing / subscription ---------------- */
function niaUpdateBillingStatus(facility) {
  // Recomputes status purely from next_due_date vs "today" — called on every
  // load so the lock/grace transition happens automatically with no cron job.
  const sub = facility.subscription;
  const today = todayISO();
  const daysPastDue = daysBetween(sub.next_due_date, today); // positive once overdue
  if (daysPastDue <= 0) {
    sub.status = 'active';
    sub.grace_started_at = null;
  } else if (daysPastDue <= NIA_GRACE_PERIOD_DAYS) {
    sub.status = 'grace';
    if (!sub.grace_started_at) sub.grace_started_at = sub.next_due_date;
  } else {
    sub.status = 'locked';
    if (!sub.grace_started_at) sub.grace_started_at = sub.next_due_date;
  }
  sub.days_overdue = Math.max(0, daysPastDue);
  sub.grace_days_remaining = sub.status === 'grace' ? Math.max(0, NIA_GRACE_PERIOD_DAYS - daysPastDue) : 0;
  return sub.status;
}

function niaRecordPayment(db, facility, method, mpesaReceipt, confirmedBy) {
  const sub = facility.subscription;
  const today = todayISO();
  // If the facility was current (or only just due), keep cycles chained from the
  // existing due date so paying early doesn't shorten the next cycle. If it was
  // overdue (grace or locked), anchor the new cycle to today — otherwise a facility
  // that catches up after being weeks behind would immediately show as overdue again.
  const wasOverdue = sub.next_due_date < today;
  const cycleStart = wasOverdue ? today : sub.next_due_date;
  const cycleEnd = addDaysISO(cycleStart, NIA_BILLING_CYCLE_DAYS);
  sub.payments.unshift({
    payment_id: uid('pay'), amount_usd: sub.monthly_fee_usd, method, mpesa_receipt: mpesaReceipt || null,
    paid_at: today, confirmed_by: confirmedBy, cycle_start: cycleStart, cycle_end: cycleEnd,
  });
  sub.next_due_date = cycleEnd;
  sub.status = 'active';
  sub.grace_started_at = null;
  sub.days_overdue = 0;
  sub.grace_days_remaining = 0;
  niaSaveDB(db);
}

function niaFmtUSD(n) {
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function niaRoleLabel(roleId) {
  const r = NIA_ROLES.find(r => r.id === roleId);
  return r ? r.label : roleId;
}

/* ---------------- Derived metrics ---------------- */
function niaComputeStats(db) {
  const plans = niaScopedPlans(db);
  const totalPlans = plans.length;
  const totalValue = plans.reduce((s, p) => s + p.total_estimated_value, 0);
  const acceptedStatuses = ['Accepted', 'In Progress', 'Completed'];
  const acceptedValue = plans.filter(p => acceptedStatuses.includes(p.status)).reduce((s, p) => s + p.total_estimated_value, 0);
  const completedValue = plans.filter(p => p.status === 'Completed').reduce((s, p) => s + p.total_estimated_value, 0);
  const lostValue = plans.filter(p => p.status === 'Rejected' || p.status === 'Dropped Off').reduce((s, p) => s + p.total_estimated_value, 0);
  const outstandingValue = acceptedValue - completedValue;
  const activePatients = new Set(plans.filter(p => !['Completed', 'Rejected'].includes(p.status)).map(p => p.patient_id)).size;
  const completedPlans = plans.filter(p => p.status === 'Completed').length;
  const journeyCompletionRate = totalPlans ? Math.round((completedPlans / totalPlans) * 100) : 0;
  const conversionRate = totalValue ? Math.round((acceptedValue / totalValue) * 100) : 0;
  const completionRate = acceptedValue ? Math.round((completedValue / acceptedValue) * 100) : 0;
  const droppedPlans = plans.filter(p => p.status === 'Dropped Off').length;
  const dropOffRate = activePatients ? Math.round((droppedPlans / (activePatients + droppedPlans)) * 100) : 0;

  const today = todayISO();
  const followUpsDueToday = niaScopedFollowUps(db).filter(f => f.next_follow_up_date === today).length;
  const overdueTreatments = niaScopedProcedures(db).filter(pr => pr.next_session_date && pr.next_session_date < today && pr.status !== 'Completed').length;

  return {
    totalPlans, totalValue, acceptedValue, completedValue, outstandingValue, lostValue,
    activePatients, journeyCompletionRate, conversionRate, completionRate, dropOffRate,
    followUpsDueToday, overdueTreatments,
  };
}

function niaPatientName(db, patientId) {
  const p = db.patients.find(x => x.patient_id === patientId);
  return p ? `${p.first_name} ${p.last_name}` : 'Unknown Patient';
}
function niaUserName(db, userId) {
  const u = db.users.find(x => x.user_id === userId);
  return u ? u.full_name : '—';
}
function niaPlanByProcedure(db, procedureId) {
  const pr = db.procedures.find(p => p.procedure_id === procedureId);
  if (!pr) return null;
  return db.plans.find(p => p.treatment_plan_id === pr.treatment_plan_id);
}

function niaBadgeClass(status) {
  const map = {
    'Draft': 'badge-draft', 'Shared': 'badge-shared', 'Accepted': 'badge-accepted', 'Rejected': 'badge-rejected',
    'In Progress': 'badge-progress', 'Completed': 'badge-completed', 'Dropped Off': 'badge-dropped',
    'Planned': 'badge-draft', 'Scheduled': 'badge-scheduled', 'Cancelled': 'badge-cancelled', 'No Show': 'badge-noshow',
    'Follow-Up Required': 'badge-followup', 'Active': 'badge-active', 'Abandoned': 'badge-abandoned', 'Stopped': 'badge-stopped',
    'active': 'badge-accepted', 'grace': 'badge-followup', 'locked': 'badge-rejected',
  };
  return map[status] || 'badge-draft';
}

function niaSubscriptionLabel(status) {
  const map = { active: 'Active', grace: 'Grace Period', locked: 'Locked — Payment Required' };
  return map[status] || status;
}

function niaToast(msg) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 2600);
}


/* ============================================================
   NiaCARE | Single-Page App Shell & Router
   Same icons/nav model as the original multi-page build, but
   navigation swaps an in-memory view instead of loading a new
   file. This makes the entire system work from one HTML file,
   opened any way at all (double-click, drag-and-drop, preview).
   ============================================================ */

const NIA_ICONS = {
  dashboard: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"/>',
  patients: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17"/>',
  plans: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75M3.75 6.75h16.5M3.75 6.75c0-.621.504-1.125 1.125-1.125h14.25c.621 0 1.125.504 1.125 1.125M3.75 6.75v13.125c0 .621.504 1.125 1.125 1.125h14.25c.621 0 1.125-.504 1.125-1.125V6.75M6.75 9.75h.008v.008H6.75V9.75Z"/>',
  appointments: '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Z"/>',
  followups: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75 6 12m0 0 3.75-3.75M6 12h12M21.75 8.25 18 12m0 0-3.75 3.75M18 12H6"/>',
  rootcanal: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25c-2.4 0-3.6 1.5-3.6 3.3 0 1.2.45 1.95.75 2.85.3.9.6 2.1.15 4.05-.3 1.35-.9 2.1-1.35 3.3-.45 1.2-.6 3.15.6 3.9.9.6 1.95.15 2.55-.75.45-.6.6-1.65.9-1.65s.45 1.05.9 1.65c.6.9 1.65 1.35 2.55.75 1.2-.75 1.05-2.7.6-3.9-.45-1.2-1.05-1.95-1.35-3.3-.45-1.95-.15-3.15.15-4.05.3-.9.75-1.65.75-2.85 0-1.8-1.2-3.3-3.6-3.3Z"/>',
  braces: '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 9.75h15M4.5 14.25h15M3.75 4.5h16.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.232.543l-1.5 1.432a.75.75 0 0 0-.232.543v6.464a.75.75 0 0 1-.232.543l-1.804 1.72a.75.75 0 0 1-1.036 0L15 18.214l-1.214 1.286a.75.75 0 0 1-1.036 0L11.5 18.214 10.25 19.5a.75.75 0 0 1-1.036 0l-1.804-1.72a.75.75 0 0 1-.232-.543V10.768a.75.75 0 0 0-.232-.543L5.482 8.793A.75.75 0 0 1 5.25 8.25v-3a.75.75 0 0 1 .75-.75Z"/>',
  reports: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>',
  facility: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18M18.75 3v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/>',
  users: '<path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/>',
  settings: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
  logout: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"/>',
  search: '<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>',
  bell: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/>',
  menu: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>',
  plus: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>',
  chevdown: '<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>',
  kebab: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" stroke-width="2.4"/>',
  empty: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75a3 3 0 1 1 4.682 2.498c-.65.398-1.182.86-1.182 1.752M12 18.75h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
  tooth: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3c-2.4 0-3.6 1.5-3.6 3.3 0 1.2.45 1.95.75 2.85.3.9.6 2.1.15 4.05-.3 1.35-.9 2.1-1.35 3.3-.45 1.2-.6 3.15.6 3.9.9.6 1.95.15 2.55-.75.45-.6.6-1.65.9-1.65s.45 1.05.9 1.65c.6.9 1.65 1.35 2.55.75 1.2-.75 1.05-2.7.6-3.9-.45-1.2-1.05-1.95-1.35-3.3-.45-1.95-.15-3.15.15-4.05.3-.9.75-1.65.75-2.85 0-1.8-1.2-3.3-3.6-3.3Z"/>',
  clipboard: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2.5a2 2 0 0 1 1.414.586l.5.5A2 2 0 0 0 12.5 5.5H15a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2Z"/>',
  desk: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5M3.75 21V8.25l8.25-5.25 8.25 5.25V21M9.75 21v-6h4.5v6"/>',
  shield: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7L4.5 5.25v6c0 5.385 3.6 9.585 7.5 10.875 3.9-1.29 7.5-5.49 7.5-10.875v-6L12 2.75Z"/>',
  admin: '<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 3.75A.75.75 0 0 1 12 3a.75.75 0 0 1 .75.75v.276a48.5 48.5 0 0 1 5.83.696.75.75 0 1 1-.26 1.477 47.4 47.4 0 0 0-.834-.146l1.391 6.084a.75.75 0 0 1-.22.72 3.748 3.748 0 0 1-2.591 1.018 3.75 3.75 0 0 1-2.591-1.018.75.75 0 0 1-.22-.72l1.392-6.084a47.4 47.4 0 0 0-.834.146M12 3.75v.276a48.5 48.5 0 0 0-5.83.696.75.75 0 1 0 .26 1.477c.273-.05.55-.097.83-.146l-1.39 6.084a.75.75 0 0 0 .22.72 3.748 3.748 0 0 0 2.59 1.018 3.75 3.75 0 0 0 2.591-1.018.75.75 0 0 0 .22-.72L9.9 5.853"/>',
  crown: '<path stroke-linecap="round" stroke-linejoin="round" d="m3 7 4.5 4.5L12 5l4.5 6.5L21 7l-1.5 11h-15L3 7Z"/>',
  globe: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3s4.5 4.03 4.5 9-2.015 9-4.5 9Zm-9-9h18"/>',
  upload: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>',
  edit: '<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"/>',
  check: '<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>',
  wallet: '<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9v3"/>',
  buildings: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3.75h6.75v16.5M4.5 3.75v0M11.25 20.25V3.75M11.25 3.75h8.25v16.5M8.25 7.5h.008M8.25 11.25h.008M8.25 15h.008M14.25 7.5h.008M14.25 11.25h.008M14.25 15h.008M17.25 7.5h.008M17.25 11.25h.008M17.25 15h.008"/>',
  trend: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/>',
  lock: '<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>',
  phone: '<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75A2.25 2.25 0 0 0 15.75 1.5H13.5m-3 0V3h3V1.5m-3 0h3M9.75 18h4.5"/>',
};

function niaIcon(name, cls) {
  return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${NIA_ICONS[name] || ''}</svg>`;
}

/* nav definition: id, label, page key, icon, roles allowed to see it (empty = all) */
const NIA_NAV = [
  {
    group: 'Workspace', items: [
      { id: 'dashboard', label: 'Dashboard', page: 'dashboard', icon: 'dashboard' },
    ]
  },
  {
    group: 'Patient Journey', items: [
      { id: 'patients', label: 'Patients', page: 'patients', icon: 'patients' },
      { id: 'plans', label: 'Treatment Plans', page: 'plans', icon: 'plans' },
      { id: 'appointments', label: 'Appointments', page: 'appointments', icon: 'appointments' },
      { id: 'followups', label: 'Follow-Up Queue', page: 'followups', icon: 'followups' },
    ]
  },
  {
    group: 'Specialised Tracking', items: [
      { id: 'rootcanal', label: 'Root Canal Tracker', page: 'rootcanal', icon: 'rootcanal' },
      { id: 'braces', label: 'Braces Tracker', page: 'braces', icon: 'braces' },
    ]
  },
  {
    group: 'Insights', items: [
      { id: 'reports', label: 'Reports', page: 'reports', icon: 'reports', roles: ['dentist', 'assistant', 'front_office', 'claims', 'admin', 'owner'] },
    ]
  },
  {
    group: 'Administration', items: [
      { id: 'billing', label: 'Billing & Subscription', page: 'billing', icon: 'wallet', roles: ['admin', 'owner'] },
      { id: 'facility', label: 'Facility Settings', page: 'facility', icon: 'facility', roles: ['admin', 'owner'] },
      { id: 'team', label: 'Team & Roles', page: 'team', icon: 'users', roles: ['admin', 'owner'] },
    ]
  },
];

/* Separate nav tree for the platform-level Super Admin / Developer console.
   Entirely disjoint from facility nav — super_admin never sees patient-level
   operational pages directly; it drills into a facility's own views instead. */
const NIA_PLATFORM_NAV = [
  {
    group: 'Platform', items: [
      { id: 'platform-dashboard', label: 'Platform Overview', page: 'platform-dashboard', icon: 'dashboard' },
      { id: 'platform-facilities', label: 'Facilities', page: 'platform-facilities', icon: 'buildings' },
      { id: 'platform-onboard', label: 'Onboard Facility', page: 'platform-onboard', icon: 'plus' },
      { id: 'platform-revenue', label: 'Revenue & Targets', page: 'platform-revenue', icon: 'trend' },
    ]
  },
];

/* ---------------- Router ---------------- */
const Pages = {};
const Router = {
  current: { page: 'dashboard', params: {} },
  go(page, params) {
    this.current = { page, params: params || {} };
    renderApp();
    window.scrollTo(0, 0);
  }
};
function go(page, params) { Router.go(page, params); }

function niaRenderShell(activeId, user, db) {
  const sidebar = document.getElementById('nia-sidebar');
  const isPlatform = user.role === 'super_admin';
  const facility = isPlatform ? null : db.facility;

  let navHtml = '';
  const navTree = isPlatform ? NIA_PLATFORM_NAV : NIA_NAV;
  navTree.forEach(group => {
    const visibleItems = group.items.filter(it => !it.roles || it.roles.includes(user.role));
    if (!visibleItems.length) return;
    navHtml += `<div class="nav-group"><div class="nav-group-label">${group.group}</div>`;
    visibleItems.forEach(it => {
      navHtml += `<a class="nav-link ${it.id === activeId ? 'active' : ''}" href="#" data-page="${it.page}">${niaIcon(it.icon)}<span>${it.label}</span></a>`;
    });
    navHtml += `</div>`;
  });

  const facilityBlockHtml = isPlatform ? `
    <div class="sidebar-facility">
      <div class="label">Mode</div>
      <div class="value">${niaIcon('globe', '')} Platform Console</div>
    </div>
  ` : `
    <div class="sidebar-facility">
      <div class="label">Facility</div>
      <div class="value">${facility.facility_name}</div>
      <div class="mt-8">
        <span class="badge ${niaBadgeClass(facility.subscription.status)}" style="font-size:10px;">${niaSubscriptionLabel(facility.subscription.status)}</span>
      </div>
    </div>
  `;

  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-brand">
        <img src="${NIA_LOGO_DATA_URI}" alt="NiaCARE" />
        <div class="brand-text">
          <div class="brand-name">NiaCARE</div>
          <div class="brand-tag">${isPlatform ? 'Developer Console' : 'Dental System'}</div>
        </div>
      </div>
      ${facilityBlockHtml}
      <nav style="flex:1; overflow-y:auto;">${navHtml}</nav>
      <div class="sidebar-footer">
        <div class="user-chip">
          <div class="user-avatar">${initials(user.full_name)}</div>
          <div class="user-meta">
            <div class="user-name">${user.full_name}</div>
            <div class="user-role">${niaRoleLabel(user.role)}</div>
          </div>
        </div>
        <a href="#" class="logout-link" id="nia-logout-link">${niaIcon('logout')}<span>Sign out</span></a>
      </div>
    `;
    sidebar.querySelectorAll('[data-page]').forEach(link => {
      link.addEventListener('click', (e) => { e.preventDefault(); go(link.dataset.page); });
    });
    document.getElementById('nia-logout-link').addEventListener('click', (e) => { e.preventDefault(); niaLogout(); });
  }
}

function niaRenderTopbar(title, sub) {
  const el = document.getElementById('nia-topbar');
  if (!el) return;
  el.innerHTML = `
    <button class="icon-btn" id="nia-menu-toggle" style="display:none;">${niaIcon('menu')}</button>
    <div>
      <h1>${title}</h1>
      ${sub ? `<div class="topbar-sub">${sub}</div>` : ''}
    </div>
    <div class="topbar-spacer"></div>
    <div class="topbar-search">${niaIcon('search')}<input type="text" placeholder="Search patients, plans, appointments..." id="nia-global-search" /></div>
    <button class="icon-btn"><span class="dot"></span>${niaIcon('bell')}</button>
  `;
}

/* ============================================================
   PAGE: Dashboard
   ============================================================ */
function niaOwnerDashboard(db, user) {
  niaRenderShell('dashboard', user, db);
  niaRenderTopbar('Practice Intelligence', `Leadership view · ${db.facility.facility_name}`);

  const statusFor = (value, green, yellow, inverse = false) => inverse ? (value < green ? 'success' : value <= yellow ? 'warning' : 'danger') : (value >= green ? 'success' : value >= yellow ? 'warning' : 'danger');
  const statusLabel = tone => tone === 'success' ? 'Healthy' : tone === 'warning' ? 'Needs attention' : 'Action required';
  const iconFor = tone => tone === 'success' ? 'check' : tone === 'warning' ? 'bell' : 'shield';
  const pct = (num, den) => den ? Math.round((num / den) * 100) : 0;
  const money = value => `KES ${(value / 1000000).toFixed(2)}M`;
  const periodDays = { Week: 7, Month: 30, Quarter: 90, Year: 365 };
  const dateValue = item => item.created_at || item.createdAt || item.date || item.appointment_date || item.due_date || item.follow_up_date || null;
  const inWindow = (item, end, days) => { const value = dateValue(item); if (!value) return false; const time = new Date(value).getTime(); return !Number.isNaN(time) && time >= end - days * 86400000 && time <= end; };
  const priorWindow = (item, end, days) => { const value = dateValue(item); if (!value) return false; const time = new Date(value).getTime(); return !Number.isNaN(time) && time >= end - days * 2 * 86400000 && time < end - days * 86400000; };
  const trendFor = (current, prior) => prior ? Math.round(((current - prior) / Math.abs(prior)) * 100) : 0;
  const trendLabel = change => change > 0 ? `↑ ${Math.abs(change)}% vs prior period` : change < 0 ? `↓ ${Math.abs(change)}% vs prior period` : '→ Stable vs prior period';
  const card = (key, icon, eyebrow, title, metrics, tone, insight, action) => { const normalizedMetrics = metrics; const visibleMetrics = normalizedMetrics.length > 3 ? normalizedMetrics.slice(0, 3) : normalizedMetrics; const extraMetrics = normalizedMetrics.length > 3 ? normalizedMetrics.slice(3) : []; return `<article class="owner-intelligence-card ${tone}${extraMetrics.length ? ' is-collapsible' : ''}" data-card-key="${key}"><div class="owner-card-heading"><div class="owner-card-icon">${niaIcon(icon)}</div><div class="owner-card-title"><span class="eyebrow">${eyebrow}</span><h3>${title}</h3></div>${extraMetrics.length ? `<button type="button" class="owner-card-expand" aria-expanded="false" aria-controls="owner-details-${key}" data-expand-card="${key}" aria-label="Show all ${title} metrics">${niaIcon('chevron-down')}</button>` : ''}</div><div class="owner-metrics">${visibleMetrics.map(metric => `<div><span>${metric.label}</span><strong>${metric.value}</strong><i class="metric-dot ${metric.tone || tone}" aria-hidden="true"></i></div>`).join('')}</div>${extraMetrics.length ? `<div class="owner-card-details" id="owner-details-${key}" hidden>${extraMetrics.map(metric => `<div><span>${metric.label}</span><strong>${metric.value}</strong><i class="metric-dot ${metric.tone || tone}" aria-hidden="true"></i></div>`).join('')}</div>` : ''}${metrics.some(metric => metric.trend) ? `<div class="owner-card-trend ${metrics.find(metric => metric.trend)?.trendTone || ''}">${metrics.find(metric => metric.trend)?.trend || ''}</div>` : ''}<div class="owner-insight-copy ${tone}"><strong>${niaIcon('info')} ${insight}</strong></div><button class="text-action" data-owner-action="${key}">${action} ${niaIcon('arrow')}</button></article>`; };
    const render = (period = 'Month', branch = 'All Branches') => {
    const branchFacilities = (db.facilities || []).filter(facility => facility.active_status && (facility.facility_id === db.facility.facility_id || facility.parent_facility_id === db.facility.facility_id || db.facility.parent_facility_id === facility.facility_id));
    const selectedFacility = branch === 'All Branches' ? db.facility : branchFacilities.find(facility => facility.facility_name.replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '') === branch) || db.facility;
    const scopedDb = selectedFacility === db.facility ? db : { ...db, facility: selectedFacility };
    const end = Date.now(); const days = periodDays[period] || periodDays.Month;
    const allPlans = niaScopedPlans(scopedDb); const allAppointments = niaScopedAppointments(scopedDb); const allFollowUps = niaScopedFollowUps(scopedDb); const procedures = niaScopedProcedures(scopedDb); const allPatients = niaScopedPatients(scopedDb);
    const plans = allPlans.filter(item => inWindow(item, end, days)); const appointments = allAppointments.filter(item => inWindow(item, end, days)); const followUps = allFollowUps.filter(item => inWindow(item, end, days)); const patients = allPatients.filter(item => inWindow(item, end, days)); const payments = selectedFacility.subscription?.payments || []; const revenue = payments.filter(item => inWindow(item, end, days)).reduce((sum, payment) => sum + Number(payment.amount_usd || payment.amount || 0), 0);
    const priorPlans = allPlans.filter(item => priorWindow(item, end, days)); const priorAppointments = allAppointments.filter(item => priorWindow(item, end, days)); const priorFollowUps = allFollowUps.filter(item => priorWindow(item, end, days));
    const accepted = plans.filter(p => ['Accepted', 'In Progress', 'Completed'].includes(p.status)); const priorAccepted = priorPlans.filter(p => ['Accepted', 'In Progress', 'Completed'].includes(p.status));
    const treatmentAcceptance = pct(accepted.length, plans.filter(p => p.status !== 'Draft').length); const priorTreatmentAcceptance = pct(priorAccepted.length, priorPlans.filter(p => p.status !== 'Draft').length); const treatmentProgression = pct(plans.filter(p => p.status === 'Completed').length, accepted.length); const priorTreatmentProgression = pct(priorPlans.filter(p => p.status === 'Completed').length, priorAccepted.length); const acceptanceTrend = trendFor(treatmentAcceptance, priorTreatmentAcceptance);
    const pendingValue = plans.filter(p => !['Completed', 'Rejected'].includes(p.status)).reduce((sum, p) => sum + Number(p.total_estimated_value || 0), 0); const priorPendingValue = priorPlans.filter(p => !['Completed', 'Rejected'].includes(p.status)).reduce((sum, p) => sum + Number(p.total_estimated_value || 0), 0); const pendingTrend = trendFor(pendingValue, priorPendingValue);
    const pendingTreatmentPlans = plans.filter(p => !['Completed', 'Rejected'].includes(p.status)); const overduePlans = plans.filter(p => p.status === 'Dropped Off').length; const overduePlanRate = pct(overduePlans, pendingTreatmentPlans.length); const treatmentAcceptanceTone = statusFor(treatmentAcceptance, 75, 60); const treatmentProgressionTone = statusFor(treatmentProgression, 80, 60); const overduePlanTone = statusFor(overduePlanRate, 15, 25, true); const pendingValueTone = pendingTrend > 15 ? 'danger' : pendingTrend >= 5 ? 'warning' : 'success'; const treatmentTone = [treatmentAcceptanceTone, treatmentProgressionTone, overduePlanTone, pendingValueTone].includes('danger') ? 'danger' : [treatmentAcceptanceTone, treatmentProgressionTone, overduePlanTone, pendingValueTone].includes('warning') ? 'warning' : 'success'; const followUpRate = pct(followUps.filter(f => f.outcome !== 'Not Reached').length, followUps.length); const priorFollowUpRate = pct(priorFollowUps.filter(f => f.outcome !== 'Not Reached').length, priorFollowUps.length); const followUpTrend = trendFor(followUpRate, priorFollowUpRate);
    const completedAppointments = appointments.filter(a => ['Completed', 'Attended'].includes(a.status)).length; const appointmentRate = pct(completedAppointments, appointments.length); const priorCompletedAppointments = priorAppointments.filter(a => ['Completed', 'Attended'].includes(a.status)).length; const priorAppointmentRate = pct(priorCompletedAppointments, priorAppointments.length); const appointmentTrend = trendFor(appointmentRate, priorAppointmentRate);
    const noShows = appointments.filter(a => ['No-show', 'No Show'].includes(a.status)).length; const noShowRate = pct(noShows, appointments.length); const cancellations = appointments.filter(a => ['Cancelled', 'Canceled'].includes(a.status)).length; const cancellationRate = pct(cancellations, appointments.length); const bookedFromFollowUps = followUps.filter(f => f.appointment_id || f.appointmentId || ['Booked', 'Scheduled'].includes(f.outcome)).length; const followUpAppointmentRate = pct(bookedFromFollowUps, followUps.length); const reminders = appointments.filter(a => a.reminder_sent !== undefined || a.reminder_status); const reminderCompletionRate = pct(reminders.filter(a => a.reminder_sent === true || ['Sent', 'Completed'].includes(a.reminder_status)).length, reminders.length); const missedFollowUpRate = pct(appointments.filter(a => ['No-show', 'No Show'].includes(a.status) && (a.follow_up_completed || a.missed_follow_up)).length, noShows);
    const followUpTone = [statusFor(followUpRate, 90, 75), statusFor(followUpAppointmentRate, 50, 30), statusFor(reminderCompletionRate, 90, 75), statusFor(noShowRate, 10, 15, true), statusFor(cancellationRate, 10, 15, true), statusFor(treatmentProgression, 80, 60)].includes('danger') ? 'danger' : [statusFor(followUpRate, 90, 75), statusFor(followUpAppointmentRate, 50, 30), statusFor(reminderCompletionRate, 90, 75), statusFor(noShowRate, 10, 15, true), statusFor(cancellationRate, 10, 15, true), statusFor(treatmentProgression, 80, 60)].includes('warning') ? 'warning' : 'success'; const treatmentStarted = plans.filter(p => ['In Progress', 'Completed'].includes(p.status)).length; const treatmentCompleted = plans.filter(p => p.status === 'Completed').length; const patientsRequiringFollowUp = new Set(followUps.filter(f => ['Not Reached', 'Interested', 'Will Return'].includes(f.outcome)).map(f => f.patient_id)).size; const followTone = followUpTone; const recallRecords = scopedDb.recalls || scopedDb.recall_records || [];
    const periodRecalls = recallRecords.filter(item => inWindow(item, end, days)); const recallBookingRate = pct(periodRecalls.filter(r => ['Booked', 'Completed'].includes(r.status)).length, periodRecalls.length); const recallCompletionRate = pct(periodRecalls.filter(r => r.status === 'Completed').length, periodRecalls.length); const overdueRecallCount = periodRecalls.filter(r => r.due_date && r.due_date < todayISO() && r.status !== 'Completed').length; const overdueRecallRate = pct(overdueRecallCount, periodRecalls.length); const recallContactRate = pct(periodRecalls.filter(r => r.contacted_at || r.contact_status === 'Contacted').length, periodRecalls.length); const recallTone = periodRecalls.length ? [statusFor(recallBookingRate, 80, 65), statusFor(recallCompletionRate, 75, 60), statusFor(overdueRecallRate, 15, 25, true)].includes('danger') ? 'danger' : [statusFor(recallBookingRate, 80, 65), statusFor(recallCompletionRate, 75, 60), statusFor(overdueRecallRate, 15, 25, true)].includes('warning') ? 'warning' : 'success' : 'warning'; const overdueRecalls = overdueRecallCount;
    const feedbackRecords = scopedDb.feedback || scopedDb.patient_feedback || []; const complaints = feedbackRecords.filter(item => item.type === 'Complaint' || item.category === 'Complaint'); const satisfactionRate = feedbackRecords.length ? pct(feedbackRecords.filter(item => Number(item.rating || item.score || 0) >= 4).length, feedbackRecords.length) : 0; const experienceTone = feedbackRecords.length ? statusFor(satisfactionRate, 90, 80) : 'warning';
    const incidents = scopedDb.incidents || scopedDb.safety_incidents || []; const seriousIncidents = incidents.filter(item => item.severity === 'Serious' || item.severity === 'Critical').length; const openIncidents = incidents.filter(item => !['Closed', 'Resolved'].includes(item.status)).length; const safetyTone = seriousIncidents > 0 ? 'danger' : incidents.length && pct(incidents.filter(item => ['Closed', 'Resolved'].includes(item.status)).length, incidents.length) < 75 ? 'warning' : 'success';
    const signalScore = (tone, weight) => (tone === 'success' ? weight : tone === 'warning' ? weight * 0.65 : weight * 0.25); const healthScore = Math.round(signalScore(treatmentTone, 20) + signalScore(followTone, 20) + signalScore(recallTone, 15) + signalScore(experienceTone, 15) + signalScore(safetyTone, 30)); const healthTone = seriousIncidents > 0 || safetyTone === 'danger' || healthScore < 55 ? 'danger' : healthScore < 80 ? 'warning' : 'success';
const healthLabel = healthTone === 'success' ? 'Healthy' : healthTone === 'warning' ? 'Needs attention' : 'Action required';
    const healthInsight = seriousIncidents > 0 ? `${seriousIncidents} serious patient safety incident${seriousIncidents === 1 ? '' : 's'} require immediate owner review.` : healthTone === 'success' ? 'Core practice signals are within target.' : healthTone === 'warning' ? `${treatmentTone !== 'success' ? 'Treatment acceptance is below target' : 'Routine performance signals need review'}${recallTone !== 'success' ? ' and recall performance is declining.' : '.'}` : 'Critical practice signals require owner review.';
    const healthAction = healthTone === 'success' ? 'View Practice Performance' : 'View Areas Requiring Attention';
    const firstName = user.full_name.replace(/^(Dr\\.|Mr\\.|Mrs\\.|Ms\\.)\\s+/, '').split(' ')[0];
    const suffix = branch === 'All Branches' ? 'across all branches' : `at ${branch}`;
    document.getElementById('content').innerHTML = `<div class="owner-hero"><div><div class="eyebrow">Practice intelligence dashboard</div><h1>Good morning, ${firstName}</h1><p>Decision support for ${db.facility.facility_name}, ${suffix}.</p></div><div class="owner-filters"><label>Branch<select id="owner-branch"><option>All Branches</option>${branchFacilities.filter(facility => facility.facility_id !== db.facility.facility_id).map(facility => `<option>${facility.facility_name.replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '')}</option>`).join('')}</select></label><label>Period<select id="owner-period"><option>Week</option><option selected>Month</option><option>Quarter</option><option>Year</option></select></label></div></div>
      <section class="owner-health ${healthTone}"><div class="owner-health-copy"><span class="eyebrow">Overall practice health</span><div class="health-row"><span class="health-dot"></span><strong>${healthLabel}</strong></div><p>${healthInsight}</p></div><div class="health-score"><div><strong>${healthScore}</strong><span>/ 100</span></div><button type="button" class="owner-health-action owner-health-score-action" data-owner-action="${healthTone === 'success' ? 'reports' : 'attention'}">${healthAction} ${niaIcon('arrow')}</button></div></section>
      <div class="owner-section-head"><div><span class="eyebrow">Practice overview</span><h2>Key performance signals</h2></div><button class="btn btn-ghost btn-sm" id="owner-export">${niaIcon('reports')} Export summary</button></div>
      <div class="owner-intelligence-grid owner-top-signals">${card('treatment-plans', 'plans', 'Treatment performance', 'Conversions & Backlog', [{ value: `${pendingTreatmentPlans.length}`, label: 'pending treatment plans', tone: treatmentTone }, { value: money(pendingValue), label: 'pending treatment value', tone: pendingValueTone, trend: trendLabel(pendingTrend), trendTone: pendingValueTone }, { value: `${treatmentAcceptance}%`, label: 'treatment acceptance', tone: treatmentAcceptanceTone, trend: trendLabel(acceptanceTrend), trendTone: acceptanceTrend >= 0 ? 'success' : 'warning' }, { value: `${overduePlanRate}%`, label: `overdue treatment plans (${overduePlans})`, tone: overduePlanTone }, { value: `${treatmentProgression}%`, label: 'treatment progression', tone: treatmentProgressionTone }], treatmentTone, treatmentAcceptanceTone === 'danger' ? 'Treatment acceptance is significantly below target.' : treatmentAcceptanceTone === 'warning' ? 'Treatment acceptance is below target.' : overduePlanTone !== 'success' ? 'Treatment backlog is increasing.' : treatmentProgressionTone !== 'success' ? 'Treatment progression is below target.' : pendingValueTone !== 'success' ? 'Pending treatment value is increasing.' : 'Treatment acceptance is within target.', treatmentTone === 'danger' ? 'Review Performance' : treatmentTone === 'warning' ? 'Review Treatment' : 'View Trend')}${card('appointments', 'appointments', 'Follow-up & appointments', 'Conversion Dynamics', [{ value: `${patientsRequiringFollowUp}`, label: 'patients requiring treatment follow-up', tone: followUpTone }, { value: `${followUpRate}%`, label: 'follow-up contact rate', trend: trendLabel(followUpTrend), trendTone: followUpTrend >= 0 ? 'success' : 'warning' }, { value: `${followUpAppointmentRate}%`, label: 'follow-up → appointment conversion', tone: statusFor(followUpAppointmentRate, 50, 30) }, { value: `${reminderCompletionRate}%`, label: 'appointment reminder completion', tone: statusFor(reminderCompletionRate, 90, 75) }, { value: `${noShowRate}%`, label: 'no-show rate', tone: statusFor(noShowRate, 10, 15, true), trend: trendLabel(trendFor(noShowRate, pct(priorAppointments.filter(a => ['No-show', 'No Show'].includes(a.status)).length, priorAppointments.length))), trendTone: noShowRate > 15 ? 'danger' : 'success' }, { value: `${cancellationRate}%`, label: 'cancellation rate' }, { value: `${treatmentProgression}%`, label: 'treatment completion' }], followTone, noShowRate > 15 ? 'No-shows are significantly above target.' : `${followUpRate}% of follow-ups have a recorded outcome.`, noShowRate > 15 ? 'Review No-Shows' : 'Review Appointments')}${card('recalls', 'calendar', 'Recall performance', 'Ongoing Care Continuity', [{ value: recallRecords.length ? `${recallBookingRate}%` : '—', label: 'recall booking' }, { value: recallRecords.length ? `${recallCompletionRate}%` : '—', label: 'recall completion' }, { value: recallRecords.length ? `${overdueRecalls}` : '—', label: 'overdue recalls' }], recallTone, recallRecords.length ? `${overdueRecalls} overdue recalls require follow-up.` : 'Recall data has not been recorded yet.', recallRecords.length ? 'Review Recalls' : 'View Recall')}${card('feedback', 'heart', 'Patient experience', 'Feedback & Sentiment', [{ value: feedbackRecords.length ? `${satisfactionRate}%` : '—', label: 'satisfaction' }, { value: complaints.length, label: 'complaints' }, { value: complaints.filter(item => !['Resolved', 'Closed'].includes(item.status)).length, label: 'open complaints' }], experienceTone, feedbackRecords.length ? `${complaints.length} complaints are represented in patient feedback.` : 'Patient feedback has not been recorded yet.', 'View Feedback')}${card('incidents', 'shield', 'Patient safety', 'Incidents & Audits', [{ value: seriousIncidents, label: 'serious incidents' }, { value: incidents.length ? `${pct(incidents.filter(item => ['Closed', 'Resolved'].includes(item.status)).length, incidents.length)}%` : '—', label: 'closure rate' }, { value: openIncidents, label: 'open incidents' }], safetyTone, seriousIncidents ? `${seriousIncidents} serious patient safety incident(s) require review.` : incidents.length ? 'No serious incidents reported.' : 'Patient safety incidents have not been recorded yet.', seriousIncidents ? 'Review Incident Now' : 'View Incidents')}</div>
      <div class="owner-overview-grid"><section class="card owner-performance"><div class="owner-panel-heading"><div><h3>Performance trend</h3><p>Revenue and completed appointments · ${period}</p></div><div class="owner-legend"><span class="revenue-dot"></span> Revenue <span class="appointments-dot"></span> Appointments</div></div><div class="owner-chart"><div class="chart-axis"><span>6M</span><span>4M</span><span>2M</span><span>0</span></div><div class="chart-area"><svg viewBox="0 0 600 190" preserveAspectRatio="none" role="img" aria-label="Revenue and completed appointments trend from January to June"><path class="chart-revenue-fill" d="M0 152 C42 140 76 142 112 127 C148 112 158 76 208 89 C245 98 269 94 300 67 C329 42 359 73 390 72 C423 70 426 36 468 34 C510 32 527 42 560 27 C578 19 590 10 600 5 L600 190 L0 190 Z"></path><path class="chart-revenue-line" d="M0 152 C42 140 76 142 112 127 C148 112 158 76 208 89 C245 98 269 94 300 67 C329 42 359 73 390 72 C423 70 426 36 468 34 C510 32 527 42 560 27 C578 19 590 10 600 5"></path><path class="chart-appointments-line" d="M0 170 C42 164 78 164 112 153 C145 142 157 119 202 130 C240 139 269 134 300 111 C330 89 361 109 393 110 C422 110 433 86 469 83 C508 80 529 91 563 80 C580 75 591 69 600 65"></path></svg></div><div class="chart-months"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div></div></section><section class="card owner-branch-performance"><div class="owner-panel-heading"><div><h3>Branch performance</h3><p>Compared with previous period</p></div></div><div class="branch-row"><div><strong>Nyali Dental Centre</strong><span>82% health score</span></div><div class="branch-meter"><i style="width:82%"></i></div></div><div class="branch-row"><div><strong>Kileleshwa Smile Studio</strong><span>76% health score</span></div><div class="branch-meter"><i style="width:76%"></i></div></div><button class="branch-comparison-btn" type="button" data-owner-action="branch-comparison">View branch comparison</button></section></div>
      <section class="owner-next-steps"><div class="owner-next-steps-heading"><span class="eyebrow">Recommended next steps</span><h2>What needs your attention</h2><p class="owner-section-note">Prioritized from the selected ${period.toLowerCase()} and weighted by operational impact.</p></div><div class="owner-attention-grid"><article class="owner-attention-card ${treatmentTone}"><div class="owner-attention-icon">${niaIcon(treatmentTone === 'success' ? 'check' : 'bell')}</div><div><h3>${overduePlans ? `${overduePlans} treatment plans need review` : 'Treatment conversion is on track'}</h3><p>${overduePlans ? `${treatmentAcceptance}% acceptance with ${overduePlans} plans currently stalled.` : `Acceptance is ${treatmentAcceptance}% and progression is ${treatmentProgression}%.`}</p><button type="button" data-owner-action="treatment-plans">${overduePlans ? 'Review treatment plans' : 'Open treatment plans'}</button></div></article><article class="owner-attention-card ${safetyTone}"><div class="owner-attention-icon">${niaIcon(safetyTone === 'success' ? 'check' : 'shield')}</div><div><h3>${openIncidents ? `${openIncidents} safety item${openIncidents === 1 ? '' : 's'} open` : 'Patient safety is clear'}</h3><p>${incidents.length ? `${seriousIncidents} serious incident${seriousIncidents === 1 ? '' : 's'} and ${openIncidents} open item${openIncidents === 1 ? '' : 's'} in the selected period.` : 'No patient safety incidents have been recorded for this period.'}</p><button type="button" data-owner-action="incidents">${openIncidents ? 'Review safety records' : 'Open safety records'}</button></div></article><article class="owner-attention-card ${experienceTone}"><div class="owner-attention-icon">${niaIcon(experienceTone === 'success' ? 'check' : 'bell')}</div><div><h3>${feedbackRecords.length ? `${satisfactionRate}% patient satisfaction` : 'Feedback data is needed'}</h3><p>${feedbackRecords.length ? `${complaints.length} complaint${complaints.length === 1 ? '' : 's'} recorded; ${complaints.filter(item => ['Resolved', 'Closed'].includes(item.status)).length} resolved.` : 'Capture patient feedback to unlock experience trend intelligence.'}</p><button type="button" data-owner-action="feedback">${feedbackRecords.length ? 'View feedback records' : 'Open reports'}</button></div></article></div></section>
      
      <section class="card owner-action-center"><div class="owner-panel-heading"><div><span class="eyebrow">Owner action center</span><h3>Decisions to move forward</h3><p>Every recommendation is linked to the operational workspace where it can be acted on.</p></div><span class="owner-action-count">${[treatmentTone, followTone, recallTone, experienceTone, safetyTone].filter(tone => tone !== 'success').length} need attention</span></div><div class="owner-action-list"><button type="button" data-owner-action="treatment-plans"><span>${niaIcon('plans')}</span><strong>Treatment conversion</strong><small>${treatmentAcceptance}% acceptance · ${treatmentProgression}% completed</small><i>${niaIcon('arrow')}</i></button><button type="button" data-owner-action="appointments"><span>${niaIcon('appointments')}</span><strong>Appointment flow</strong><small>${followUpAppointmentRate}% follow-up conversion · ${noShowRate}% no-show</small><i>${niaIcon('arrow')}</i></button><button type="button" data-owner-action="recalls"><span>${niaIcon('calendar')}</span><strong>Recall continuity</strong><small>${recallRecords.length ? `${recallBookingRate}% booked · ${overdueRecallRate}% overdue` : 'No recall records in this period'}</small><i>${niaIcon('arrow')}</i></button><button type="button" data-owner-action="reports"><span>${niaIcon('reports')}</span><strong>Experience and safety</strong><small>${satisfactionRate || 0}% satisfaction · ${openIncidents} open safety item${openIncidents === 1 ? '' : 's'}</small><i>${niaIcon('arrow')}</i></button></div></section><section class="card owner-trace"><div><span class="eyebrow">Traceability</span><h3>Underlying practice data</h3><p>${patients.length} patients · ${appointments.length} appointments · ${procedures.length} procedures. Every signal links back to operational records.</p></div><button class="btn btn-primary btn-sm" data-owner-action="reports">View records ${niaIcon('arrow')}</button></section>`;
    document.getElementById('owner-branch').value = branch; document.getElementById('owner-period').value = period;
    document.getElementById('owner-branch').onchange = e => render(document.getElementById('owner-period').value, e.target.value);
    document.getElementById('owner-period').onchange = e => render(e.target.value, document.getElementById('owner-branch').value);
    document.getElementById('owner-export').onclick = () => window.print();
    document.querySelectorAll('[data-expand-card]').forEach(button => button.onclick = () => { const details = document.getElementById(`owner-details-${button.dataset.expandCard}`); const expanded = button.getAttribute('aria-expanded') === 'true'; details.hidden = expanded; button.setAttribute('aria-expanded', String(!expanded)); button.classList.toggle('expanded', !expanded); });
    const ownerRoutes = { 'treatment-plans': 'plans', appointments: 'appointments', 'no-shows': 'appointments', recalls: 'followups', feedback: 'reports', incidents: 'reports', reports: 'reports', attention: 'reports', 'branch-comparison': 'reports', 'treatment-performance': 'plans' }; document.querySelectorAll('[data-owner-action]').forEach(button => button.onclick = () => { const page = ownerRoutes[button.dataset.ownerAction] || 'reports'; go(page); });
    bindNavLinks();
  };
  render();
}
Pages.dashboard = function (db, user) {
  if (user.role === 'owner') { niaOwnerDashboard(db, user); return; }
  niaRenderShell('dashboard', user, db);
  niaRenderTopbar('Dashboard', `Welcome back, ${user.full_name.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s+/, '').split(' ')[0]} — here's what's happening at ${db.facility.facility_name}.`);

  const stats = niaComputeStats(db);
  const today = todayISO();
  const scopedPlans = niaScopedPlans(db);
  const scopedAppointments = niaScopedAppointments(db);
  const scopedFollowUps = niaScopedFollowUps(db);
  const scopedProcedures = niaScopedProcedures(db);
  const scopedRootCanalCases = niaScopedRootCanalCases(db);
  const scopedBracesCases = niaScopedBracesCases(db);
  const scopedPatients = niaScopedPatients(db);

  function statCard(label, value, sub, accent) {
    return `<div class="stat-card ${accent ? 'accent-' + accent : ''}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-foot">${sub}</div>` : ''}
    </div>`;
  }

  function dentistMetrics(userId) {
    const myPlans = scopedPlans.filter(p => p.dentist_id === userId);
    const generated = myPlans.length;
    const value = myPlans.reduce((s, p) => s + p.total_estimated_value, 0);
    const acceptedCount = myPlans.filter(p => ['Accepted', 'In Progress', 'Completed'].includes(p.status)).length;
    const acceptanceRate = generated ? Math.round((acceptedCount / generated) * 100) : 0;
    const completedCount = myPlans.filter(p => p.status === 'Completed').length;
    const completionRate = generated ? Math.round((completedCount / generated) * 100) : 0;
    return { generated, value, acceptanceRate, completionRate };
  }

  function frontOfficeMetrics(userId) {
    const myFollowUps = scopedFollowUps.filter(f => f.conducted_by === userId);
    const contacted = myFollowUps.length;
    const reached = myFollowUps.filter(f => ['Reached', 'Interested', 'Will Return'].includes(f.outcome)).length;
    const contactRate = contacted ? Math.round((reached / contacted) * 100) : 0;
    const myBooked = scopedAppointments.filter(a => myFollowUps.some(f => f.patient_id === a.patient_id)).length;
    return { contacted, contactRate, booked: myBooked };
  }

  function assistantMetrics() {
    const activeCases = scopedRootCanalCases.filter(c => c.status === 'Active').length + scopedBracesCases.filter(c => c.status === 'Active').length;
    const rcDue = scopedRootCanalCases.filter(c => c.status === 'Active' && c.next_session_date <= todayISO(3)).length;
    const bracesDue = scopedBracesCases.filter(c => c.status === 'Active' && c.next_review_date <= todayISO(3)).length;
    const overdue = scopedProcedures.filter(pr => pr.next_session_date && pr.next_session_date < today && pr.status !== 'Completed').length;
    return { activeCases, rcDue, bracesDue, overdue };
  }

  let roleBlockHtml = '';

  if (user.role === 'dentist') {
    const m = dentistMetrics(user.user_id);
    roleBlockHtml = `
      <div class="section-head"><div><h2>My Performance</h2><p>Your treatment plans at ${db.facility.facility_name}.</p></div></div>
      <div class="stat-grid mt-16">
        ${statCard('Plans Generated', m.generated, 'All time')}
        ${statCard('Treatment Value Generated', fmtKES(m.value))}
        ${statCard('Acceptance Rate', m.acceptanceRate + '%', m.acceptanceRate >= 60 ? '<span style="color:var(--nia-success)">●</span> Healthy' : '<span style="color:var(--nia-warning)">●</span> Needs attention')}
        ${statCard('Completion Rate', m.completionRate + '%')}
      </div>`;
  } else if (user.role === 'front_office') {
    const m = frontOfficeMetrics(user.user_id);
    roleBlockHtml = `
      <div class="section-head"><div><h2>My Follow-Up Performance</h2><p>Patients you've contacted and recovered.</p></div></div>
      <div class="stat-grid mt-16">
        ${statCard('Patients Contacted', m.contacted)}
        ${statCard('Contact Rate', m.contactRate + '%')}
        ${statCard('Follow-Ups Due Today', stats.followUpsDueToday, `<a href="#" data-nav-page="followups" style="color:var(--nia-primary); font-weight:600;">View queue →</a>`)}
      </div>`;
  } else if (user.role === 'assistant') {
    const m = assistantMetrics();
    roleBlockHtml = `
      <div class="section-head"><div><h2>My Case Load</h2><p>Root canal and braces cases under active monitoring.</p></div></div>
      <div class="stat-grid mt-16">
        ${statCard('Active Cases', m.activeCases)}
        ${statCard('Root Canals Due Soon', m.rcDue, `<a href="#" data-nav-page="rootcanal" style="color:var(--nia-primary); font-weight:600;">View tracker →</a>`)}
        ${statCard('Braces Reviews Due Soon', m.bracesDue, `<a href="#" data-nav-page="braces" style="color:var(--nia-primary); font-weight:600;">View tracker →</a>`)}
        ${statCard('Overdue Sessions', m.overdue, m.overdue > 0 ? '<span style="color:var(--nia-danger)">Needs follow-up</span>' : 'On track')}
      </div>`;
  } else if (user.role === 'claims') {
    const pendingPlans = scopedPlans.filter(p => p.status === 'Shared' || p.status === 'Accepted');
    const insurancePatients = scopedPatients.filter(p => p.payment_type.startsWith('Insurance')).length;
    roleBlockHtml = `
      <div class="section-head"><div><h2>Claims Overview</h2><p>Insurance approvals and authorization tracking.</p></div></div>
      <div class="stat-grid mt-16">
        ${statCard('Pending Approvals', pendingPlans.length)}
        ${statCard('Insurance Patients', insurancePatients)}
        ${statCard('Approval Turnaround Time', '2.4 days', 'Facility average')}
      </div>`;
  }

  const showFacilityWide = ['admin', 'owner'].includes(user.role);
  const facilityHtml = `
    <div class="section-head mt-24"><div><h2>${showFacilityWide ? 'Facility Overview' : 'Facility Snapshot'}</h2><p>${db.facility.facility_name} — overall treatment journey performance.</p></div>
      ${showFacilityWide ? `<a href="#" data-nav-page="reports" class="btn btn-ghost btn-sm">${niaIcon('reports')}Full Reports</a>` : ''}
    </div>
    <div class="stat-grid mt-16">
      ${statCard('Total Treatment Plans', stats.totalPlans)}
      ${statCard('Total Plan Value', fmtKES(stats.totalValue))}
      ${statCard('Accepted Value', fmtKES(stats.acceptedValue))}
      ${statCard('Completed Value', fmtKES(stats.completedValue), null, 'gold')}
      ${statCard('Outstanding Value', fmtKES(stats.outstandingValue))}
      ${statCard('Lost Value', fmtKES(stats.lostValue), '<span style="color:var(--nia-danger)">Rejected + Dropped Off</span>')}
      ${statCard('Active Patients', stats.activePatients)}
      ${statCard('Follow-Ups Due Today', stats.followUpsDueToday)}
      ${statCard('Overdue Treatments', stats.overdueTreatments)}
    </div>`;

  function rateCard(label, pct, note) {
    return `<div class="card card-pad">
      <div class="flex-between"><span style="font-size:13px; font-weight:700; color:var(--nia-secondary);">${label}</span><span style="font-family:var(--font-display); font-weight:700; font-size:18px; color:var(--nia-primary);">${pct}%</span></div>
      <div class="progress-track mt-8"><div class="progress-fill" style="width:${pct}%;"></div></div>
      <div class="form-hint mt-8">${note}</div>
    </div>`;
  }
  const ratesHtml = `
    <div class="section-head mt-24"><div><h2>Treatment Journey Rates</h2><p>The four numbers that summarise patient conversion and continuity.</p></div></div>
    <div class="stat-grid mt-16" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">
      ${rateCard('Journey Completion Rate', stats.journeyCompletionRate, 'Completed plans ÷ plans created')}
      ${rateCard('Conversion Rate', stats.conversionRate, 'Accepted value ÷ total plan value')}
      ${rateCard('Completion Rate', stats.completionRate, 'Completed value ÷ accepted value')}
      ${rateCard('Drop-Off Rate', stats.dropOffRate, 'Dropped-off ÷ active + dropped patients')}
    </div>`;

  const upcomingAppts = scopedAppointments.filter(a => a.status === 'Scheduled').sort((a, b) => a.appointment_date.localeCompare(b.appointment_date)).slice(0, 5);
  const dueFollowUps = scopedFollowUps.filter(f => f.next_follow_up_date && f.next_follow_up_date <= todayISO(3)).sort((a, b) => (a.next_follow_up_date || '').localeCompare(b.next_follow_up_date || '')).slice(0, 5);

  const widgetsHtml = `
    <div class="mt-24" style="display:grid; grid-template-columns:1.3fr 1fr; gap:18px;">
      <div class="card">
        <div class="card-header"><div><h3>Upcoming Appointments</h3><div class="hint">Next scheduled sessions across the facility</div></div><a href="#" data-nav-page="appointments" class="btn btn-ghost btn-sm">View all</a></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Patient</th><th>Procedure</th><th>Provider</th><th>Date & Time</th></tr></thead>
            <tbody>
              ${upcomingAppts.map(a => {
    const proc = db.procedures.find(p => p.procedure_id === a.procedure_id);
    return `<tr>
                  <td class="cell-strong">${niaPatientName(db, a.patient_id)}</td>
                  <td>${proc ? proc.procedure_name : 'Consultation'}</td>
                  <td>${niaUserName(db, a.provider_id)}</td>
                  <td>${fmtDate(a.appointment_date)} <span class="cell-sub">${a.appointment_time}</span></td>
                </tr>`;
  }).join('') || `<tr><td colspan="4" class="text-right" style="text-align:center; color:var(--nia-ink-soft); padding:24px;">No upcoming appointments.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div><h3>Follow-Ups Due</h3><div class="hint">Patients needing outreach soon</div></div><a href="#" data-nav-page="followups" class="btn btn-ghost btn-sm">View queue</a></div>
        <div style="padding:6px 8px;">
          ${dueFollowUps.map(f => `
            <div style="display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid var(--nia-line);">
              <div class="avatar-sm">${initials(niaPatientName(db, f.patient_id))}</div>
              <div style="min-width:0; flex:1;">
                <div class="cell-strong" style="font-size:13px;">${niaPatientName(db, f.patient_id)}</div>
                <div class="cell-sub">Due ${fmtDate(f.next_follow_up_date)} · ${niaUserName(db, f.conducted_by)}</div>
              </div>
              <span class="badge ${niaBadgeClass(f.outcome === 'Declined' ? 'Rejected' : 'Shared')}">${f.outcome}</span>
            </div>
          `).join('') || `<div class="empty-state"><p>No follow-ups due in the next few days.</p></div>`}
        </div>
      </div>
    </div>`;

  function billingReminderHtml() {
    if (!['admin', 'owner'].includes(user.role)) return '';
    const sub = db.facility.subscription;
    if (sub.status === 'active') {
      const daysLeft = daysBetween(today, sub.next_due_date);
      if (daysLeft > 5) return '';
      return `<div class="card card-pad" style="background:#fff8ec; border-color:#f0d9a8; margin-bottom:20px;">
        <div class="flex-between">
          <div class="flex-gap">${niaIcon('bell', 'banner-icon')}<div>
            <div style="font-weight:700; font-size:13.5px;">Payment due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</div>
            <div class="form-hint mt-8">${niaFmtUSD(sub.monthly_fee_usd)} due on ${fmtDate(sub.next_due_date)} for ${db.facility.facility_name}.</div>
          </div></div>
          <a href="#" data-nav-page="billing" class="btn btn-ghost btn-sm">Renew Now</a>
        </div>
      </div>`;
    }
    if (sub.status === 'grace') {
      return `<div class="card card-pad" style="background:#fff4f1; border-color:#f0bdb0; margin-bottom:20px;">
        <div class="flex-between">
          <div class="flex-gap">${niaIcon('bell', 'banner-icon')}<div>
            <div style="font-weight:700; font-size:13.5px; color:var(--nia-danger);">Payment overdue — ${sub.grace_days_remaining} day${sub.grace_days_remaining === 1 ? '' : 's'} left before lockout</div>
            <div class="form-hint mt-8">${niaFmtUSD(sub.monthly_fee_usd)} was due ${fmtDate(sub.next_due_date)}. The system will automatically lock operational pages once the grace period ends.</div>
          </div></div>
          <a href="#" data-nav-page="billing" class="btn btn-primary btn-sm">Renew Now</a>
        </div>
      </div>`;
    }
    return '';
  }

  document.getElementById('content').innerHTML = billingReminderHtml() + roleBlockHtml + facilityHtml + ratesHtml + widgetsHtml;
  bindNavLinks();
};


/* ============================================================
   PAGE: Patients
   ============================================================ */
Pages.patients = function (db, user) {
  niaRenderShell('patients', user, db);
  niaRenderTopbar('Patients', `${niaScopedPatients(db).length} patients registered at ${db.facility.facility_name}.`);

  let search = '';
  let paymentFilter = 'all';

  function patientPlans(patientId) { return db.plans.filter(p => p.patient_id === patientId); }
  function patientValue(patientId) { return patientPlans(patientId).reduce((s, p) => s + p.total_estimated_value, 0); }
  function patientStatus(patientId) {
    const plans = patientPlans(patientId);
    if (!plans.length) return 'No Plan';
    if (plans.some(p => p.status === 'Dropped Off')) return 'Dropped Off';
    if (plans.some(p => p.status === 'In Progress')) return 'In Progress';
    if (plans.some(p => ['Accepted', 'Shared'].includes(p.status))) return 'Active';
    if (plans.every(p => p.status === 'Completed')) return 'Completed';
    return 'Active';
  }

  function render() {
    const scopedPatients = niaScopedPatients(db);
    let rows = scopedPatients.filter(p => {
      const matchesSearch = !search || (p.first_name + ' ' + p.last_name + ' ' + p.patient_number + ' ' + p.phone_number).toLowerCase().includes(search.toLowerCase());
      const matchesPayment = paymentFilter === 'all' || p.payment_type.startsWith(paymentFilter);
      return matchesSearch && matchesPayment;
    });

    const html = `
      <div class="section-head">
        <div><h2>All Patients</h2><p>Demographic records and treatment journey snapshot.</p></div>
        <button class="btn btn-primary" id="add-patient-btn">${niaIcon('plus')}New Patient</button>
      </div>

      <div class="card mt-16">
        <div style="padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; border-bottom:1px solid var(--nia-line);">
          <div class="topbar-search" style="min-width:280px;">${niaIcon('search')}<input type="text" id="patient-search" placeholder="Search by name, number, or phone..." value="${search}" /></div>
          <div class="pill-tab" id="payment-filter">
            <button data-v="all" class="${paymentFilter === 'all' ? 'active' : ''}">All</button>
            <button data-v="Cash" class="${paymentFilter === 'Cash' ? 'active' : ''}">Cash</button>
            <button data-v="Insurance" class="${paymentFilter === 'Insurance' ? 'active' : ''}">Insurance</button>
          </div>
          <div style="margin-left:auto; font-size:12.5px; color:var(--nia-ink-soft);">${rows.length} of ${scopedPatients.length} patients</div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Patient</th><th>Contact</th><th>Payment</th><th>Journey Status</th><th>Treatment Value</th><th>Registered</th><th></th></tr></thead>
            <tbody>
              ${rows.map(p => `
                <tr style="cursor:pointer;" class="row-to-patient" data-patient="${p.patient_id}">
                  <td>
                    <div class="flex-gap">
                      <div class="avatar-sm">${initials(p.first_name + ' ' + p.last_name)}</div>
                      <div>
                        <div class="cell-strong">${p.first_name} ${p.last_name}</div>
                        <div class="cell-sub">${p.patient_number}</div>
                      </div>
                    </div>
                  </td>
                  <td>${p.phone_number}<div class="cell-sub">${p.email}</div></td>
                  <td>${p.payment_type}</td>
                  <td><span class="badge ${niaBadgeClass(patientStatus(p.patient_id) === 'No Plan' ? 'Draft' : patientStatus(p.patient_id))}">${patientStatus(p.patient_id)}</span></td>
                  <td class="cell-strong">${fmtKES(patientValue(p.patient_id))}</td>
                  <td>${fmtDate(p.created_at)}</td>
                  <td class="text-right"><button class="btn btn-ghost btn-sm view-patient-btn" data-patient="${p.patient_id}">View</button></td>
                </tr>
              `).join('') || `<tr><td colspan="7"><div class="empty-state">${niaIcon('empty')}<h4>No patients found</h4><p>Try a different search or filter.</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.getElementById('patient-search').addEventListener('input', e => { search = e.target.value; render(); preserveFocus(); });
    document.querySelectorAll('#payment-filter button').forEach(btn => btn.addEventListener('click', () => { paymentFilter = btn.dataset.v; render(); }));
    document.getElementById('add-patient-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.row-to-patient').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.view-patient-btn')) return;
        go('patient-profile', { id: row.dataset.patient });
      });
    });
    document.querySelectorAll('.view-patient-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); go('patient-profile', { id: btn.dataset.patient }); });
    });
  }

  function preserveFocus() {
    const el = document.getElementById('patient-search');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

  function openAddModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Register New Patient</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field"><label>First Name <span class="req">*</span></label><input type="text" id="np-first" /></div>
            <div class="form-field"><label>Last Name <span class="req">*</span></label><input type="text" id="np-last" /></div>
            <div class="form-field"><label>Phone Number <span class="req">*</span></label><input type="text" id="np-phone" placeholder="+254 7XX XXX XXX" /></div>
            <div class="form-field"><label>Email</label><input type="email" id="np-email" /></div>
            <div class="form-field"><label>Date of Birth</label><input type="date" id="np-dob" /></div>
            <div class="form-field"><label>Gender</label><select id="np-gender"><option>Female</option><option>Male</option></select></div>
            <div class="form-field full"><label>Payment Type</label><select id="np-payment"><option>Cash</option><option>Insurance — NHIF SHA</option><option>Insurance — AAR</option><option>Insurance — Jubilee</option></select></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-patient">Register Patient</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-patient').addEventListener('click', () => {
      const first = document.getElementById('np-first').value.trim();
      const last = document.getElementById('np-last').value.trim();
      const phone = document.getElementById('np-phone').value.trim();
      if (!first || !last || !phone) { niaToast('Please fill in required fields.'); return; }
      const newId = uid('p');
      const num = 'NIA-P-' + (1000 + niaScopedPatients(db).length + 1);
      db.patients.push({
        patient_id: newId, facility_id: db.facility.facility_id, patient_number: num,
        first_name: first, last_name: last, phone_number: phone,
        email: document.getElementById('np-email').value.trim(),
        date_of_birth: document.getElementById('np-dob').value,
        gender: document.getElementById('np-gender').value,
        payment_type: document.getElementById('np-payment').value,
        created_at: todayISO(),
      });
      niaSaveDB(db);
      modal.remove();
      niaToast(`${first} ${last} registered successfully.`);
      render();
    });
  }

  render();
};


/* ============================================================
   PAGE: Patient Profile
   ============================================================ */
Pages['patient-profile'] = function (db, user, params) {
  niaRenderShell('patients', user, db);

  const patientId = params.id;
  const patient = db.patients.find(p => p.patient_id === patientId);

  if (!patient) {
    document.getElementById('content').innerHTML = `<div class="empty-state">${niaIcon('empty')}<h4>Patient not found</h4><p>This patient record may have been removed.</p></div>`;
    niaRenderTopbar('Patient Not Found');
    return;
  }

  niaRenderTopbar(`${patient.first_name} ${patient.last_name}`, `${patient.patient_number} · Registered ${fmtDate(patient.created_at)}`);

  const plans = db.plans.filter(p => p.patient_id === patientId);
  const appts = db.appointments.filter(a => a.patient_id === patientId).sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));
  const followUps = db.followUps.filter(f => f.patient_id === patientId).sort((a, b) => b.follow_up_date.localeCompare(a.follow_up_date));

  const STAGES = [
    { key: 'created', label: 'Plan Created' },
    { key: 'shared', label: 'Plan Shared' },
    { key: 'decision', label: 'Patient Decision' },
    { key: 'scheduled', label: 'Appointment Booked' },
    { key: 'delivery', label: 'Treatment Delivery' },
    { key: 'completed', label: 'Completed' },
  ];

  function stageIndex(plan) {
    if (!plan) return -1;
    if (plan.status === 'Draft') return 0;
    if (plan.status === 'Shared') return 1;
    if (plan.status === 'Rejected') return 2;
    if (plan.status === 'Dropped Off') return 2;
    if (plan.status === 'Accepted') return 3;
    if (plan.status === 'In Progress') return 4;
    if (plan.status === 'Completed') return 5;
    return 0;
  }

  function journeyHtml(plan) {
    const idx = stageIndex(plan);
    const blocked = plan.status === 'Rejected' || plan.status === 'Dropped Off';
    return `<div class="journey">
      ${STAGES.map((s, i) => {
      const done = i < idx;
      const current = i === idx;
      const state = blocked && current ? 'blocked' : (done ? 'done' : (current ? 'current' : ''));
      return `<div class="journey-step">
          ${i > 0 ? `<div class="journey-line ${i <= idx ? 'done' : ''}"></div>` : ''}
          <div class="journey-node ${state}">
            <div class="journey-dot">${done ? niaIcon('check') : i + 1}</div>
            <div class="journey-label">${s.label}</div>
          </div>
        </div>`;
    }).join('')}
    </div>`;
  }

  const html = `
    <div style="display:grid; grid-template-columns:300px 1fr; gap:18px;">
      <div class="card card-pad" style="text-align:center;">
        <div class="user-avatar" style="width:72px; height:72px; font-size:24px; margin:0 auto 14px; background:linear-gradient(135deg, var(--nia-primary), var(--nia-violet-mid)); color:var(--nia-white);">${initials(patient.first_name + ' ' + patient.last_name)}</div>
        <h3 style="font-size:18px;">${patient.first_name} ${patient.last_name}</h3>
        <div class="form-hint">${patient.patient_number}</div>
        <div style="text-align:left; margin-top:18px; display:flex; flex-direction:column; gap:10px;">
          <div class="flex-between"><span class="form-hint">Phone</span><span style="font-weight:600;">${patient.phone_number}</span></div>
          <div class="flex-between"><span class="form-hint">Email</span><span style="font-weight:600; font-size:12px;">${patient.email || '—'}</span></div>
          <div class="flex-between"><span class="form-hint">Date of Birth</span><span style="font-weight:600;">${fmtDate(patient.date_of_birth)}</span></div>
          <div class="flex-between"><span class="form-hint">Gender</span><span style="font-weight:600;">${patient.gender}</span></div>
          <div class="flex-between"><span class="form-hint">Payment Type</span><span style="font-weight:600;">${patient.payment_type}</span></div>
        </div>
        <button class="btn btn-primary btn-block mt-24" id="new-plan-btn">${niaIcon('plus')}New Treatment Plan</button>
      </div>

      <div>
        <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
          <div class="stat-card"><div class="stat-label">Treatment Plans</div><div class="stat-value">${plans.length}</div></div>
          <div class="stat-card"><div class="stat-label">Total Treatment Value</div><div class="stat-value">${fmtKES(plans.reduce((s, p) => s + p.total_estimated_value, 0))}</div></div>
          <div class="stat-card accent-gold"><div class="stat-label">Completed Value</div><div class="stat-value">${fmtKES(plans.filter(p => p.status === 'Completed').reduce((s, p) => s + p.total_estimated_value, 0))}</div></div>
        </div>

        <div class="card mt-16">
          <div class="card-header"><div><h3>Treatment Journeys</h3><div class="hint">Each treatment plan moves through the same seven-stage journey</div></div></div>
          <div class="card-pad" style="display:flex; flex-direction:column; gap:24px;">
            ${plans.length ? plans.map(plan => `
              <div>
                <div class="flex-between mt-8">
                  <div>
                    <span class="cell-strong">${plan.plan_number}</span>
                    <span class="cell-sub" style="margin-left:8px;">${fmtDate(plan.treatment_plan_date)} · Dr. ${niaUserName(db, plan.dentist_id).replace('Dr. ', '')}</span>
                  </div>
                  <div class="flex-gap">
                    <span class="badge ${niaBadgeClass(plan.status)}">${plan.status}</span>
                    <span class="cell-strong">${fmtKES(plan.total_estimated_value)}</span>
                  </div>
                </div>
                ${journeyHtml(plan)}
                <div class="table-wrap mt-8">
                  <table class="table">
                    <thead><tr><th>Procedure</th><th>Tooth</th><th>Cost</th><th>Status</th><th>Next Session</th></tr></thead>
                    <tbody>
                      ${db.procedures.filter(pr => pr.treatment_plan_id === plan.treatment_plan_id).map(pr => `
                        <tr>
                          <td class="cell-strong">${pr.procedure_name}</td>
                          <td>${pr.tooth_number || '—'}</td>
                          <td>${fmtKES(pr.estimated_cost)}</td>
                          <td><span class="badge ${niaBadgeClass(pr.status)}">${pr.status}</span></td>
                          <td>${pr.next_session_date ? fmtDate(pr.next_session_date) : '—'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `).join('<div style="height:1px; background:var(--nia-line);"></div>') : `<div class="empty-state">${niaIcon('empty')}<h4>No treatment plans yet</h4><p>Create the first treatment plan for this patient.</p></div>`}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;" class="mt-16">
          <div class="card">
            <div class="card-header"><h3>Appointment History</h3></div>
            <div style="padding:6px 8px;">
              ${appts.length ? appts.map(a => `
                <div style="padding:11px 14px; border-bottom:1px solid var(--nia-line); display:flex; justify-content:space-between;">
                  <div><div class="cell-strong" style="font-size:13px;">${fmtDate(a.appointment_date)} · ${a.appointment_time}</div><div class="cell-sub">${niaUserName(db, a.provider_id)}</div></div>
                  <span class="badge ${niaBadgeClass(a.status)}">${a.status}</span>
                </div>
              `).join('') : `<div class="empty-state"><p>No appointments yet.</p></div>`}
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Follow-Up History</h3></div>
            <div style="padding:6px 8px;">
              ${followUps.length ? followUps.map(f => `
                <div style="padding:11px 14px; border-bottom:1px solid var(--nia-line);">
                  <div class="flex-between"><span class="cell-strong" style="font-size:13px;">${fmtDate(f.follow_up_date)}</span><span class="badge ${niaBadgeClass(f.outcome === 'Declined' ? 'Rejected' : 'Shared')}">${f.outcome}</span></div>
                  <div class="cell-sub mt-8">${f.notes || '—'} — ${niaUserName(db, f.conducted_by)}</div>
                </div>
              `).join('') : `<div class="empty-state"><p>No follow-ups recorded.</p></div>`}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;
  document.getElementById('new-plan-btn').addEventListener('click', () => {
    go('plans', { new: patientId });
  });
};


/* ============================================================
   PAGE: Treatment Plans
   ============================================================ */
Pages.plans = function (db, user, params) {
  niaRenderShell('plans', user, db);
  niaRenderTopbar('Treatment Plans', `${niaScopedPlans(db).length} treatment plans across ${db.facility.facility_name}.`);

  const presetPatient = params.new || null;

  let statusFilter = 'all';
  let search = '';
  const STATUSES = ['Draft', 'Shared', 'Accepted', 'Rejected', 'In Progress', 'Completed', 'Dropped Off'];

  function render() {
    const scopedPlans = niaScopedPlans(db);
    let rows = scopedPlans.filter(p => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const name = niaPatientName(db, p.patient_id).toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase()) || p.plan_number.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    }).sort((a, b) => b.treatment_plan_date.localeCompare(a.treatment_plan_date));

    const html = `
      <div class="section-head">
        <div><h2>All Treatment Plans</h2><p>Master treatment records and their lifecycle status.</p></div>
        <button class="btn btn-primary" id="add-plan-btn">${niaIcon('plus')}New Treatment Plan</button>
      </div>

      <div class="card mt-16">
        <div style="padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; border-bottom:1px solid var(--nia-line);">
          <div class="topbar-search" style="min-width:260px;">${niaIcon('search')}<input type="text" id="plan-search" placeholder="Search patient or plan number..." value="${search}" /></div>
          <select id="status-filter" style="width:auto; min-width:160px;">
            <option value="all">All Statuses</option>
            ${STATUSES.map(s => `<option value="${s}" ${statusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <div style="margin-left:auto; font-size:12.5px; color:var(--nia-ink-soft);">${rows.length} of ${scopedPlans.length} plans</div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Plan</th><th>Patient</th><th>Dentist</th><th>Date</th><th>Value</th><th>Status</th><th>Shared?</th><th></th></tr></thead>
            <tbody>
              ${rows.map(p => `
                <tr>
                  <td><span class="cell-strong">${p.plan_number}</span></td>
                  <td><a href="#" class="link-patient" data-patient="${p.patient_id}" style="color:var(--nia-primary); font-weight:600;">${niaPatientName(db, p.patient_id)}</a></td>
                  <td>${niaUserName(db, p.dentist_id)}</td>
                  <td>${fmtDate(p.treatment_plan_date)}</td>
                  <td class="cell-strong">${fmtKES(p.total_estimated_value)}</td>
                  <td>
                    <select class="status-select" data-plan="${p.treatment_plan_id}" style="font-size:11.5px; padding:4px 8px; width:auto; border-radius:99px; font-weight:700; text-transform:uppercase; letter-spacing:0.03em;">
                      ${STATUSES.map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                  </td>
                  <td>${p.treatment_plan_shared ? `<span class="form-hint">${p.sharing_method}</span>` : `<span class="form-hint">Not shared</span>`}</td>
                  <td class="text-right"><button class="btn btn-ghost btn-sm open-patient-btn" data-patient="${p.patient_id}">Open</button></td>
                </tr>
              `).join('') || `<tr><td colspan="8"><div class="empty-state">${niaIcon('empty')}<h4>No treatment plans found</h4><p>Try a different filter or search.</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.getElementById('plan-search').addEventListener('input', e => { search = e.target.value; render(); const el = document.getElementById('plan-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
    document.getElementById('status-filter').addEventListener('change', e => { statusFilter = e.target.value; render(); });
    document.getElementById('add-plan-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const plan = db.plans.find(p => p.treatment_plan_id === sel.dataset.plan);
        plan.status = sel.value;
        niaSaveDB(db);
        niaToast(`${plan.plan_number} marked as ${sel.value}.`);
        render();
      });
    });
    document.querySelectorAll('.link-patient, .open-patient-btn').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); go('patient-profile', { id: el.dataset.patient }); });
    });
  }

  function openAddModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    const facilityPatients = niaScopedPatients(db);
    const dentists = niaScopedUsers(db).filter(u => u.role === 'dentist');
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>New Treatment Plan</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full"><label>Patient <span class="req">*</span></label>
              <select id="tp-patient">
                ${facilityPatients.map(p => `<option value="${p.patient_id}" ${presetPatient === p.patient_id ? 'selected' : ''}>${p.first_name} ${p.last_name} (${p.patient_number})</option>`).join('')}
              </select>
            </div>
            <div class="form-field"><label>Dentist <span class="req">*</span></label>
              <select id="tp-dentist">${dentists.map(d => `<option value="${d.user_id}">${d.full_name}</option>`).join('')}</select>
            </div>
            <div class="form-field"><label>Plan Date</label><input type="date" id="tp-date" value="${todayISO()}" /></div>
            <div class="form-field"><label>Estimated Value (KES)</label><input type="number" id="tp-value" placeholder="e.g. 45000" /></div>
            <div class="form-field"><label>Payment Mode</label><select id="tp-payment"><option>Cash</option><option>Insurance</option></select></div>
            <div class="form-field full"><label>Procedure Name</label><input type="text" id="tp-proc" placeholder="e.g. Crown Tooth 26" /></div>
            <div class="form-field full"><label>Notes</label><textarea id="tp-notes" placeholder="Clinical notes..."></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-plan">Create Plan</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-plan').addEventListener('click', () => {
      const patientId = document.getElementById('tp-patient').value;
      const dentistId = document.getElementById('tp-dentist').value;
      const value = Number(document.getElementById('tp-value').value) || 0;
      if (!patientId || !value) { niaToast('Please select a patient and enter an estimated value.'); return; }
      const planId = uid('tp');
      const planNumber = 'NIA-TP-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 899);
      db.plans.push({
        treatment_plan_id: planId, facility_id: db.facility.facility_id, patient_id: patientId, dentist_id: dentistId,
        plan_number: planNumber, treatment_plan_date: document.getElementById('tp-date').value || todayISO(),
        total_estimated_value: value, status: 'Draft', treatment_plan_shared: false, sharing_method: null, shared_date: null,
        notes: document.getElementById('tp-notes').value, created_at: todayISO(),
      });
      const procName = document.getElementById('tp-proc').value.trim();
      if (procName) {
        db.procedures.push({
          procedure_id: uid('pr'), treatment_plan_id: planId, procedure_name: procName, tooth_number: null,
          estimated_cost: value, priority: 'Medium', status: 'Planned', next_session_date: null, notes: '', created_at: todayISO(),
        });
      }
      niaSaveDB(db);
      modal.remove();
      niaToast(`Treatment plan ${planNumber} created.`);
      render();
    });
  }

  render();
  if (presetPatient) openAddModal();
};


/* ============================================================
   PAGE: Appointments
   ============================================================ */
Pages.appointments = function (db, user) {
  niaRenderShell('appointments', user, db);
  niaRenderTopbar('Appointments', `${niaScopedAppointments(db).filter(a => a.status === 'Scheduled').length} upcoming appointments.`);

  let viewFilter = 'upcoming';
  const STATUSES = ['Scheduled', 'Completed', 'No Show', 'Cancelled'];

  function render() {
    let rows = niaScopedAppointments(db);
    const today = todayISO();
    if (viewFilter === 'upcoming') rows = rows.filter(a => a.status === 'Scheduled');
    if (viewFilter === 'today') rows = rows.filter(a => a.appointment_date === today);
    if (viewFilter === 'past') rows = rows.filter(a => a.status !== 'Scheduled');
    rows.sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));

    const grouped = {};
    rows.forEach(a => { (grouped[a.appointment_date] = grouped[a.appointment_date] || []).push(a); });

    const html = `
      <div class="section-head">
        <div><h2>Appointment Schedule</h2><p>Manage treatment sessions, no-shows, and provider assignments.</p></div>
        <button class="btn btn-primary" id="add-appt-btn">${niaIcon('plus')}New Appointment</button>
      </div>

      <div class="pill-tab mt-16" id="view-filter">
        <button data-v="upcoming" class="${viewFilter === 'upcoming' ? 'active' : ''}">Upcoming</button>
        <button data-v="today" class="${viewFilter === 'today' ? 'active' : ''}">Today</button>
        <button data-v="past" class="${viewFilter === 'past' ? 'active' : ''}">Past & Closed</button>
      </div>

      <div class="mt-16" style="display:flex; flex-direction:column; gap:16px;">
        ${Object.keys(grouped).length ? Object.keys(grouped).map(date => `
          <div class="card">
            <div class="card-header"><h3>${fmtDate(date)}${date === today ? ' <span class="badge badge-gold" style="margin-left:8px;">Today</span>' : ''}</h3><div class="hint">${grouped[date].length} appointment${grouped[date].length > 1 ? 's' : ''}</div></div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Time</th><th>Patient</th><th>Procedure</th><th>Provider</th><th>Status</th><th>Notes</th></tr></thead>
                <tbody>
                  ${grouped[date].map(a => {
      const proc = db.procedures.find(p => p.procedure_id === a.procedure_id);
      return `<tr>
                      <td class="cell-strong">${a.appointment_time}</td>
                      <td><a href="#" class="link-patient" data-patient="${a.patient_id}" style="color:var(--nia-primary); font-weight:600;">${niaPatientName(db, a.patient_id)}</a></td>
                      <td>${proc ? proc.procedure_name : 'Consultation'}</td>
                      <td>${niaUserName(db, a.provider_id)}</td>
                      <td>
                        <select class="appt-status" data-appt="${a.appointment_id}" style="font-size:11.5px; padding:4px 8px; width:auto; border-radius:99px; font-weight:700; text-transform:uppercase;">
                          ${STATUSES.map(s => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                      </td>
                      <td class="cell-sub">${a.notes || '—'}</td>
                    </tr>`;
    }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('') : `<div class="card"><div class="empty-state">${niaIcon('empty')}<h4>No appointments in this view</h4><p>Switch tabs or schedule a new appointment.</p></div></div>`}
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.querySelectorAll('#view-filter button').forEach(btn => btn.addEventListener('click', () => { viewFilter = btn.dataset.v; render(); }));
    document.getElementById('add-appt-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.link-patient').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); go('patient-profile', { id: el.dataset.patient }); });
    });
    document.querySelectorAll('.appt-status').forEach(sel => {
      sel.addEventListener('change', () => {
        const appt = db.appointments.find(a => a.appointment_id === sel.dataset.appt);
        const prevStatus = appt.status;
        appt.status = sel.value;
        if (sel.value === 'No Show' && prevStatus !== 'No Show') {
          const frontOfficeStaff = niaScopedUsers(db).find(u => u.role === 'front_office');
          db.followUps.push({
            follow_up_id: uid('fu'), facility_id: db.facility.facility_id, patient_id: appt.patient_id,
            treatment_plan_id: appt.treatment_plan_id, conducted_by: frontOfficeStaff ? frontOfficeStaff.user_id : user.user_id,
            follow_up_date: todayISO(), outcome: 'Not Reached', next_follow_up_date: todayISO(2),
            notes: 'Auto-created: patient missed appointment.', created_at: todayISO(),
          });
          niaToast(`No-show recorded. Follow-up task created automatically.`);
        } else {
          niaToast(`Appointment marked as ${sel.value}.`);
        }
        niaSaveDB(db);
        render();
      });
    });
  }

  function openAddModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    const facilityPatients = niaScopedPatients(db);
    const providers = niaScopedUsers(db).filter(u => ['dentist', 'assistant'].includes(u.role));
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Schedule New Appointment</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full"><label>Patient <span class="req">*</span></label>
              <select id="ap-patient">${facilityPatients.map(p => `<option value="${p.patient_id}">${p.first_name} ${p.last_name} (${p.patient_number})</option>`).join('')}</select>
            </div>
            <div class="form-field"><label>Provider</label><select id="ap-provider">${providers.map(p => `<option value="${p.user_id}">${p.full_name}</option>`).join('')}</select></div>
            <div class="form-field"><label>Procedure</label>
              <select id="ap-procedure"><option value="">— Consultation —</option></select>
            </div>
            <div class="form-field"><label>Date <span class="req">*</span></label><input type="date" id="ap-date" value="${todayISO(1)}" /></div>
            <div class="form-field"><label>Time <span class="req">*</span></label><input type="time" id="ap-time" value="09:00" /></div>
            <div class="form-field full"><label>Notes</label><textarea id="ap-notes"></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-appt">Schedule Appointment</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    function refreshProcedures() {
      const pid = document.getElementById('ap-patient').value;
      const plans = db.plans.filter(p => p.patient_id === pid).map(p => p.treatment_plan_id);
      const procs = db.procedures.filter(pr => plans.includes(pr.treatment_plan_id) && pr.status !== 'Completed');
      document.getElementById('ap-procedure').innerHTML = `<option value="">— Consultation —</option>` + procs.map(pr => `<option value="${pr.procedure_id}">${pr.procedure_name}</option>`).join('');
    }
    document.getElementById('ap-patient').addEventListener('change', refreshProcedures);
    refreshProcedures();

    document.getElementById('save-appt').addEventListener('click', () => {
      const patientId = document.getElementById('ap-patient').value;
      const date = document.getElementById('ap-date').value;
      const time = document.getElementById('ap-time').value;
      if (!patientId || !date || !time) { niaToast('Please complete all required fields.'); return; }
      const procId = document.getElementById('ap-procedure').value || null;
      const proc = procId ? db.procedures.find(p => p.procedure_id === procId) : null;
      db.appointments.push({
        appointment_id: uid('ap'), facility_id: db.facility.facility_id, patient_id: patientId,
        treatment_plan_id: proc ? proc.treatment_plan_id : null, procedure_id: procId,
        provider_id: document.getElementById('ap-provider').value, appointment_date: date, appointment_time: time,
        status: 'Scheduled', notes: document.getElementById('ap-notes').value, created_at: todayISO(),
      });
      if (proc) { proc.status = 'Scheduled'; proc.next_session_date = date; }
      niaSaveDB(db);
      modal.remove();
      niaToast('Appointment scheduled.');
      render();
    });
  }

  render();
};


/* ============================================================
   PAGE: Follow-Up Queue
   ============================================================ */
Pages.followups = function (db, user) {
  niaRenderShell('followups', user, db);

  const today = todayISO();
  const OUTCOMES = ['Reached', 'Not Reached', 'Interested', 'Will Return', 'Declined', 'Wrong Number'];

  /* Build "needs follow-up" triggers per PRD section 12, plus existing logged follow-ups */
  function buildQueue() {
    const triggered = [];
    niaScopedPlans(db).forEach(plan => {
      if (plan.status === 'Accepted') {
        const hasAppt = niaScopedAppointments(db).some(a => a.treatment_plan_id === plan.treatment_plan_id);
        if (!hasAppt && daysBetween(plan.shared_date || plan.treatment_plan_date, today) > 7) {
          triggered.push({ patient_id: plan.patient_id, plan, reason: 'No booking within 7 days of acceptance', urgency: 'high' });
        }
      }
      if (plan.status === 'Dropped Off') {
        triggered.push({ patient_id: plan.patient_id, plan, reason: 'No patient activity for 60+ days', urgency: 'high' });
      }
    });
    niaScopedAppointments(db).filter(a => a.status === 'No Show').forEach(a => {
      triggered.push({ patient_id: a.patient_id, plan: db.plans.find(p => p.treatment_plan_id === a.treatment_plan_id), reason: `Missed appointment on ${fmtDate(a.appointment_date)}`, urgency: 'medium' });
    });
    return triggered;
  }

  niaRenderTopbar('Follow-Up Queue', `Patients requiring outreach to recover treatment value.`);

  let outcomeFilter = 'all';

  function render() {
    const queue = buildQueue();
    const scopedFollowUps = niaScopedFollowUps(db);
    const logged = scopedFollowUps.slice().sort((a, b) => b.follow_up_date.localeCompare(a.follow_up_date));
    const filteredLogged = outcomeFilter === 'all' ? logged : logged.filter(f => f.outcome === outcomeFilter);

    const recoverableValue = queue.reduce((s, q) => s + (q.plan ? q.plan.total_estimated_value : 0), 0);

    const html = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Patients In Queue</div><div class="stat-value">${queue.length}</div></div>
        <div class="stat-card accent-gold"><div class="stat-label">Recoverable Treatment Value</div><div class="stat-value">${fmtKES(recoverableValue)}</div></div>
        <div class="stat-card"><div class="stat-label">Follow-Ups Logged</div><div class="stat-value">${scopedFollowUps.length}</div></div>
        <div class="stat-card"><div class="stat-label">Due Today</div><div class="stat-value">${scopedFollowUps.filter(f => f.next_follow_up_date === today).length}</div></div>
      </div>

      <div class="section-head mt-24"><div><h2>Needs Follow-Up</h2><p>Automatically triggered by missed appointments, overdue acceptance, or inactivity.</p></div></div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Patient</th><th>Reason</th><th>Treatment Value</th><th>Urgency</th><th></th></tr></thead>
            <tbody>
              ${queue.length ? queue.map(q => `
                <tr>
                  <td><a href="#" class="link-patient" data-patient="${q.patient_id}" style="color:var(--nia-primary); font-weight:600;">${niaPatientName(db, q.patient_id)}</a></td>
                  <td>${q.reason}</td>
                  <td class="cell-strong">${q.plan ? fmtKES(q.plan.total_estimated_value) : '—'}</td>
                  <td><span class="badge ${q.urgency === 'high' ? 'badge-rejected' : 'badge-followup'}">${q.urgency === 'high' ? 'High' : 'Medium'}</span></td>
                  <td class="text-right"><button class="btn btn-gold btn-sm log-followup" data-patient="${q.patient_id}" data-plan="${q.plan ? q.plan.treatment_plan_id : ''}">${niaIcon('check')}Log Contact</button></td>
                </tr>
              `).join('') : `<tr><td colspan="5"><div class="empty-state">${niaIcon('check')}<h4>Queue is clear</h4><p>No patients currently need follow-up outreach.</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-head mt-24">
        <div><h2>Follow-Up History</h2><p>All logged outreach attempts and outcomes.</p></div>
        <select id="outcome-filter" style="width:auto;">
          <option value="all">All Outcomes</option>
          ${OUTCOMES.map(o => `<option value="${o}" ${outcomeFilter === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date</th><th>Patient</th><th>Staff Member</th><th>Outcome</th><th>Next Follow-Up</th><th>Notes</th></tr></thead>
            <tbody>
              ${filteredLogged.map(f => `
                <tr>
                  <td>${fmtDate(f.follow_up_date)}</td>
                  <td><a href="#" class="link-patient" data-patient="${f.patient_id}" style="color:var(--nia-primary); font-weight:600;">${niaPatientName(db, f.patient_id)}</a></td>
                  <td>${niaUserName(db, f.conducted_by)}</td>
                  <td><span class="badge ${['Reached', 'Interested', 'Will Return'].includes(f.outcome) ? 'badge-accepted' : (f.outcome === 'Declined' ? 'badge-rejected' : 'badge-draft')}">${f.outcome}</span></td>
                  <td>${f.next_follow_up_date ? fmtDate(f.next_follow_up_date) : '—'}</td>
                  <td class="cell-sub">${f.notes || '—'}</td>
                </tr>
              `).join('') || `<tr><td colspan="6"><div class="empty-state"><p>No follow-ups match this filter.</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.getElementById('outcome-filter').addEventListener('change', e => { outcomeFilter = e.target.value; render(); });
    document.querySelectorAll('.link-patient').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); go('patient-profile', { id: el.dataset.patient }); });
    });
    document.querySelectorAll('.log-followup').forEach(btn => {
      btn.addEventListener('click', () => openLogModal(btn.dataset.patient, btn.dataset.plan));
    });
  }

  function openLogModal(patientId, planId) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Log Follow-Up — ${niaPatientName(db, patientId)}</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full"><label>Outcome <span class="req">*</span></label>
              <select id="fu-outcome">${OUTCOMES.map(o => `<option value="${o}">${o}</option>`).join('')}</select>
            </div>
            <div class="form-field full"><label>Next Follow-Up Date</label><input type="date" id="fu-next" value="${todayISO(3)}" /></div>
            <div class="form-field full"><label>Notes</label><textarea id="fu-notes" placeholder="What happened on this call?"></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-followup">Save Follow-Up</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-followup').addEventListener('click', () => {
      db.followUps.push({
        follow_up_id: uid('fu'), facility_id: db.facility.facility_id, patient_id: patientId, treatment_plan_id: planId || null,
        conducted_by: user.user_id, follow_up_date: todayISO(), outcome: document.getElementById('fu-outcome').value,
        next_follow_up_date: document.getElementById('fu-next').value || null, notes: document.getElementById('fu-notes').value, created_at: todayISO(),
      });
      niaSaveDB(db);
      modal.remove();
      niaToast('Follow-up logged.');
      render();
    });
  }

  render();
};


/* ============================================================
   PAGE: Root Canal Tracker
   ============================================================ */
Pages.rootcanal = function (db, user) {
  niaRenderShell('rootcanal', user, db);
  niaRenderTopbar('Root Canal Tracker', `${niaScopedRootCanalCases(db).filter(c => c.status === 'Active').length} active multi-session root canal cases.`);

  const today = todayISO();

  function render() {
    const cases = niaScopedRootCanalCases(db).slice().sort((a, b) => (a.next_session_date || '').localeCompare(b.next_session_date || ''));
    const scopedSessions = niaScopedRootCanalSessions(db);

    const html = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Active Cases</div><div class="stat-value">${cases.filter(c => c.status === 'Active').length}</div></div>
        <div class="stat-card"><div class="stat-label">Completed Cases</div><div class="stat-value">${cases.filter(c => c.status === 'Completed').length}</div></div>
        <div class="stat-card"><div class="stat-label">Sessions Overdue</div><div class="stat-value">${cases.filter(c => c.status === 'Active' && c.next_session_date < today).length}</div></div>
        <div class="stat-card"><div class="stat-label">Total Sessions Logged</div><div class="stat-value">${scopedSessions.length}</div></div>
      </div>

      <div class="section-head mt-24"><div><h2>Root Canal Cases</h2><p>Multi-visit endodontic treatments by tooth and session.</p></div></div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${cases.map(c => {
      const sessions = scopedSessions.filter(s => s.root_canal_case_id === c.root_canal_case_id).sort((a, b) => a.session_number - b.session_number);
      const overdue = c.status === 'Active' && c.next_session_date < today;
      const pct = Math.round((c.current_session / c.planned_sessions) * 100);
      return `
          <div class="card">
            <div class="card-header">
              <div>
                <h3>${niaPatientName(db, c.patient_id)} — Tooth ${c.tooth_number}</h3>
                <div class="hint">Session ${c.current_session} of ${c.planned_sessions} ${overdue ? '· <span style="color:var(--nia-danger); font-weight:600;">Overdue</span>' : ''}</div>
              </div>
              <span class="badge ${niaBadgeClass(c.status)}">${c.status}</span>
            </div>
            <div class="card-pad">
              <div class="progress-track"><div class="progress-fill ${overdue ? '' : ''}" style="width:${pct}%; ${overdue ? 'background:linear-gradient(90deg, var(--nia-danger), #d65a6c);' : ''}"></div></div>
              <div class="flex-between mt-8">
                <span class="form-hint">Next session: ${c.next_session_date ? fmtDate(c.next_session_date) : '—'}</span>
                ${c.status === 'Active' ? `<button class="btn btn-gold btn-sm log-session" data-case="${c.root_canal_case_id}">${niaIcon('plus')}Log Session</button>` : ''}
              </div>
              ${sessions.length ? `
                <div class="table-wrap mt-16">
                  <table class="table">
                    <thead><tr><th>Session</th><th>Date</th><th>Provider</th><th>Procedure Done</th><th>Next Session</th></tr></thead>
                    <tbody>
                      ${sessions.map(s => `<tr><td class="cell-strong">#${s.session_number}</td><td>${fmtDate(s.session_date)}</td><td>${niaUserName(db, s.provider_id)}</td><td>${s.procedure_done}</td><td>${s.next_session_date ? fmtDate(s.next_session_date) : '—'}</td></tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
            </div>
          </div>`;
    }).join('') || `<div class="card"><div class="empty-state">${niaIcon('empty')}<h4>No root canal cases</h4></div></div>`}
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.querySelectorAll('.log-session').forEach(btn => btn.addEventListener('click', () => openSessionModal(btn.dataset.case)));
  }

  function openSessionModal(caseId) {
    const c = db.rootCanalCases.find(x => x.root_canal_case_id === caseId);
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    const dentists = niaScopedUsers(db).filter(u => u.role === 'dentist');
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Log Root Canal Session</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">���</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field"><label>Provider</label><select id="rc-provider">${dentists.map(d => `<option value="${d.user_id}">${d.full_name}</option>`).join('')}</select></div>
            <div class="form-field"><label>Session Date</label><input type="date" id="rc-date" value="${todayISO()}" /></div>
            <div class="form-field full"><label>Procedure Done</label><input type="text" id="rc-proc" placeholder="e.g. Canal obturation" /></div>
            <div class="form-field"><label>Next Session Date</label><input type="date" id="rc-next" value="${todayISO(14)}" /></div>
            <div class="form-field"><label>Mark Case Completed?</label><select id="rc-complete"><option value="no">No, more sessions needed</option><option value="yes">Yes, this was the final session</option></select></div>
            <div class="form-field full"><label>Notes</label><textarea id="rc-notes"></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-session">Save Session</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-session').addEventListener('click', () => {
      const nextSessionNum = c.current_session + 1;
      const isFinal = document.getElementById('rc-complete').value === 'yes';
      db.rootCanalSessions.push({
        root_canal_session_id: uid('rcs'), root_canal_case_id: caseId, provider_id: document.getElementById('rc-provider').value,
        session_number: c.current_session, session_date: document.getElementById('rc-date').value,
        procedure_done: document.getElementById('rc-proc').value, next_session_date: isFinal ? null : document.getElementById('rc-next').value,
        notes: document.getElementById('rc-notes').value, created_at: todayISO(),
      });
      if (isFinal) {
        c.status = 'Completed';
        c.next_session_date = null;
      } else {
        c.current_session = nextSessionNum;
        c.next_session_date = document.getElementById('rc-next').value;
      }
      niaSaveDB(db);
      modal.remove();
      niaToast(isFinal ? 'Root canal case marked completed.' : 'Session logged.');
      render();
    });
  }

  render();
};


/* ============================================================
   PAGE: Braces Tracker
   ============================================================ */
Pages.braces = function (db, user) {
  niaRenderShell('braces', user, db);
  niaRenderTopbar('Braces Tracker', `${niaScopedBracesCases(db).filter(c => c.status === 'Active').length} active orthodontic cases.`);

  const today = todayISO();

  function render() {
    const cases = niaScopedBracesCases(db).slice().sort((a, b) => (a.next_review_date || '').localeCompare(b.next_review_date || ''));
    const scopedVisits = niaScopedBracesVisits(db);

    const html = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Active Cases</div><div class="stat-value">${cases.filter(c => c.status === 'Active').length}</div></div>
        <div class="stat-card"><div class="stat-label">Completed Cases</div><div class="stat-value">${cases.filter(c => c.status === 'Completed').length}</div></div>
        <div class="stat-card"><div class="stat-label">Reviews Overdue</div><div class="stat-value">${cases.filter(c => c.status === 'Active' && c.next_review_date < today).length}</div></div>
        <div class="stat-card"><div class="stat-label">Total Visits Logged</div><div class="stat-value">${scopedVisits.length}</div></div>
      </div>

      <div class="section-head mt-24"><div><h2>Orthodontic Cases</h2><p>Treatment stage and monthly review compliance.</p></div></div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${cases.map(c => {
      const visits = scopedVisits.filter(v => v.braces_case_id === c.braces_case_id).sort((a, b) => a.visit_date.localeCompare(b.visit_date));
      const overdue = c.status === 'Active' && c.next_review_date < today;
      const monthsIn = Math.max(0, Math.round(daysBetween(c.treatment_start_date, today) / 30));
      const pct = Math.min(100, Math.round((monthsIn / c.expected_duration_months) * 100));
      return `
          <div class="card">
            <div class="card-header">
              <div>
                <h3>${niaPatientName(db, c.patient_id)}</h3>
                <div class="hint">${c.current_stage} ${overdue ? '· <span style="color:var(--nia-danger); font-weight:600;">Review overdue</span>' : ''}</div>
              </div>
              <span class="badge ${niaBadgeClass(c.status)}">${c.status}</span>
            </div>
            <div class="card-pad">
              <div class="progress-track"><div class="progress-fill gold" style="width:${pct}%; ${overdue ? 'background:linear-gradient(90deg, var(--nia-danger), #d65a6c);' : ''}"></div></div>
              <div class="flex-between mt-8">
                <span class="form-hint">Month ${monthsIn} of ${c.expected_duration_months} · Next review: ${c.next_review_date ? fmtDate(c.next_review_date) : '—'}</span>
                ${c.status === 'Active' ? `<button class="btn btn-gold btn-sm log-visit" data-case="${c.braces_case_id}">${niaIcon('plus')}Log Review Visit</button>` : ''}
              </div>
              ${visits.length ? `
                <div class="table-wrap mt-16">
                  <table class="table">
                    <thead><tr><th>Date</th><th>Provider</th><th>Adjustment Performed</th><th>Next Review</th></tr></thead>
                    <tbody>
                      ${visits.map(v => `<tr><td class="cell-strong">${fmtDate(v.visit_date)}</td><td>${niaUserName(db, v.provider_id)}</td><td>${v.adjustment_performed}</td><td>${v.next_review_date ? fmtDate(v.next_review_date) : '—'}</td></tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
            </div>
          </div>`;
    }).join('') || `<div class="card"><div class="empty-state">${niaIcon('empty')}<h4>No braces cases</h4></div></div>`}
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.querySelectorAll('.log-visit').forEach(btn => btn.addEventListener('click', () => openVisitModal(btn.dataset.case)));
  }

  function openVisitModal(caseId) {
    const c = db.bracesCases.find(x => x.braces_case_id === caseId);
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    const dentists = niaScopedUsers(db).filter(u => u.role === 'dentist');
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Log Braces Review Visit</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field"><label>Provider</label><select id="bv-provider">${dentists.map(d => `<option value="${d.user_id}">${d.full_name}</option>`).join('')}</select></div>
            <div class="form-field"><label>Visit Date</label><input type="date" id="bv-date" value="${todayISO()}" /></div>
            <div class="form-field full"><label>Adjustment Performed</label><input type="text" id="bv-adj" placeholder="e.g. Archwire tension adjustment" /></div>
            <div class="form-field full"><label>Current Stage</label><input type="text" id="bv-stage" value="${c.current_stage}" /></div>
            <div class="form-field"><label>Next Review Date</label><input type="date" id="bv-next" value="${todayISO(30)}" /></div>
            <div class="form-field"><label>Mark Treatment Completed?</label><select id="bv-complete"><option value="no">No, continue treatment</option><option value="yes">Yes, braces removed</option></select></div>
            <div class="form-field full"><label>Notes</label><textarea id="bv-notes"></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-visit">Save Visit</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-visit').addEventListener('click', () => {
      const isFinal = document.getElementById('bv-complete').value === 'yes';
      db.bracesVisits.push({
        braces_visit_id: uid('bv'), braces_case_id: caseId, provider_id: document.getElementById('bv-provider').value,
        visit_date: document.getElementById('bv-date').value, adjustment_performed: document.getElementById('bv-adj').value,
        next_review_date: isFinal ? null : document.getElementById('bv-next').value,
        notes: document.getElementById('bv-notes').value, created_at: todayISO(),
      });
      c.current_stage = document.getElementById('bv-stage').value;
      if (isFinal) { c.status = 'Completed'; c.next_review_date = null; }
      else { c.next_review_date = document.getElementById('bv-next').value; }
      niaSaveDB(db);
      modal.remove();
      niaToast(isFinal ? 'Braces case marked completed.' : 'Review visit logged.');
      render();
    });
  }

  render();
};


/* ============================================================
   PAGE: Reports
   ============================================================ */
Pages.reports = function (db, user) {
  niaRenderShell('reports', user, db);
  niaRenderTopbar('Reports', `Facility and team performance, ${db.facility.facility_name}.`);

  const stats = niaComputeStats(db);
  const scopedUsers = niaScopedUsers(db);
  const scopedPlans = niaScopedPlans(db);
  const scopedFollowUps = niaScopedFollowUps(db);
  const scopedPatients = niaScopedPatients(db);
  const scopedRootCanalCases = niaScopedRootCanalCases(db);
  const scopedBracesCases = niaScopedBracesCases(db);

  /* ---------- Team performance per role ---------- */
  const dentists = scopedUsers.filter(u => u.role === 'dentist');
  const dentistRows = dentists.map(d => {
    const myPlans = scopedPlans.filter(p => p.dentist_id === d.user_id);
    const value = myPlans.reduce((s, p) => s + p.total_estimated_value, 0);
    const accepted = myPlans.filter(p => ['Accepted', 'In Progress', 'Completed'].includes(p.status)).length;
    const completed = myPlans.filter(p => p.status === 'Completed').length;
    return {
      name: d.full_name, generated: myPlans.length, value,
      acceptanceRate: myPlans.length ? Math.round((accepted / myPlans.length) * 100) : 0,
      completionRate: myPlans.length ? Math.round((completed / myPlans.length) * 100) : 0,
    };
  });

  const frontOffice = scopedUsers.filter(u => u.role === 'front_office');
  const foRows = frontOffice.map(f => {
    const myFollowUps = scopedFollowUps.filter(fu => fu.conducted_by === f.user_id);
    const reached = myFollowUps.filter(fu => ['Reached', 'Interested', 'Will Return'].includes(fu.outcome)).length;
    const recoveredPlans = scopedPlans.filter(p => myFollowUps.some(fu => fu.treatment_plan_id === p.treatment_plan_id) && ['In Progress', 'Completed'].includes(p.status));
    const recoveredValue = recoveredPlans.reduce((s, p) => s + p.total_estimated_value, 0);
    return {
      name: f.full_name, contacted: myFollowUps.length,
      contactRate: myFollowUps.length ? Math.round((reached / myFollowUps.length) * 100) : 0,
      recoveredValue,
    };
  });

  const assistants = scopedUsers.filter(u => u.role === 'assistant');
  const asstRows = assistants.map(a => {
    const rc = scopedRootCanalCases;
    const bc = scopedBracesCases;
    const activeCases = rc.filter(c => c.status === 'Active').length + bc.filter(c => c.status === 'Active').length;
    const overdueRC = rc.filter(c => c.status === 'Active' && c.next_session_date < todayISO()).length;
    const overdueBC = bc.filter(c => c.status === 'Active' && c.next_review_date < todayISO()).length;
    const rcCompliance = rc.length ? Math.round(((rc.length - overdueRC) / rc.length) * 100) : 100;
    const bcCompliance = bc.length ? Math.round(((bc.length - overdueBC) / bc.length) * 100) : 100;
    return { name: a.full_name, activeCases, rcCompliance, bcCompliance, overdue: overdueRC + overdueBC };
  });

  const claimsOfficers = scopedUsers.filter(u => u.role === 'claims');
  const claimsRows = claimsOfficers.map(c => {
    const insurancePlans = scopedPlans.filter(p => scopedPatients.find(pt => pt.patient_id === p.patient_id)?.payment_type.startsWith('Insurance'));
    const pending = insurancePlans.filter(p => ['Shared', 'Accepted'].includes(p.status)).length;
    const approvedValue = insurancePlans.filter(p => ['In Progress', 'Completed'].includes(p.status)).reduce((s, p) => s + p.total_estimated_value, 0);
    return { name: c.full_name, pending, approvedValue, turnaround: '2.4 days' };
  });

  function teamTable(title, hint, headers, rows, renderRow) {
    return `<div class="card mt-16">
      <div class="card-header"><div><h3>${title}</h3><div class="hint">${hint}</div></div></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(renderRow).join('') || `<tr><td colspan="${headers.length}" style="text-align:center; color:var(--nia-ink-soft); padding:24px;">No data yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
  }

  function rateCard(label, pct, note) {
    return `<div class="card card-pad">
      <div class="flex-between"><span style="font-size:13px; font-weight:700; color:var(--nia-secondary);">${label}</span><span style="font-family:var(--font-display); font-weight:700; font-size:18px; color:var(--nia-primary);">${pct}%</span></div>
      <div class="progress-track mt-8"><div class="progress-fill" style="width:${pct}%;"></div></div>
      <div class="form-hint mt-8">${note}</div>
    </div>`;
  }

  const html = `
    <div class="section-head"><div><h2>Facility Performance</h2><p>The five rates that summarise treatment journey health.</p></div></div>
    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
      ${rateCard('Treatment Journey Completion Rate', stats.journeyCompletionRate, 'Completed plans ÷ plans created × 100')}
      ${rateCard('Treatment Conversion Rate', stats.conversionRate, 'Accepted value ÷ total plan value × 100')}
      ${rateCard('Treatment Completion Rate', stats.completionRate, 'Completed value ÷ accepted value × 100')}
      ${rateCard('Patient Drop-Off Rate', stats.dropOffRate, 'Dropped-off ÷ active + dropped patients × 100')}
    </div>

    <div class="section-head mt-24"><div><h2>Team Performance</h2><p>Contribution by role across the treatment journey.</p></div></div>

    ${teamTable('Dentist Report', 'Treatment plans generated and conversion outcomes', ['Dentist', 'Plans Generated', 'Value Generated', 'Acceptance Rate', 'Completion Rate'], dentistRows, r => `
      <tr><td class="cell-strong">${r.name}</td><td>${r.generated}</td><td>${fmtKES(r.value)}</td><td>${r.acceptanceRate}%</td><td>${r.completionRate}%</td></tr>
    `)}

    ${teamTable('Front Office Report', 'Patient outreach and recovered treatment value', ['Staff Member', 'Patients Contacted', 'Contact Rate', 'Treatment Value Recovered'], foRows, r => `
      <tr><td class="cell-strong">${r.name}</td><td>${r.contacted}</td><td>${r.contactRate}%</td><td>${fmtKES(r.recoveredValue)}</td></tr>
    `)}

    ${teamTable('Dental Assistant Report', 'Case load and review compliance', ['Staff Member', 'Active Cases', 'Root Canal Compliance', 'Braces Review Compliance', 'Overdue Sessions'], asstRows, r => `
      <tr><td class="cell-strong">${r.name}</td><td>${r.activeCases}</td><td>${r.rcCompliance}%</td><td>${r.bcCompliance}%</td><td>${r.overdue}</td></tr>
    `)}

    ${teamTable('Claims Report', 'Insurance approvals and authorization tracking', ['Staff Member', 'Pending Approvals', 'Approved Value', 'Avg. Turnaround'], claimsRows, r => `
      <tr><td class="cell-strong">${r.name}</td><td>${r.pending}</td><td>${fmtKES(r.approvedValue)}</td><td>${r.turnaround}</td></tr>
    `)}
  `;
  document.getElementById('content').innerHTML = html;
};


/* ============================================================
   PAGE: Team & Roles
   ============================================================ */
Pages.team = function (db, user) {
  if (!['admin', 'owner'].includes(user.role)) {
    go('dashboard');
    return;
  }
  niaRenderShell('team', user, db);
  const scopedUsers = niaScopedUsers(db);
  niaRenderTopbar('Team & Roles', `${scopedUsers.length} staff members at ${db.facility.facility_name}.`);

  function render() {
    const html = `
      <div class="section-head">
        <div><h2>Staff Members</h2><p>Manage roles and access across the seven user types.</p></div>
        <button class="btn btn-primary" id="add-user-btn">${niaIcon('plus')}Add Staff Member</button>
      </div>

      <div class="card mt-16">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              ${scopedUsers.map(u => `
                <tr>
                  <td><div class="flex-gap"><div class="avatar-sm">${initials(u.full_name)}</div><span class="cell-strong">${u.full_name}</span></div></td>
                  <td>${u.email}</td>
                  <td>
                    <select class="role-select" data-user="${u.user_id}" ${u.user_id === user.user_id ? 'disabled' : ''} style="width:auto;">
                      ${NIA_ROLES.map(r => `<option value="${r.id}" ${u.role === r.id ? 'selected' : ''}>${r.label}</option>`).join('')}
                    </select>
                  </td>
                  <td><span class="badge ${u.active_status ? 'badge-accepted' : 'badge-cancelled'}">${u.active_status ? 'Active' : 'Inactive'}</span></td>
                  <td>${fmtDate(u.created_at)}</td>
                  <td class="text-right">${u.user_id === user.user_id ? '<span class="form-hint">You</span>' : `<button class="btn btn-ghost btn-sm toggle-active" data-user="${u.user_id}">${u.active_status ? 'Deactivate' : 'Activate'}</button>`}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-head mt-24"><div><h2>Role Reference</h2><p>What each role can see and do in NiaCARE.</p></div></div>
      <div class="stat-grid">
        ${[
        { r: 'Dentist', d: 'Creates treatment plans, explains options, updates clinical progress.' },
        { r: 'Dental Assistant', d: 'Coordinates sessions, monitors root canal and braces cases.' },
        { r: 'Front Office', d: 'Schedules appointments, runs follow-ups, recovers inactive patients.' },
        { r: 'Claims Officer', d: 'Tracks insurance approvals and payment authorization.' },
        { r: 'Facility Administrator', d: 'Monitors operations, team performance, journey completion.' },
        { r: 'Facility Owner', d: 'Strategic oversight of revenue, completion, and retention.' },
        { r: 'Super Admin', d: 'Platform-wide access across all facilities.' },
      ].map(x => `<div class="card card-pad"><h4 style="font-size:14px; margin-bottom:6px;">${x.r}</h4><p style="font-size:12.5px; color:var(--nia-ink-soft); margin:0;">${x.d}</p></div>`).join('')}
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.getElementById('add-user-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.role-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const u = db.users.find(x => x.user_id === sel.dataset.user);
        u.role = sel.value;
        niaSaveDB(db);
        niaToast(`${u.full_name}'s role updated to ${niaRoleLabel(u.role)}.`);
        render();
      });
    });
    document.querySelectorAll('.toggle-active').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = db.users.find(x => x.user_id === btn.dataset.user);
        u.active_status = !u.active_status;
        niaSaveDB(db);
        niaToast(`${u.full_name} ${u.active_status ? 'activated' : 'deactivated'}.`);
        render();
      });
    });
  }

  function openAddModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Add Staff Member</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full"><label>Full Name <span class="req">*</span></label><input type="text" id="nu-name" /></div>
            <div class="form-field full"><label>Email <span class="req">*</span></label><input type="email" id="nu-email" /></div>
            <div class="form-field full"><label>Role</label><select id="nu-role">${NIA_ROLES.map(r => `<option value="${r.id}">${r.label}</option>`).join('')}</select></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-user">Add Staff Member</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-user').addEventListener('click', () => {
      const name = document.getElementById('nu-name').value.trim();
      const email = document.getElementById('nu-email').value.trim();
      if (!name || !email) { niaToast('Please complete all required fields.'); return; }
      db.users.push({ user_id: uid('u'), facility_id: db.facility.facility_id, full_name: name, email, role: document.getElementById('nu-role').value, active_status: true, created_at: todayISO() });
      niaSaveDB(db);
      modal.remove();
      niaToast(`${name} added to the team.`);
      render();
    });
  }

  render();
};


/* ============================================================
   PAGE: Facility Settings
   ============================================================ */
Pages.facility = function (db, user) {
  if (!['admin', 'owner'].includes(user.role)) {
    go('dashboard');
    return;
  }
  niaRenderShell('facility', user, db);
  niaRenderTopbar('Facility Settings', 'Manage your facility profile and platform configuration.');

  const f = db.facility;
  let profileFacility = f;
  let profileEditMode = false;
  const profileDb = () => ({ ...db, facility: profileFacility });
  const html = `
  <div style="display:grid; grid-template-columns:minmax(0, 1fr) 360px; gap:18px;">
  <div class="card${!profileFacility.active_status ? ' facility-inactive' : ''}">
  <div class="facility-profile-header"><div class="facility-profile-heading"><div class="facility-profile-icon">⌂</div><div><div class="eyebrow">Facility profile</div><h3 id="facility-profile-title"><span class="facility-profile-brand">NiaCARE |</span> <span>${(profileFacility.facility_name || 'Facility').replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '')}</span></h3><span class="form-hint" id="facility-profile-context">Main facility</span></div></div><button class="btn btn-ghost btn-sm" id="edit-facility">Edit Facility Details</button></div>
  <div class="card-pad" id="facility-profile-body">
<div class="facility-profile-columns"><div class="facility-detail-row"><span>Facility Name</span><strong>${(profileFacility.facility_name || '—').replace(/^NiaCARE\s*(?:—|-|\|)\s*/, 'NiaCARE | ')}</strong></div><div class="facility-detail-row"><span>Facility Code</span><strong>${profileFacility.facility_code || '—'}</strong></div><div class="facility-detail-row"><span>Email</span><strong>${profileFacility.facility_email || '—'}</strong></div><div class="facility-detail-row"><span>Phone</span><strong>${profileFacility.facility_phone || '—'}</strong></div><div class="facility-detail-row"><span>County</span><strong>${profileFacility.county || '—'}</strong></div><div class="facility-detail-row"><span>Status</span><strong><span class="badge ${profileFacility.active_status ? 'badge-success' : 'badge-inactive'}">${profileFacility.active_status ? 'Active' : 'Inactive'}</span></strong></div></div><div class="facility-metric-grid"><div><span><i class="facility-metric-icon">${niaIcon('users')}</i>Total Users</span><strong>${niaScopedUsers(profileDb()).length}</strong></div><div><span><i class="facility-metric-icon">${niaIcon('patients')}</i>Total Patients</span><strong>${niaScopedPatients(profileDb()).length}</strong></div><div><span><i class="facility-metric-icon">${niaIcon('calendar')}</i>Created Date</span><strong>${fmtDate(profileFacility.created_at)}</strong></div></div>
  </div>
  </div>

      <div class="card mt-16 facility-branches-card${!profileFacility.active_status ? ' facility-inactive' : ''}">
        <div class="card-header"><div><h3>Branches</h3><div class="hint">Add branches managed under this facility. Owners can switch branches from Practice Intelligence.</div></div></div>
        <div class="card-pad">
          <div class="mt-16" id="branch-list">${[f, ...(db.facilities || []).filter(branch => branch.parent_facility_id === f.facility_id && branch.facility_id !== f.facility_id)].map(branch => `<div class="flex-between branch-row" style="padding:10px 0; border-top:1px solid var(--nia-border);"><span class="branch-name"><strong>${branch.facility_name.replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '')}</strong></span><span style="display:flex; align-items:center; gap:8px;"><span class="badge ${branch.active_status ? 'badge-success' : 'badge-inactive'}">${branch.facility_id === f.facility_id ? 'Main' : branch.active_status ? 'Active' : 'Inactive'}</span><button class="btn btn-ghost btn-sm view-facility" data-facility="${branch.facility_id}">View Facility</button></span></div>`).join('') || '<div class="form-hint">No facilities yet.</div>'}</div>
          <button class="btn btn-primary mt-24 facility-add-branch" id="show-add-branch"><span>Add Branch</span><strong>+</strong></button>
          <div id="add-branch-form" style="display:none;" class="mt-16"><div class="form-grid"><div class="form-field"><label>Branch name</label><input type="text" id="branch-name" placeholder="e.g. Bamburi Dental Centre" /></div><div class="form-field"><label>County</label><input type="text" id="branch-county" value="${f.county || ''}" /></div><div class="form-field"><label>Email</label><input type="email" id="branch-email" placeholder="branch@example.com" /></div><div class="form-field"><label>Phone</label><input type="text" id="branch-phone" placeholder="+254 ..." /></div></div><button class="btn btn-primary mt-24" id="add-branch">Save Branch</button></div>
        </div>
      </div>

    </div>

    <div class="card mt-16">
      <div class="card-header"><div><h3>Danger Zone</h3><div class="hint">Permanently remove this facility from the client system.</div></div></div>
      <div class="card-pad">
        <p class="danger-warning">Deleting a facility permanently erases its client access and cannot be recovered. NiaCARE administrators will retain a deleted-facility record for audit purposes.</p>
        <button class="btn btn-danger" id="delete-facility">Delete Facility</button>
      </div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;

  const renderProfileDetails = () => {
  document.getElementById('facility-profile-body').innerHTML = `<div class="facility-profile-columns"><div class="facility-detail-row"><span>Facility Name</span><strong>${(profileFacility.facility_name || '—').replace(/^NiaCARE\s*(?:—|-|\|)\s*/, 'NiaCARE | ')}</strong></div><div class="facility-detail-row"><span>Facility Code</span><strong>${profileFacility.facility_code || '—'}</strong></div><div class="facility-detail-row"><span>Email</span><strong>${profileFacility.facility_email || '—'}</strong></div><div class="facility-detail-row"><span>Phone</span><strong>${profileFacility.facility_phone || '��'}</strong></div><div class="facility-detail-row"><span>County</span><strong>${profileFacility.county || '—'}</strong></div><div class="facility-detail-row"><span>Status</span><strong><span class="badge ${profileFacility.active_status ? 'badge-success' : 'badge-inactive'}">${profileFacility.active_status ? 'Active' : 'Inactive'}</span></strong></div></div><div class="facility-metric-grid"><div><span><i class="facility-metric-icon">${niaIcon('users')}</i>Total Users</span><strong>${niaScopedUsers(profileDb()).length}</strong></div><div><span><i class="facility-metric-icon">${niaIcon('patients')}</i>Total Patients</span><strong>${niaScopedPatients(profileDb()).length}</strong></div><div><span><i class="facility-metric-icon">${niaIcon('calendar')}</i>Created Date</span><strong>${fmtDate(profileFacility.created_at)}</strong></div></div>`;
  document.getElementById('facility-profile-title').innerHTML = `<span class="facility-profile-brand">NiaCARE |</span> <span>${(profileFacility.facility_name || 'Facility').replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '')}</span>`;
  document.getElementById('facility-profile-context').textContent = profileFacility.facility_id === f.facility_id ? 'Main facility' : `Viewing—${(profileFacility.facility_name || 'facility').replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '')}`;
  document.getElementById('edit-facility').style.display = '';
  };

  const enterProfileEditMode = () => {
  document.getElementById('facility-profile-body').innerHTML = `<div class="form-grid"><div class="form-field"><label>Facility Name</label><div class="facility-name-input"><span>NiaCARE |</span><input type="text" id="f-name" value="${(profileFacility.facility_name || '').replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '')}" autocomplete="organization" /></div></div><div class="form-field"><label>Facility Code</label><input type="text" id="f-code" value="${profileFacility.facility_code || ''}" readonly /></div><div class="form-field"><label>Email</label><input type="email" id="f-email" value="${profileFacility.facility_email || ''}" /></div><div class="form-field"><label>Phone</label><input type="text" id="f-phone" value="${profileFacility.facility_phone || ''}" /></div><div class="form-field"><label>County</label><input type="text" id="f-county" value="${profileFacility.county || ''}" /></div><div class="form-field"><label>Status</label><select id="f-status"><option ${profileFacility.active_status ? 'selected' : ''}>Active</option><option ${!profileFacility.active_status ? 'selected' : ''}>Inactive</option></select></div></div><div class="facility-edit-actions"><button class="btn btn-primary" id="save-facility">Save Changes</button><button class="btn btn-ghost" id="close-facility-edit" type="button">Close</button></div>`;
  document.getElementById('edit-facility').style.display = 'none';
  document.getElementById('close-facility-edit').addEventListener('click', () => renderProfileDetails());
  document.getElementById('save-facility').addEventListener('click', () => {
    profileFacility.facility_name = `NiaCARE | ${document.getElementById('f-name').value.trim()}`;
    profileFacility.facility_email = document.getElementById('f-email').value;
    profileFacility.facility_phone = document.getElementById('f-phone').value;
    profileFacility.county = document.getElementById('f-county').value;
    profileFacility.active_status = document.getElementById('f-status').value === 'Active';
    niaSaveDB(db);
    document.getElementById('facility-profile-context').textContent = `Viewing—${profileFacility.facility_name.replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '')}`;
    niaToast('Facility profile updated.');
    renderProfileDetails();
  });
  };

  document.getElementById('edit-facility').addEventListener('click', enterProfileEditMode);
  document.querySelectorAll('.view-facility').forEach(button => button.addEventListener('click', () => {
  profileFacility = (db.facilities || []).find(facility => facility.facility_id === button.dataset.facility) || f;
  document.getElementById('facility-profile-context').textContent = `Viewing—${profileFacility.facility_name.replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '')}`;
  renderProfileDetails();
  }));

  document.getElementById('show-add-branch').addEventListener('click', () => {
  const form = document.getElementById('add-branch-form');
  const isHidden = form.style.display === 'none';
  form.style.display = isHidden ? 'block' : 'none';
  document.getElementById('show-add-branch').textContent = isHidden ? 'Cancel' : 'Add Branch';
  if (isHidden) document.getElementById('branch-name').focus();
  });

  document.getElementById('add-branch').addEventListener('click', () => {
  const name = document.getElementById('branch-name').value.trim();
    if (!name) { niaToast('Enter a branch name.'); return; }
    const branch = {
      facility_id: uid('fac'),
      parent_facility_id: f.facility_id,
      facility_name: `NiaCARE | ${name}`,
      facility_code: `${f.facility_code}-BR-${String((db.facilities || []).filter(item => item.parent_facility_id === f.facility_id).length + 1).padStart(2, '0')}`,
      facility_email: document.getElementById('branch-email').value.trim(),
      facility_phone: document.getElementById('branch-phone').value.trim(),
      county: document.getElementById('branch-county').value.trim(),
      active_status: true,
      onboarded_at: todayISO(),
      created_at: todayISO(),
      subscription: niaBuildSubscription(todayISO(), 1, 'active'),
    };
    db.facilities.push(branch);
    niaSaveDB(db);
    niaToast(`${name} added as a branch.`);
    setTimeout(() => Pages.facility(db, user), 350);
  });

  document.getElementById('delete-facility').addEventListener('click', () => {
  const deleteTarget = profileFacility;
  const facilityName = (deleteTarget.facility_name || 'this facility').replace(/^NiaCARE\s*(?:—|-|\|)\s*/, '');
  const isMainFacility = !deleteTarget.parent_facility_id;
  const activeOtherFacilities = (db.facilities || []).filter(item => item.facility_id !== deleteTarget.facility_id && item.active_status && !item.deleted_at && item.deletion_status !== 'deleted_by_owner');
  if (isMainFacility && activeOtherFacilities.length > 0) {
    niaToast('The main facility cannot be deleted while other facilities are active. Deactivate or delete the other facilities first.');
    return;
  }
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop facility-delete-backdrop';
  modal.innerHTML = `<div class="modal facility-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="facility-delete-title"><div class="facility-delete-icon">!</div><div class="modal-header"><div><div class="eyebrow danger-eyebrow">Danger zone</div><h3 id="facility-delete-title">Delete ${facilityName}?</h3></div><button class="modal-close" type="button" aria-label="Close delete dialog">✕</button></div><div class="modal-body"><div class="facility-delete-warning"><strong>This action is permanent.</strong><p>All patients, staff, treatment plans, appointments, and facility data will be erased from the client system and cannot be recovered. NiaCARE administrators will retain an audit record showing that the facility was deleted by the owner.</p></div><label class="delete-consent"><input type="checkbox" id="delete-consent" /><span>I understand that all data for this facility will be permanently erased.</span></label><div class="form-field"><label for="delete-owner-password">Facility owner password</label><input id="delete-owner-password" type="password" autocomplete="current-password" placeholder="Enter owner password" /></div><p class="delete-error" id="delete-error" role="alert"></p></div><div class="modal-footer"><button class="btn btn-ghost" type="button" id="cancel-delete-facility">Cancel</button><button class="btn btn-danger" type="button" id="confirm-delete-facility" disabled>Delete Facility</button></div></div>`;
  document.body.appendChild(modal);
  const closeModal = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('#cancel-delete-facility').addEventListener('click', closeModal);
  const consent = modal.querySelector('#delete-consent');
  const passwordInput = modal.querySelector('#delete-owner-password');
  const confirmButton = modal.querySelector('#confirm-delete-facility');
  const error = modal.querySelector('#delete-error');
  const syncDeleteButton = () => { confirmButton.disabled = !consent.checked || !passwordInput.value.trim(); };
  consent.addEventListener('change', syncDeleteButton);
  passwordInput.addEventListener('input', syncDeleteButton);
  confirmButton.addEventListener('click', () => {
    if (passwordInput.value !== 'demo-password') { error.textContent = 'Incorrect facility owner password. Facility was not deleted.'; passwordInput.focus(); return; }
    const deletedAt = new Date().toISOString();
    const facility = db.facilities.find(item => item.facility_id === deleteTarget.facility_id);
    if (!facility) return;
    facility.active_status = false;
    facility.deleted_at = deletedAt;
    facility.deleted_by_owner = user.user_id;
    facility.deletion_status = 'deleted_by_owner';
    db.users.filter(item => item.facility_id === deleteTarget.facility_id).forEach(item => { item.active_status = false; item.deleted_with_facility_at = deletedAt; });
    niaSaveDB(db);
    closeModal();
    niaSetSession(null);
    niaToast('Facility deleted.');
    setTimeout(() => showLoginView(), 500);
  });
  passwordInput.focus();
  });
};


/* ============================================================
   PAGE: Billing & Subscription — owner/admin only.
   Shows current status, payment reminder banner during grace,
   M-Pesa renewal flow (simulated STK push), payment details,
   and full payment history.
   ============================================================ */
Pages.billing = function (db, user) {
  if (!['admin', 'owner'].includes(user.role)) { go('dashboard'); return; }
  niaRenderShell('billing', user, db);
  niaRenderTopbar('Billing & Subscription', `Manage ${db.facility.facility_name}'s subscription and payment history.`);

  const sub = db.facility.subscription;

  function statusBanner() {
    if (sub.status === 'active') {
      const daysLeft = daysBetween(todayISO(), sub.next_due_date);
      if (daysLeft <= 5) {
        return `<div class="card card-pad mt-16" style="background:#fff8ec; border-color:#f0d9a8;">
          <div class="flex-gap">
            ${niaIcon('bell', 'banner-icon')}
            <div>
              <div style="font-weight:700; font-size:13.5px;">Payment reminder</div>
              <div class="form-hint mt-8">Your next payment of ${niaFmtUSD(sub.monthly_fee_usd)} is due on ${fmtDate(sub.next_due_date)} — in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew early to avoid any interruption.</div>
            </div>
          </div>
        </div>`;
      }
      return '';
    }
    if (sub.status === 'grace') {
      return `<div class="card card-pad mt-16" style="background:#fff4f1; border-color:#f0bdb0;">
        <div class="flex-gap">
          ${niaIcon('bell', 'banner-icon')}
          <div>
            <div style="font-weight:700; font-size:13.5px; color:var(--nia-danger);">Payment overdue — grace period active</div>
            <div class="form-hint mt-8">Payment of ${niaFmtUSD(sub.monthly_fee_usd)} was due on ${fmtDate(sub.next_due_date)}. Your team retains full access for <b>${sub.grace_days_remaining} more day${sub.grace_days_remaining === 1 ? '' : 's'}</b> before the system automatically locks operational pages. Renew now to stay uninterrupted.</div>
          </div>
        </div>
      </div>`;
    }
    return `<div class="card card-pad mt-16" style="background:#fdecec; border-color:#e6a3a3;">
      <div class="flex-gap">
        ${niaIcon('lock', 'banner-icon lock-icon')}
        <div>
          <div style="font-weight:700; font-size:13.5px; color:var(--nia-danger);">System locked — payment required</div>
          <div class="form-hint mt-8">Payment was due ${fmtDate(sub.next_due_date)} (${sub.days_overdue} days ago). Operational pages are locked for everyone except you and your Facility Administrator until this is renewed.</div>
        </div>
      </div>
    </div>`;
  }

  function render() {
    const html = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Subscription Status</div><div class="stat-value" style="font-size:18px;"><span class="badge ${niaBadgeClass(sub.status)}">${niaSubscriptionLabel(sub.status)}</span></div></div>
        <div class="stat-card"><div class="stat-label">Monthly Fee</div><div class="stat-value">${niaFmtUSD(sub.monthly_fee_usd)}</div></div>
        <div class="stat-card"><div class="stat-label">Next Due Date</div><div class="stat-value" style="font-size:18px;">${fmtDate(sub.next_due_date)}</div></div>
        <div class="stat-card"><div class="stat-label">Lifetime Payments</div><div class="stat-value">${sub.payments.length}</div></div>
      </div>

      ${statusBanner()}

      <div class="mt-24" style="display:grid; grid-template-columns:1fr 1fr; gap:18px;">
        <div class="card">
          <div class="card-header"><div><h3>Renew via M-Pesa</h3><div class="hint">Send a payment prompt straight to your phone</div></div></div>
          <div class="card-pad">
            <div class="form-field full"><label>M-Pesa Number</label><input type="text" id="bill-mpesa-number" value="${sub.mpesa_number_on_file}" /></div>
            <div class="form-field full mt-8"><label>Amount</label><input type="text" value="${niaFmtUSD(sub.monthly_fee_usd)} (≈ ${fmtKES(sub.monthly_fee_usd * 130)})" readonly /></div>
            <button class="btn btn-primary btn-block mt-16" id="send-stk-btn">${niaIcon('phone')}Send Payment Prompt to M-Pesa</button>
            <div class="form-hint mt-16" style="text-align:center;">You'll receive an STK push prompt on your phone to enter your M-Pesa PIN and complete payment.</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div><h3>M-Pesa Payment Details</h3><div class="hint">Pay manually via Paybill if preferred</div></div></div>
          <div class="card-pad">
            <div class="flex-between"><span class="form-hint">Paybill Number</span><span style="font-weight:700; font-family:var(--font-mono);">${NIA_MPESA_CONFIG.paybill_number}</span></div>
            <div class="flex-between mt-8"><span class="form-hint">Account Number</span><span style="font-weight:700; font-family:var(--font-mono);">${db.facility.facility_code}</span></div>
            <div class="flex-between mt-8"><span class="form-hint">Business Name</span><span style="font-weight:700;">${NIA_MPESA_CONFIG.till_name}</span></div>
            <div class="flex-between mt-8"><span class="form-hint">Amount Due</span><span style="font-weight:700;">${niaFmtUSD(sub.monthly_fee_usd)}</span></div>
            <div class="form-hint mt-16" style="padding:10px 12px; background:var(--nia-bg-soft); border-radius:10px;">${NIA_MPESA_CONFIG.daraja_integration_status}</div>
            <button class="btn btn-ghost btn-block mt-16" id="confirm-manual-btn">I've Paid via Paybill — Confirm Manually</button>
          </div>
        </div>
      </div>

      <div class="section-head mt-24"><div><h2>Payment History</h2><p>All subscription payments recorded for this facility.</p></div></div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date Paid</th><th>Billing Cycle</th><th>Amount</th><th>Method</th><th>M-Pesa Receipt</th></tr></thead>
            <tbody>
              ${sub.payments.map(p => `
                <tr>
                  <td class="cell-strong">${fmtDate(p.paid_at)}</td>
                  <td>${fmtDate(p.cycle_start)} – ${fmtDate(p.cycle_end)}</td>
                  <td class="cell-strong">${niaFmtUSD(p.amount_usd)}</td>
                  <td>${p.method}</td>
                  <td class="cell-sub" style="font-family:var(--font-mono);">${p.mpesa_receipt || '—'}</td>
                </tr>
              `).join('') || `<tr><td colspan="5"><div class="empty-state"><p>No payments recorded yet.</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.getElementById('send-stk-btn').addEventListener('click', openSTKModal);
    document.getElementById('confirm-manual-btn').addEventListener('click', openManualConfirmModal);
  }

  function openSTKModal() {
    const phone = document.getElementById('bill-mpesa-number').value.trim();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" style="max-width:420px;">
        <div class="modal-header"><h3>M-Pesa Payment Prompt</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body" style="text-align:center; padding:36px 24px;">
          <div class="stk-spinner"></div>
          <p style="font-weight:700; margin-top:18px;">Sending prompt to ${phone}...</p>
          <p class="form-hint mt-8">Asking you to enter your M-Pesa PIN to pay ${niaFmtUSD(sub.monthly_fee_usd)}.</p>
        </div>
      </div>`;
    document.body.appendChild(modal);

    setTimeout(() => {
      const receipt = 'S' + Math.random().toString(36).slice(2, 10).toUpperCase();
      modal.querySelector('.modal-body').innerHTML = `
        <div style="width:56px; height:56px; border-radius:50%; background:var(--nia-success); display:flex; align-items:center; justify-content:center; margin:0 auto; color:#fff;">${niaIcon('check', '')}</div>
        <p style="font-weight:700; margin-top:18px;">Payment received!</p>
        <p class="form-hint mt-8">M-Pesa receipt <b style="font-family:var(--font-mono);">${receipt}</b> — ${niaFmtUSD(sub.monthly_fee_usd)} confirmed.</p>
        <button class="btn btn-primary btn-block mt-16" id="stk-done-btn">Done</button>
      `;
      document.getElementById('stk-done-btn').addEventListener('click', () => {
        niaRecordPayment(db, db.facility, 'M-Pesa', receipt, user.user_id);
        modal.remove();
        niaToast('Subscription renewed for another 30 days.');
        niaRenderShell('billing', user, db);
        render();
      });
    }, 2200);
  }

  function openManualConfirmModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Confirm Manual Payment</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full"><label>M-Pesa Transaction Code</label><input type="text" id="manual-receipt" placeholder="e.g. SFA1B2C3D4" /></div>
            <div class="form-field full"><label>Amount Paid</label><input type="text" value="${niaFmtUSD(sub.monthly_fee_usd)}" readonly /></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="confirm-manual-save">Confirm Payment</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('confirm-manual-save').addEventListener('click', () => {
      const code = document.getElementById('manual-receipt').value.trim();
      if (!code) { niaToast('Please enter the M-Pesa transaction code.'); return; }
      niaRecordPayment(db, db.facility, 'M-Pesa (Manual)', code.toUpperCase(), user.user_id);
      modal.remove();
      niaToast('Payment confirmed. Subscription renewed.');
      niaRenderShell('billing', user, db);
      render();
    });
  }

  render();
};


/* ============================================================
   PAGE: Locked Notice — shown to ALL facility staff (any role
   except super_admin) once the facility's subscription is
   locked. No nav, no operational data, payment notice only.
   Admin/Owner get a link through to the Billing page; everyone
   else just sees the notice and who to contact.
   ============================================================ */
Pages['locked-notice'] = function (db, user) {
  const sub = db.facility.subscription;
  const isBillingRole = ['admin', 'owner'].includes(user.role);

  document.getElementById('nia-sidebar').innerHTML = `
    <div class="sidebar-brand">
      <img src="${NIA_LOGO_DATA_URI}" alt="NiaCARE" />
      <div class="brand-text">
        <div class="brand-name">NiaCARE</div>
        <div class="brand-tag">Dental System</div>
      </div>
    </div>
    <div class="sidebar-facility">
      <div class="label">Facility</div>
      <div class="value">${db.facility.facility_name}</div>
      <div class="mt-8"><span class="badge badge-rejected" style="font-size:10px;">Locked — Payment Required</span></div>
    </div>
    <div style="flex:1;"></div>
    <div class="sidebar-footer">
      <div class="user-chip">
        <div class="user-avatar">${initials(user.full_name)}</div>
        <div class="user-meta">
          <div class="user-name">${user.full_name}</div>
          <div class="user-role">${niaRoleLabel(user.role)}</div>
        </div>
      </div>
      <a href="#" class="logout-link" id="nia-logout-link">${niaIcon('logout')}<span>Sign out</span></a>
    </div>
  `;
  document.getElementById('nia-logout-link').addEventListener('click', (e) => { e.preventDefault(); niaLogout(); });
  document.getElementById('nia-topbar').innerHTML = '';

  document.getElementById('content').innerHTML = `
    <div style="max-width:560px; margin:60px auto; text-align:center;">
      <div style="width:72px; height:72px; border-radius:20px; background:linear-gradient(135deg, var(--nia-danger), #d65a6c); display:flex; align-items:center; justify-content:center; margin:0 auto 24px; color:#fff;">
        ${niaIcon('lock', 'banner-icon lock-icon')}
      </div>
      <h1 style="font-size:24px; margin-bottom:10px;">Account Access Locked</h1>
      <p style="color:var(--nia-ink-soft); font-size:14.5px; line-height:1.7; margin-bottom:28px;">
        ${db.facility.facility_name}'s subscription payment is ${sub.days_overdue} day${sub.days_overdue === 1 ? '' : 's'} overdue.
        The ${NIA_GRACE_PERIOD_DAYS}-day grace period has ended, so operational pages — patients, treatment plans, appointments,
        and all clinical data — are temporarily unavailable until payment is renewed.
      </p>

      <div class="card card-pad" style="text-align:left; margin-bottom:24px;">
        <div class="flex-between"><span class="form-hint">Monthly Subscription</span><span style="font-weight:700;">${niaFmtUSD(sub.monthly_fee_usd)} / month</span></div>
        <div class="flex-between mt-8"><span class="form-hint">Payment Was Due</span><span style="font-weight:700; color:var(--nia-danger);">${fmtDate(sub.next_due_date)}</span></div>
        <div class="flex-between mt-8"><span class="form-hint">Days Overdue</span><span style="font-weight:700;">${sub.days_overdue} days</span></div>
      </div>

      ${isBillingRole ? `
        <button class="btn btn-primary btn-block" id="go-to-billing-btn">${niaIcon('wallet')}Renew Subscription Now</button>
        <p class="form-hint mt-16">As ${niaRoleLabel(user.role)}, you can renew this subscription via M-Pesa from the Billing page.</p>
      ` : `
        <div class="card card-pad" style="background:var(--nia-bg-soft); border-style:dashed;">
          <p style="font-size:13px; color:var(--nia-ink-soft); margin:0;">Only your Facility Owner or Facility Administrator can renew this subscription. Please contact them directly, or reach our billing team at <b>${NIA_MPESA_CONFIG.support_email}</b> / <b>${NIA_MPESA_CONFIG.support_phone}</b>.</p>
        </div>
      `}
    </div>
  `;

  if (isBillingRole) {
    document.getElementById('go-to-billing-btn').addEventListener('click', () => go('billing'));
  }
};


/* ============================================================
   PAGE: Platform Dashboard — super_admin / developer only.
   Cross-facility metrics: onboarded count, revenue rollups by
   month/quarter/half-year/year, targets, active vs discontinued.
   ============================================================ */
Pages['platform-dashboard'] = function (db, user) {
  if (user.role !== 'super_admin') { go('dashboard'); return; }
  niaRenderShell('platform-dashboard', user, db);
  niaRenderTopbar('Platform Overview', `Cross-facility metrics across every NiaCARE deployment.`);

  const facilities = db.facilities;
  const activeFacilities = facilities.filter(f => f.active_status && f.subscription.status !== 'locked');
  const lockedFacilities = facilities.filter(f => f.subscription.status === 'locked');
  const discontinued = facilities.filter(f => !f.active_status);

  /* Flatten all payments across all facilities for revenue rollups */
  const allPayments = facilities.flatMap(f => f.subscription.payments.map(p => ({ ...p, facility_id: f.facility_id, facility_name: f.facility_name })));

  const today = new Date(todayISO());
  const thisMonth = today.toISOString().slice(0, 7);
  const thisYear = today.getFullYear();
  const thisQuarter = Math.floor(today.getMonth() / 3);

  function inMonth(p, ym) { return p.paid_at.slice(0, 7) === ym; }
  function inQuarter(p, year, q) { const m = new Date(p.paid_at).getMonth(); return new Date(p.paid_at).getFullYear() === year && Math.floor(m / 3) === q; }
  function inHalf(p, year, half) { const m = new Date(p.paid_at).getMonth(); return new Date(p.paid_at).getFullYear() === year && (half === 0 ? m < 6 : m >= 6); }
  function inYear(p, year) { return new Date(p.paid_at).getFullYear() === year; }

  const revenueThisMonth = allPayments.filter(p => inMonth(p, thisMonth)).reduce((s, p) => s + p.amount_usd, 0);
  const revenueThisQuarter = allPayments.filter(p => inQuarter(p, thisYear, thisQuarter)).reduce((s, p) => s + p.amount_usd, 0);
  const revenueThisHalf = allPayments.filter(p => inHalf(p, thisYear, today.getMonth() < 6 ? 0 : 1)).reduce((s, p) => s + p.amount_usd, 0);
  const revenueThisYear = allPayments.filter(p => inYear(p, thisYear)).reduce((s, p) => s + p.amount_usd, 0);
  const revenueAllTime = allPayments.reduce((s, p) => s + p.amount_usd, 0);

  /* Simple target model: target = active facility count × monthly fee, evaluated against this month's collected revenue */
  const monthlyTarget = activeFacilities.length * NIA_SUBSCRIPTION_FEE_USD;
  const targetAchievedPct = monthlyTarget ? Math.min(100, Math.round((revenueThisMonth / monthlyTarget) * 100)) : 0;

  function statCard(label, value, sub, accent) {
    return `<div class="stat-card ${accent ? 'accent-' + accent : ''}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-foot">${sub}</div>` : ''}
    </div>`;
  }

  const html = `
    <div class="section-head"><div><h2>Facility Network</h2><p>Every facility onboarded onto NiaCARE, regardless of plan status.</p></div></div>
    <div class="stat-grid">
      ${statCard('Hospitals Onboarded', facilities.length)}
      ${statCard('Active Facilities', activeFacilities.length, '<span style="color:var(--nia-success);">● Paying &amp; operational</span>')}
      ${statCard('Locked (Non-Payment)', lockedFacilities.length, lockedFacilities.length ? '<span style="color:var(--nia-danger);">Needs follow-up</span>' : 'None currently')}
      ${statCard('Discontinued', discontinued.length)}
    </div>

    <div class="section-head mt-24"><div><h2>Revenue Collected</h2><p>Subscription revenue across all facilities, rolled up by period.</p></div></div>
    <div class="stat-grid">
      ${statCard('This Month', niaFmtUSD(revenueThisMonth), today.toLocaleString('en-US', { month: 'long', year: 'numeric' }))}
      ${statCard('This Quarter', niaFmtUSD(revenueThisQuarter), `Q${thisQuarter + 1} ${thisYear}`)}
      ${statCard('This Half-Year', niaFmtUSD(revenueThisHalf), today.getMonth() < 6 ? `H1 ${thisYear}` : `H2 ${thisYear}`)}
      ${statCard('This Year', niaFmtUSD(revenueThisYear), `${thisYear} to date`)}
      ${statCard('All-Time Revenue', niaFmtUSD(revenueAllTime), `${allPayments.length} payments total`, 'gold')}
    </div>

    <div class="section-head mt-24"><div><h2>Monthly Target</h2><p>Expected revenue this month if every active facility pays on time.</p></div></div>
    <div class="card card-pad">
      <div class="flex-between"><span style="font-size:13px; font-weight:700; color:var(--nia-secondary);">Target Achieved</span><span style="font-family:var(--font-display); font-weight:700; font-size:18px; color:var(--nia-primary);">${targetAchievedPct}%</span></div>
      <div class="progress-track mt-8"><div class="progress-fill" style="width:${targetAchievedPct}%;"></div></div>
      <div class="form-hint mt-8">${niaFmtUSD(revenueThisMonth)} collected of ${niaFmtUSD(monthlyTarget)} target (${activeFacilities.length} active facilities × ${niaFmtUSD(NIA_SUBSCRIPTION_FEE_USD)})</div>
    </div>

    <div class="section-head mt-24"><div><h2>Facility Status</h2><p>Quick view of every facility and its billing health.</p></div></div>
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Facility</th><th>County</th><th>Status</th><th>Subscription</th><th>Next Due</th><th></th></tr></thead>
          <tbody>
            ${facilities.map(f => `
              <tr>
                <td class="cell-strong">${f.facility_name}</td>
                <td>${f.county}</td>
                <td><span class="badge ${f.active_status ? 'badge-accepted' : 'badge-cancelled'}">${f.deletion_status === 'deleted_by_owner' ? 'Deleted by owner' : f.active_status ? 'Active' : 'Discontinued'}</span></td>
                <td><span class="badge ${niaBadgeClass(f.subscription.status)}">${niaSubscriptionLabel(f.subscription.status)}</span></td>
                <td>${fmtDate(f.subscription.next_due_date)}</td>
                <td class="text-right"><button class="btn btn-ghost btn-sm view-facility-btn" data-facility="${f.facility_id}">Open</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;

  document.querySelectorAll('.view-facility-btn').forEach(btn => {
    btn.addEventListener('click', () => go('platform-facilities', { open: btn.dataset.facility }));
  });
};


/* ============================================================
   PAGE: Platform Facilities — list + drill-in detail.
   Super Admin can see and control every facility: its staff,
   patients, treatment plans, reports, and subscription, with
   power to suspend/reactivate or adjust billing manually.
   ============================================================ */
Pages['platform-facilities'] = function (db, user, params) {
  if (user.role !== 'super_admin') { go('dashboard'); return; }
  niaRenderShell('platform-facilities', user, db);

  const openId = params.open || null;
  if (openId) {
    renderDetail(openId);
  } else {
    renderList();
  }

  function renderList() {
    niaRenderTopbar('Facilities', `${db.facilities.length} facilities onboarded onto NiaCARE.`);
    const html = `
      <div class="section-head"><div><h2>All Facilities</h2><p>Click a facility to view its full operations, staff, and client data.</p></div>
        <button class="btn btn-primary" id="onboard-shortcut-btn">${niaIcon('plus')}Onboard Facility</button>
      </div>
      <div class="card mt-16">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Facility</th><th>County</th><th>Onboarded</th><th>Status</th><th>Subscription</th><th>Staff</th><th>Patients</th><th></th></tr></thead>
            <tbody>
              ${db.facilities.map(f => {
      const staffCount = db.users.filter(u => u.facility_id === f.facility_id).length;
      const patientCount = db.patients.filter(p => p.facility_id === f.facility_id).length;
      return `<tr>
                  <td class="cell-strong">${f.facility_name}</td>
                  <td>${f.county}</td>
                  <td>${fmtDate(f.onboarded_at)}</td>
                  <td><span class="badge ${f.active_status ? 'badge-accepted' : 'badge-cancelled'}">${f.deletion_status === 'deleted_by_owner' ? 'Deleted by owner' : f.active_status ? 'Active' : 'Discontinued'}</span></td>
                  <td><span class="badge ${niaBadgeClass(f.subscription.status)}">${niaSubscriptionLabel(f.subscription.status)}</span></td>
                  <td>${staffCount}</td>
                  <td>${patientCount}</td>
                  <td class="text-right"><button class="btn btn-ghost btn-sm open-detail-btn" data-facility="${f.facility_id}">Open</button></td>
                </tr>`;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('content').innerHTML = html;
    document.getElementById('onboard-shortcut-btn').addEventListener('click', () => go('platform-onboard'));
    document.querySelectorAll('.open-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => go('platform-facilities', { open: btn.dataset.facility }));
    });
  }

  function renderDetail(facilityId) {
    const f = db.facilities.find(x => x.facility_id === facilityId);
    if (!f) { renderList(); return; }

    niaRenderTopbar(f.facility_name, `${f.facility_code} · ${f.county} · Onboarded ${fmtDate(f.onboarded_at)}`);

    const staff = db.users.filter(u => u.facility_id === facilityId);
    const facilityPatients = db.patients.filter(p => p.facility_id === facilityId);
    const facilityPlans = db.plans.filter(p => p.facility_id === facilityId);
    const totalValue = facilityPlans.reduce((s, p) => s + p.total_estimated_value, 0);
    const completedValue = facilityPlans.filter(p => p.status === 'Completed').reduce((s, p) => s + p.total_estimated_value, 0);
    const sub = f.subscription;

    let activeTab = 'overview';

    function renderTabs() {
      const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'staff', label: `Staff (${staff.length})` },
        { id: 'patients', label: `Patients (${facilityPatients.length})` },
        { id: 'plans', label: `Treatment Plans (${facilityPlans.length})` },
        { id: 'billing', label: 'Subscription & Billing' },
      ];
      return `<div class="pill-tab" id="detail-tabs">${tabs.map(t => `<button data-t="${t.id}" class="${activeTab === t.id ? 'active' : ''}">${t.label}</button>`).join('')}</div>`;
    }

    function renderBody() {
      if (activeTab === 'overview') {
        return `
          <div class="stat-grid mt-16">
            <div class="stat-card"><div class="stat-label">Total Patients</div><div class="stat-value">${facilityPatients.length}</div></div>
            <div class="stat-card"><div class="stat-label">Treatment Plans</div><div class="stat-value">${facilityPlans.length}</div></div>
            <div class="stat-card"><div class="stat-label">Total Plan Value</div><div class="stat-value">${fmtKES(totalValue)}</div></div>
            <div class="stat-card accent-gold"><div class="stat-label">Completed Value</div><div class="stat-value">${fmtKES(completedValue)}</div></div>
          </div>
          <div class="card mt-16 card-pad">
            <div class="flex-between"><span class="form-hint">Facility Email</span><span style="font-weight:600;">${f.facility_email}</span></div>
            <div class="flex-between mt-8"><span class="form-hint">Facility Phone</span><span style="font-weight:600;">${f.facility_phone}</span></div>
            <div class="flex-between mt-8"><span class="form-hint">Status</span><span class="badge ${f.active_status ? 'badge-accepted' : 'badge-cancelled'}">${f.active_status ? 'Active' : 'Discontinued'}</span></div>
          </div>
          <div class="card mt-16 card-pad" style="border-style:dashed;">
            <div class="flex-between">
              <div>
                <div style="font-weight:700; font-size:13.5px;">${f.active_status ? 'Discontinue this facility' : 'Reactivate this facility'}</div>
                <div class="form-hint mt-8">${f.active_status ? 'This marks the facility as discontinued. Staff can still sign in but the facility will be flagged as inactive in platform reporting.' : 'This restores the facility to active status on the platform.'}</div>
              </div>
              <button class="btn ${f.active_status ? 'btn-danger' : 'btn-primary'} btn-sm" id="toggle-facility-status">${f.active_status ? 'Discontinue' : 'Reactivate'}</button>
            </div>
          </div>
        `;
      }
      if (activeTab === 'staff') {
        return `
          <div class="card mt-16">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
                <tbody>
                  ${staff.map(u => `<tr><td class="cell-strong">${u.full_name}</td><td>${u.email}</td><td>${niaRoleLabel(u.role)}</td><td><span class="badge ${u.active_status ? 'badge-accepted' : 'badge-cancelled'}">${u.active_status ? 'Active' : 'Inactive'}</span></td><td>${fmtDate(u.created_at)}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state"><p>No staff on record.</p></div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
      if (activeTab === 'patients') {
        return `
          <div class="card mt-16">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Patient</th><th>Contact</th><th>Payment</th><th>Registered</th></tr></thead>
                <tbody>
                  ${facilityPatients.map(p => `<tr><td class="cell-strong">${p.first_name} ${p.last_name}<div class="cell-sub">${p.patient_number}</div></td><td>${p.phone_number}</td><td>${p.payment_type}</td><td>${fmtDate(p.created_at)}</td></tr>`).join('') || `<tr><td colspan="4"><div class="empty-state"><p>No patients on record.</p></div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
      if (activeTab === 'plans') {
        return `
          <div class="card mt-16">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Plan</th><th>Patient</th><th>Value</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  ${facilityPlans.map(p => `<tr><td class="cell-strong">${p.plan_number}</td><td>${niaPatientName(db, p.patient_id)}</td><td>${fmtKES(p.total_estimated_value)}</td><td><span class="badge ${niaBadgeClass(p.status)}">${p.status}</span></td><td>${fmtDate(p.treatment_plan_date)}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state"><p>No treatment plans on record.</p></div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
      if (activeTab === 'billing') {
        return `
          <div class="stat-grid mt-16">
            <div class="stat-card"><div class="stat-label">Status</div><div class="stat-value" style="font-size:16px;"><span class="badge ${niaBadgeClass(sub.status)}">${niaSubscriptionLabel(sub.status)}</span></div></div>
            <div class="stat-card"><div class="stat-label">Monthly Fee</div><div class="stat-value">${niaFmtUSD(sub.monthly_fee_usd)}</div></div>
            <div class="stat-card"><div class="stat-label">Next Due</div><div class="stat-value" style="font-size:16px;">${fmtDate(sub.next_due_date)}</div></div>
            <div class="stat-card"><div class="stat-label">Days Overdue</div><div class="stat-value">${sub.days_overdue || 0}</div></div>
          </div>
          <div class="card mt-16 card-pad" style="border-style:dashed;">
            <div class="flex-between">
              <div>
                <div style="font-weight:700; font-size:13.5px;">Manually confirm a payment for this facility</div>
                <div class="form-hint mt-8">Use this if a facility paid offline (bank transfer, cheque) and you need to renew their access yourself.</div>
              </div>
              <button class="btn btn-primary btn-sm" id="dev-confirm-payment-btn">Record Payment</button>
            </div>
          </div>
          <div class="card mt-16">
            <div class="card-header"><h3>Payment History</h3></div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Date Paid</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Confirmed By</th></tr></thead>
                <tbody>
                  ${sub.payments.map(p => `<tr><td>${fmtDate(p.paid_at)}</td><td class="cell-strong">${niaFmtUSD(p.amount_usd)}</td><td>${p.method}</td><td class="cell-sub" style="font-family:var(--font-mono);">${p.mpesa_receipt || '—'}</td><td>${p.confirmed_by}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state"><p>No payments recorded.</p></div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    }

    function renderAll() {
      document.getElementById('content').innerHTML = `
        <button class="btn btn-ghost btn-sm" id="back-to-list-btn">← All Facilities</button>
        ${renderTabs()}
        <div id="detail-body">${renderBody()}</div>
      `;
      document.getElementById('back-to-list-btn').addEventListener('click', () => go('platform-facilities'));
      document.querySelectorAll('#detail-tabs button').forEach(btn => {
        btn.addEventListener('click', () => { activeTab = btn.dataset.t; renderAll(); });
      });
      const toggleBtn = document.getElementById('toggle-facility-status');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          f.active_status = !f.active_status;
          niaSaveDB(db);
          niaToast(`${f.facility_name} marked as ${f.active_status ? 'active' : 'discontinued'}.`);
          renderAll();
        });
      }
      const confirmBtn = document.getElementById('dev-confirm-payment-btn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => openDevConfirmModal());
      }
    }

    function openDevConfirmModal() {
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-header"><h3>Record Payment — ${f.facility_name}</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-field"><label>Method</label><select id="dev-pay-method"><option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>M-Pesa (Manual)</option></select></div>
              <div class="form-field"><label>Reference / Receipt No.</label><input type="text" id="dev-pay-ref" /></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button class="btn btn-primary" id="dev-pay-save">Confirm Payment</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('dev-pay-save').addEventListener('click', () => {
        niaRecordPayment(db, f, document.getElementById('dev-pay-method').value, document.getElementById('dev-pay-ref').value.trim() || null, user.user_id);
        modal.remove();
        niaToast('Payment recorded. Facility subscription renewed.');
        renderAll();
      });
    }

    renderAll();
  }
};


/* ============================================================
   PAGE: Onboard Facility — super_admin only.
   Creates a new facility record, its initial subscription
   (starts in a fresh 30-day cycle from today), and a Facility
   Owner account so the client can sign in immediately.
   ============================================================ */
Pages['platform-onboard'] = function (db, user) {
  if (user.role !== 'super_admin') { go('dashboard'); return; }
  niaRenderShell('platform-onboard', user, db);
  niaRenderTopbar('Onboard Facility', 'Add a new dental facility to the NiaCARE platform.');

  const html = `
    <div style="max-width:680px;">
      <div class="card">
        <div class="card-header"><div><h3>Facility Details</h3><div class="hint">Creates the facility record and starts its first billing cycle today</div></div></div>
        <div class="card-pad">
          <div class="form-grid">
            <div class="form-field full"><label>Facility Name <span class="req">*</span></label><input type="text" id="ob-name" placeholder="e.g. NiaCARE | Kisumu Dental Clinic" /></div>
            <div class="form-field"><label>Facility Code <span class="req">*</span></label><input type="text" id="ob-code" placeholder="e.g. NIA-KSM-04" /></div>
            <div class="form-field"><label>County</label><input type="text" id="ob-county" placeholder="e.g. Kisumu" /></div>
            <div class="form-field"><label>Facility Email</label><input type="email" id="ob-email" placeholder="frontdesk@facility.co.ke" /></div>
            <div class="form-field"><label>Facility Phone</label><input type="text" id="ob-phone" placeholder="+254 7XX XXX XXX" /></div>
          </div>

          <div class="section-head mt-24" style="margin-bottom:0;"><div><h3 style="font-size:14px;">Initial Facility Owner Account</h3><p>This person will be able to sign in immediately and manage their facility, staff, and billing.</p></div></div>
          <div class="form-grid mt-16">
            <div class="form-field"><label>Owner Full Name <span class="req">*</span></label><input type="text" id="ob-owner-name" /></div>
            <div class="form-field"><label>Owner Email <span class="req">*</span></label><input type="email" id="ob-owner-email" /></div>
          </div>

          <div class="card card-pad mt-24" style="background:var(--nia-bg-soft);">
            <div class="flex-between"><span class="form-hint">Monthly Subscription Fee</span><span style="font-weight:700;">${niaFmtUSD(NIA_SUBSCRIPTION_FEE_USD)}</span></div>
            <div class="flex-between mt-8"><span class="form-hint">First Payment Due</span><span style="font-weight:700;">${fmtDate(todayISO(NIA_BILLING_CYCLE_DAYS))} (30 days from onboarding)</span></div>
          </div>

          <button class="btn btn-primary btn-block mt-24" id="onboard-save-btn">${niaIcon('plus')}Onboard Facility</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;

  document.getElementById('onboard-save-btn').addEventListener('click', () => {
    const name = document.getElementById('ob-name').value.trim();
    const code = document.getElementById('ob-code').value.trim();
    const ownerName = document.getElementById('ob-owner-name').value.trim();
    const ownerEmail = document.getElementById('ob-owner-email').value.trim();
    if (!name || !code || !ownerName || !ownerEmail) { niaToast('Please complete all required fields.'); return; }

    const facilityId = uid('fac');
    const newFacility = {
      facility_id: facilityId, facility_name: name, facility_code: code,
      facility_email: document.getElementById('ob-email').value.trim(),
      facility_phone: document.getElementById('ob-phone').value.trim(),
      county: document.getElementById('ob-county').value.trim() || '—',
      active_status: true, onboarded_at: todayISO(), created_at: todayISO(),
      subscription: {
        monthly_fee_usd: NIA_SUBSCRIPTION_FEE_USD, billing_cycle_start: todayISO(),
        next_due_date: todayISO(NIA_BILLING_CYCLE_DAYS), status: 'active', grace_started_at: null,
        mpesa_number_on_file: '', payments: [], days_overdue: 0, grace_days_remaining: 0,
      },
    };
    db.facilities.push(newFacility);
    db.users.push({
      user_id: uid('u'), facility_id: facilityId, full_name: ownerName, email: ownerEmail,
      role: 'owner', active_status: true, created_at: todayISO(),
    });
    niaSaveDB(db);
    niaToast(`${name} onboarded successfully. First payment due ${fmtDate(newFacility.subscription.next_due_date)}.`);
    go('platform-facilities', { open: facilityId });
  });
};


/* ============================================================
   PAGE: Platform Revenue & Targets — super_admin only.
   Deeper revenue breakdown: per-facility contribution, monthly
   trend for the last 6 months, and target tracking.
   ============================================================ */
Pages['platform-revenue'] = function (db, user) {
  if (user.role !== 'super_admin') { go('dashboard'); return; }
  niaRenderShell('platform-revenue', user, db);
  niaRenderTopbar('Revenue & Targets', 'Subscription revenue performance across the NiaCARE network.');

  const facilities = db.facilities;
  const allPayments = facilities.flatMap(f => f.subscription.payments.map(p => ({ ...p, facility_id: f.facility_id, facility_name: f.facility_name })));
  const activeFacilities = facilities.filter(f => f.active_status && f.subscription.status !== 'locked');

  const today = new Date(todayISO());

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    const total = allPayments.filter(p => p.paid_at.slice(0, 7) === ym).reduce((s, p) => s + p.amount_usd, 0);
    months.push({ ym, label, total });
  }
  const maxMonthly = Math.max(...months.map(m => m.total), NIA_SUBSCRIPTION_FEE_USD);

  const perFacility = facilities.map(f => ({
    name: f.facility_name,
    total: f.subscription.payments.reduce((s, p) => s + p.amount_usd, 0),
    count: f.subscription.payments.length,
    status: f.subscription.status,
  })).sort((a, b) => b.total - a.total);

  const monthlyTarget = activeFacilities.length * NIA_SUBSCRIPTION_FEE_USD;
  const thisMonthRevenue = months[months.length - 1].total;
  const targetPct = monthlyTarget ? Math.min(100, Math.round((thisMonthRevenue / monthlyTarget) * 100)) : 0;
  const annualTarget = facilities.length * NIA_SUBSCRIPTION_FEE_USD * 12;
  const yearRevenue = allPayments.filter(p => new Date(p.paid_at).getFullYear() === today.getFullYear()).reduce((s, p) => s + p.amount_usd, 0);
  const annualPct = annualTarget ? Math.min(100, Math.round((yearRevenue / annualTarget) * 100)) : 0;

  const html = `
    <div class="section-head"><div><h2>Targets</h2><p>Tracking collected revenue against expected revenue if every facility pays on time.</p></div></div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);">
      <div class="card card-pad">
        <div class="flex-between"><span style="font-size:13px; font-weight:700; color:var(--nia-secondary);">Monthly Target</span><span style="font-family:var(--font-display); font-weight:700; font-size:18px; color:var(--nia-primary);">${targetPct}%</span></div>
        <div class="progress-track mt-8"><div class="progress-fill" style="width:${targetPct}%;"></div></div>
        <div class="form-hint mt-8">${niaFmtUSD(thisMonthRevenue)} of ${niaFmtUSD(monthlyTarget)} target this month</div>
      </div>
      <div class="card card-pad">
        <div class="flex-between"><span style="font-size:13px; font-weight:700; color:var(--nia-secondary);">Annual Target</span><span style="font-family:var(--font-display); font-weight:700; font-size:18px; color:var(--nia-primary);">${annualPct}%</span></div>
        <div class="progress-track mt-8"><div class="progress-fill gold" style="width:${annualPct}%;"></div></div>
        <div class="form-hint mt-8">${niaFmtUSD(yearRevenue)} of ${niaFmtUSD(annualTarget)} target this year</div>
      </div>
    </div>

    <div class="section-head mt-24"><div><h2>Monthly Revenue Trend</h2><p>Subscription revenue collected over the last six months.</p></div></div>
    <div class="card card-pad">
      <div style="display:flex; align-items:flex-end; gap:18px; height:180px;">
        ${months.map(m => `
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; height:100%; justify-content:flex-end;">
            <div class="form-hint" style="font-weight:700; color:var(--nia-secondary);">${niaFmtUSD(m.total)}</div>
            <div style="width:100%; max-width:46px; background:linear-gradient(180deg, var(--nia-primary), var(--nia-violet-mid)); border-radius:8px 8px 0 0; height:${Math.max(4, (m.total / maxMonthly) * 120)}px;"></div>
            <div class="form-hint">${m.label}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="section-head mt-24"><div><h2>Revenue by Facility</h2><p>Lifetime subscription revenue contributed by each facility.</p></div></div>
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Facility</th><th>Lifetime Revenue</th><th>Payments Made</th><th>Current Status</th></tr></thead>
          <tbody>
            ${perFacility.map(f => `
              <tr>
                <td class="cell-strong">${f.name}</td>
                <td class="cell-strong">${niaFmtUSD(f.total)}</td>
                <td>${f.count}</td>
                <td><span class="badge ${niaBadgeClass(f.status)}">${niaSubscriptionLabel(f.status)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;
};


/* ============================================================
   LOGIN VIEW — renders into #login-screen, hides #app-shell
   ============================================================ */
function showLoginView() {
  document.getElementById('app-shell').style.display = 'none';
  const loginScreen = document.getElementById('login-screen');
  loginScreen.style.display = '';

  const db = niaLoadDB();
  let selectedUserId = db.users.find(u => u.role === 'owner').user_id;

  function roleIcon(role) {
    const map = { dentist: 'tooth', assistant: 'clipboard', front_office: 'desk', claims: 'shield', admin: 'admin', owner: 'crown' };
    return map[role] || 'tooth';
  }

  loginScreen.innerHTML = `
    <div class="login-shell">
      <div class="login-art">
        <svg class="login-knot" width="520" height="520" viewBox="0 0 24 24" style="position:absolute; right:-80px; bottom:-80px;">
          <path fill="white" d="M12 2c-1.5 2-3 3-5 3s-3.5-1-3.5-1S4 7 4 9s-1.5 3-1.5 3S5 13 7 15s3 5 5 5 3-3 5-5 5-2 5-2-1.5-1-1.5-3 1.5-3 1.5-3-2 0-3.5-1S13.5 2 12 2Z"/>
        </svg>

        <div class="login-art-top">
          <div class="brand-row">
            <img src="${NIA_LOGO_DATA_URI}" alt="NiaCARE" />
            <div>
              <div class="brand-name">NiaCARE</div>
              <div class="brand-tag">Dental System</div>
            </div>
          </div>
        </div>

        <div class="login-art-mid">
          <div class="eyebrow">Treatment Journey Platform</div>
          <h2>Every patient's path,<br/>from first visit to<br/>completed smile.</h2>
          <p>NiaCARE gives your team one shared view of treatment plans, appointments, and follow-ups — so no patient and no shilling of treatment value falls through the cracks.</p>
          <div class="login-stats">
            <div><b>${db.patients.length}</b><span>Active Patients</span></div>
            <div><b>KES 1.5M+</b><span>Treatment Value</span></div>
            <div><b>${db.users.length}</b><span>Team Members</span></div>
          </div>
        </div>

        <div class="login-art-bottom">
          <span>© 2026 NiaCARE. Built for Kenyan dental facilities.</span>
          <a href="#" id="dev-access-link" title="Developer Access">·</a>
        </div>
      </div>

      <div class="login-form-side">
        <div class="login-card">
          <h1>Welcome back</h1>
          <p class="sub">Sign in to NiaCARE | ${db.facility.facility_name.split('—')[1] ? db.facility.facility_name.split('—')[1].trim() : db.facility.facility_name}.</p>

          <div class="form-field full" style="margin-bottom:14px;">
            <label>Choose your role to preview</label>
          </div>
          <div class="role-grid" id="role-grid"></div>

          <div class="form-field full" style="margin-bottom:14px;">
            <label>Email address</label>
            <input type="text" id="login-email" readonly />
          </div>
          <div class="form-field full" style="margin-bottom:18px;">
            <label>Password</label>
            <input type="password" value="demo-password" readonly />
          </div>

          <button class="btn btn-primary btn-block" id="login-btn">Sign In</button>

          <div class="login-demo-note">
            <b>Demo mode.</b> Pick any of the six staff roles above to explore NiaCARE exactly as that role would see it — dashboards, navigation, and permissions all adapt automatically.
          </div>
        </div>
      </div>
    </div>
  `;

  function renderRoles() {
    const grid = document.getElementById('role-grid');
    grid.innerHTML = NIA_ROLES.map(r => {
      const user = db.users.find(u => u.role === r.id && u.facility_id === 'fac_001');
      const active = user.user_id === selectedUserId ? 'active' : '';
      return `<button class="role-pick ${active}" data-user="${user.user_id}">${niaIcon(roleIcon(r.id))}<span>${r.label}</span></button>`;
    }).join('');
    grid.querySelectorAll('.role-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedUserId = btn.dataset.user;
        renderRoles();
        updateEmail();
      });
    });
  }

  function updateEmail() {
    const user = db.users.find(u => u.user_id === selectedUserId);
    document.getElementById('login-email').value = user.email;
  }

  document.getElementById('login-btn').addEventListener('click', () => {
    niaSetSession(selectedUserId);
    loginScreen.style.display = 'none';
    document.getElementById('app-shell').style.display = '';
    Router.go('dashboard');
  });

  document.getElementById('dev-access-link').addEventListener('click', (e) => {
    e.preventDefault();
    showDeveloperLoginView();
  });

  renderRoles();
  updateEmail();
}

/* ============================================================
   DEVELOPER / SUPER ADMIN LOGIN — hidden entry point, separate
   from the facility staff role-picker. Requires an access code
   so it isn't reachable by accident.
   ============================================================ */
function showDeveloperLoginView() {
  const db = niaLoadDB();
  const loginScreen = document.getElementById('login-screen');
  const devUser = db.users.find(u => u.role === 'super_admin');

  loginScreen.innerHTML = `
    <div class="login-shell" style="grid-template-columns:1fr;">
      <div class="login-form-side" style="margin:0 auto; width:100%; max-width:460px;">
        <div class="login-card">
          <div class="flex-gap" style="margin-bottom:6px;">
            <div class="user-avatar" style="background:linear-gradient(135deg, var(--nia-secondary), var(--nia-primary)); color:#fff; width:38px; height:38px; font-size:14px;">${niaIcon('globe')}</div>
            <h1 style="margin:0;">Developer Access</h1>
          </div>
          <p class="sub">Platform-level access for NiaCARE developers and operators. Not a facility account.</p>

          <div class="form-field full" style="margin-bottom:14px;">
            <label>Developer Email</label>
            <input type="text" id="dev-email" value="${devUser.email}" />
          </div>
          <div class="form-field full" style="margin-bottom:14px;">
            <label>Access Code</label>
            <input type="password" id="dev-code" placeholder="Enter access code" />
            <div class="form-hint mt-8">Demo access code: <code>NIA-DEV-2026</code></div>
          </div>
          <div id="dev-login-error" style="display:none; color:var(--nia-danger); font-size:12.5px; font-weight:600; margin-bottom:14px;">Incorrect access code. Please try again.</div>

          <button class="btn btn-primary btn-block" id="dev-login-btn">Enter Developer Console</button>
          <button class="btn btn-ghost btn-block mt-8" id="dev-back-btn">← Back to facility sign in</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('dev-back-btn').addEventListener('click', () => showLoginView());
  document.getElementById('dev-login-btn').addEventListener('click', () => {
    const code = document.getElementById('dev-code').value.trim();
    if (code !== 'NIA-DEV-2026') {
      document.getElementById('dev-login-error').style.display = '';
      return;
    }
    niaSetSession(devUser.user_id);
    loginScreen.style.display = 'none';
    document.getElementById('app-shell').style.display = '';
    Router.go('platform-dashboard');
  });
}

/* ============================================================
   APP BOOTSTRAP — dispatches Router.current.page to Pages[...]
   ============================================================ */
function bindNavLinks() {
  document.querySelectorAll('[data-nav-page]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); go(el.dataset.navPage, {}); });
  });
}

function renderApp() {
  const auth = niaRequireAuth();
  if (!auth) return; // showLoginView already triggered
  const { db, user } = auth;
  const { page, params } = Router.current;

  /* Billing gate — applies to facility staff only. Super Admin always
     bypasses, regardless of any facility's subscription status. */
  if (user.role !== 'super_admin') {
    const status = db.facility.subscription.status;
    if (status === 'locked') {
      const allowedWhenLocked = ['billing'];
      if (!allowedWhenLocked.includes(page) || !['admin', 'owner'].includes(user.role)) {
        Pages['locked-notice'](db, user, params || {});
        return;
      }
    }
  }

  const handler = Pages[page] || Pages.dashboard;
  handler(db, user, params || {});
}

export function createNiaApp() {
  const sess = niaGetSession();
  if (sess) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = '';
    renderApp();
  } else {
    showLoginView();
  }
}
