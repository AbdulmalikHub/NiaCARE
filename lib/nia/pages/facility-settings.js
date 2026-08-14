// NiaCARE Facility Settings page module.
/* ============================================================
   PAGE: Facility Settings
   ============================================================ */
Pages.facility = function(db, user){
  if (!['admin','owner'].includes(user.role)){
    go('dashboard');
    return;
  }
  niaRenderShell('facility', user, db);
  niaRenderTopbar('Facility Settings', 'Manage your facility profile and platform configuration.');

  const f = db.facility;
  const html = `
    <div style="display:grid; grid-template-columns:1fr 320px; gap:18px;">
      <div class="card">
        <div class="card-header"><h3>Facility Profile</h3></div>
        <div class="card-pad">
          <div class="form-grid">
            <div class="form-field"><label>Facility Name</label><input type="text" id="f-name" value="${f.facility_name}" /></div>
            <div class="form-field"><label>Facility Code</label><input type="text" id="f-code" value="${f.facility_code}" readonly /></div>
            <div class="form-field"><label>Email</label><input type="email" id="f-email" value="${f.facility_email}" /></div>
            <div class="form-field"><label>Phone</label><input type="text" id="f-phone" value="${f.facility_phone}" /></div>
            <div class="form-field"><label>County</label><input type="text" id="f-county" value="${f.county}" /></div>
            <div class="form-field"><label>Status</label><select id="f-status"><option ${f.active_status?'selected':''}>Active</option><option ${!f.active_status?'selected':''}>Inactive</option></select></div>
          </div>
          <button class="btn btn-primary mt-24" id="save-facility">Save Changes</button>
        </div>
      </div>

      <div class="card card-pad">
        <div class="eyebrow">Multi-Tenant Architecture</div>
        <p style="font-size:13px; color:var(--nia-ink-soft); line-height:1.6;">Every record in NiaCARE belongs to a facility. Your facility's data is fully isolated from any other facility on the platform — only a Super Admin can view across facilities.</p>
        <div class="mt-16" style="display:flex; flex-direction:column; gap:10px;">
          <div class="flex-between"><span class="form-hint">Facility ID</span><span style="font-family:var(--font-mono); font-size:12px;">${f.facility_id}</span></div>
          <div class="flex-between"><span class="form-hint">Created</span><span style="font-weight:600;">${fmtDate(f.created_at)}</span></div>
          <div class="flex-between"><span class="form-hint">Total Users</span><span style="font-weight:600;">${niaScopedUsers(db).length}</span></div>
          <div class="flex-between"><span class="form-hint">Total Patients</span><span style="font-weight:600;">${niaScopedPatients(db).length}</span></div>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-header"><div><h3>Danger Zone</h3><div class="hint">Resets all demo data back to its original seeded state</div></div></div>
      <div class="card-pad">
        <button class="btn btn-danger" id="reset-data">Reset Demo Data</button>
      </div>
    </div>
  `;
  document.getElementById('content').innerHTML = html;

  document.getElementById('save-facility').addEventListener('click', () => {
    f.facility_name = document.getElementById('f-name').value;
    f.facility_email = document.getElementById('f-email').value;
    f.facility_phone = document.getElementById('f-phone').value;
    f.county = document.getElementById('f-county').value;
    f.active_status = document.getElementById('f-status').value === 'Active';
    niaSaveDB(db);
    niaToast('Facility profile updated.');
  });

  document.getElementById('reset-data').addEventListener('click', () => {
    if (confirm('This will erase all changes and restore the original demo data. Continue?')){
      niaResetDB();
      niaToast('Demo data reset.');
      setTimeout(()=>window.location.reload(), 600);
    }
  });
};


/* ============================================================
   PAGE: Billing & Subscription — owner/admin only.
   Shows current status, payment reminder banner during grace,
   M-Pesa renewal flow (simulated STK push), payment details,
   and full payment history.
   ============================================================ */
