// NiaCARE Reports page module.
/* ============================================================
   PAGE: Reports
   ============================================================ */
Pages.reports = function(db, user){
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
  const dentists = scopedUsers.filter(u=>u.role==='dentist');
  const dentistRows = dentists.map(d => {
    const myPlans = scopedPlans.filter(p=>p.dentist_id===d.user_id);
    const value = myPlans.reduce((s,p)=>s+p.total_estimated_value,0);
    const accepted = myPlans.filter(p=>['Accepted','In Progress','Completed'].includes(p.status)).length;
    const completed = myPlans.filter(p=>p.status==='Completed').length;
    return {
      name: d.full_name, generated: myPlans.length, value,
      acceptanceRate: myPlans.length ? Math.round((accepted/myPlans.length)*100) : 0,
      completionRate: myPlans.length ? Math.round((completed/myPlans.length)*100) : 0,
    };
  });

  const frontOffice = scopedUsers.filter(u=>u.role==='front_office');
  const foRows = frontOffice.map(f => {
    const myFollowUps = scopedFollowUps.filter(fu=>fu.conducted_by===f.user_id);
    const reached = myFollowUps.filter(fu=>['Reached','Interested','Will Return'].includes(fu.outcome)).length;
    const recoveredPlans = scopedPlans.filter(p => myFollowUps.some(fu=>fu.treatment_plan_id===p.treatment_plan_id) && ['In Progress','Completed'].includes(p.status));
    const recoveredValue = recoveredPlans.reduce((s,p)=>s+p.total_estimated_value,0);
    return {
      name: f.full_name, contacted: myFollowUps.length,
      contactRate: myFollowUps.length ? Math.round((reached/myFollowUps.length)*100) : 0,
      recoveredValue,
    };
  });

  const assistants = scopedUsers.filter(u=>u.role==='assistant');
  const asstRows = assistants.map(a => {
    const rc = scopedRootCanalCases;
    const bc = scopedBracesCases;
    const activeCases = rc.filter(c=>c.status==='Active').length + bc.filter(c=>c.status==='Active').length;
    const overdueRC = rc.filter(c=>c.status==='Active' && c.next_session_date < todayISO()).length;
    const overdueBC = bc.filter(c=>c.status==='Active' && c.next_review_date < todayISO()).length;
    const rcCompliance = rc.length ? Math.round(((rc.length-overdueRC)/rc.length)*100) : 100;
    const bcCompliance = bc.length ? Math.round(((bc.length-overdueBC)/bc.length)*100) : 100;
    return { name: a.full_name, activeCases, rcCompliance, bcCompliance, overdue: overdueRC+overdueBC };
  });

  const claimsOfficers = scopedUsers.filter(u=>u.role==='claims');
  const claimsRows = claimsOfficers.map(c => {
    const insurancePlans = scopedPlans.filter(p => scopedPatients.find(pt=>pt.patient_id===p.patient_id)?.payment_type.startsWith('Insurance'));
    const pending = insurancePlans.filter(p=>['Shared','Accepted'].includes(p.status)).length;
    const approvedValue = insurancePlans.filter(p=>['In Progress','Completed'].includes(p.status)).reduce((s,p)=>s+p.total_estimated_value,0);
    return { name: c.full_name, pending, approvedValue, turnaround: '2.4 days' };
  });

  function teamTable(title, hint, headers, rows, renderRow){
    return `<div class="card mt-16">
      <div class="card-header"><div><h3>${title}</h3><div class="hint">${hint}</div></div></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(renderRow).join('') || `<tr><td colspan="${headers.length}" style="text-align:center; color:var(--nia-ink-soft); padding:24px;">No data yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
  }

  function rateCard(label, pct, note){
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

    ${teamTable('Dentist Report', 'Treatment plans generated and conversion outcomes', ['Dentist','Plans Generated','Value Generated','Acceptance Rate','Completion Rate'], dentistRows, r => `
      <tr><td class="cell-strong">${r.name}</td><td>${r.generated}</td><td>${fmtKES(r.value)}</td><td>${r.acceptanceRate}%</td><td>${r.completionRate}%</td></tr>
    `)}

    ${teamTable('Front Office Report', 'Patient outreach and recovered treatment value', ['Staff Member','Patients Contacted','Contact Rate','Treatment Value Recovered'], foRows, r => `
      <tr><td class="cell-strong">${r.name}</td><td>${r.contacted}</td><td>${r.contactRate}%</td><td>${fmtKES(r.recoveredValue)}</td></tr>
    `)}

    ${teamTable('Dental Assistant Report', 'Case load and review compliance', ['Staff Member','Active Cases','Root Canal Compliance','Braces Review Compliance','Overdue Sessions'], asstRows, r => `
      <tr><td class="cell-strong">${r.name}</td><td>${r.activeCases}</td><td>${r.rcCompliance}%</td><td>${r.bcCompliance}%</td><td>${r.overdue}</td></tr>
    `)}

    ${teamTable('Claims Report', 'Insurance approvals and authorization tracking', ['Staff Member','Pending Approvals','Approved Value','Avg. Turnaround'], claimsRows, r => `
      <tr><td class="cell-strong">${r.name}</td><td>${r.pending}</td><td>${fmtKES(r.approvedValue)}</td><td>${r.turnaround}</td></tr>
    `)}
  `;
  document.getElementById('content').innerHTML = html;
};


