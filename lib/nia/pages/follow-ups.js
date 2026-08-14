// Source section extracted from the original NiaCARE HTML.
/* ============================================================
   PAGE: Follow-Up Queue
   ============================================================ */
Pages.followups = function(db, user){
  niaRenderShell('followups', user, db);

  const today = todayISO();
  const OUTCOMES = ['Reached','Not Reached','Interested','Will Return','Declined','Wrong Number'];

  /* Build "needs follow-up" triggers per PRD section 12, plus existing logged follow-ups */
  function buildQueue(){
    const triggered = [];
    niaScopedPlans(db).forEach(plan => {
      if (plan.status === 'Accepted'){
        const hasAppt = niaScopedAppointments(db).some(a => a.treatment_plan_id === plan.treatment_plan_id);
        if (!hasAppt && daysBetween(plan.shared_date||plan.treatment_plan_date, today) > 7){
          triggered.push({ patient_id: plan.patient_id, plan, reason: 'No booking within 7 days of acceptance', urgency: 'high' });
        }
      }
      if (plan.status === 'Dropped Off'){
        triggered.push({ patient_id: plan.patient_id, plan, reason: 'No patient activity for 60+ days', urgency: 'high' });
      }
    });
    niaScopedAppointments(db).filter(a => a.status === 'No Show').forEach(a => {
      triggered.push({ patient_id: a.patient_id, plan: db.plans.find(p=>p.treatment_plan_id===a.treatment_plan_id), reason: `Missed appointment on ${fmtDate(a.appointment_date)}`, urgency: 'medium' });
    });
    return triggered;
  }

  niaRenderTopbar('Follow-Up Queue', `Patients requiring outreach to recover treatment value.`);

  let outcomeFilter = 'all';

  function render(){
    const queue = buildQueue();
    const scopedFollowUps = niaScopedFollowUps(db);
    const logged = scopedFollowUps.slice().sort((a,b)=>b.follow_up_date.localeCompare(a.follow_up_date));
    const filteredLogged = outcomeFilter === 'all' ? logged : logged.filter(f=>f.outcome===outcomeFilter);

    const recoverableValue = queue.reduce((s,q)=> s + (q.plan ? q.plan.total_estimated_value : 0), 0);

    const html = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Patients In Queue</div><div class="stat-value">${queue.length}</div></div>
        <div class="stat-card accent-gold"><div class="stat-label">Recoverable Treatment Value</div><div class="stat-value">${fmtKES(recoverableValue)}</div></div>
        <div class="stat-card"><div class="stat-label">Follow-Ups Logged</div><div class="stat-value">${scopedFollowUps.length}</div></div>
        <div class="stat-card"><div class="stat-label">Due Today</div><div class="stat-value">${scopedFollowUps.filter(f=>f.next_follow_up_date===today).length}</div></div>
      </div>

      <div class="section-head mt-24"><div><h2>Needs Follow-Up</h2><p>Automatically triggered by missed appointments, overdue acceptance, or inactivity.</p></div></div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Patient</th><th>Reason</th><th>Treatment Value</th><th>Urgency</th><th></th></tr></thead>
            <tbody>
              ${queue.length ? queue.map(q => `
                <tr>
                  <td><a href="#" class="link-patient" data-patient="${q.patient_id}" style="color:var(--nia-primary); font-weight:600;">${niaPatientName(db,q.patient_id)}</a></td>
                  <td>${q.reason}</td>
                  <td class="cell-strong">${q.plan?fmtKES(q.plan.total_estimated_value):'—'}</td>
                  <td><span class="badge ${q.urgency==='high'?'badge-rejected':'badge-followup'}">${q.urgency==='high'?'High':'Medium'}</span></td>
                  <td class="text-right"><button class="btn btn-gold btn-sm log-followup" data-patient="${q.patient_id}" data-plan="${q.plan?q.plan.treatment_plan_id:''}">${niaIcon('check')}Log Contact</button></td>
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
          ${OUTCOMES.map(o=>`<option value="${o}" ${outcomeFilter===o?'selected':''}>${o}</option>`).join('')}
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
                  <td><a href="#" class="link-patient" data-patient="${f.patient_id}" style="color:var(--nia-primary); font-weight:600;">${niaPatientName(db,f.patient_id)}</a></td>
                  <td>${niaUserName(db,f.conducted_by)}</td>
                  <td><span class="badge ${['Reached','Interested','Will Return'].includes(f.outcome)?'badge-accepted':(f.outcome==='Declined'?'badge-rejected':'badge-draft')}">${f.outcome}</span></td>
                  <td>${f.next_follow_up_date?fmtDate(f.next_follow_up_date):'—'}</td>
                  <td class="cell-sub">${f.notes||'—'}</td>
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

  function openLogModal(patientId, planId){
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Log Follow-Up — ${niaPatientName(db,patientId)}</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full"><label>Outcome <span class="req">*</span></label>
              <select id="fu-outcome">${OUTCOMES.map(o=>`<option value="${o}">${o}</option>`).join('')}</select>
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