Pages.billing = function(db, user){
  if (!['admin','owner'].includes(user.role)){ go('dashboard'); return; }
  niaRenderShell('billing', user, db);
  niaRenderTopbar('Billing & Subscription', `Manage ${db.facility.facility_name}'s subscription and payment history.`);

  const sub = db.facility.subscription;

  function statusBanner(){
    if (sub.status === 'active'){
      const daysLeft = daysBetween(todayISO(), sub.next_due_date);
      if (daysLeft <= 5){
        return `<div class="card card-pad mt-16" style="background:#fff8ec; border-color:#f0d9a8;">
          <div class="flex-gap">
            ${niaIcon('bell', 'banner-icon')}
            <div>
              <div style="font-weight:700; font-size:13.5px;">Payment reminder</div>
              <div class="form-hint mt-8">Your next payment of ${niaFmtUSD(sub.monthly_fee_usd)} is due on ${fmtDate(sub.next_due_date)} — in ${daysLeft} day${daysLeft===1?'':'s'}. Renew early to avoid any interruption.</div>
            </div>
          </div>
        </div>`;
      }
      return '';
    }
    if (sub.status === 'grace'){
      return `<div class="card card-pad mt-16" style="background:#fff4f1; border-color:#f0bdb0;">
        <div class="flex-gap">
          ${niaIcon('bell', 'banner-icon')}
          <div>
            <div style="font-weight:700; font-size:13.5px; color:var(--nia-danger);">Payment overdue — grace period active</div>
            <div class="form-hint mt-8">Payment of ${niaFmtUSD(sub.monthly_fee_usd)} was due on ${fmtDate(sub.next_due_date)}. Your team retains full access for <b>${sub.grace_days_remaining} more day${sub.grace_days_remaining===1?'':'s'}</b> before the system automatically locks operational pages. Renew now to stay uninterrupted.</div>
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

  function render(){
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

  function openSTKModal(){
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
      const receipt = 'S' + Math.random().toString(36).slice(2,10).toUpperCase();
      modal.querySelector('.modal-body').innerHTML = `
        <div style="width:56px; height:56px; border-radius:50%; background:var(--nia-success); display:flex; align-items:center; justify-content:center; margin:0 auto; color:#fff;">${niaIcon('check','')}</div>
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

  function openManualConfirmModal(){
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
      if (!code){ niaToast('Please enter the M-Pesa transaction code.'); return; }
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
Pages['locked-notice'] = function(db, user){
  const sub = db.facility.subscription;
  const isBillingRole = ['admin','owner'].includes(user.role);

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
        ${db.facility.facility_name}'s subscription payment is ${sub.days_overdue} day${sub.days_overdue===1?'':'s'} overdue.
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

  if (isBillingRole){
    document.getElementById('go-to-billing-btn').addEventListener('click', () => go('billing'));
  }
};


/* ============================================================
   PAGE: Platform Dashboard — super_admin / developer only.
   Cross-facility metrics: onboarded count, revenue rollups by
   month/quarter/half-year/year, targets, active vs discontinued.
   ============================================================ */
Pages['platform-dashboard'] = function(db, user){
  if (user.role !== 'super_admin'){ go('dashboard'); return; }
  niaRenderShell('platform-dashboard', user, db);
  niaRenderTopbar('Platform Overview', `Cross-facility metrics across every NiaCARE deployment.`);

  const facilities = db.facilities;
  const activeFacilities = facilities.filter(f => f.active_status && f.subscription.status !== 'locked');
  const lockedFacilities = facilities.filter(f => f.subscription.status === 'locked');
  const discontinued = facilities.filter(f => !f.active_status);

  /* Flatten all payments across all facilities for revenue rollups */
  const allPayments = facilities.flatMap(f => f.subscription.payments.map(p => ({ ...p, facility_id: f.facility_id, facility_name: f.facility_name })));

  const today = new Date(todayISO());
  const thisMonth = today.toISOString().slice(0,7);
  const thisYear = today.getFullYear();
  const thisQuarter = Math.floor(today.getMonth() / 3);

  function inMonth(p, ym){ return p.paid_at.slice(0,7) === ym; }
  function inQuarter(p, year, q){ const m = new Date(p.paid_at).getMonth(); return new Date(p.paid_at).getFullYear() === year && Math.floor(m/3) === q; }
  function inHalf(p, year, half){ const m = new Date(p.paid_at).getMonth(); return new Date(p.paid_at).getFullYear() === year && (half === 0 ? m < 6 : m >= 6); }
  function inYear(p, year){ return new Date(p.paid_at).getFullYear() === year; }

  const revenueThisMonth = allPayments.filter(p => inMonth(p, thisMonth)).reduce((s,p)=>s+p.amount_usd,0);
  const revenueThisQuarter = allPayments.filter(p => inQuarter(p, thisYear, thisQuarter)).reduce((s,p)=>s+p.amount_usd,0);
  const revenueThisHalf = allPayments.filter(p => inHalf(p, thisYear, today.getMonth() < 6 ? 0 : 1)).reduce((s,p)=>s+p.amount_usd,0);
  const revenueThisYear = allPayments.filter(p => inYear(p, thisYear)).reduce((s,p)=>s+p.amount_usd,0);
  const revenueAllTime = allPayments.reduce((s,p)=>s+p.amount_usd,0);

  /* Simple target model: target = active facility count × monthly fee, evaluated against this month's collected revenue */
  const monthlyTarget = activeFacilities.length * NIA_SUBSCRIPTION_FEE_USD;
  const targetAchievedPct = monthlyTarget ? Math.min(100, Math.round((revenueThisMonth / monthlyTarget) * 100)) : 0;

  function statCard(label, value, sub, accent){
    return `<div class="stat-card ${accent?'accent-'+accent:''}">
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
      ${statCard('This Month', niaFmtUSD(revenueThisMonth), today.toLocaleString('en-US',{month:'long',year:'numeric'}))}
      ${statCard('This Quarter', niaFmtUSD(revenueThisQuarter), `Q${thisQuarter+1} ${thisYear}`)}
      ${statCard('This Half-Year', niaFmtUSD(revenueThisHalf), today.getMonth()<6?`H1 ${thisYear}`:`H2 ${thisYear}`)}
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
                <td><span class="badge ${f.active_status?'badge-accepted':'badge-cancelled'}">${f.active_status?'Active':'Discontinued'}</span></td>
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
Pages['platform-facilities'] = function(db, user, params){
  if (user.role !== 'super_admin'){ go('dashboard'); return; }
  niaRenderShell('platform-facilities', user, db);

  const openId = params.open || null;
  if (openId){
    renderDetail(openId);
  } else {
    renderList();
  }

  function renderList(){
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
                const staffCount = db.users.filter(u=>u.facility_id===f.facility_id).length;
                const patientCount = db.patients.filter(p=>p.facility_id===f.facility_id).length;
                return `<tr>
                  <td class="cell-strong">${f.facility_name}</td>
                  <td>${f.county}</td>
                  <td>${fmtDate(f.onboarded_at)}</td>
                  <td><span class="badge ${f.active_status?'badge-accepted':'badge-cancelled'}">${f.active_status?'Active':'Discontinued'}</span></td>
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

  function renderDetail(facilityId){
    const f = db.facilities.find(x => x.facility_id === facilityId);
    if (!f){ renderList(); return; }

    niaRenderTopbar(f.facility_name, `${f.facility_code} · ${f.county} · Onboarded ${fmtDate(f.onboarded_at)}`);

    const staff = db.users.filter(u => u.facility_id === facilityId);
    const facilityPatients = db.patients.filter(p => p.facility_id === facilityId);
    const facilityPlans = db.plans.filter(p => p.facility_id === facilityId);
    const totalValue = facilityPlans.reduce((s,p)=>s+p.total_estimated_value,0);
    const completedValue = facilityPlans.filter(p=>p.status==='Completed').reduce((s,p)=>s+p.total_estimated_value,0);
    const sub = f.subscription;

    let activeTab = 'overview';

    function renderTabs(){
      const tabs = [
        { id:'overview', label:'Overview' },
        { id:'staff', label:`Staff (${staff.length})` },
        { id:'patients', label:`Patients (${facilityPatients.length})` },
        { id:'plans', label:`Treatment Plans (${facilityPlans.length})` },
        { id:'billing', label:'Subscription & Billing' },
      ];
      return `<div class="pill-tab" id="detail-tabs">${tabs.map(t=>`<button data-t="${t.id}" class="${activeTab===t.id?'active':''}">${t.label}</button>`).join('')}</div>`;
    }

    function renderBody(){
      if (activeTab === 'overview'){
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
            <div class="flex-between mt-8"><span class="form-hint">Status</span><span class="badge ${f.active_status?'badge-accepted':'badge-cancelled'}">${f.active_status?'Active':'Discontinued'}</span></div>
          </div>
          <div class="card mt-16 card-pad" style="border-style:dashed;">
            <div class="flex-between">
              <div>
                <div style="font-weight:700; font-size:13.5px;">${f.active_status ? 'Discontinue this facility' : 'Reactivate this facility'}</div>
                <div class="form-hint mt-8">${f.active_status ? 'This marks the facility as discontinued. Staff can still sign in but the facility will be flagged as inactive in platform reporting.' : 'This restores the facility to active status on the platform.'}</div>
              </div>
              <button class="btn ${f.active_status?'btn-danger':'btn-primary'} btn-sm" id="toggle-facility-status">${f.active_status ? 'Discontinue' : 'Reactivate'}</button>
            </div>
          </div>
        `;
      }
      if (activeTab === 'staff'){
        return `
          <div class="card mt-16">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
                <tbody>
                  ${staff.map(u => `<tr><td class="cell-strong">${u.full_name}</td><td>${u.email}</td><td>${niaRoleLabel(u.role)}</td><td><span class="badge ${u.active_status?'badge-accepted':'badge-cancelled'}">${u.active_status?'Active':'Inactive'}</span></td><td>${fmtDate(u.created_at)}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state"><p>No staff on record.</p></div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
      if (activeTab === 'patients'){
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
      if (activeTab === 'plans'){
        return `
          <div class="card mt-16">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Plan</th><th>Patient</th><th>Value</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  ${facilityPlans.map(p => `<tr><td class="cell-strong">${p.plan_number}</td><td>${niaPatientName(db,p.patient_id)}</td><td>${fmtKES(p.total_estimated_value)}</td><td><span class="badge ${niaBadgeClass(p.status)}">${p.status}</span></td><td>${fmtDate(p.treatment_plan_date)}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state"><p>No treatment plans on record.</p></div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
      if (activeTab === 'billing'){
        return `
          <div class="stat-grid mt-16">
            <div class="stat-card"><div class="stat-label">Status</div><div class="stat-value" style="font-size:16px;"><span class="badge ${niaBadgeClass(sub.status)}">${niaSubscriptionLabel(sub.status)}</span></div></div>
            <div class="stat-card"><div class="stat-label">Monthly Fee</div><div class="stat-value">${niaFmtUSD(sub.monthly_fee_usd)}</div></div>
            <div class="stat-card"><div class="stat-label">Next Due</div><div class="stat-value" style="font-size:16px;">${fmtDate(sub.next_due_date)}</div></div>
            <div class="stat-card"><div class="stat-label">Days Overdue</div><div class="stat-value">${sub.days_overdue||0}</div></div>
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
                  ${sub.payments.map(p => `<tr><td>${fmtDate(p.paid_at)}</td><td class="cell-strong">${niaFmtUSD(p.amount_usd)}</td><td>${p.method}</td><td class="cell-sub" style="font-family:var(--font-mono);">${p.mpesa_receipt||'—'}</td><td>${p.confirmed_by}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state"><p>No payments recorded.</p></div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    }

    function renderAll(){
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
      if (toggleBtn){
        toggleBtn.addEventListener('click', () => {
          f.active_status = !f.active_status;
          niaSaveDB(db);
          niaToast(`${f.facility_name} marked as ${f.active_status?'active':'discontinued'}.`);
          renderAll();
        });
      }
      const confirmBtn = document.getElementById('dev-confirm-payment-btn');
      if (confirmBtn){
        confirmBtn.addEventListener('click', () => openDevConfirmModal());
      }
    }

    function openDevConfirmModal(){
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
Pages['platform-onboard'] = function(db, user){
  if (user.role !== 'super_admin'){ go('dashboard'); return; }
  niaRenderShell('platform-onboard', user, db);
  niaRenderTopbar('Onboard Facility', 'Add a new dental facility to the NiaCARE platform.');

  const html = `
    <div style="max-width:680px;">
      <div class="card">
        <div class="card-header"><div><h3>Facility Details</h3><div class="hint">Creates the facility record and starts its first billing cycle today</div></div></div>
        <div class="card-pad">
          <div class="form-grid">
            <div class="form-field full"><label>Facility Name <span class="req">*</span></label><input type="text" id="ob-name" placeholder="e.g. NiaCARE — Kisumu Dental Clinic" /></div>
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
    if (!name || !code || !ownerName || !ownerEmail){ niaToast('Please complete all required fields.'); return; }

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
Pages['platform-revenue'] = function(db, user){
  if (user.role !== 'super_admin'){ go('dashboard'); return; }
  niaRenderShell('platform-revenue', user, db);
  niaRenderTopbar('Revenue & Targets', 'Subscription revenue performance across the NiaCARE network.');

  const facilities = db.facilities;
  const allPayments = facilities.flatMap(f => f.subscription.payments.map(p => ({ ...p, facility_id: f.facility_id, facility_name: f.facility_name })));
  const activeFacilities = facilities.filter(f => f.active_status && f.subscription.status !== 'locked');

  const today = new Date(todayISO());

  const months = [];
  for (let i = 5; i >= 0; i--){
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = d.toISOString().slice(0,7);
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    const total = allPayments.filter(p => p.paid_at.slice(0,7) === ym).reduce((s,p)=>s+p.amount_usd,0);
    months.push({ ym, label, total });
  }
  const maxMonthly = Math.max(...months.map(m=>m.total), NIA_SUBSCRIPTION_FEE_USD);

  const perFacility = facilities.map(f => ({
    name: f.facility_name,
    total: f.subscription.payments.reduce((s,p)=>s+p.amount_usd,0),
    count: f.subscription.payments.length,
    status: f.subscription.status,
  })).sort((a,b)=>b.total-a.total);

  const monthlyTarget = activeFacilities.length * NIA_SUBSCRIPTION_FEE_USD;
  const thisMonthRevenue = months[months.length-1].total;
  const targetPct = monthlyTarget ? Math.min(100, Math.round((thisMonthRevenue/monthlyTarget)*100)) : 0;
  const annualTarget = facilities.length * NIA_SUBSCRIPTION_FEE_USD * 12;
  const yearRevenue = allPayments.filter(p => new Date(p.paid_at).getFullYear() === today.getFullYear()).reduce((s,p)=>s+p.amount_usd,0);
  const annualPct = annualTarget ? Math.min(100, Math.round((yearRevenue/annualTarget)*100)) : 0;

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
            <div style="width:100%; max-width:46px; background:linear-gradient(180deg, var(--nia-primary), var(--nia-violet-mid)); border-radius:8px 8px 0 0; height:${Math.max(4, (m.total/maxMonthly)*120)}px;"></div>
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
function showLoginView(){
  document.getElementById('app-shell').style.display = 'none';
  const loginScreen = document.getElementById('login-screen');
  loginScreen.style.display = '';

  const db = niaLoadDB();
  let selectedUserId = db.users.find(u => u.role === 'owner').user_id;

  function roleIcon(role){
    const map = { dentist:'tooth', assistant:'clipboard', front_office:'desk', claims:'shield', admin:'admin', owner:'crown' };
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
          <p class="sub">Sign in to NiaCARE — ${db.facility.facility_name.split('—')[1] ? db.facility.facility_name.split('—')[1].trim() : db.facility.facility_name}.</p>

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

  function renderRoles(){
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

  function updateEmail(){
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
function showDeveloperLoginView(){
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
    if (code !== 'NIA-DEV-2026'){
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
function bindNavLinks(){
  document.querySelectorAll('[data-nav-page]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); go(el.dataset.navPage, {}); });
  });
}

function renderApp(){
  const auth = niaRequireAuth();
  if (!auth) return; // showLoginView already triggered
  const { db, user } = auth;
  const { page, params } = Router.current;

  /* Billing gate — applies to facility staff only. Super Admin always
     bypasses, regardless of any facility's subscription status. */
  if (user.role !== 'super_admin'){
    const status = db.facility.subscription.status;
    if (status === 'locked'){
      const allowedWhenLocked = ['billing'];
      if (!allowedWhenLocked.includes(page) || !['admin','owner'].includes(user.role)){
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
  if (sess){
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = '';
    renderApp();
  } else {
    showLoginView();
  }
}
