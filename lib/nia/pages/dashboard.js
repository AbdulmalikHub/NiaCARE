// Source section extracted from the original NiaCARE HTML.
/* ============================================================
   PAGE: Dashboard
   ============================================================ */
Pages.dashboard = function(db, user){
  niaRenderShell('dashboard', user, db);
  niaRenderTopbar('Dashboard', `Welcome back, ${user.full_name.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s+/,'').split(' ')[0]} — here's what's happening at ${db.facility.facility_name}.`);

  const stats = niaComputeStats(db);
  const today = todayISO();
  const scopedPlans = niaScopedPlans(db);
  const scopedAppointments = niaScopedAppointments(db);
  const scopedFollowUps = niaScopedFollowUps(db);
  const scopedProcedures = niaScopedProcedures(db);
  const scopedRootCanalCases = niaScopedRootCanalCases(db);
  const scopedBracesCases = niaScopedBracesCases(db);
  const scopedPatients = niaScopedPatients(db);

  function statCard(label, value, sub, accent){
    return `<div class="stat-card ${accent?'accent-'+accent:''}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-foot">${sub}</div>` : ''}
    </div>`;
  }

  function dentistMetrics(userId){
    const myPlans = scopedPlans.filter(p => p.dentist_id === userId);
    const generated = myPlans.length;
    const value = myPlans.reduce((s,p) => s + p.total_estimated_value, 0);
    const acceptedCount = myPlans.filter(p => ['Accepted','In Progress','Completed'].includes(p.status)).length;
    const acceptanceRate = generated ? Math.round((acceptedCount/generated)*100) : 0;
    const completedCount = myPlans.filter(p => p.status === 'Completed').length;
    const completionRate = generated ? Math.round((completedCount/generated)*100) : 0;
    return { generated, value, acceptanceRate, completionRate };
  }

  function frontOfficeMetrics(userId){
    const myFollowUps = scopedFollowUps.filter(f => f.conducted_by === userId);
    const contacted = myFollowUps.length;
    const reached = myFollowUps.filter(f => ['Reached','Interested','Will Return'].includes(f.outcome)).length;
    const contactRate = contacted ? Math.round((reached/contacted)*100) : 0;
    const myBooked = scopedAppointments.filter(a => myFollowUps.some(f => f.patient_id === a.patient_id)).length;
    return { contacted, contactRate, booked: myBooked };
  }

  function assistantMetrics(){
    const activeCases = scopedRootCanalCases.filter(c=>c.status==='Active').length + scopedBracesCases.filter(c=>c.status==='Active').length;
    const rcDue = scopedRootCanalCases.filter(c => c.status==='Active' && c.next_session_date <= todayISO(3)).length;
    const bracesDue = scopedBracesCases.filter(c => c.status==='Active' && c.next_review_date <= todayISO(3)).length;
    const overdue = scopedProcedures.filter(pr => pr.next_session_date && pr.next_session_date < today && pr.status !== 'Completed').length;
    return { activeCases, rcDue, bracesDue, overdue };
  }

  let roleBlockHtml = '';

  if (user.role === 'dentist'){
    const m = dentistMetrics(user.user_id);
    roleBlockHtml = `
      <div class="section-head"><div><h2>My Performance</h2><p>Your treatment plans at ${db.facility.facility_name}.</p></div></div>
      <div class="stat-grid mt-16">
        ${statCard('Plans Generated', m.generated, 'All time')}
        ${statCard('Treatment Value Generated', fmtKES(m.value))}
        ${statCard('Acceptance Rate', m.acceptanceRate+'%', m.acceptanceRate>=60?'<span style="color:var(--nia-success)">●</span> Healthy':'<span style="color:var(--nia-warning)">●</span> Needs attention')}
        ${statCard('Completion Rate', m.completionRate+'%')}
      </div>`;
  } else if (user.role === 'front_office'){
    const m = frontOfficeMetrics(user.user_id);
    roleBlockHtml = `
      <div class="section-head"><div><h2>My Follow-Up Performance</h2><p>Patients you've contacted and recovered.</p></div></div>
      <div class="stat-grid mt-16">
        ${statCard('Patients Contacted', m.contacted)}
        ${statCard('Contact Rate', m.contactRate+'%')}
        ${statCard('Follow-Ups Due Today', stats.followUpsDueToday, `<a href="#" data-nav-page="followups" style="color:var(--nia-primary); font-weight:600;">View queue →</a>`)}
      </div>`;
  } else if (user.role === 'assistant'){
    const m = assistantMetrics();
    roleBlockHtml = `
      <div class="section-head"><div><h2>My Case Load</h2><p>Root canal and braces cases under active monitoring.</p></div></div>
      <div class="stat-grid mt-16">
        ${statCard('Active Cases', m.activeCases)}
        ${statCard('Root Canals Due Soon', m.rcDue, `<a href="#" data-nav-page="rootcanal" style="color:var(--nia-primary); font-weight:600;">View tracker →</a>`)}
        ${statCard('Braces Reviews Due Soon', m.bracesDue, `<a href="#" data-nav-page="braces" style="color:var(--nia-primary); font-weight:600;">View tracker →</a>`)}
        ${statCard('Overdue Sessions', m.overdue, m.overdue>0?'<span style="color:var(--nia-danger)">Needs follow-up</span>':'On track')}
      </div>`;
  } else if (user.role === 'claims'){
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

  const showFacilityWide = ['admin','owner'].includes(user.role);
  const facilityHtml = `
    <div class="section-head mt-24"><div><h2>${showFacilityWide?'Facility Overview':'Facility Snapshot'}</h2><p>${db.facility.facility_name} — overall treatment journey performance.</p></div>
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

  function rateCard(label, pct, note){
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

  const upcomingAppts = scopedAppointments.filter(a => a.status === 'Scheduled').sort((a,b)=>a.appointment_date.localeCompare(b.appointment_date)).slice(0,5);
  const dueFollowUps = scopedFollowUps.filter(f => f.next_follow_up_date && f.next_follow_up_date <= todayISO(3)).sort((a,b)=>(a.next_follow_up_date||'').localeCompare(b.next_follow_up_date||'')).slice(0,5);

  const widgetsHtml = `
    <div class="mt-24" style="display:grid; grid-template-columns:1.3fr 1fr; gap:18px;">
      <div class="card">
        <div class="card-header"><div><h3>Upcoming Appointments</h3><div class="hint">Next scheduled sessions across the facility</div></div><a href="#" data-nav-page="appointments" class="btn btn-ghost btn-sm">View all</a></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Patient</th><th>Procedure</th><th>Provider</th><th>Date & Time</th></tr></thead>
            <tbody>
              ${upcomingAppts.map(a => {
                const proc = db.procedures.find(p=>p.procedure_id===a.procedure_id);
                return `<tr>
                  <td class="cell-strong">${niaPatientName(db,a.patient_id)}</td>
                  <td>${proc?proc.procedure_name:'Consultation'}</td>
                  <td>${niaUserName(db,a.provider_id)}</td>
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
              <div class="avatar-sm">${initials(niaPatientName(db,f.patient_id))}</div>
              <div style="min-width:0; flex:1;">
                <div class="cell-strong" style="font-size:13px;">${niaPatientName(db,f.patient_id)}</div>
                <div class="cell-sub">Due ${fmtDate(f.next_follow_up_date)} · ${niaUserName(db,f.conducted_by)}</div>
              </div>
              <span class="badge ${niaBadgeClass(f.outcome==='Declined'?'Rejected':'Shared')}">${f.outcome}</span>
            </div>
          `).join('') || `<div class="empty-state"><p>No follow-ups due in the next few days.</p></div>`}
        </div>
      </div>
    </div>`;

  function billingReminderHtml(){
    if (!['admin','owner'].includes(user.role)) return '';
    const sub = db.facility.subscription;
    if (sub.status === 'active'){
      const daysLeft = daysBetween(today, sub.next_due_date);
      if (daysLeft > 5) return '';
      return `<div class="card card-pad" style="background:#fff8ec; border-color:#f0d9a8; margin-bottom:20px;">
        <div class="flex-between">
          <div class="flex-gap">${niaIcon('bell','banner-icon')}<div>
            <div style="font-weight:700; font-size:13.5px;">Payment due in ${daysLeft} day${daysLeft===1?'':'s'}</div>
            <div class="form-hint mt-8">${niaFmtUSD(sub.monthly_fee_usd)} due on ${fmtDate(sub.next_due_date)} for ${db.facility.facility_name}.</div>
          </div></div>
          <a href="#" data-nav-page="billing" class="btn btn-ghost btn-sm">Renew Now</a>
        </div>
      </div>`;
    }
    if (sub.status === 'grace'){
      return `<div class="card card-pad" style="background:#fff4f1; border-color:#f0bdb0; margin-bottom:20px;">
        <div class="flex-between">
          <div class="flex-gap">${niaIcon('bell','banner-icon')}<div>
            <div style="font-weight:700; font-size:13.5px; color:var(--nia-danger);">Payment overdue — ${sub.grace_days_remaining} day${sub.grace_days_remaining===1?'':'s'} left before lockout</div>
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


