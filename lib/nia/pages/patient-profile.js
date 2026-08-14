// Source section extracted from the original NiaCARE HTML.
/* ============================================================
   PAGE: Patient Profile
   ============================================================ */
Pages['patient-profile'] = function(db, user, params){
  niaRenderShell('patients', user, db);

  const patientId = params.id;
  const patient = db.patients.find(p => p.patient_id === patientId);

  if (!patient){
    document.getElementById('content').innerHTML = `<div class="empty-state">${niaIcon('empty')}<h4>Patient not found</h4><p>This patient record may have been removed.</p></div>`;
    niaRenderTopbar('Patient Not Found');
    return;
  }

  niaRenderTopbar(`${patient.first_name} ${patient.last_name}`, `${patient.patient_number} · Registered ${fmtDate(patient.created_at)}`);

  const plans = db.plans.filter(p => p.patient_id === patientId);
  const appts = db.appointments.filter(a => a.patient_id === patientId).sort((a,b)=>b.appointment_date.localeCompare(a.appointment_date));
  const followUps = db.followUps.filter(f => f.patient_id === patientId).sort((a,b)=>b.follow_up_date.localeCompare(a.follow_up_date));

  const STAGES = [
    { key:'created', label:'Plan Created' },
    { key:'shared', label:'Plan Shared' },
    { key:'decision', label:'Patient Decision' },
    { key:'scheduled', label:'Appointment Booked' },
    { key:'delivery', label:'Treatment Delivery' },
    { key:'completed', label:'Completed' },
  ];

  function stageIndex(plan){
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

  function journeyHtml(plan){
    const idx = stageIndex(plan);
    const blocked = plan.status === 'Rejected' || plan.status === 'Dropped Off';
    return `<div class="journey">
      ${STAGES.map((s,i) => {
        const done = i < idx;
        const current = i === idx;
        const state = blocked && current ? 'blocked' : (done ? 'done' : (current ? 'current' : ''));
        return `<div class="journey-step">
          ${i>0 ? `<div class="journey-line ${i<=idx?'done':''}"></div>` : ''}
          <div class="journey-node ${state}">
            <div class="journey-dot">${done?niaIcon('check'):i+1}</div>
            <div class="journey-label">${s.label}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  const html = `
    <div style="display:grid; grid-template-columns:300px 1fr; gap:18px;">
      <div class="card card-pad" style="text-align:center;">
        <div class="user-avatar" style="width:72px; height:72px; font-size:24px; margin:0 auto 14px; background:linear-gradient(135deg, var(--nia-primary), var(--nia-violet-mid)); color:var(--nia-white);">${initials(patient.first_name+' '+patient.last_name)}</div>
        <h3 style="font-size:18px;">${patient.first_name} ${patient.last_name}</h3>
        <div class="form-hint">${patient.patient_number}</div>
        <div style="text-align:left; margin-top:18px; display:flex; flex-direction:column; gap:10px;">
          <div class="flex-between"><span class="form-hint">Phone</span><span style="font-weight:600;">${patient.phone_number}</span></div>
          <div class="flex-between"><span class="form-hint">Email</span><span style="font-weight:600; font-size:12px;">${patient.email||'—'}</span></div>
          <div class="flex-between"><span class="form-hint">Date of Birth</span><span style="font-weight:600;">${fmtDate(patient.date_of_birth)}</span></div>
          <div class="flex-between"><span class="form-hint">Gender</span><span style="font-weight:600;">${patient.gender}</span></div>
          <div class="flex-between"><span class="form-hint">Payment Type</span><span style="font-weight:600;">${patient.payment_type}</span></div>
        </div>
        <button class="btn btn-primary btn-block mt-24" id="new-plan-btn">${niaIcon('plus')}New Treatment Plan</button>
      </div>

      <div>
        <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
          <div class="stat-card"><div class="stat-label">Treatment Plans</div><div class="stat-value">${plans.length}</div></div>
          <div class="stat-card"><div class="stat-label">Total Treatment Value</div><div class="stat-value">${fmtKES(plans.reduce((s,p)=>s+p.total_estimated_value,0))}</div></div>
          <div class="stat-card accent-gold"><div class="stat-label">Completed Value</div><div class="stat-value">${fmtKES(plans.filter(p=>p.status==='Completed').reduce((s,p)=>s+p.total_estimated_value,0))}</div></div>
        </div>

        <div class="card mt-16">
          <div class="card-header"><div><h3>Treatment Journeys</h3><div class="hint">Each treatment plan moves through the same seven-stage journey</div></div></div>
          <div class="card-pad" style="display:flex; flex-direction:column; gap:24px;">
            ${plans.length ? plans.map(plan => `
              <div>
                <div class="flex-between mt-8">
                  <div>
                    <span class="cell-strong">${plan.plan_number}</span>
                    <span class="cell-sub" style="margin-left:8px;">${fmtDate(plan.treatment_plan_date)} · Dr. ${niaUserName(db, plan.dentist_id).replace('Dr. ','')}</span>
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
                      ${db.procedures.filter(pr=>pr.treatment_plan_id===plan.treatment_plan_id).map(pr => `
                        <tr>
                          <td class="cell-strong">${pr.procedure_name}</td>
                          <td>${pr.tooth_number||'—'}</td>
                          <td>${fmtKES(pr.estimated_cost)}</td>
                          <td><span class="badge ${niaBadgeClass(pr.status)}">${pr.status}</span></td>
                          <td>${pr.next_session_date?fmtDate(pr.next_session_date):'—'}</td>
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
                  <div><div class="cell-strong" style="font-size:13px;">${fmtDate(a.appointment_date)} · ${a.appointment_time}</div><div class="cell-sub">${niaUserName(db,a.provider_id)}</div></div>
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
                  <div class="flex-between"><span class="cell-strong" style="font-size:13px;">${fmtDate(f.follow_up_date)}</span><span class="badge ${niaBadgeClass(f.outcome==='Declined'?'Rejected':'Shared')}">${f.outcome}</span></div>
                  <div class="cell-sub mt-8">${f.notes||'—'} — ${niaUserName(db,f.conducted_by)}</div>
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


